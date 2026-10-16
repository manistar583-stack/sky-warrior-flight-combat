import React, { useState } from 'react';
import { GameState, MissionDef } from '../game/types';
import { Play, RotateCcw, Volume2, VolumeX, Shield, Award, Crosshair, ChevronRight, Settings } from 'lucide-react';

interface MenuProps {
  gameState: GameState;
  missions: MissionDef[];
  currentMission: MissionDef;
  onSelectMission: (mission: MissionDef) => void;
  onStartMission: (mission: MissionDef) => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  lastResult?: { score: number; time: number; won: boolean };
}

export const Menu: React.FC<MenuProps> = ({
  gameState,
  missions,
  currentMission,
  onSelectMission,
  onStartMission,
  onResume,
  onRestart,
  onReturnToMenu,
  isMuted,
  onToggleMute,
  lastResult,
}) => {
  const [selectedMission, setSelectedMission] = useState<MissionDef>(currentMission);
  const [showBriefing, setShowBriefing] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // TITLE SCREEN / MISSION SELECT
  if (gameState === 'menu') {
    return (
      <div className="absolute inset-0 pointer-events-auto flex flex-col justify-between p-8 bg-gradient-to-t from-black/85 via-transparent to-black/60 select-none">
        {/* Header Title Lockup */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-mono tracking-widest rounded">
                SIMULATION V2.4 // AIR SUPERIORITY
              </span>
            </div>

            {/* Bespoke SVG Styled Title Lockup */}
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-black font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 drop-shadow-[0_4px_20px_rgba(16,185,129,0.4)] mt-1">
              SKY WARRIOR
            </h1>
            <div className="text-xs sm:text-sm font-mono tracking-[0.35em] text-cyan-400/90 -mt-2">
              FLIGHT COMBAT SIMULATOR
            </div>
          </div>

          {/* Quick Play CTA & Sound Mute */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onStartMission(selectedMission)}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-black font-display font-black text-xl tracking-wider rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.5)] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>FLY NOW [SPACE]</span>
            </button>

            <button
              onClick={onToggleMute}
              className="p-2.5 bg-black/60 hover:bg-neutral-900 border border-emerald-500/40 rounded-xl text-emerald-300 transition-colors cursor-pointer"
              title="Toggle Audio"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Center / Bottom: Mission Selection Deck */}
        <div className="flex flex-col md:flex-row gap-4 max-w-5xl mx-auto w-full items-stretch overflow-y-auto max-h-[62vh] my-auto pr-1">
          {/* Mission List */}
          <div className="flex-1 flex flex-col gap-2.5">
            <div className="text-xs font-mono text-emerald-500/80 tracking-widest uppercase mb-1">
              SELECT OPERATION
            </div>
            {missions.map((m) => {
              const isSelected = selectedMission.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedMission(m);
                    onSelectMission(m);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-950/80 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                      : 'bg-black/60 border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2 py-1 bg-black/50 border border-emerald-500/30 rounded text-emerald-400 font-bold">
                      {m.code}
                    </span>
                    <div>
                      <div className="font-bold text-base tracking-wide text-white font-display">
                        {m.name}
                      </div>
                      <div className="text-xs text-neutral-400 line-clamp-1">
                        {m.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {m.bestScore > 0 && (
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-neutral-400 font-mono">RECORD</div>
                        <div className="text-xs font-mono font-bold text-amber-300">
                          {m.bestScore.toLocaleString()} PTS
                        </div>
                      </div>
                    )}
                    <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-emerald-400' : 'text-neutral-600'}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mission Details & Launch Button */}
          <div className="w-full md:w-80 p-5 bg-black/80 border border-emerald-500/40 rounded-2xl flex flex-col justify-between shadow-2xl">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <span className="font-mono text-xs text-emerald-400">OPERATION BRIEF</span>
                <span className="font-mono text-xs text-neutral-400">{selectedMission.code}</span>
              </div>

              <div className="font-display text-2xl font-bold text-white tracking-wide">
                {selectedMission.name}
              </div>

              <p className="text-xs font-mono text-neutral-300 leading-relaxed">
                {selectedMission.briefing}
              </p>

              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-800 text-xs font-mono">
                <div>
                  <span className="text-neutral-500">TIME LIMIT:</span>
                  <div className="text-emerald-300 font-bold">
                    {selectedMission.timeLimit ? `${selectedMission.timeLimit}s` : 'UNLIMITED'}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-500">OBJECTIVE:</span>
                  <div className="text-cyan-300 font-bold">
                    {selectedMission.totalCheckpoints
                      ? `${selectedMission.totalCheckpoints} RINGS`
                      : selectedMission.targetEnemyCount
                      ? `${selectedMission.targetEnemyCount} HOSTILES`
                      : 'FREE ROAM'}
                  </div>
                </div>
              </div>
            </div>

            {/* Launch CTA */}
            <button
              onClick={() => onStartMission(selectedMission)}
              className="mt-6 w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-[0.98] text-black font-display font-black text-2xl tracking-widest rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>LAUNCH MISSION</span>
            </button>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="text-center text-xs font-mono text-neutral-500 tracking-wider">
          CONTROLS: WASD FLIGHT YOKE · SHIFT AFTERBURNER · SPACE VULCAN GUNS · F MISSILES · C COCKPIT VIEW
        </div>
      </div>
    );
  }

  // PAUSE MODAL
  if (gameState === 'paused') {
    return (
      <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-6 z-30 pointer-events-auto">
        <div className="w-full max-w-md p-6 bg-neutral-950 border border-emerald-500/50 rounded-2xl shadow-2xl flex flex-col gap-5 text-center">
          <div className="text-3xl font-display font-black tracking-widest text-emerald-400">
            SIMULATION PAUSED
          </div>
          <p className="text-xs font-mono text-neutral-400">
            Active Mission: {currentMission.name}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={onResume}
              className="py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold font-display text-xl tracking-wider rounded-xl transition cursor-pointer"
            >
              RESUME FLIGHT
            </button>

            <button
              onClick={onRestart}
              className="py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold font-display text-xl tracking-wider rounded-xl transition cursor-pointer"
            >
              RESTART MISSION [R]
            </button>

            <button
              onClick={onReturnToMenu}
              className="py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold font-display text-xl tracking-wider rounded-xl transition cursor-pointer"
            >
              MISSION SELECTION
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VICTORY / MISSION COMPLETE
  if (gameState === 'victory') {
    return (
      <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6 z-30 pointer-events-auto animate-fade-in">
        <div className="w-full max-w-lg p-8 bg-neutral-950 border-2 border-emerald-400 rounded-3xl shadow-[0_0_40px_rgba(52,211,153,0.3)] flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400">
            <Award className="w-10 h-10" />
          </div>

          <div>
            <div className="text-xs font-mono text-emerald-400 tracking-widest">OPERATION SUCCESSFUL</div>
            <h2 className="text-5xl font-display font-black text-white tracking-wider mt-1">
              MISSION COMPLETE
            </h2>
          </div>

          <div className="w-full bg-black/60 border border-emerald-500/30 rounded-2xl p-4 grid grid-cols-2 gap-4 font-mono text-sm">
            <div className="text-left">
              <span className="text-neutral-400 text-xs">FINAL SCORE</span>
              <div className="text-2xl font-bold text-emerald-300">
                {lastResult?.score.toLocaleString() || '0'} PTS
              </div>
            </div>
            <div className="text-right">
              <span className="text-neutral-400 text-xs">MISSION TIME</span>
              <div className="text-2xl font-bold text-cyan-300">
                {lastResult?.time ? `${Math.round(lastResult.time)}s` : '--'}
              </div>
            </div>
          </div>

          <div className="flex gap-4 w-full">
            <button
              onClick={onRestart}
              className="flex-1 py-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold font-display text-xl rounded-xl transition cursor-pointer"
            >
              REPLAY MISSION
            </button>

            <button
              onClick={onReturnToMenu}
              className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black font-display text-xl tracking-wider rounded-xl transition cursor-pointer shadow-lg"
            >
              MISSION LIST
            </button>
          </div>
        </div>
      </div>
    );
  }

  // GAME OVER / RESTART
  if (gameState === 'gameover') {
    return (
      <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center p-6 z-30 pointer-events-auto">
        <div className="w-full max-w-md p-8 bg-black/90 border-2 border-red-500 rounded-3xl shadow-[0_0_40px_rgba(239,68,68,0.4)] flex flex-col items-center gap-6 text-center">
          <div className="text-xs font-mono text-red-400 tracking-widest">MISSION FAILED</div>
          <h2 className="text-5xl font-display font-black text-red-500 tracking-wider">
            AIRCRAFT LOST
          </h2>

          <p className="text-xs font-mono text-neutral-300">
            Combat systems offline. All telemetry feeds disconnected.
          </p>

          <div className="w-full bg-neutral-950/80 border border-red-500/30 rounded-xl p-3 font-mono text-sm flex justify-between">
            <span className="text-neutral-400">SCORE AT CRASH:</span>
            <span className="font-bold text-white">{lastResult?.score.toLocaleString() || '0'} PTS</span>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={onRestart}
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white font-black font-display text-xl tracking-wider rounded-xl transition cursor-pointer shadow-lg"
            >
              RETRY [R]
            </button>

            <button
              onClick={onReturnToMenu}
              className="flex-1 py-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold font-display text-xl rounded-xl transition cursor-pointer"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
