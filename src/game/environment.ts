import * as THREE from 'three';
import { WeatherType } from './types';
import { soundEngine } from './audio';

export interface CheckpointRing {
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  id: number;
  passed: boolean;
}

export interface EnvironmentPack {
  scene: THREE.Scene;
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  cloudsGroup: THREE.Group;
  checkpointRings: CheckpointRing[];
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  ambientLight: THREE.AmbientLight;
  getTerrainHeight: (x: number, z: number) => number;
  updateClouds: (delta: number) => void;
  updateRings: (delta: number) => void;
  clearRings: () => void;
  createRingsCourse: (points: THREE.Vector3[]) => void;
  // Weather system methods
  currentWeather: WeatherType;
  updateWeather: (delta: number, camPos: THREE.Vector3, jetSpeedMs: number, onCameraShake?: (amt: number) => void) => void;
  setWeather: (weather: WeatherType) => void;
  toggleNextWeather: () => WeatherType;
}

// Procedural multi-octave noise function for realistic terrain
function pseudoNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fy * fy * (3.0 - 2.0 * fy);

  const a = pseudoNoise(i, j);
  const b = pseudoNoise(i + 1, j);
  const c = pseudoNoise(i, j + 1);
  const d = pseudoNoise(i + 1, j + 1);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function sampleTerrainHeight(x: number, z: number): number {
  const nx = x * 0.00035;
  const nz = z * 0.00035;

  let h = 0;
  let freq = 1.0;
  let amp = 1.0;

  for (let o = 0; o < 4; o++) {
    h += smoothNoise(nx * freq + 17.3, nz * freq + 83.1) * amp;
    freq *= 2.1;
    amp *= 0.45;
  }

  const distFromCenter = Math.sqrt(x * x + z * z);
  const islandMask = Math.max(0, 1.0 - Math.pow(distFromCenter / 14000, 2.5));

  const ridge = Math.pow(h, 2.4);
  const elevation = (ridge * 2200 - 320) * islandMask;

  // Flatten airbase island runway plateau around (0, 0)
  const distToAirbase = Math.sqrt((x / 700) * (x / 700) + (z / 1800) * (z / 1800));
  if (distToAirbase < 1.0) {
    const blend = distToAirbase * distToAirbase;
    return 15 * (1 - blend) + Math.max(15, elevation) * blend;
  }

  return Math.max(-100, elevation);
}

