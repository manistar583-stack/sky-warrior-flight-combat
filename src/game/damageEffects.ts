import * as THREE from 'three';

interface SmokeParticle {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  maxSize: number;
  life: number;
  maxLife: number;
  baseOpacity: number;
  active: boolean;
}

interface SparkParticle {
  mesh: THREE.Line;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class DamageEffectsManager {
  private scene: THREE.Scene;

  // Pooled particles
  private smokePool: SmokeParticle[] = [];
  private sparkPool: SparkParticle[] = [];

  // Geometries and materials
  private smokeGeo: THREE.DodecahedronGeometry;
  private smokeMatHeavy: THREE.MeshBasicMaterial;
  private smokeMatFire: THREE.MeshBasicMaterial;

  private sparkGeo: THREE.BufferGeometry;
  private sparkMat: THREE.LineBasicMaterial;

  // Emission timers
  private smokeEmitTimer: number = 0;
  private sparkEmitTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Volumetric smoke puff geometry
    this.smokeGeo = new THREE.DodecahedronGeometry(1.0, 1);
    this.smokeMatHeavy = new THREE.MeshBasicMaterial({
      color: 0x1f2937, // Dark billowing smoke
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.smokeMatFire = new THREE.MeshBasicMaterial({
      color: 0xf97316, // Fiery orange smoke tongue
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    // Spark streak geometry
    const sparkPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1.2)];
    this.sparkGeo = new THREE.BufferGeometry().setFromPoints(sparkPts);
    this.sparkMat = new THREE.LineBasicMaterial({
      color: 0xfef08a, // Bright incandescent yellow/gold spark
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    // Pre-populate particle pools (60 smoke particles, 40 sparks)
    this.initPools();
  }

  private initPools() {
    for (let i = 0; i < 75; i++) {
      const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMatHeavy.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.smokePool.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        size: 0.8,
        maxSize: 4.8,
        life: 0,
        maxLife: 1.2,
        baseOpacity: 0.8,
        active: false,
      });
    }

    for (let i = 0; i < 45; i++) {
      const line = new THREE.Line(this.sparkGeo, this.sparkMat.clone());
      line.visible = false;
      this.scene.add(line);
      this.sparkPool.push({
        mesh: line,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.28,
        active: false,
      });
    }
  }

  public emitSmoke(origin: THREE.Vector3, jetVelocity: THREE.Vector3, isCritical: boolean) {
    // Find inactive smoke particle
    const p = this.smokePool.find((item) => !item.active);
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.9 + Math.random() * 0.5;
    p.size = 0.7 + Math.random() * 0.4;
    p.maxSize = isCritical ? 5.8 : 4.2;
    p.baseOpacity = isCritical ? 0.88 : 0.72;

    p.position.copy(origin);
    p.mesh.position.copy(p.position);
    p.mesh.scale.set(p.size, p.size, p.size);
    p.mesh.visible = true;

    // Tint material: fiery core intermittently when critical
    const isFire = isCritical && Math.random() < 0.35;
    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(isFire ? 0xf97316 : 0x1e293b);
    mat.opacity = p.baseOpacity;

    // Velocity: trails backwards along jet slipstream + small random puff expansion
    p.velocity.copy(jetVelocity).multiplyScalar(0.15); // Carries some jet momentum
    p.velocity.x += (Math.random() - 0.5) * 4.0;
    p.velocity.y += 1.5 + Math.random() * 3.0; // Thermal lift
    p.velocity.z += (Math.random() - 0.5) * 4.0;
  }

  public emitSparks(origin: THREE.Vector3, jetForward: THREE.Vector3, jetRight: THREE.Vector3) {
    const sparkCount = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < sparkCount; s++) {
      const sp = this.sparkPool.find((item) => !item.active);
      if (!sp) break;

      sp.active = true;
      sp.life = 0;
      sp.maxLife = 0.2 + Math.random() * 0.22;

      sp.position.copy(origin);
      sp.position.x += (Math.random() - 0.5) * 0.3;
      sp.position.y += (Math.random() - 0.5) * 0.3;
      sp.position.z += (Math.random() - 0.5) * 0.3;

      sp.mesh.position.copy(sp.position);
      sp.mesh.visible = true;

      // Burst velocity: sparks fly outward and backwards
      const burstSpeed = 18 + Math.random() * 35;
      const spreadDir = new THREE.Vector3()
        .addScaledVector(jetRight, (Math.random() - 0.5) * 2.2)
        .addScaledVector(jetForward, -1.8 - Math.random()) // Swept back by high speed airflow
        .add(new THREE.Vector3(0, (Math.random() - 0.5) * 1.5, 0))
        .normalize();

      sp.velocity.copy(spreadDir).multiplyScalar(burstSpeed);
      sp.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spreadDir);
    }
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    jetForward: THREE.Vector3,
    jetRight: THREE.Vector3,
    jetUp: THREE.Vector3,
    jetVelocity: THREE.Vector3,
    playerHealth: number
  ) {
    // 1. If player health < 50%, emit dynamic smoke and localized sparks
    if (playerHealth < 50 && playerHealth > 0) {
      const isCritical = playerHealth < 28;

      // Calculate localized damage emitter anchor on the starboard engine nacelle
      // (right behind cockpit and above right engine intake)
      const damageOrigin = playerPos.clone()
        .addScaledVector(jetRight, 0.72)
        .addScaledVector(jetUp, 0.25)
        .addScaledVector(jetForward, -1.8);

      // Emit smoke puffs
      this.smokeEmitTimer -= delta;
      const smokeInterval = isCritical ? 0.035 : 0.065;
      if (this.smokeEmitTimer <= 0) {
        this.smokeEmitTimer = smokeInterval;
        this.emitSmoke(damageOrigin, jetVelocity, isCritical);

        // Secondary damage spot on port wing root if critical
        if (isCritical) {
          const portOrigin = playerPos.clone()
            .addScaledVector(jetRight, -1.6)
            .addScaledVector(jetUp, 0.05)
            .addScaledVector(jetForward, -0.6);
          this.emitSmoke(portOrigin, jetVelocity, true);
        }
      }

      // Emit localized electrical & friction sparks
      this.sparkEmitTimer -= delta;
      const sparkInterval = isCritical ? 0.06 : 0.12;
      if (this.sparkEmitTimer <= 0) {
        this.sparkEmitTimer = sparkInterval;
        this.emitSparks(damageOrigin, jetForward, jetRight);
      }
    }

    // 2. Animate and update active smoke particles
    for (const p of this.smokePool) {
      if (!p.active) continue;

      p.life += delta;
      const progress = p.life / p.maxLife;

      if (progress >= 1.0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Move particle
      p.position.addScaledVector(p.velocity, delta);
      p.mesh.position.copy(p.position);

      // Expand particle size
      const currentScale = THREE.MathUtils.lerp(p.size, p.maxSize, Math.pow(progress, 0.7));
      p.mesh.scale.set(currentScale, currentScale, currentScale);

      // Fade opacity
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = p.baseOpacity * (1.0 - progress);
    }

    // 3. Animate and update active spark particles
    for (const sp of this.sparkPool) {
      if (!sp.active) continue;

      sp.life += delta;
      const progress = sp.life / sp.maxLife;

      if (progress >= 1.0) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }

      // Gravity and deceleration
      sp.velocity.y -= 18 * delta;
      sp.position.addScaledVector(sp.velocity, delta);
      sp.mesh.position.copy(sp.position);

      const mat = sp.mesh.material as THREE.LineBasicMaterial;
      mat.opacity = 1.0 - progress;
    }
  }

  public clearAll() {
    this.smokePool.forEach((p) => {
      p.active = false;
      p.mesh.visible = false;
    });
    this.sparkPool.forEach((sp) => {
      sp.active = false;
      sp.mesh.visible = false;
    });
  }

  public destroy() {
    this.smokePool.forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    });
    this.sparkPool.forEach((sp) => {
      this.scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      (sp.mesh.material as THREE.Material).dispose();
    });
    this.smokePool = [];
    this.sparkPool = [];
  }
}
