import * as THREE from 'three';
import { createAircraftModel, AircraftMeshPack } from './aircraftModel';
import { WeaponSystem } from './weapons';

export interface EnemyJet {
  id: string;
  name: string;
  meshPack: AircraftMeshPack;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  speedKmh: number;
  health: number;
  maxHealth: number;
  state: 'patrol' | 'intercept' | 'evade' | 'attacking';
  stateTimer: number;
  fireCooldown: number;
  missileCooldown: number;
  isDead: boolean;
  smokeTimer: number;
}

export class EnemyAIManager {
  private scene: THREE.Scene;
  private weaponSystem: WeaponSystem;
  public enemies: EnemyJet[] = [];

  constructor(scene: THREE.Scene, weaponSystem: WeaponSystem) {
    this.scene = scene;
    this.weaponSystem = weaponSystem;
  }

  public spawnEnemy(name: string, pos: THREE.Vector3, headingDeg: number = 0): EnemyJet {
    const meshPack = createAircraftModel(true);
    meshPack.root.position.copy(pos);
    meshPack.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (headingDeg * Math.PI) / 180);
    this.scene.add(meshPack.root);

    const enemy: EnemyJet = {
      id: 'enemy_' + Math.random().toString(36).substring(2, 9),
      name,
      meshPack,
      position: pos.clone(),
      quaternion: meshPack.root.quaternion.clone(),
      velocity: new THREE.Vector3(0, 0, 1).applyQuaternion(meshPack.root.quaternion).multiplyScalar(200),
      speedKmh: 680,
      health: 100,
      maxHealth: 100,
      state: 'patrol',
      stateTimer: 0,
      fireCooldown: 1.5,
      missileCooldown: 6.0,
      isDead: false,
      smokeTimer: 0,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    getTerrainHeight: (x: number, z: number) => number,
    onEnemyDestroyed?: (enemy: EnemyJet) => void
  ) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isDead) {
        continue;
      }

      e.stateTimer += delta;
      e.fireCooldown = Math.max(0, e.fireCooldown - delta);
      e.missileCooldown = Math.max(0, e.missileCooldown - delta);

      // Compute vector to player
      const toPlayer = playerPos.clone().sub(e.position);
      const distToPlayer = toPlayer.length();

      // Forward direction of enemy
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(e.quaternion).normalize();
      const dot = forward.dot(toPlayer.clone().normalize());

      // Ground altitude check
      const groundH = getTerrainHeight(e.position.x, e.position.z);
      const altAboveGround = e.position.y - groundH;

      // AI State Decision
      if (altAboveGround < 160) {
        // Terrain avoidance: Pull up immediately!
        const pullUpQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.8 * delta);
        e.quaternion.multiply(pullUpQuat);
      } else if (distToPlayer < 2400) {
        if (dot > 0.85) {
          e.state = 'attacking';
        } else if (dot < -0.3) {
          e.state = 'evade';
        } else {
          e.state = 'intercept';
        }
      } else {
        e.state = 'patrol';
      }

      // Execute AI maneuver based on state
      let targetHeading: THREE.Vector3;
      if (e.state === 'attacking') {
        targetHeading = toPlayer.clone().normalize();
        // Fire machine gun at player if close and centered
        if (distToPlayer < 750 && dot > 0.94 && e.fireCooldown <= 0) {
          const leftMuzzle = new THREE.Vector3();
          const rightMuzzle = new THREE.Vector3();
          e.meshPack.leftMuzzle.getWorldPosition(leftMuzzle);
          e.meshPack.rightMuzzle.getWorldPosition(rightMuzzle);
          this.weaponSystem.fireGuns(leftMuzzle, rightMuzzle, forward, e.speedKmh * 0.277, false);
          e.fireCooldown = 0.12;
        }
      } else if (e.state === 'intercept') {
        targetHeading = toPlayer.clone().normalize();
      } else if (e.state === 'evade') {
        // High-g barrel roll evasive break
        targetHeading = toPlayer.clone().negate().normalize();
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(forward, 2.5 * delta);
        e.quaternion.premultiply(rollQuat);
      } else {
        // Patrol in a wide circle
        const angle = e.stateTimer * 0.2;
        targetHeading = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
      }

      // Smoothly orient enemy towards target direction
      const currentDir = forward.clone();
      const turnSpeed = e.state === 'evade' ? 2.2 : 1.5;
      currentDir.lerp(targetHeading, Math.min(1.0, turnSpeed * delta)).normalize();

      const lookTarget = e.position.clone().add(currentDir.multiplyScalar(100));
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(e.position, lookTarget, new THREE.Vector3(0, 1, 0))
      );
      e.quaternion.slerp(targetQuat, 2.0 * delta);

      // Move forward
      const speedMs = (e.speedKmh * 1000) / 3600;
      e.velocity.copy(forward).multiplyScalar(speedMs);
      e.position.addScaledVector(e.velocity, delta);

      // Prevent crashing into terrain
      if (e.position.y <= groundH + 8) {
        this.destroyEnemy(e, onEnemyDestroyed);
        continue;
      }

      // Update mesh position and rotation
      e.meshPack.root.position.copy(e.position);
      e.meshPack.root.quaternion.copy(e.quaternion);

      // Animate afterburners
      const flameScale = e.state === 'attacking' || e.state === 'evade' ? 1.4 : 0.8;
      e.meshPack.afterburners.forEach((flame) => {
        flame.scale.set(flameScale, flameScale, flameScale + (Math.random() - 0.5) * 0.2);
      });

      // Damage smoke puff if low health
      if (e.health < 50) {
        e.smokeTimer += delta;
        if (e.smokeTimer > 0.08) {
          e.smokeTimer = 0;
          this.weaponSystem.createExplosion(e.position, 0.25);
        }
      }
    }
  }

  public applyDamage(targetObj: THREE.Object3D, amount: number, onEnemyDestroyed?: (enemy: EnemyJet) => void): boolean {
    // Find matching enemy
    for (const e of this.enemies) {
      if (e.isDead) continue;

      let found = false;
      e.meshPack.root.traverse((child) => {
        if (child === targetObj) found = true;
      });

      if (found) {
        e.health -= amount;
        if (e.health <= 0) {
          this.destroyEnemy(e, onEnemyDestroyed);
        }
        return true;
      }
    }
    return false;
  }

  public destroyEnemy(enemy: EnemyJet, onEnemyDestroyed?: (enemy: EnemyJet) => void) {
    if (enemy.isDead) return;
    enemy.isDead = true;
    this.weaponSystem.createExplosion(enemy.position, 2.2);
    this.scene.remove(enemy.meshPack.root);

    if (onEnemyDestroyed) {
      onEnemyDestroyed(enemy);
    }
  }

  public clearAll() {
    this.enemies.forEach((e) => {
      this.scene.remove(e.meshPack.root);
    });
    this.enemies.length = 0;
  }
}
