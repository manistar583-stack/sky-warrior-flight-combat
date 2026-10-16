import * as THREE from 'three';
import { soundEngine } from './audio';

export interface Bullet {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  isPlayer: boolean;
}

export interface Missile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Group;
  target: THREE.Object3D | null;
  targetPos: THREE.Vector3 | null;
  life: number;
  maxLife: number;
  isPlayer: boolean;
}

export interface ExplosionParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  color: THREE.Color;
  life: number;
  maxLife: number;
}

export interface Flare {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class WeaponSystem {
  private scene: THREE.Scene;
  public bullets: Bullet[] = [];
  public missiles: Missile[] = [];
  public flares: Flare[] = [];
  public explosions: ExplosionParticle[] = [];

  // Reusable geometries and materials to avoid GC
  private bulletGeo: THREE.CylinderGeometry;
  private playerBulletMat: THREE.MeshBasicMaterial;
  private enemyBulletMat: THREE.MeshBasicMaterial;

  private missileGeo: THREE.CylinderGeometry;
  private missileFinGeo: THREE.BoxGeometry;
  private missileBodyMat: THREE.MeshStandardMaterial;
  private missileExhaustMat: THREE.MeshBasicMaterial;

  private flareGeo: THREE.SphereGeometry;
  private flareMat: THREE.MeshBasicMaterial;

  // Camera shake state
  public cameraShakeAmount: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Bullet tracer mesh setup
    this.bulletGeo = new THREE.CylinderGeometry(0.18, 0.18, 5.0, 6);
    this.bulletGeo.rotateX(Math.PI / 2);
    this.playerBulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // High tech cyan tracer
    this.enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Hostile red tracer

