import * as THREE from 'three';
import { MissionDef } from './types';

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1_training',
    code: 'OP-01',
    name: 'FLIGHT TRAINING',
    description: 'Master basic aerodynamics and navigate through 10 tactical checkpoint rings.',
    briefing: 'Pilot, your first assignment is to calibrate your avionics. Take off from runway 09 and fly through all 10 holographic checkpoint rings plotted through the archipelago valleys. Maintain airspeed and watch your altitude.',
    totalCheckpoints: 10,
    timeLimit: 150,
    unlocked: true,
    bestScore: 0,
  },
  {
    id: 'm2_intercept',
    code: 'OP-02',
    name: 'ENEMY INTERCEPT',
    description: 'Scramble to intercept and splash 3 hostile multi-role fighters intruding sovereign airspace.',
    briefing: 'Warning: 3 unidentified bogies with active ECM radar signatures have penetrated sector 4. Arm Sidewinder missiles and 20mm Vulcan cannons. Engage and splash all 3 hostiles. Do not let them escape.',
    targetEnemyCount: 3,
    timeLimit: 180,
    unlocked: true,
    bestScore: 0,
  },
  {
    id: 'm3_mountain',
    code: 'OP-03',
    name: 'MOUNTAIN RUN',
    description: 'Fly a high-speed low-altitude canyon run through dangerous mountain passes.',
    briefing: 'Radar suppression run: fly below the radar ceiling through narrow granite canyons. Stay tight to the terrain and hit all 12 precision navigation gates while maintaining high throttle.',
    totalCheckpoints: 12,
    timeLimit: 140,
    unlocked: true,
    bestScore: 0,
  },
  {
    id: 'm4_survival',
    code: 'OP-04',
    name: 'AERIAL SURVIVAL',
    description: 'Survive against relentless waves of hostile aggressor squadrons for 120 seconds.',
    briefing: 'High-threat combat environment. You are outnumbered in hostile territory. Defend your aircraft, deploy flares against incoming missiles, and eliminate as many enemy bandits as possible before extraction.',
    timeLimit: 120,
    targetEnemyCount: 8,
    unlocked: true,
    bestScore: 0,
  },
  {
    id: 'm5_freeflight',
    code: 'FREE',
    name: 'FREE FLIGHT',
    description: 'Unrestricted airspace. Practice aerobatics, touch-and-go landings, and supersonic speeds.',
    briefing: 'All airspace restrictions lifted. Test aircraft flight envelope, perform supersonic Mach 2+ runs over mountain peaks, practice carrier landings, and explore the vast 3D archipelago.',
    unlocked: true,
    bestScore: 0,
  },
];

const STORAGE_KEY = 'sky_warrior_mission_data_v1';

export function loadSavedMissionProgress(): MissionDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return MISSIONS;
    const data = JSON.parse(raw);
    return MISSIONS.map((m) => {
      if (data[m.id]) {
        return {
          ...m,
          unlocked: data[m.id].unlocked ?? m.unlocked,
          bestScore: data[m.id].bestScore ?? m.bestScore,
          bestTime: data[m.id].bestTime ?? m.bestTime,
        };
      }
      return m;
    });
  } catch {
    return MISSIONS;
  }
}

export function saveMissionScore(missionId: string, score: number, timeElapsed?: number) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const prev = data[missionId] || { bestScore: 0 };
    data[missionId] = {
      unlocked: true,
      bestScore: Math.max(prev.bestScore || 0, score),
      bestTime: timeElapsed && (!prev.bestTime || timeElapsed < prev.bestTime) ? timeElapsed : prev.bestTime,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota or private browsing mode
  }
}

export function getCheckpointCourseForMission(missionId: string): THREE.Vector3[] {
  if (missionId === 'm1_training') {
    return [
      new THREE.Vector3(0, 180, 400),
      new THREE.Vector3(150, 240, 1000),
      new THREE.Vector3(450, 320, 1700),
      new THREE.Vector3(900, 420, 2200),
      new THREE.Vector3(1400, 480, 1800),
      new THREE.Vector3(1800, 520, 1100),
      new THREE.Vector3(1600, 420, 200),
      new THREE.Vector3(1000, 350, -600),
      new THREE.Vector3(400, 260, -1100),
      new THREE.Vector3(0, 150, -400),
    ];
  }

  if (missionId === 'm3_mountain') {
    return [
      new THREE.Vector3(-400, 280, 500),
      new THREE.Vector3(-1200, 340, 1200),
      new THREE.Vector3(-2100, 420, 1800),
      new THREE.Vector3(-3000, 550, 2100),
      new THREE.Vector3(-3800, 680, 1700),
      new THREE.Vector3(-3500, 590, 800),
      new THREE.Vector3(-2600, 480, -200),
      new THREE.Vector3(-1800, 410, -900),
      new THREE.Vector3(-900, 320, -1500),
      new THREE.Vector3(200, 390, -1800),
      new THREE.Vector3(1200, 460, -1200),
      new THREE.Vector3(400, 220, -300),
    ];
  }

  return [];
}
