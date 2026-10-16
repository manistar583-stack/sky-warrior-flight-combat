/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SkyWarriorGameEngine } from './game/gameEngine';
import { HUD } from './components/HUD';
import { Menu } from './components/Menu';
import { MobileControls } from './components/MobileControls';
import { soundEngine } from './game/audio';
import { FlightTelemetry, GameState, MissionDef, RadarContact, FlightInputs } from './game/types';
import { MISSIONS, loadSavedMissionProgress } from './game/missions';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SkyWarriorGameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('menu');
  const [missions, setMissions] = useState<MissionDef[]>(MISSIONS);
  const [currentMission, setCurrentMission] = useState<MissionDef>(MISSIONS[0]);
  const [telemetry, setTelemetry] = useState<FlightTelemetry | null>(null);
  const [radarContacts, setRadarContacts] = useState<RadarContact[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{ score: number; time: number; won: boolean } | undefined>(undefined);

  // Initialize saved mission high scores from localStorage
  useEffect(() => {
    const loaded = loadSavedMissionProgress();
    setMissions(loaded);
    setCurrentMission(loaded[0]);
  }, []);

  // Initialize Three.js Game Engine once in isolated ref container
  useEffect(() => {
    if (!canvasMountRef.current) return;

    // Telemetry throttling to prevent high React overhead (~20fps React UI sync while Three.js renders at 60fps)
    let lastUiSync = 0;

    const engine = new SkyWarriorGameEngine(
      canvasMountRef.current,
      (data, contacts) => {
        const now = performance.now();
        if (now - lastUiSync > 45) {
          lastUiSync = now;
          setTelemetry(data);
          setRadarContacts(contacts);
        }
      },
      (state, result) => {
        setGameState(state);
        if (result) {
          setLastResult(result);
          // Refresh mission high scores if won
          if (result.won) {
            setMissions(loadSavedMissionProgress());
          }
        }
      }
    );

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Keyboard input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      const code = e.code;
      const inputs = engineRef.current.inputs;

      if (gameState === 'menu') {
        if (code === 'Space' || code === 'Enter') {
          e.preventDefault();
          engineRef.current.startGame(currentMission);
          return;
        }
      }

      if (code === 'KeyW' || code === 'ArrowUp') inputs.pitchDown = true;
      if (code === 'KeyS' || code === 'ArrowDown') inputs.pitchUp = true;
      if (code === 'KeyA' || code === 'ArrowLeft') inputs.rollLeft = true;
      if (code === 'KeyD' || code === 'ArrowRight') inputs.rollRight = true;
      if (code === 'KeyQ') inputs.yawLeft = true;
      if (code === 'KeyE') inputs.yawRight = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') inputs.boost = true;
      if (code === 'ControlLeft' || code === 'KeyB') inputs.brake = true;
      if (code === 'Space') inputs.fireGuns = true;
      if (code === 'KeyF') inputs.fireMissile = true;
      if (code === 'KeyX') inputs.deployFlare = true;
      if (code === 'KeyC') inputs.switchCam = true;

      if (code === 'KeyR') {
        if (gameState === 'playing' || gameState === 'gameover' || gameState === 'victory') {
          engineRef.current.restartGame();
        }
      }

      if (code === 'Escape') {
        if (gameState === 'playing') {
          engineRef.current.pauseGame();
        } else if (gameState === 'paused') {
          engineRef.current.resumeGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      const code = e.code;
      const inputs = engineRef.current.inputs;

      if (code === 'KeyW' || code === 'ArrowUp') inputs.pitchDown = false;
      if (code === 'KeyS' || code === 'ArrowDown') inputs.pitchUp = false;
      if (code === 'KeyA' || code === 'ArrowLeft') inputs.rollLeft = false;
      if (code === 'KeyD' || code === 'ArrowRight') inputs.rollRight = false;
      if (code === 'KeyQ') inputs.yawLeft = false;
      if (code === 'KeyE') inputs.yawRight = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') inputs.boost = false;
      if (code === 'ControlLeft' || code === 'KeyB') inputs.brake = false;
      if (code === 'Space') inputs.fireGuns = false;
      if (code === 'KeyF') inputs.fireMissile = false;
    };

    const handleBlur = () => {
      // Clear held keys on window blur to avoid stuck steering
      if (engineRef.current) {
        const inputs = engineRef.current.inputs;
        inputs.pitchUp = false;
        inputs.pitchDown = false;
        inputs.rollLeft = false;
        inputs.rollRight = false;
        inputs.yawLeft = false;
        inputs.yawRight = false;
        inputs.boost = false;
        inputs.brake = false;
        inputs.fireGuns = false;
        inputs.fireMissile = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState]);

  // Actions
  const handleSelectMission = useCallback((mission: MissionDef) => {
    setCurrentMission(mission);
    if (engineRef.current) {
      engineRef.current.setMission(mission);
    }
  }, []);

  const handleStartMission = useCallback((mission: MissionDef) => {
    if (engineRef.current) {
      engineRef.current.startGame(mission);
    }
  }, []);

  const handleResume = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resumeGame();
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restartGame();
    }
  }, []);

  const handleReturnToMenu = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.returnToMenu();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.init();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
  }, [isMuted]);

  const handleToggleCamera = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.inputs.switchCam = true;
    }
  }, []);

  const handleDeployFlare = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.inputs.deployFlare = true;
    }
  }, []);

  const handleToggleWeather = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.toggleWeather();
    }
  }, []);

  const handleUpdateMobileInputs = useCallback((updater: (prev: FlightInputs) => FlightInputs) => {
    if (engineRef.current) {
      engineRef.current.inputs = updater(engineRef.current.inputs);
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Isolated Three.js WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Military HUD during flight */}
      {gameState === 'playing' && (
        <>
          <HUD
            telemetry={telemetry}
            radarContacts={radarContacts}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onToggleCamera={handleToggleCamera}
            onToggleWeather={handleToggleWeather}
            onPause={() => engineRef.current?.pauseGame()}
          />
          <MobileControls
            onUpdateInputs={handleUpdateMobileInputs}
            onToggleCamera={handleToggleCamera}
            onDeployFlare={handleDeployFlare}
          />
        </>
      )}

      {/* Menu / Briefing / Pause / Results Modals */}
      <Menu
        gameState={gameState}
        missions={missions}
        currentMission={currentMission}
        onSelectMission={handleSelectMission}
        onStartMission={handleStartMission}
        onResume={handleResume}
        onRestart={handleRestart}
        onReturnToMenu={handleReturnToMenu}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        lastResult={lastResult}
      />
    </div>
  );
}
