/**
 * Game state types and interfaces for Sky Warrior: Flight Combat
 */

export type GameState = 'menu' | 'briefing' | 'playing' | 'paused' | 'victory' | 'gameover';

export type CameraMode = 'chase' | 'cockpit';

export type WeatherType = 'clear' | 'fog' | 'thunderstorm';

export interface MissionDef {
  id: string;
  name: string;
  code: string;
  description: string;
  briefing: string;
  timeLimit?: number; // seconds
  targetEnemyCount?: number;
  totalCheckpoints?: number;
  unlocked: boolean;
  bestScore: number;
  bestTime?: number;
}

export interface FlightTelemetry {
  speedKmh: number;
  altitudeM: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  throttle: number;
  isBoosting: boolean;
  health: number;
  maxHealth: number;
  missilesLeft: number;
  flaresLeft: number;
  score: number;
  timeRemaining: number;
  elapsedTime: number;
  enemiesRemaining: number;
  checkpointsHit: number;
  totalCheckpoints: number;
  hasTargetLock: boolean;
  targetDistance: number;
  targetName: string;
  stallWarning: boolean;
  pullUpWarning: boolean;
  missileIncomingWarning: boolean;
  cameraMode: CameraMode;
  weather: WeatherType;
  isKillCamActive: boolean;
  killCamTargetName: string;
}

export interface RadarContact {
  id: string;
  x: number; // -1 to 1 relative to radar display
  y: number; // -1 to 1 relative to radar display
  type: 'enemy' | 'checkpoint' | 'friendly' | 'base';
  isTargetLocked: boolean;
  altitudeDiff: number; // >0 above, <0 below
}

export interface FlightInputs {
  pitchUp: boolean;     // S / Down
  pitchDown: boolean;   // W / Up
  rollLeft: boolean;    // A / Left
  rollRight: boolean;   // D / Right
  yawLeft: boolean;     // Q
  yawRight: boolean;    // E
  boost: boolean;       // Shift
  brake: boolean;       // Ctrl or low throttle
  fireGuns: boolean;    // Space
  fireMissile: boolean; // F
  deployFlare: boolean; // X
  switchCam: boolean;   // C
  restart: boolean;     // R
  pause: boolean;       // Esc
}
