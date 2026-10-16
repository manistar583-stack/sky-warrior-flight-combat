import * as THREE from 'three';
import { FlightInputs } from './types';

export class FlightPhysics {
  public position: THREE.Vector3 = new THREE.Vector3(0, 450, -500);
  public quaternion: THREE.Quaternion = new THREE.Quaternion();
  public forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  public up: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public right: THREE.Vector3 = new THREE.Vector3(1, 0, 0);

  // Aerodynamic velocities and rates
  public speedKmh: number = 720; // km/h
  public throttle: number = 0.55; // 0 to 1
  public isBoosting: boolean = false;

  private currentPitchRate: number = 0;
  private currentRollRate: number = 0;
  private currentYawRate: number = 0;

  // Constants
  private readonly MIN_SPEED: number = 190;
  private readonly CRUISE_SPEED: number = 780;
  private readonly MAX_DRY_SPEED: number = 1380;
  private readonly MAX_BOOST_SPEED: number = 2240;

  private readonly PITCH_ACCEL: number = 1.9;
  private readonly ROLL_ACCEL: number = 3.6;
  private readonly YAW_ACCEL: number = 1.1;

  // Scratch objects for 0-GC loop
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _q1 = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(initialPos?: THREE.Vector3, initialHeadingDeg: number = 0) {
    if (initialPos) {
      this.position.copy(initialPos);
    }
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (initialHeadingDeg * Math.PI) / 180);
    this.updateVectors();
  }

  public reset(pos: THREE.Vector3, headingDeg: number = 0) {
    this.position.copy(pos);
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (headingDeg * Math.PI) / 180);
    this.speedKmh = 720;
    this.throttle = 0.55;
    this.isBoosting = false;
    this.currentPitchRate = 0;
    this.currentRollRate = 0;
    this.currentYawRate = 0;
    this.updateVectors();
  }

  public update(inputs: FlightInputs, delta: number, getTerrainHeight: (x: number, z: number) => number): {
    crashed: boolean;
    stallWarning: boolean;
    pullUpWarning: boolean;
  } {
    // 1. Throttle & Boost kinematics
    this.isBoosting = inputs.boost;

    let targetSpeed = this.CRUISE_SPEED;
    if (inputs.boost) {
      this.throttle = Math.min(1.0, this.throttle + delta * 1.2);
      targetSpeed = this.MAX_BOOST_SPEED;
    } else if (inputs.brake) {
      this.throttle = Math.max(0.15, this.throttle - delta * 0.9);
      targetSpeed = this.MIN_SPEED + 80;
    } else {
      // Default to balanced military cruise throttle
      this.throttle = THREE.MathUtils.damp(this.throttle, 0.55, 1.5, delta);
      targetSpeed = this.CRUISE_SPEED;
    }

    // Accelerate / decelerate towards target speed
    const accelRate = inputs.boost ? 550 : 280;
    this.speedKmh = THREE.MathUtils.damp(this.speedKmh, targetSpeed, accelRate * 0.003, delta);

    // 2. Control surface inputs (Pitch, Roll, Yaw)
    let targetPitch = 0;
    if (inputs.pitchUp) targetPitch += 1.0;
    if (inputs.pitchDown) targetPitch -= 1.0;

    let targetRoll = 0;
    if (inputs.rollLeft) targetRoll += 1.0;
    if (inputs.rollRight) targetRoll -= 1.0;

    let targetYaw = 0;
    if (inputs.yawLeft) targetYaw += 1.0;
    if (inputs.yawRight) targetYaw -= 1.0;

    // Control authority scales slightly with speed (rudder/aileron airflow effectiveness)
    const dynamicPressure = Math.min(1.2, Math.max(0.4, this.speedKmh / 800));

    // Smooth angular rates with damping
    this.currentPitchRate = THREE.MathUtils.damp(this.currentPitchRate, targetPitch * this.PITCH_ACCEL * dynamicPressure, 6.0, delta);
    this.currentRollRate = THREE.MathUtils.damp(this.currentRollRate, targetRoll * this.ROLL_ACCEL * dynamicPressure, 8.0, delta);
    this.currentYawRate = THREE.MathUtils.damp(this.currentYawRate, targetYaw * this.YAW_ACCEL * dynamicPressure, 5.0, delta);

    // 3. Apply angular rotation via Quaternions
    // Pitch around local Right axis
    if (Math.abs(this.currentPitchRate) > 0.001) {
      this._q1.setFromAxisAngle(this.right, this.currentPitchRate * delta);
      this.quaternion.premultiply(this._q1);
    }

    // Roll around local Forward axis
    if (Math.abs(this.currentRollRate) > 0.001) {
      this._q1.setFromAxisAngle(this.forward, this.currentRollRate * delta);
      this.quaternion.premultiply(this._q1);
    }

    // Yaw around local Up axis
    if (Math.abs(this.currentYawRate) > 0.001) {
      this._q1.setFromAxisAngle(this.up, this.currentYawRate * delta);
      this.quaternion.premultiply(this._q1);
    }

    // Coordinated aerodynamic banking: rolling banks the lift vector to naturally turn
    const bankAngle = Math.atan2(this.right.y, this.up.y);
    const bankTurnRate = -Math.sin(bankAngle) * 0.85 * dynamicPressure;
    if (Math.abs(bankTurnRate) > 0.01) {
      this._q1.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bankTurnRate * delta);
      this.quaternion.premultiply(this._q1);
    }

    // Gentle auto-leveling stabilization when no roll input
    if (targetRoll === 0 && Math.abs(bankAngle) < 0.3) {
      this._q1.setFromAxisAngle(this.forward, -bankAngle * 1.5 * delta);
      this.quaternion.premultiply(this._q1);
    }

    this.quaternion.normalize();
    this.updateVectors();

    // 4. Position update from velocity vector (forward speed in m/s)
    const speedMs = this.speedKmh * (1000 / 3600);
    this.position.addScaledVector(this.forward, speedMs * delta);

    // Aerodynamic lift vs gravity: slight downward sink if flying extremely slow
    if (this.speedKmh < 240) {
      const sink = (240 - this.speedKmh) * 0.35 * delta;
      this.position.y -= sink;
    }

    // 5. Ground and collision checks
    const groundH = getTerrainHeight(this.position.x, this.position.z);
    const altAboveGround = this.position.y - groundH;

    const crashed = altAboveGround <= 6; // Hit ground or water
    const stallWarning = this.speedKmh < 230;
    const pullUpWarning = altAboveGround < 120 && this.forward.y < -0.08;

    return { crashed, stallWarning, pullUpWarning };
  }

  public updateVectors() {
    // In Three.js aircraft coordinate system:
    // Forward is +Z in our model layout
    this.forward.set(0, 0, 1).applyQuaternion(this.quaternion).normalize();
    this.up.set(0, 1, 0).applyQuaternion(this.quaternion).normalize();
    this.right.set(1, 0, 0).applyQuaternion(this.quaternion).normalize();

    // Calculate heading, pitch, roll in degrees for HUD
    this._euler.setFromQuaternion(this.quaternion, 'YXZ');
  }

  public getHeadingDeg(): number {
    const angle = Math.atan2(this.forward.x, this.forward.z);
    let deg = (angle * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return Math.round(deg);
  }

  public getPitchDeg(): number {
    const deg = Math.asin(THREE.MathUtils.clamp(this.forward.y, -1, 1)) * (180 / Math.PI);
    return Math.round(deg);
  }

  public getRollDeg(): number {
    const deg = Math.atan2(this.right.y, this.up.y) * (180 / Math.PI);
    return Math.round(deg);
  }
}