    // Missile model components
    this.missileGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.8, 8);
    this.missileGeo.rotateX(Math.PI / 2);
    this.missileFinGeo = new THREE.BoxGeometry(0.8, 0.05, 0.4);
    this.missileBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    this.missileExhaustMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    // Flare
    this.flareGeo = new THREE.SphereGeometry(0.6, 6, 6);
    this.flareMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
  }

  public fireGuns(originLeft: THREE.Vector3, originRight: THREE.Vector3, forward: THREE.Vector3, jetSpeedMs: number, isPlayer: boolean) {
    soundEngine.playGunShot();
    this.cameraShakeAmount = Math.min(0.6, this.cameraShakeAmount + 0.05);

    const muzzleSpeed = 1600; // m/s tracer velocity
    const origins = [originLeft, originRight];

    origins.forEach((pos) => {
      const mesh = new THREE.Mesh(this.bulletGeo, isPlayer ? this.playerBulletMat : this.enemyBulletMat);
      mesh.position.copy(pos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      this.scene.add(mesh);

      // Slight bullet dispersion for realistic Gatling cannon cone
      const spread = 0.008;
      const vel = forward.clone().multiplyScalar(muzzleSpeed + jetSpeedMs);
      vel.x += (Math.random() - 0.5) * muzzleSpeed * spread;
      vel.y += (Math.random() - 0.5) * muzzleSpeed * spread;
      vel.z += (Math.random() - 0.5) * muzzleSpeed * spread;

      this.bullets.push({
        position: pos.clone(),
        velocity: vel,
        mesh,
        life: 0,
        maxLife: 1.8,
        isPlayer,
      });
    });
  }

  public fireMissile(origin: THREE.Vector3, forward: THREE.Vector3, target: THREE.Object3D | null, isPlayer: boolean): boolean {
    soundEngine.playMissileLaunch();
    this.cameraShakeAmount = Math.min(1.0, this.cameraShakeAmount + 0.15);

    const missileGroup = new THREE.Group();
    const body = new THREE.Mesh(this.missileGeo, this.missileBodyMat);
    const fins1 = new THREE.Mesh(this.missileFinGeo, this.missileBodyMat);
    fins1.position.z = -0.9;
    const fins2 = fins1.clone();
    fins2.rotation.z = Math.PI / 2;

    const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 6), this.missileExhaustMat);
    exhaust.rotateX(-Math.PI / 2);
    exhaust.position.z = -1.8;

    missileGroup.add(body);
    missileGroup.add(fins1);
    missileGroup.add(fins2);
    missileGroup.add(exhaust);

    missileGroup.position.copy(origin);
    missileGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
    this.scene.add(missileGroup);

    const initialSpeed = 350;
    const velocity = forward.clone().multiplyScalar(initialSpeed);

    this.missiles.push({
      position: origin.clone(),
      velocity,
      mesh: missileGroup,
      target,
      targetPos: target ? target.position.clone() : null,
      life: 0,
      maxLife: 6.5,
      isPlayer,
    });

    return true;
  }

  public deployFlares(pos: THREE.Vector3, right: THREE.Vector3) {
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(this.flareGeo, this.flareMat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const side = (i % 2 === 0 ? 1 : -1) * (15 + Math.random() * 20);
      const vel = new THREE.Vector3(
        right.x * side + (Math.random() - 0.5) * 10,
        -15 + (Math.random() - 0.5) * 8,
        right.z * side + (Math.random() - 0.5) * 10
      );

      this.flares.push({
        position: pos.clone(),
        velocity: vel,
        mesh,
        life: 0,
        maxLife: 2.2,
      });
    }
  }

  public createExplosion(pos: THREE.Vector3, scale: number = 1.0) {
    soundEngine.playExplosion();
    this.cameraShakeAmount = Math.min(2.0, this.cameraShakeAmount + 0.45 * scale);

    // Create 35 dynamic fireball particles
    const pCount = Math.floor(35 * scale);
    for (let i = 0; i < pCount; i++) {
      const pMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.4 * scale, 0),
        new THREE.MeshBasicMaterial({
          color: Math.random() > 0.4 ? 0xf97316 : 0xfacc15,
          transparent: true,
          opacity: 0.9,
        })
      );
      pMesh.position.copy(pos);
      this.scene.add(pMesh);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = (25 + Math.random() * 65) * scale;
      const vel = new THREE.Vector3(
        Math.cos(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * speed,
        Math.cos(phi) * Math.sin(theta) * speed
      );

      const bulletPart: Bullet = {
        position: pos.clone(),
        velocity: vel,
        mesh: pMesh as unknown as THREE.Mesh,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.5,
        isPlayer: false,
      };
      this.bullets.push(bulletPart);
    }
  }

  public update(
    delta: number,
    getTerrainHeight: (x: number, z: number) => number,
    onHitTarget?: (target: THREE.Object3D, damage: number, isPlayerWeapon: boolean) => void
  ) {
    // Damping camera shake
    this.cameraShakeAmount = THREE.MathUtils.damp(this.cameraShakeAmount, 0, 4.5, delta);

    // 1. Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life += delta;

      if (b.life >= b.maxLife) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.bullets.splice(i, 1);
        continue;
      }

      b.position.addScaledVector(b.velocity, delta);
      b.mesh.position.copy(b.position);

      // Check ground collision
      const groundY = getTerrainHeight(b.position.x, b.position.z);
      if (b.position.y <= groundY + 2) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.bullets.splice(i, 1);
        continue;
      }
    }

    // 2. Update Missiles with Proportional Navigation Tracking
    const missileMaxSpeed = 920; // Mach 2.7+ in m/s
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life += delta;

      if (m.life >= m.maxLife) {
        this.createExplosion(m.position, 0.8);
        this.scene.remove(m.mesh);
        this.missiles.splice(i, 1);
        continue;
      }

      // Accelerate missile
      const currentSpeed = m.velocity.length();
      const newSpeed = Math.min(missileMaxSpeed, currentSpeed + delta * 500);

      if (m.target && m.target.parent) {
        // Track target with homing turn rate
        const targetWorldPos = new THREE.Vector3();
        m.target.getWorldPosition(targetWorldPos);

        const toTarget = targetWorldPos.clone().sub(m.position);
        const dist = toTarget.length();

        // Proximity detonation check (< 12 meters)
        if (dist < 12) {
          if (onHitTarget) {
            onHitTarget(m.target, 85, m.isPlayer);
          }
          this.createExplosion(m.position, 1.4);
          this.scene.remove(m.mesh);
          this.missiles.splice(i, 1);
          continue;
        }

        toTarget.normalize();
        const currentDir = m.velocity.clone().normalize();
        const homingAgility = THREE.MathUtils.clamp(2.4 * delta, 0, 0.15);
        currentDir.lerp(toTarget, homingAgility).normalize();

        m.velocity.copy(currentDir).multiplyScalar(newSpeed);
      } else {
        // Fly forward along current vector
        m.velocity.normalize().multiplyScalar(newSpeed);
      }

      m.position.addScaledVector(m.velocity, delta);
      m.mesh.position.copy(m.position);
      m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), m.velocity.clone().normalize());

      // Ground collision
      const groundH = getTerrainHeight(m.position.x, m.position.z);
      if (m.position.y <= groundH + 4) {
        this.createExplosion(m.position, 1.0);
        this.scene.remove(m.mesh);
        this.missiles.splice(i, 1);
        continue;
      }
    }

    // 3. Update Flares
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.life += delta;
      if (f.life >= f.maxLife) {
        this.scene.remove(f.mesh);
        this.flares.splice(i, 1);
        continue;
      }
      f.velocity.y -= 9.8 * delta;
      f.position.addScaledVector(f.velocity, delta);
      f.mesh.position.copy(f.position);
    }
  }

  public clearAll() {
    this.bullets.forEach((b) => this.scene.remove(b.mesh));
    this.bullets.length = 0;
    this.missiles.forEach((m) => this.scene.remove(m.mesh));
    this.missiles.length = 0;
    this.flares.forEach((f) => this.scene.remove(f.mesh));
    this.flares.length = 0;
  }
}
