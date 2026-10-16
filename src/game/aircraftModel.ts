import * as THREE from 'three';

export interface AircraftMeshPack {
  root: THREE.Group;
  cockpitAnchor: THREE.Object3D;
  afterburners: THREE.Mesh[];
  afterburnerLights: THREE.PointLight[];
  leftWingtip: THREE.Object3D;
  rightWingtip: THREE.Object3D;
  leftMuzzle: THREE.Object3D;
  rightMuzzle: THREE.Object3D;
  leftMissileMount: THREE.Object3D;
  rightMissileMount: THREE.Object3D;
  pilotGroup: THREE.Group;
}

/**
 * Procedural Aircraft Generator inspired by modern air-superiority fighters
 * (F/A-18, F-15, Su-57) built as composite 3-12+ part procedural models.
 */
export function createAircraftModel(isEnemy: boolean = false): AircraftMeshPack {
  const root = new THREE.Group();

  // Color scheme:
  // Player: Air superiority ghost grey with low-vis tactical markings
  // Enemy: Aggressor dark charcoal / splinter camo
  const fuselageColor = isEnemy ? 0x1e242b : 0x75808d;
  const radomeColor = isEnemy ? 0xd0d5dd : 0x4a5568;
  const darkMetalColor = 0x2d3748;
  const exhaustColor = 0x1a202c;

  // Materials
  const fuselageMat = new THREE.MeshStandardMaterial({
    color: fuselageColor,
    metalness: 0.5,
    roughness: 0.42,
  });

  const detailMat = new THREE.MeshStandardMaterial({
    color: darkMetalColor,
    metalness: 0.75,
    roughness: 0.28,
  });

  const radomeMat = new THREE.MeshStandardMaterial({
    color: radomeColor,
    metalness: 0.2,
    roughness: 0.5,
  });

  const exhaustMat = new THREE.MeshStandardMaterial({
    color: exhaustColor,
    metalness: 0.9,
    roughness: 0.2,
  });

  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e3a5f,
    metalness: 0.2,
    roughness: 0.08,
    transmission: 0.85,
    thickness: 0.4,
    ior: 1.52,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  // --- 1. Main Fuselage (Lofted streamlined multi-section) ---
  const fuselageGroup = new THREE.Group();

  // Central body
  const bodyGeo = new THREE.CylinderGeometry(0.75, 0.95, 7.5, 12);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, fuselageMat);
  body.scale.set(1.4, 0.85, 1.0);
  body.castShadow = true;
  body.receiveShadow = true;
  fuselageGroup.add(body);

  // Nose cone / Radome
  const noseGeo = new THREE.ConeGeometry(0.75, 3.2, 12);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, radomeMat);
  nose.position.set(0, -0.05, 5.2);
  nose.scale.set(1.3, 0.75, 1.0);
  nose.castShadow = true;
  fuselageGroup.add(nose);

  // Pitot tube at very tip
  const pitotGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6);
  pitotGeo.rotateX(Math.PI / 2);
  const pitot = new THREE.Mesh(pitotGeo, detailMat);
  pitot.position.set(0, -0.05, 7.2);
  fuselageGroup.add(pitot);

  // Dorsal hump / Avionics spine
  const spineGeo = new THREE.BoxGeometry(0.6, 0.4, 4.2);
  const spine = new THREE.Mesh(spineGeo, fuselageMat);
  spine.position.set(0, 0.52, 0.2);
  fuselageGroup.add(spine);

  root.add(fuselageGroup);

  // --- 2. Cockpit Canopy & Interior Pilot ---
  const canopyGeo = new THREE.SphereGeometry(0.7, 16, 12);
  canopyGeo.scale(0.8, 0.85, 2.6);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.58, 2.3);
  canopy.castShadow = false;
  root.add(canopy);

  // Canopy Frame Arch
  const frameGeo = new THREE.TorusGeometry(0.55, 0.04, 6, 16, Math.PI);
  const frame = new THREE.Mesh(frameGeo, detailMat);
  frame.rotation.y = Math.PI / 2;
  frame.rotation.z = Math.PI;
  frame.position.set(0, 0.55, 2.2);
  root.add(frame);

  // Pilot inside cockpit
  const pilotGroup = new THREE.Group();
  pilotGroup.position.set(0, 0.35, 2.2);

  // Helmet
  const helmetMat = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0x991b1b : 0xe2e8f0,
    roughness: 0.3,
    metalness: 0.4,
  });
  const helmetGeo = new THREE.SphereGeometry(0.24, 12, 10);
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, 0.25, -0.1);
  pilotGroup.add(helmet);

  // Gold / reflective Visor
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.1,
  });
  const visorGeo = new THREE.BoxGeometry(0.26, 0.12, 0.2);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.26, 0.08);
  pilotGroup.add(visor);

  // Flight suit shoulders & seat
  const torsoMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.35), torsoMat);
  pilotGroup.add(torso);

  const seatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.15), seatMat);
  seatBack.position.set(0, 0.25, -0.3);
  pilotGroup.add(seatBack);

  root.add(pilotGroup);

  // Cockpit camera anchor
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0, 0.65, 2.1);
  root.add(cockpitAnchor);

  // HUD Glass for first person cockpit view
  const hudGlassMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.2,
    wireframe: true,
  });
  const hudGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), hudGlassMat);
  hudGlass.position.set(0, 0.72, 2.75);
  root.add(hudGlass);

  // --- 3. Main Wings & Leading Edge Extensions (LEX) ---
  // Left Wing Shape using ShapeGeometry for swept aerodynamic profile
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(4.8, -1.8);
  wingShape.lineTo(4.8, -2.4);
  wingShape.lineTo(0.9, -2.9);
  wingShape.lineTo(0, -2.2);
  wingShape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.03,
  };

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
  wingGeo.rotateX(Math.PI / 2);

  // Left Wing
  const leftWing = new THREE.Mesh(wingGeo, fuselageMat);
  leftWing.position.set(0.6, 0.0, 0.8);
  leftWing.castShadow = true;
  leftWing.receiveShadow = true;
  root.add(leftWing);

  // Right Wing (mirrored)
  const rightWingGeo = wingGeo.clone();
  rightWingGeo.scale(-1, 1, 1);
  const rightWing = new THREE.Mesh(rightWingGeo, fuselageMat);
  rightWing.position.set(-0.6, 0.0, 0.8);
  rightWing.castShadow = true;
  rightWing.receiveShadow = true;
  root.add(rightWing);

  // Leading Edge Chine / Strake
  const strakeGeo = new THREE.BufferGeometry();
  const strakeV = new Float32Array([
    // Left strake triangle
    0.8, 0.1, 1.8,
    0.4, 0.0, 3.8,
    0.8, -0.1, 1.8,
    // Right strake triangle
    -0.8, 0.1, 1.8,
    -0.8, -0.1, 1.8,
    -0.4, 0.0, 3.8,
  ]);
  strakeGeo.setAttribute('position', new THREE.BufferAttribute(strakeV, 3));
  strakeGeo.computeVertexNormals();
  const strakes = new THREE.Mesh(strakeGeo, fuselageMat);
  root.add(strakes);

  // Wingtip Missile Rails & Sidewinder Missiles
  const railGeo = new THREE.BoxGeometry(0.12, 0.08, 2.2);
  const leftRail = new THREE.Mesh(railGeo, detailMat);
  leftRail.position.set(5.35, -0.05, -1.3);
  root.add(leftRail);

  const rightRail = new THREE.Mesh(railGeo, detailMat);
  rightRail.position.set(-5.35, -0.05, -1.3);
  root.add(rightRail);

  // Wingtip Missiles (AIM-9 style)
  const missileGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8);
  missileGeo.rotateX(Math.PI / 2);
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  const leftWingMissile = new THREE.Mesh(missileGeo, missileMat);
  leftWingMissile.position.set(5.35, -0.14, -1.3);
  root.add(leftWingMissile);

  const rightWingMissile = new THREE.Mesh(missileGeo, missileMat);
  rightWingMissile.position.set(-5.35, -0.14, -1.3);
  root.add(rightWingMissile);

  // Anchors for contrails / wingtip vapor
  const leftWingtip = new THREE.Object3D();
  leftWingtip.position.set(5.4, 0, -1.8);
  root.add(leftWingtip);

  const rightWingtip = new THREE.Object3D();
  rightWingtip.position.set(-5.4, 0, -1.8);
  root.add(rightWingtip);

  // --- 4. Twin Canted Vertical Stabilizers (F/A-18 style) ---
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.6, 2.2);
  finShape.lineTo(1.4, 2.1);
  finShape.lineTo(1.8, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  finGeo.rotateY(Math.PI / 2);

  // Left Tail Fin (canted outward by ~18 degrees)
  const leftFin = new THREE.Mesh(finGeo, fuselageMat);
  leftFin.position.set(0.85, 0.4, -2.6);
  leftFin.rotation.z = -0.32;
  leftFin.castShadow = true;
  root.add(leftFin);

  // Right Tail Fin
  const rightFin = new THREE.Mesh(finGeo, fuselageMat);
  rightFin.position.set(-0.85, 0.4, -2.6);
  rightFin.rotation.z = 0.32;
  rightFin.castShadow = true;
  root.add(rightFin);

  // --- 5. Twin Horizontal Stabilizers (Elevons) ---
  const elevonShape = new THREE.Shape();
  elevonShape.moveTo(0, 0);
  elevonShape.lineTo(1.8, -0.6);
  elevonShape.lineTo(1.6, -1.4);
  elevonShape.lineTo(0, -1.2);
  elevonShape.closePath();

  const elevonGeo = new THREE.ExtrudeGeometry(elevonShape, { depth: 0.06, bevelEnabled: false });
  elevonGeo.rotateX(Math.PI / 2);

  const leftElevon = new THREE.Mesh(elevonGeo, fuselageMat);
  leftElevon.position.set(1.0, 0.0, -3.2);
  root.add(leftElevon);

  const rightElevonGeo = elevonGeo.clone();
  rightElevonGeo.scale(-1, 1, 1);
  const rightElevon = new THREE.Mesh(rightElevonGeo, fuselageMat);
  rightElevon.position.set(-1.0, 0.0, -3.2);
  root.add(rightElevon);

  // --- 6. Twin Engine Nacelles & Exhaust Nozzles ---
  const engineGeo = new THREE.CylinderGeometry(0.48, 0.52, 3.8, 12);
  engineGeo.rotateX(Math.PI / 2);

  const leftEngine = new THREE.Mesh(engineGeo, fuselageMat);
  leftEngine.position.set(0.65, -0.05, -2.1);
  root.add(leftEngine);

  const rightEngine = new THREE.Mesh(engineGeo, fuselageMat);
  rightEngine.position.set(-0.65, -0.05, -2.1);
  root.add(rightEngine);

  // Nozzle rings
  const nozzleGeo = new THREE.CylinderGeometry(0.44, 0.48, 0.7, 12, 1, true);
  nozzleGeo.rotateX(Math.PI / 2);
  const leftNozzle = new THREE.Mesh(nozzleGeo, exhaustMat);
  leftNozzle.position.set(0.65, -0.05, -4.1);
  root.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo, exhaustMat);
  rightNozzle.position.set(-0.65, -0.05, -4.1);
  root.add(rightNozzle);

  // --- 7. Dynamic Glowing Afterburner Flame Cones ---
  const flameGeo = new THREE.ConeGeometry(0.38, 2.4, 12);
  flameGeo.rotateX(-Math.PI / 2);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, // Intense cyan/blue/orange afterburner glow
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });

  const leftFlame = new THREE.Mesh(flameGeo, flameMat);
  leftFlame.position.set(0.65, -0.05, -5.3);
  root.add(leftFlame);

  const rightFlame = new THREE.Mesh(flameGeo, flameMat);
  rightFlame.position.set(-0.65, -0.05, -5.3);
  root.add(rightFlame);

  // Dynamic point lights for afterburners
  const leftLight = new THREE.PointLight(0x38bdf8, 2.5, 18);
  leftLight.position.set(0.65, -0.05, -4.5);
  root.add(leftLight);

  const rightLight = new THREE.PointLight(0x38bdf8, 2.5, 18);
  rightLight.position.set(-0.65, -0.05, -4.5);
  root.add(rightLight);

  // --- 8. Gun Muzzles & Hardpoint Weapon Anchors ---
  const leftMuzzle = new THREE.Object3D();
  leftMuzzle.position.set(0.32, 0.15, 4.4);
  root.add(leftMuzzle);

  const rightMuzzle = new THREE.Object3D();
  rightMuzzle.position.set(-0.32, 0.15, 4.4);
  root.add(rightMuzzle);

  const leftMissileMount = new THREE.Object3D();
  leftMissileMount.position.set(2.4, -0.25, 0.0);
  root.add(leftMissileMount);

  const rightMissileMount = new THREE.Object3D();
  rightMissileMount.position.set(-2.4, -0.25, 0.0);
  root.add(rightMissileMount);

  // Cast shadow on all submeshes
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child !== canopy) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    root,
    cockpitAnchor,
    afterburners: [leftFlame, rightFlame],
    afterburnerLights: [leftLight, rightLight],
    leftWingtip,
    rightWingtip,
    leftMuzzle,
    rightMuzzle,
    leftMissileMount,
    rightMissileMount,
    pilotGroup,
  };
}