export function createEnvironment(scene: THREE.Scene): EnvironmentPack {
  // Fog setup matching cool high-altitude sky
  const fog = new THREE.FogExp2(0x89b6dc, 0.000085);
  scene.fog = fog;

  // --- Lighting Rig ---
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.1);
  hemiLight.position.set(0, 1000, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
  sunLight.position.set(4000, 5000, -3000);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 500;
  sunLight.shadow.camera.far = 18000;
  const d = 1200;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // Ambient fill
  const ambientLight = new THREE.AmbientLight(0x64748b, 0.5);
  scene.add(ambientLight);

  // --- Sky Dome ---
  const skyGeo = new THREE.SphereGeometry(22000, 24, 16);
  skyGeo.scale(-1, 1, 1);

  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 16;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#0f2942');
  skyGrad.addColorStop(0.35, '#1e5285');
  skyGrad.addColorStop(0.75, '#78a6d4');
  skyGrad.addColorStop(1.0, '#a5cbe8');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 16, 256);

  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  // --- Vast Procedural Terrain Mesh ---
  const terrainSize = 28000;
  const segments = 128;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = sampleTerrainHeight(vx, vz);
    posAttr.setY(i, vy);

    if (vy < 15) {
      colors.push(0.35, 0.4, 0.35);
    } else if (vy < 400) {
      colors.push(0.22, 0.32, 0.2);
    } else if (vy < 1100) {
      colors.push(0.35, 0.35, 0.38);
    } else {
      const snowBlend = Math.min(1.0, (vy - 1100) / 400);
      const r = 0.4 + snowBlend * 0.58;
      const g = 0.42 + snowBlend * 0.56;
      const b = 0.45 + snowBlend * 0.55;
      colors.push(r, g, b);
    }
  }

  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: true,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  scene.add(terrainMesh);

  // --- Water Ocean Surface ---
  const waterGeo = new THREE.PlaneGeometry(32000, 32000, 32, 32);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x144a74,
    roughness: 0.12,
    metalness: 0.85,
    transparent: true,
    opacity: 0.9,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 5;
  scene.add(waterMesh);

  // --- Military Airbase Runway on Island Plateau ---
  const airbaseGroup = new THREE.Group();
  airbaseGroup.position.set(0, 18, 0);

  const runwayGeo = new THREE.BoxGeometry(160, 4, 2200);
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const runway = new THREE.Mesh(runwayGeo, runwayMat);
  airbaseGroup.add(runway);

  const centerLineGeo = new THREE.PlaneGeometry(6, 1800);
  centerLineGeo.rotateX(-Math.PI / 2);
  const centerLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, polygonOffset: true, polygonOffsetFactor: -1 });
  const centerLine = new THREE.Mesh(centerLineGeo, centerLineMat);
  centerLine.position.y = 2.1;
  airbaseGroup.add(centerLine);

  const lightGeo = new THREE.SphereGeometry(1.2, 8, 8);
  const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const amberLightMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

  for (let z = -1000; z <= 1000; z += 100) {
    const leftLight = new THREE.Mesh(lightGeo, z < 0 ? greenLightMat : amberLightMat);
    leftLight.position.set(-85, 2.5, z);
    airbaseGroup.add(leftLight);

    const rightLight = new THREE.Mesh(lightGeo, z < 0 ? greenLightMat : amberLightMat);
    rightLight.position.set(85, 2.5, z);
    airbaseGroup.add(rightLight);
  }

  scene.add(airbaseGroup);

  // --- Volumetric 3D Cumulus Clouds ---
  const cloudsGroup = new THREE.Group();
  const puffGeo = new THREE.DodecahedronGeometry(180, 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.95,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88,
    flatShading: true,
  });

  const cloudClusters = 28;
  for (let c = 0; c < cloudClusters; c++) {
    const cluster = new THREE.Group();
    const cx = (Math.random() - 0.5) * 16000;
    const cz = (Math.random() - 0.5) * 16000;
    const cy = 1400 + Math.random() * 2600;
    cluster.position.set(cx, cy, cz);

    const puffsInCluster = 5 + Math.floor(Math.random() * 5);
    for (let p = 0; p < puffsInCluster; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      const px = (Math.random() - 0.5) * 600;
      const py = (Math.random() - 0.5) * 180;
      const pz = (Math.random() - 0.5) * 600;
      puff.position.set(px, py, pz);
      const sc = 0.8 + Math.random() * 1.5;
      puff.scale.set(sc * 1.4, sc * 0.7, sc * 1.4);
      puff.castShadow = true;
      cluster.add(puff);
    }
    cloudsGroup.add(cluster);
  }
  scene.add(cloudsGroup);

  // --- Rain Particle System for Thunderstorms ---
  const rainCount = 1800;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 6); // 2 vertices per line streak

  const rainSpread = 280;
  const rainHeight = 220;

  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * rainSpread;
    const ry = (Math.random() - 0.5) * rainHeight;
    const rz = (Math.random() - 0.5) * rainSpread;

    const streakLen = 4.5 + Math.random() * 3.5;

    // Start point
    rainPositions[i * 6 + 0] = rx;
    rainPositions[i * 6 + 1] = ry;
    rainPositions[i * 6 + 2] = rz;

    // End point trailing backwards/upwards
    rainPositions[i * 6 + 3] = rx;
    rainPositions[i * 6 + 4] = ry + streakLen;
    rainPositions[i * 6 + 5] = rz;
  }

  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0, // starts invisible until thunderstorm
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  scene.add(rainLines);

  // --- Procedural Lightning Bolt Mesh ---
  const lightningGroup = new THREE.Group();
  const lightningMat = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    linewidth: 3,
    transparent: true,
    opacity: 0,
  });

  const createLightningBranch = (start: THREE.Vector3, end: THREE.Vector3, pointsArr: THREE.Vector3[]) => {
    pointsArr.push(start.clone());
    let current = start.clone();
    const segments = 12;
    for (let s = 1; s < segments; s++) {
      const frac = s / segments;
      const target = start.clone().lerp(end, frac);
      target.x += (Math.random() - 0.5) * 120;
      target.z += (Math.random() - 0.5) * 120;
      target.y += (Math.random() - 0.5) * 40;
      pointsArr.push(target);
      current = target;
    }
    pointsArr.push(end.clone());
  };

  const initialLightningPoints: THREE.Vector3[] = [];
  createLightningBranch(new THREE.Vector3(0, 3500, 0), new THREE.Vector3(200, 400, 200), initialLightningPoints);
  const lightningGeo = new THREE.BufferGeometry().setFromPoints(initialLightningPoints);
  const lightningLine = new THREE.Line(lightningGeo, lightningMat);
  lightningGroup.add(lightningLine);
  scene.add(lightningGroup);

  // --- Dynamic Weather State & Transition Engine ---
  let currentWeather: WeatherType = 'clear';
  let targetWeather: WeatherType = 'clear';
  let weatherAutoTimer: number = 45; // Auto toggle every 45-75 seconds

  // Lighting & fog target values
  const weatherConfigs = {
    clear: {
      fogColor: new THREE.Color(0x89b6dc),
      fogDensity: 0.000085,
      sunColor: new THREE.Color(0xfff7ed),
      sunIntensity: 2.4,
      hemiSkyColor: new THREE.Color(0xdbeafe),
      hemiGroundColor: new THREE.Color(0x334155),
      hemiIntensity: 1.1,
      ambientIntensity: 0.5,
      cloudColor: new THREE.Color(0xf1f5f9),
      rainOpacity: 0.0,
    },
    fog: {
      fogColor: new THREE.Color(0x94a3b8), // Dense misty grey
      fogDensity: 0.00042, // High density obscures mountains
      sunColor: new THREE.Color(0xd8e2ec),
      sunIntensity: 0.95,
      hemiSkyColor: new THREE.Color(0xb0bec5),
      hemiGroundColor: new THREE.Color(0x37474f),
      hemiIntensity: 0.75,
      ambientIntensity: 0.65,
      cloudColor: new THREE.Color(0xd1d5db),
      rainOpacity: 0.0,
    },
    thunderstorm: {
      fogColor: new THREE.Color(0x1e293b), // Dark brooding stormy slate
      fogDensity: 0.00028,
      sunColor: new THREE.Color(0x64748b),
      sunIntensity: 0.45,
      hemiSkyColor: new THREE.Color(0x334155),
      hemiGroundColor: new THREE.Color(0x0f172a),
      hemiIntensity: 0.4,
      ambientIntensity: 0.35,
      cloudColor: new THREE.Color(0x475569), // Dark stormy anvil clouds
      rainOpacity: 0.75,
    },
  };

  // Lightning timing
  let lightningTimer = 6.0;
  let flashTimer = 0;
  let isFlashing = false;

  const setWeather = (weather: WeatherType) => {
    targetWeather = weather;
    currentWeather = weather;
  };

  const toggleNextWeather = (): WeatherType => {
    const list: WeatherType[] = ['clear', 'fog', 'thunderstorm'];
    const nextIdx = (list.indexOf(targetWeather) + 1) % list.length;
    const next = list[nextIdx];
    setWeather(next);
    return next;
  };

  const updateWeather = (
    delta: number,
    camPos: THREE.Vector3,
    jetSpeedMs: number,
    onCameraShake?: (amt: number) => void
  ) => {
    // 1. Automatic weather change timer
    weatherAutoTimer -= delta;
    if (weatherAutoTimer <= 0) {
      weatherAutoTimer = 50 + Math.random() * 30; // 50 to 80 seconds
      // Pick random different weather
      const options: WeatherType[] = ['clear', 'fog', 'thunderstorm'];
      const nextOptions = options.filter((w) => w !== targetWeather);
      const chosen = nextOptions[Math.floor(Math.random() * nextOptions.length)];
      setWeather(chosen);
    }

    // 2. Smooth exponential transition of atmospheric parameters
    const cfg = weatherConfigs[targetWeather];
    const lerpRate = 1.8 * delta;

    // Fog
    fog.color.lerp(cfg.fogColor, lerpRate);
    fog.density = THREE.MathUtils.damp(fog.density, cfg.fogDensity, 2.0, delta);

    // Sun light
    sunLight.color.lerp(cfg.sunColor, lerpRate);
    sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, cfg.sunIntensity, 2.0, delta);

    // Hemisphere light
    hemiLight.color.lerp(cfg.hemiSkyColor, lerpRate);
    hemiLight.groundColor.lerp(cfg.hemiGroundColor, lerpRate);
    hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, cfg.hemiIntensity, 2.0, delta);

    // Ambient light
    ambientLight.intensity = THREE.MathUtils.damp(ambientLight.intensity, cfg.ambientIntensity, 2.0, delta);

    // Cloud material tint
    cloudMat.color.lerp(cfg.cloudColor, lerpRate);

    // Rain material opacity
    rainMat.opacity = THREE.MathUtils.damp(rainMat.opacity, cfg.rainOpacity, 2.5, delta);

    // 3. Update Rain Particle System during Thunderstorms
    if (rainMat.opacity > 0.02) {
      rainLines.position.copy(camPos);

      const positions = rainGeo.attributes.position.array as Float32Array;
      const fallSpeed = (65 + jetSpeedMs * 0.4) * delta;

      for (let i = 0; i < rainCount; i++) {
        // Drop Y downwards
        positions[i * 6 + 1] -= fallSpeed;
        positions[i * 6 + 4] -= fallSpeed;

        // Wrap around bounding box
        if (positions[i * 6 + 1] < -rainHeight / 2) {
          const resetY = rainHeight / 2 + Math.random() * 20;
          const streakLen = 4.5 + Math.random() * 4.0;
          positions[i * 6 + 1] = resetY;
          positions[i * 6 + 4] = resetY + streakLen;

          positions[i * 6 + 0] = (Math.random() - 0.5) * rainSpread;
          positions[i * 6 + 3] = positions[i * 6 + 0];

          positions[i * 6 + 2] = (Math.random() - 0.5) * rainSpread;
          positions[i * 6 + 5] = positions[i * 6 + 2];
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // 4. Lightning Strikes during Thunderstorm
    if (targetWeather === 'thunderstorm') {
      lightningTimer -= delta;

      if (lightningTimer <= 0 && !isFlashing) {
        // Trigger lightning flash!
        isFlashing = true;
        flashTimer = 0.16; // 160ms flash duration
        lightningTimer = 5 + Math.random() * 8; // Next lightning in 5-13 seconds

        // Position lightning bolt nearby in distance
        const angle = Math.random() * Math.PI * 2;
        const dist = 1400 + Math.random() * 2200;
        const lx = camPos.x + Math.sin(angle) * dist;
        const lz = camPos.z + Math.cos(angle) * dist;
        const lyTop = camPos.y + 1200 + Math.random() * 1000;
        const lyBot = Math.max(10, sampleTerrainHeight(lx, lz));

        const pts: THREE.Vector3[] = [];
        createLightningBranch(new THREE.Vector3(lx, lyTop, lz), new THREE.Vector3(lx + (Math.random() - 0.5) * 300, lyBot, lz + (Math.random() - 0.5) * 300), pts);
        lightningGeo.setFromPoints(pts);

        // Flash lights
        sunLight.intensity = 5.2;
        hemiLight.intensity = 3.8;
        ambientLight.intensity = 2.4;
        lightningMat.opacity = 1.0;

        // Play procedural thunder sound effect!
        soundEngine.playThunder();

        // Impulse camera shake
        if (onCameraShake) {
          onCameraShake(0.7);
        }
      }

      if (isFlashing) {
        flashTimer -= delta;
        if (flashTimer <= 0) {
          isFlashing = false;
          lightningMat.opacity = 0;
        } else {
          // Secondary flicker
          const flicker = Math.sin(flashTimer * 60) > 0 ? 1.0 : 0.4;
          lightningMat.opacity = flicker;
        }
      }
    } else {
      lightningMat.opacity = 0;
      isFlashing = false;
    }
  };

  // --- Checkpoint Rings Collection ---
  const checkpointRings: CheckpointRing[] = [];
  const ringsContainer = new THREE.Group();
  scene.add(ringsContainer);

  const clearRings = () => {
    while (ringsContainer.children.length > 0) {
      const child = ringsContainer.children[0];
      ringsContainer.remove(child);
    }
    checkpointRings.length = 0;
  };

  const createRingsCourse = (points: THREE.Vector3[]) => {
    clearRings();

    const ringGeo = new THREE.TorusGeometry(32, 2.2, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.85,
    });

    const innerPulseGeo = new THREE.TorusGeometry(30, 0.8, 8, 24);
    const innerPulseMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });

    points.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      if (idx < points.length - 1) {
        group.lookAt(points[idx + 1]);
      } else {
        group.lookAt(pos.clone().add(new THREE.Vector3(0, 0, 100)));
      }

      const mainRing = new THREE.Mesh(ringGeo, ringMat.clone());
      const pulseRing = new THREE.Mesh(innerPulseGeo, innerPulseMat.clone());
      group.add(mainRing);
      group.add(pulseRing);

      const ringMarker: CheckpointRing = {
        mesh: group,
        position: pos.clone(),
        radius: 36,
        id: idx + 1,
        passed: false,
      };

      checkpointRings.push(ringMarker);
      ringsContainer.add(group);
    });
  };

  const updateClouds = (delta: number) => {
    cloudsGroup.children.forEach((c) => {
      c.position.x += 12 * delta;
      if (c.position.x > 9000) {
        c.position.x = -9000;
      }
    });
  };

  const updateRings = (delta: number) => {
    checkpointRings.forEach((ring) => {
      if (!ring.passed) {
        ring.mesh.children[1].rotation.z += 1.8 * delta;
      }
    });
  };

  return {
    scene,
    terrainMesh,
    waterMesh,
    cloudsGroup,
    checkpointRings,
    sunLight,
    hemiLight,
    ambientLight,
    getTerrainHeight: sampleTerrainHeight,
    updateClouds,
    updateRings,
    clearRings,
    createRingsCourse,
    currentWeather,
    updateWeather,
    setWeather,
    toggleNextWeather,
  };
}
