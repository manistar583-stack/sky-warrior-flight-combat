import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createAircraftModel, AircraftMeshPack } from './aircraftModel';
import { createEnvironment, EnvironmentPack } from './environment';
import { FlightPhysics } from './flightPhysics';
import { WeaponSystem } from './weapons';
import { EnemyAIManager, EnemyJet } from './enemyAI';
import { FlightCameraController } from './cameraController';
import { soundEngine } from './audio';
import { DamageEffectsManager } from './damageEffects';
import { FlightInputs, FlightTelemetry, GameState, MissionDef, RadarContact, WeatherType } from './types';
import { MISSIONS, getCheckpointCourseForMission, saveMissionScore } from './missions';

export class SkyWarriorGameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraController: FlightCameraController;

  private envPack: EnvironmentPack;
  private playerModel: AircraftMeshPack;
  private physics: FlightPhysics;
  private weaponSystem: WeaponSystem;
  private enemyManager: EnemyAIManager;
  private damageEffects: DamageEffectsManager;

  private animFrameId: number | null = null;
  private clock: THREE.Clock = new THREE.Clock();

  // State
  public gameState: GameState = 'menu';
  public currentMission: MissionDef = MISSIONS[0];
  private score: number = 0;
  private playerHealth: number = 100;
  private readonly MAX_HEALTH: number = 100;
  private missilesRemaining: number = 8;
  private flaresRemaining: number = 4;
  private elapsedTime: number = 0;
  private missionTimer: number = 150;
  private currentCheckpointIdx: number = 0;
  private spawnGracePeriod: number = 3.5;

  // Kill Cam
  private killCamDuration: number = 2.4;
  private killCamTimer: number = 0;
  private killCamTargetPos: THREE.Vector3 = new THREE.Vector3();
  private killCamTargetName: string = '';

  // Targeting
  private lockedEnemy: EnemyJet | null = null;
  private lockTimer: number = 0;
  private isHardLocked: boolean = false;

  // Inputs
  public inputs: FlightInputs = {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    yawLeft: false,
    yawRight: false,
    boost: false,
    brake: false,
    fireGuns: false,
    fireMissile: false,
    deployFlare: false,
    switchCam: false,
    restart: false,
    pause: false,
  };

  private gunFireCooldown: number = 0;
  private missileFireCooldown: number = 0;

  // Telemetry callback to notify React HUD without re-rendering canvas
  private onTelemetryUpdate?: (data: FlightTelemetry, contacts: RadarContact[]) => void;
  private onStateChange?: (state: GameState, result?: { score: number; time: number; won: boolean }) => void;

  constructor(
    container: HTMLElement,
    onTelemetry?: (data: FlightTelemetry, contacts: RadarContact[]) => void,
    onStateChange?: (state: GameState, result?: { score: number; time: number; won: boolean }) => void
  ) {
    this.container = container;
    this.onTelemetryUpdate = onTelemetry;
    this.onStateChange = onStateChange;

    // 1. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Environment Map (Studio Reflections as required by Three.js skill)
    this.scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera Controller
    this.cameraController = new FlightCameraController();

    // 4. Procedural Environment & Terrain
    this.envPack = createEnvironment(this.scene);

    // 5. Player Jet Model
    this.playerModel = createAircraftModel(false);
    this.scene.add(this.playerModel.root);

    // 6. Flight Physics
    this.physics = new FlightPhysics(new THREE.Vector3(0, 350, -400), 0);

    // 7. Weapons & Particles
    this.weaponSystem = new WeaponSystem(this.scene);

    // 8. Enemy AI Manager
    this.enemyManager = new EnemyAIManager(this.scene, this.weaponSystem);

    // 9. Damage Particle System (Dynamic smoke & localized sparks)
    this.damageEffects = new DamageEffectsManager(this.scene);

    // Bind resize
    window.addEventListener('resize', this.onWindowResize);

    // Start game loop
    this.startLoop();
  }

  public setMission(mission: MissionDef) {
    this.currentMission = mission;
    this.score = 0;
    this.playerHealth = 100;
    this.missilesRemaining = mission.id === 'm1_training' ? 4 : 8;
    this.flaresRemaining = 4;
    this.elapsedTime = 0;
    this.missionTimer = mission.timeLimit ?? 180;
    this.currentCheckpointIdx = 0;
    this.spawnGracePeriod = 3.5;
    this.killCamTimer = 0;
    this.lockedEnemy = null;
    this.lockTimer = 0;
    this.isHardLocked = false;

    // Reset weapons, enemies, and damage effects
    this.weaponSystem.clearAll();
    this.enemyManager.clearAll();
    this.damageEffects.clearAll();
    this.envPack.clearRings();

    // Position aircraft safely above terrain
    if (mission.id === 'm1_training') {
      this.physics.reset(new THREE.Vector3(0, 250, -400), 0);
      const points = getCheckpointCourseForMission('m1_training');
      this.envPack.createRingsCourse(points);
    } else if (mission.id === 'm2_intercept') {
      this.physics.reset(new THREE.Vector3(0, 1500, -800), 0);
      // Spawn 3 hostile interceptors in formation ahead
      this.enemyManager.spawnEnemy('MIG-35 FALCRUM', new THREE.Vector3(-400, 1600, 2200), 180);
      this.enemyManager.spawnEnemy('SU-57 FELON', new THREE.Vector3(0, 1750, 2500), 180);
      this.enemyManager.spawnEnemy('SU-37 TERMINATOR', new THREE.Vector3(450, 1550, 2300), 180);
    } else if (mission.id === 'm3_mountain') {
      this.physics.reset(new THREE.Vector3(-400, 750, 0), 30);
      const points = getCheckpointCourseForMission('m3_mountain');
      this.envPack.createRingsCourse(points);
      // Add a lurking patrol bogey
      this.enemyManager.spawnEnemy('J-20 MIGHTY DRAGON', new THREE.Vector3(-2200, 900, 1600), 90);
    } else if (mission.id === 'm4_survival') {
      this.physics.reset(new THREE.Vector3(0, 1600, 0), 0);
      // Spawn hostile wolfpack
      this.enemyManager.spawnEnemy('SU-35 FLANKER-E', new THREE.Vector3(-1200, 1800, 1800), 150);
      this.enemyManager.spawnEnemy('SU-57 FELON', new THREE.Vector3(1200, 1900, 1900), 210);
      this.enemyManager.spawnEnemy('MIG-31 FOXHOUND', new THREE.Vector3(0, 2100, 2600), 180);
    } else {
      // Free Flight
      this.physics.reset(new THREE.Vector3(0, 800, 0), 0);
      this.enemyManager.spawnEnemy('AGRESSOR-01', new THREE.Vector3(1500, 1200, 1500), 240);
    }
  }

  public startGame(mission: MissionDef) {
    soundEngine.init();
    this.setMission(mission);
    this.gameState = 'playing';
    this.ifStateChange('playing');
  }

  public pauseGame() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this.ifStateChange('paused');
    }
  }

  public resumeGame() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.ifStateChange('playing');
    }
  }

  public restartGame() {
    this.startGame(this.currentMission);
  }

  public triggerKillCam(targetName: string, targetPos: THREE.Vector3) {
    this.killCamTimer = this.killCamDuration;
    this.killCamTargetPos.copy(targetPos);
    this.killCamTargetName = targetName;
  }

  public returnToMenu() {
    this.gameState = 'menu';
    this.killCamTimer = 0;
    this.physics.reset(new THREE.Vector3(0, 480, 0), 0);
    this.enemyManager.clearAll();
    this.weaponSystem.clearAll();
    this.damageEffects.clearAll();
    this.envPack.clearRings();
    this.ifStateChange('menu');
  }

  private ifStateChange(state: GameState, result?: { score: number; time: number; won: boolean }) {
    if (this.onStateChange) {
      this.onStateChange(state, result);
    }
  }

  private startLoop() {
    const tick = () => {
      this.animFrameId = requestAnimationFrame(tick);
      const rawDt = this.clock.getDelta();
      // Clamp delta time to avoid large jumps
      const delta = Math.min(rawDt, 0.05);

      this.update(delta);
      this.render();
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private update(delta: number) {
    if (this.gameState === 'menu') {
      // Animate cinematic orbit around hero jet on title screen
      this.playerModel.root.position.copy(this.physics.position);
      this.playerModel.root.quaternion.copy(this.physics.quaternion);
      this.cameraController.updateCinematicMenu(this.physics.position, delta);
      this.envPack.updateClouds(delta);
      this.envPack.updateWeather(delta, this.cameraController.camera.position, 120);
      return;
    }

    if (this.gameState === 'paused') {
      return;
    }

    // --- Active Gameplay Simulation ---
    this.elapsedTime += delta;
    if (this.currentMission.timeLimit) {
      this.missionTimer -= delta;
      if (this.missionTimer <= 0) {
        if (this.currentMission.id === 'm4_survival') {
          // Survival mission won when timer runs out!
          this.triggerVictory();
        } else {
          this.triggerGameOver('MISSION TIME EXPIRED');
        }
        return;
      }
    }

    // 1. Flight Physics
    this.spawnGracePeriod = Math.max(0, this.spawnGracePeriod - delta);
    const { crashed, stallWarning, pullUpWarning } = this.physics.update(
      this.inputs,
      delta,
      this.envPack.getTerrainHeight
    );

    if (crashed && this.spawnGracePeriod <= 0) {
      this.weaponSystem.createExplosion(this.physics.position, 2.5);
      this.triggerGameOver('AIRCRAFT DESTROYED: TERRAIN COLLISION');
      return;
    }

    if (stallWarning) {
      soundEngine.playWarning('pullup');
    } else if (pullUpWarning) {
      soundEngine.playWarning('pullup');
    }

    // 2. Audio Engine Engine Pitch & Rumble
    soundEngine.updateEngine(this.physics.throttle, this.physics.isBoosting);

    // 3. Update Player Jet 3D Model
    this.playerModel.root.position.copy(this.physics.position);
    this.playerModel.root.quaternion.copy(this.physics.quaternion);

    // Animate Afterburner Glow Cones
    const flameScale = this.physics.isBoosting ? 1.9 : 0.4 + this.physics.throttle * 0.7;
    const flameIntensity = this.physics.isBoosting ? 4.5 : 1.2;
    this.playerModel.afterburners.forEach((flame) => {
      flame.scale.set(flameScale, flameScale, flameScale + (Math.random() - 0.5) * 0.15);
      (flame.material as THREE.MeshBasicMaterial).color.setHex(this.physics.isBoosting ? 0x60a5fa : 0x38bdf8);
    });
    this.playerModel.afterburnerLights.forEach((light) => {
      light.intensity = flameIntensity;
    });

    // 4. Weapons & Combat Actions
    this.gunFireCooldown = Math.max(0, this.gunFireCooldown - delta);
    this.missileFireCooldown = Math.max(0, this.missileFireCooldown - delta);

    if (this.inputs.fireGuns && this.gunFireCooldown <= 0) {
      const leftMuzzle = new THREE.Vector3();
      const rightMuzzle = new THREE.Vector3();
      this.playerModel.leftMuzzle.getWorldPosition(leftMuzzle);
      this.playerModel.rightMuzzle.getWorldPosition(rightMuzzle);

      const jetSpeedMs = (this.physics.speedKmh * 1000) / 3600;
      this.weaponSystem.fireGuns(leftMuzzle, rightMuzzle, this.physics.forward, jetSpeedMs, true);
      this.gunFireCooldown = 0.08; // High fire rate
    }

    // Missile launch (F key or button)
    if (this.inputs.fireMissile && this.missileFireCooldown <= 0 && this.missilesRemaining > 0) {
      const mount = this.missilesRemaining % 2 === 0 ? this.playerModel.leftMissileMount : this.playerModel.rightMissileMount;
      const mountPos = new THREE.Vector3();
      mount.getWorldPosition(mountPos);

      const targetObj = this.lockedEnemy ? this.lockedEnemy.meshPack.root : null;
      this.weaponSystem.fireMissile(mountPos, this.physics.forward, targetObj, true);
      this.missilesRemaining--;
      this.missileFireCooldown = 1.2;
    }

    // Deploy Flares
    if (this.inputs.deployFlare && this.flaresRemaining > 0) {
      this.weaponSystem.deployFlares(this.physics.position, this.physics.right);
      this.flaresRemaining--;
      this.inputs.deployFlare = false;
    }

    // Switch camera
    if (this.inputs.switchCam) {
      this.cameraController.toggleMode();
      this.inputs.switchCam = false;
    }

    // 5. Target Lock Acquisition
    this.updateTargetLock(delta);

    // 6. Update Weapons & Explosions
    this.weaponSystem.update(
      delta,
      this.envPack.getTerrainHeight,
      (target, damage, isPlayerWeapon) => {
        if (isPlayerWeapon) {
          const hitEnemy = this.enemyManager.applyDamage(target, damage, (killed) => {
            this.triggerKillCam(killed.name, killed.position);
            this.score += 1500;
            this.checkVictoryCondition();
          });
          if (hitEnemy) {
            this.score += 250;
          }
        } else {
          // Enemy weapon hit player
          this.playerHealth = Math.max(0, this.playerHealth - damage);
          soundEngine.playExplosion();
          if (this.playerHealth <= 0) {
            this.triggerGameOver('AIRCRAFT SHOT DOWN IN COMBAT');
          }
        }
      }
    );

    // Check bullet collisions with enemies
    this.checkBulletCollisions();

    // 7. Update Enemy AI
    this.enemyManager.update(
      delta,
      this.physics.position,
      this.envPack.getTerrainHeight,
      (killedEnemy) => {
        this.triggerKillCam(killedEnemy.name, killedEnemy.position);
        this.score += 1500;
        this.checkVictoryCondition();
      }
    );

    // 8. Checkpoint Rings Collision Check
    this.updateCheckpoints();

    // 9. Update Dynamic Environment (Clouds drift, ring spin, dynamic weather, rain & lightning)
    this.envPack.updateClouds(delta);
    this.envPack.updateRings(delta);
    this.envPack.updateWeather(
      delta,
      this.cameraController.camera.position,
      (this.physics.speedKmh * 1000) / 3600,
      (shake) => {
        this.weaponSystem.cameraShakeAmount = Math.max(this.weaponSystem.cameraShakeAmount, shake);
      }
    );

    // Update sunlight shadow position centered on player jet
    this.envPack.sunLight.position.set(
      this.physics.position.x + 3000,
      this.physics.position.y + 4000,
      this.physics.position.z - 2500
    );
    this.envPack.sunLight.target = this.playerModel.root;

    // 9b. Dynamic Damage Effects (Smoke trails and localized sparks when health < 50%)
    const jetVelocity = this.physics.forward.clone().multiplyScalar((this.physics.speedKmh * 1000) / 3600);
    this.damageEffects.update(
      delta,
      this.physics.position,
      this.physics.forward,
      this.physics.right,
      this.physics.up,
      jetVelocity,
      this.playerHealth
    );

    // 10. Update Camera (Cinematic Kill Cam or standard Chase / Cockpit mode)
    if (this.killCamTimer > 0) {
      this.killCamTimer -= delta;
      const progress = Math.min(1.0, 1.0 - this.killCamTimer / this.killCamDuration);
      this.cameraController.updateKillCam(
        this.killCamTargetPos,
        this.physics.position,
        progress,
        delta
      );
    } else if (this.cameraController.mode === 'cockpit') {
      const cockpitPos = new THREE.Vector3();
      this.playerModel.cockpitAnchor.getWorldPosition(cockpitPos);
      this.cameraController.updateCockpit(
        cockpitPos,
        this.physics.forward,
        this.physics.up,
        this.weaponSystem.cameraShakeAmount,
        delta
      );
    } else {
      this.cameraController.updateChase(
        this.physics.position,
        this.physics.forward,
        this.physics.up,
        this.physics.isBoosting,
        this.weaponSystem.cameraShakeAmount,
        delta
      );
    }

    // 11. Send Telemetry to HUD
    this.dispatchTelemetry();
  }

  private updateTargetLock(delta: number) {
    let bestCandidate: EnemyJet | null = null;
    let closestDist = 3800;

    for (const enemy of this.enemyManager.enemies) {
      if (enemy.isDead) continue;
      const toEnemy = enemy.position.clone().sub(this.physics.position);
      const dist = toEnemy.length();

      if (dist < closestDist) {
        // Check bore angle (forward cone)
        const dot = this.physics.forward.dot(toEnemy.clone().normalize());
        if (dot > 0.85) {
          closestDist = dist;
          bestCandidate = enemy;
        }
      }
    }

    if (bestCandidate) {
      if (this.lockedEnemy === bestCandidate) {
        this.lockTimer += delta;
        if (this.lockTimer > 0.75) {
          this.isHardLocked = true;
          soundEngine.setLockStatus('locked');
        } else {
          this.isHardLocked = false;
          soundEngine.setLockStatus('seeking');
        }
      } else {
        this.lockedEnemy = bestCandidate;
        this.lockTimer = 0;
        this.isHardLocked = false;
        soundEngine.setLockStatus('seeking');
      }
    } else {
      this.lockedEnemy = null;
      this.lockTimer = 0;
      this.isHardLocked = false;
      soundEngine.setLockStatus('none');
    }
  }

  private checkBulletCollisions() {
    // Check player bullets against enemies
    for (const b of this.weaponSystem.bullets) {
      if (!b.isPlayer) {
        // Enemy bullet against player
        const distToPlayer = b.position.distanceTo(this.physics.position);
        if (distToPlayer < 4.5) {
          this.playerHealth = Math.max(0, this.playerHealth - 12);
          b.life = b.maxLife; // Dispose
          this.weaponSystem.createExplosion(b.position, 0.4);
          if (this.playerHealth <= 0) {
            this.triggerGameOver('AIRCRAFT DESTROYED: GUNFIRE DAMAGE');
          }
        }
        continue;
      }

      for (const e of this.enemyManager.enemies) {
        if (e.isDead) continue;
        const dist = b.position.distanceTo(e.position);
        if (dist < 6.5) {
          b.life = b.maxLife; // Dispose bullet
          this.weaponSystem.createExplosion(b.position, 0.4);
          e.health -= 18;
          this.score += 80;
          if (e.health <= 0) {
            this.triggerKillCam(e.name, e.position);
            this.enemyManager.destroyEnemy(e, () => {
              this.score += 1500;
              this.checkVictoryCondition();
            });
          }
          break;
        }
      }
    }
  }

  private updateCheckpoints() {
    if (this.envPack.checkpointRings.length === 0) return;

    if (this.currentCheckpointIdx < this.envPack.checkpointRings.length) {
      const ring = this.envPack.checkpointRings[this.currentCheckpointIdx];
      const dist = this.physics.position.distanceTo(ring.position);

      if (dist < ring.radius + 8) {
        ring.passed = true;
        // Turn ring gold/green
        (ring.mesh.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        soundEngine.playCheckpointChime();
        this.score += 1000;
        this.currentCheckpointIdx++;

        if (this.currentCheckpointIdx >= this.envPack.checkpointRings.length) {
          this.checkVictoryCondition();
        }
      }
    }
  }

  private checkVictoryCondition() {
    const m = this.currentMission;
    if (m.id === 'm1_training' || m.id === 'm3_mountain') {
      if (this.currentCheckpointIdx >= this.envPack.checkpointRings.length) {
        this.triggerVictory();
      }
    } else if (m.id === 'm2_intercept') {
      const aliveEnemies = this.enemyManager.enemies.filter((e) => !e.isDead);
      if (aliveEnemies.length === 0) {
        this.triggerVictory();
      }
    } else if (m.id === 'm4_survival') {
      const aliveEnemies = this.enemyManager.enemies.filter((e) => !e.isDead);
      if (aliveEnemies.length === 0) {
        // Spawn next wave!
        this.score += 3000;
        this.enemyManager.spawnEnemy('SU-57 FELON', new THREE.Vector3(-1500, 2000, 2200), 180);
        this.enemyManager.spawnEnemy('J-20 DRAGON', new THREE.Vector3(1500, 1800, 2000), 180);
      }
    }
  }

  private triggerVictory() {
    this.gameState = 'victory';
    this.score += Math.max(0, Math.floor(this.missionTimer * 50));
    saveMissionScore(this.currentMission.id, this.score, this.elapsedTime);
    soundEngine.setLockStatus('none');
    this.ifStateChange('victory', { score: this.score, time: this.elapsedTime, won: true });
  }

  private triggerGameOver(reason: string) {
    this.gameState = 'gameover';
    soundEngine.setLockStatus('none');
    this.ifStateChange('gameover', { score: this.score, time: this.elapsedTime, won: false });
  }

  private dispatchTelemetry() {
    if (!this.onTelemetryUpdate) return;

    // Build radar contacts relative to player aircraft heading
    const radarRange = 4500;
    const contacts: RadarContact[] = [];

    // Player heading vector
    const headingAngle = Math.atan2(this.physics.forward.x, this.physics.forward.z);

    // Enemy contacts
    this.enemyManager.enemies.forEach((e) => {
      if (e.isDead) return;
      const dx = e.position.x - this.physics.position.x;
      const dz = e.position.z - this.physics.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radarRange) {
        // Rotate into player jet coordinate space
        const worldAngle = Math.atan2(dx, dz);
        const relAngle = worldAngle - headingAngle;

        const relDist = dist / radarRange;
        const rx = Math.sin(relAngle) * relDist;
        const ry = -Math.cos(relAngle) * relDist;

        contacts.push({
          id: e.id,
          x: rx,
          y: ry,
          type: 'enemy',
          isTargetLocked: this.lockedEnemy === e && this.isHardLocked,
          altitudeDiff: e.position.y - this.physics.position.y,
        });
      }
    });

    // Checkpoint contact
    if (this.currentCheckpointIdx < this.envPack.checkpointRings.length) {
      const ring = this.envPack.checkpointRings[this.currentCheckpointIdx];
      const dx = ring.position.x - this.physics.position.x;
      const dz = ring.position.z - this.physics.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radarRange) {
        const worldAngle = Math.atan2(dx, dz);
        const relAngle = worldAngle - headingAngle;
        const relDist = dist / radarRange;
        contacts.push({
          id: 'next_ring',
          x: Math.sin(relAngle) * relDist,
          y: -Math.cos(relAngle) * relDist,
          type: 'checkpoint',
          isTargetLocked: false,
          altitudeDiff: ring.position.y - this.physics.position.y,
        });
      }
    }

    const groundH = this.envPack.getTerrainHeight(this.physics.position.x, this.physics.position.z);
    const altAboveGround = Math.max(0, this.physics.position.y - groundH);

    const telemetry: FlightTelemetry = {
      speedKmh: Math.round(this.physics.speedKmh),
      altitudeM: Math.round(this.physics.position.y),
      headingDeg: this.physics.getHeadingDeg(),
      pitchDeg: this.physics.getPitchDeg(),
      rollDeg: this.physics.getRollDeg(),
      throttle: this.physics.throttle,
      isBoosting: this.physics.isBoosting,
      health: this.playerHealth,
      maxHealth: this.MAX_HEALTH,
      missilesLeft: this.missilesRemaining,
      flaresLeft: this.flaresRemaining,
      score: this.score,
      timeRemaining: Math.max(0, Math.round(this.missionTimer)),
      elapsedTime: Math.round(this.elapsedTime),
      enemiesRemaining: this.enemyManager.enemies.filter((e) => !e.isDead).length,
      checkpointsHit: this.currentCheckpointIdx,
      totalCheckpoints: this.envPack.checkpointRings.length,
      hasTargetLock: this.isHardLocked,
      targetDistance: this.lockedEnemy ? Math.round(this.physics.position.distanceTo(this.lockedEnemy.position)) : 0,
      targetName: this.lockedEnemy ? this.lockedEnemy.name : '',
      stallWarning: this.physics.speedKmh < 230,
      pullUpWarning: altAboveGround < 120 && this.physics.forward.y < -0.08,
      missileIncomingWarning: false,
      cameraMode: this.cameraController.mode,
      weather: this.envPack.currentWeather,
      isKillCamActive: this.killCamTimer > 0,
      killCamTargetName: this.killCamTargetName,
    };

    this.onTelemetryUpdate(telemetry, contacts);
  }

  public toggleWeather(): WeatherType {
    return this.envPack.toggleNextWeather();
  }

  public setWeather(w: WeatherType) {
    this.envPack.setWeather(w);
  }

  private render() {
    this.renderer.render(this.scene, this.cameraController.camera);
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.cameraController.camera.aspect = width / height;
    this.cameraController.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    soundEngine.setLockStatus('none');
    this.damageEffects.destroy();
    this.renderer.dispose();
  }
}
