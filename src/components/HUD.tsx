import React from 'react';
import { FlightTelemetry, RadarContact, WeatherType } from '../game/types';
import { Shield, Crosshair, Volume2, VolumeX, Eye, Flame, Compass, Sun, CloudFog, CloudLightning } from 'lucide-react';

interface HUDProps {
  telemetry: FlightTelemetry | null;
  radarContacts: RadarContact[];
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleWeather?: () => void;
  onPause: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  radarContacts,
  isMuted,
  onToggleMute,
  onToggleCamera,
  onToggleWeather,
  onPause,
}) => {
  if (!telemetry) return null;

  const dmgPercent = Math.max(0, 100 - telemetry.health);
  const isCriticalDmg = telemetry.health <= 35;

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-emerald-400 font-mono-hud text-sm overflow-hidden">
      {/* --- CINEMATIC KILL CAM OVERLAY --- */}
      {telemetry.isKillCamActive && (
        <>
          {/* Top Letterbox Bar */}
          <div className="absolute top-0 inset-x-0 h-16 bg-black/95 border-b border-red-500/50 flex items-center justify-between px-8 z-30 pointer-events-none">
            <div className="flex items-center gap-2.5 text-xs font-mono text-red-400 tracking-widest font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span>CINEMATIC KILL CAM // TARGET TRACKING</span>
            </div>
            <div className="text-[11px] font-mono text-neutral-400 tracking-wider">
              COMBAT EVALUATION // 60 FPS
            </div>
          </div>

          {/* Bottom Letterbox Bar */}
          <div className="absolute bottom-0 inset-x-0 h-16 bg-black/95 border-t border-red-500/50 flex items-center justify-between px-8 z-30 pointer-events-none">
            <div className="text-xs font-mono text-neutral-400 tracking-wider">
              AUTO-ALIGNING COCKPIT VECTORS...
            </div>
            <div className="text-xs font-mono text-emerald-400 font-bold">
              AIR COMBAT VICTORY
            </div>
          </div>

          {/* Center Dramatic Splash Banner */}
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-30">
            <div className="px-6 py-1 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-black font-display font-black text-sm tracking-[0.25em] uppercase rounded-t shadow-lg">
              TARGET DESTROYED // SPLASH ONE
            </div>
            <div className="px-8 py-3 bg-black/90 border-2 border-red-500 rounded-b shadow-[0_0_35px_rgba(239,68,68,0.7)] flex items-center gap-4">
              <Crosshair className="w-8 h-8 text-red-400 animate-spin" style={{ animationDuration: '3s' }} />
              <div>
                <div className="text-3xl font-black font-display text-white tracking-widest uppercase">
                  {telemetry.killCamTargetName || 'ENEMY FIGHTER'}
                </div>
                <div className="text-xs font-mono text-emerald-400 font-bold">
                  +1,500 PTS // AIRBORNE KILL
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- TOP STATUS BAR --- */}
      <div className="absolute top-4 left-6 right-6 flex items-start justify-between">
        {/* Left: Score & Target Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500/70 text-xs tracking-widest">SCORE:</span>
            <span className="text-xl font-bold tracking-wider text-emerald-300 hud-glow tabular-nums">
              {telemetry.score.toString().padStart(6, '0')}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-500/70">TARGET:</span>
            <span className="text-amber-400 font-semibold tracking-wide">
              {telemetry.hasTargetLock ? `${telemetry.targetName} [${telemetry.targetDistance}m]` : 'SEEKING BOGEY'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs mt-0.5">
            <span className="text-emerald-500/70">WX:</span>
            {telemetry.weather === 'clear' && (
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-400" /> CLEAR SKIES
              </span>
            )}
            {telemetry.weather === 'fog' && (
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <CloudFog className="w-3.5 h-3.5 text-slate-400" /> DENSE FOG [LOW VIS]
              </span>
            )}
            {telemetry.weather === 'thunderstorm' && (
              <span className="text-cyan-300 font-bold flex items-center gap-1 animate-pulse">
                <CloudLightning className="w-3.5 h-3.5 text-cyan-400" /> THUNDERSTORM [RAIN]
              </span>
            )}
          </div>
        </div>

        {/* Center: Heading Compass Tape */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 px-4 py-1 border border-emerald-500/40 bg-black/60 rounded text-center">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400/80">HDG</span>
            <span className="text-lg font-bold text-emerald-300 hud-glow tabular-nums">
              {telemetry.headingDeg.toString().padStart(3, '0')}°
            </span>
          </div>

          {/* Warning Alarms */}
          {telemetry.pullUpWarning && (
            <div className="mt-3 px-6 py-1.5 bg-red-950/80 border-2 border-red-500 text-red-400 font-bold tracking-widest text-lg animate-bounce rounded hud-glow-red">
              WARNING: PULL UP
            </div>
          )}
          {telemetry.stallWarning && !telemetry.pullUpWarning && (
            <div className="mt-3 px-6 py-1.5 bg-amber-950/80 border-2 border-amber-500 text-amber-300 font-bold tracking-widest text-lg animate-pulse rounded hud-glow-amber">
              CAUTION: STALL RECOVERY
            </div>
          )}
        </div>

        {/* Right: Mission Time & Objectives */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500/70 text-xs">TIME REMAINING:</span>
            <span className="text-xl font-bold text-emerald-300 hud-glow tabular-nums">
              {Math.floor(telemetry.timeRemaining / 60)}:
              {(telemetry.timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-500/70">
              {telemetry.totalCheckpoints > 0 ? 'CHECKPOINTS:' : 'HOSTILES REMAINING:'}
            </span>
            <span className="text-cyan-300 font-bold">
              {telemetry.totalCheckpoints > 0
                ? `${telemetry.checkpointsHit} / ${telemetry.totalCheckpoints}`
                : `${telemetry.enemiesRemaining} AIRBORNE`}
            </span>
          </div>
        </div>
      </div>

      {/* --- CENTER FLIGHT COMBAT CROSSHAIR & PITCH LADDER --- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Aircraft Bore Crosshair */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Center pip */}
          <div className="w-2.5 h-2.5 border border-emerald-400 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-emerald-300 rounded-full"></div>
          </div>

          {/* Left Wing bar */}
          <div className="absolute left-0 w-8 h-[2px] bg-emerald-400/80"></div>
          {/* Right Wing bar */}
          <div className="absolute right-0 w-8 h-[2px] bg-emerald-400/80"></div>
          {/* Rudder tick */}
          <div className="absolute top-1 w-[2px] h-4 bg-emerald-400/80"></div>

          {/* Horizon & Pitch line tilt representation */}
          <div
            className="absolute w-44 h-[1px] bg-emerald-400/40 transition-transform duration-75"
            style={{ transform: `rotate(${-telemetry.rollDeg}deg)` }}
          >
            <div className="absolute -top-3 left-0 text-[10px] text-emerald-400/60">-- 0° --</div>
            <div className="absolute -top-3 right-0 text-[10px] text-emerald-400/60">-- 0° --</div>
          </div>
        </div>

        {/* Dynamic Target-Lock Reticle when enemy in range */}
        {telemetry.hasTargetLock && (
          <div className="absolute -top-12 animate-pulse flex flex-col items-center">
            <div className="w-20 h-20 border-2 border-red-500 rounded-lg hud-box-lock flex items-center justify-center relative">
              <Crosshair className="w-8 h-8 text-red-500 animate-spin" style={{ animationDuration: '6s' }} />
              <div className="absolute -top-5 px-1 bg-red-950/80 text-[10px] text-red-300 font-bold">
                LOCK-ON
              </div>
            </div>
            <span className="mt-1 text-xs text-red-400 font-bold bg-black/70 px-2 py-0.5 rounded">
              {telemetry.targetDistance}m
            </span>
          </div>
        )}
      </div>

      {/* --- LEFT FLIGHT INSTRUMENT: AIRSPEED LADDER --- */}
      <div className="absolute left-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
        <div className="flex flex-col items-end border-r-2 border-emerald-400/60 pr-3 py-6 bg-black/40 rounded-l">
          <div className="text-[11px] text-emerald-400/70 tracking-wider">SPEED</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-emerald-300 hud-glow tabular-nums">
              {telemetry.speedKmh}
            </span>
            <span className="text-xs text-emerald-500">KM/H</span>
          </div>

          {/* Throttle Bar */}
          <div className="w-24 h-2 bg-emerald-950/80 border border-emerald-500/40 mt-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                telemetry.isBoosting ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.round(telemetry.throttle * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-emerald-400/60 mt-1 flex items-center gap-1">
            {telemetry.isBoosting && <Flame className="w-3 h-3 text-cyan-400 animate-bounce" />}
            <span>{telemetry.isBoosting ? 'AFTERBURNER [MAX]' : 'MILITARY POWER'}</span>
          </div>
        </div>

        {/* Speed chevron bracket matching user screenshot */}
        <div className="w-0 h-0 border-y-8 border-y-transparent border-l-8 border-l-emerald-400"></div>
      </div>

      {/* --- RIGHT FLIGHT INSTRUMENT: ALTITUDE LADDER & WEAPONS --- */}
      <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
        {/* Altitude chevron bracket */}
        <div className="w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-emerald-400"></div>

        <div className="flex flex-col items-start border-l-2 border-emerald-400/60 pl-3 py-6 bg-black/40 rounded-r min-w-[140px]">
          <div className="text-[11px] text-emerald-400/70 tracking-wider">ALTITUDE</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-emerald-300 hud-glow tabular-nums">
              {telemetry.altitudeM}
            </span>
            <span className="text-xs text-emerald-500">M</span>
          </div>

          {/* Weapons Status Cluster (matching Ace Combat / user screenshot 1) */}
          <div className="mt-4 pt-3 border-t border-emerald-500/30 w-full flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center text-emerald-400/80">
              <span>GUN:</span>
              <span className="text-emerald-300 font-bold">20mm ∞</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-cyan-400 font-bold">&gt; MSL:</span>
              <span className="text-cyan-300 font-extrabold text-sm tabular-nums">
                {telemetry.missilesLeft}
              </span>
            </div>

            <div className="flex justify-between items-center text-emerald-400/80">
              <span>FLR:</span>
              <span className="text-emerald-300 font-bold tabular-nums">{telemetry.flaresLeft}</span>
            </div>

            <div className="flex justify-between items-center">
              <span>DMG:</span>
              <span className={`font-bold tabular-nums ${isCriticalDmg ? 'text-red-400 animate-pulse' : telemetry.health < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {dmgPercent}%
              </span>
            </div>
            {telemetry.health < 50 && (
              <div className="text-[10px] text-amber-300/90 font-bold tracking-tight animate-pulse flex items-center gap-1">
                <span>⚠</span>
                <span>{telemetry.health < 28 ? 'FIRE / SPARKS' : 'ENGINE SMOKE'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- BOTTOM-LEFT: TACTICAL ROUND RADAR (Matching User Image 1) --- */}
      <div className="absolute bottom-6 left-6 flex flex-col items-start gap-1">
        <div className="relative w-44 h-44 rounded-lg border border-emerald-500/50 bg-black/75 p-1 hud-box-glow overflow-hidden">
          {/* Radar background grid & concentric circles */}
          <div className="absolute inset-2 rounded-full border border-emerald-500/40"></div>
          <div className="absolute inset-8 rounded-full border border-emerald-500/30"></div>
          <div className="absolute inset-14 rounded-full border border-emerald-500/20"></div>

          {/* Cross lines */}
          <div className="absolute inset-x-2 top-1/2 h-[1px] bg-emerald-500/30 -translate-y-1/2"></div>
          <div className="absolute inset-y-2 left-1/2 w-[1px] bg-emerald-500/30 -translate-x-1/2"></div>

          {/* Compass labels */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-emerald-400 font-bold">N</span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-emerald-400 font-bold">S</span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-400 font-bold">W</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-400 font-bold">E</span>

          {/* Rotating radar sweep ray */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent to-emerald-400 origin-center animate-radar-sweep"></div>
          </div>

          {/* Center Player Jet Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-0 h-0 border-x-4 border-x-transparent border-b-8 border-b-emerald-300"></div>
          </div>

          {/* Dynamic Radar Blips */}
          {radarContacts.map((contact) => {
            // Map -1..1 to radar circle container
            const radarRadiusPx = 76;
            const leftPx = 88 + contact.x * radarRadiusPx;
            const topPx = 88 + contact.y * radarRadiusPx;

            return (
              <div
                key={contact.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${leftPx}px`, top: `${topPx}px` }}
              >
                {contact.type === 'enemy' ? (
                  <div
                    className={`w-0 h-0 border-x-[5px] border-x-transparent border-b-[9px] ${
                      contact.isTargetLocked ? 'border-b-red-400 animate-ping' : 'border-b-red-500'
                    }`}
                  />
                ) : (
                  <div className="w-2.5 h-2.5 bg-cyan-400 rotate-45 border border-white" />
                )}
              </div>
            );
          })}
        </div>

        <span className="text-[10px] text-emerald-500/70 tracking-widest pl-1">
          RWR / TACTICAL SCANNER: 4500M
        </span>
      </div>

      {/* --- BOTTOM-CENTER: SLEEK COLLAPSIBLE CONTROL DOCK --- */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex items-center gap-3 px-5 py-2.5 bg-black/80 border border-emerald-500/40 rounded-full shadow-2xl backdrop-blur-none">
          {/* Camera switch */}
          <button
            onClick={onToggleCamera}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 rounded-full text-xs text-emerald-300 transition-colors cursor-pointer"
            title="Switch View (Key C)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{telemetry.cameraMode === 'chase' ? 'COCKPIT' : 'CHASE'}</span>
          </button>

          {/* Weather switch button */}
          {onToggleWeather && (
            <button
              onClick={onToggleWeather}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 rounded-full text-xs text-emerald-300 transition-colors cursor-pointer"
              title="Cycle Weather (Clear / Fog / Thunderstorm)"
            >
              {telemetry.weather === 'clear' && <Sun className="w-3.5 h-3.5 text-amber-400" />}
              {telemetry.weather === 'fog' && <CloudFog className="w-3.5 h-3.5 text-slate-300" />}
              {telemetry.weather === 'thunderstorm' && <CloudLightning className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
              <span className="uppercase">{telemetry.weather}</span>
            </button>
          )}

          {/* Sound Mute */}
          <button
            onClick={onToggleMute}
            className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 rounded-full text-emerald-300 transition-colors cursor-pointer"
            title="Mute Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="w-[1px] h-4 bg-emerald-500/30"></div>

          {/* Keyboard hint reminder */}
          <div className="hidden md:flex items-center gap-3 text-[11px] text-emerald-400/70">
            <span>WASD: Pitch/Roll</span>
            <span>Q/E: Yaw</span>
            <span>Shift: Boost</span>
            <span>Space: Guns</span>
            <span>F: Missile</span>
            <span>C: Cam</span>
          </div>

          <div className="w-[1px] h-4 bg-emerald-500/30 hidden md:block"></div>

          {/* Pause Button */}
          <button
            onClick={onPause}
            className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-full text-xs text-neutral-300 transition-colors cursor-pointer"
          >
            PAUSE [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};
