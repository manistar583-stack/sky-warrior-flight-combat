import React, { useRef, useState, useEffect } from 'react';
import { FlightInputs } from '../game/types';
import { Flame, Shield, Crosshair, Target, Eye } from 'lucide-react';

interface MobileControlsProps {
  onUpdateInputs: (updater: (prev: FlightInputs) => FlightInputs) => void;
  onToggleCamera: () => void;
  onDeployFlare: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onUpdateInputs,
  onToggleCamera,
  onDeployFlare,
}) => {
  const stickRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const activeTouchId = useRef<number | null>(null);

  // Touch handler for virtual flight stick
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsDragging(true);
    updateStick(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        updateStick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsDragging(false);
        setKnobPos({ x: 0, y: 0 });
        onUpdateInputs((prev) => ({
          ...prev,
          pitchUp: false,
          pitchDown: false,
          rollLeft: false,
          rollRight: false,
        }));
        break;
      }
    }
  };

  const updateStick = (clientX: number, clientY: number) => {
    if (!stickRef.current) return;
    const rect = stickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = 45;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * (clampedDist / maxRadius);
    const ny = Math.sin(angle) * (clampedDist / maxRadius);

    setKnobPos({
      x: nx * maxRadius,
      y: ny * maxRadius,
    });

    const deadzone = 0.22;
    onUpdateInputs((prev) => ({
      ...prev,
      rollLeft: nx < -deadzone,
      rollRight: nx > deadzone,
      // Flight standard: pulling stick down (positive Y) pitches nose UP; pushing forward pitches nose DOWN
      pitchUp: ny > deadzone,
      pitchDown: ny < -deadzone,
    }));
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 md:hidden flex justify-between items-end p-6 pb-20">
      {/* Left: Virtual Flight Joystick */}
      <div
        ref={stickRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="relative w-36 h-36 rounded-full border-2 border-emerald-500/50 bg-black/60 pointer-events-auto flex items-center justify-center shadow-lg"
      >
        {/* Crosshair guide lines */}
        <div className="absolute inset-x-2 top-1/2 h-[1px] bg-emerald-500/30 -translate-y-1/2" />
        <div className="absolute inset-y-2 left-1/2 w-[1px] bg-emerald-500/30 -translate-x-1/2" />

        {/* Joystick Thumb Knob */}
        <div
          className="w-14 h-14 rounded-full bg-emerald-600/80 border border-emerald-300 shadow-md transition-transform duration-75 flex items-center justify-center"
          style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
        >
          <div className="w-4 h-4 rounded-full bg-emerald-200" />
        </div>
      </div>

      {/* Right: Combat Buttons Cluster */}
      <div className="flex flex-col items-end gap-3 pointer-events-auto">
        {/* Top row: Boost & Flare */}
        <div className="flex gap-3">
          <button
            onTouchStart={() => onUpdateInputs((prev) => ({ ...prev, boost: true }))}
            onTouchEnd={() => onUpdateInputs((prev) => ({ ...prev, boost: false }))}
            className="w-14 h-14 rounded-full bg-cyan-700/80 active:bg-cyan-500 border border-cyan-400 text-cyan-100 flex flex-col items-center justify-center text-[10px] font-bold shadow-lg"
          >
            <Flame className="w-5 h-5" />
            <span>BOOST</span>
          </button>

          <button
            onClick={onDeployFlare}
            className="w-14 h-14 rounded-full bg-amber-700/80 active:bg-amber-500 border border-amber-400 text-amber-100 flex flex-col items-center justify-center text-[10px] font-bold shadow-lg"
          >
            <Shield className="w-5 h-5" />
            <span>FLARE</span>
          </button>
        </div>

        {/* Bottom row: Missile & Vulcan Gun */}
        <div className="flex gap-3">
          <button
            onTouchStart={() => onUpdateInputs((prev) => ({ ...prev, fireMissile: true }))}
            onTouchEnd={() => onUpdateInputs((prev) => ({ ...prev, fireMissile: false }))}
            className="w-16 h-16 rounded-full bg-red-700/80 active:bg-red-500 border-2 border-red-400 text-red-100 flex flex-col items-center justify-center text-xs font-bold shadow-xl"
          >
            <Target className="w-6 h-6" />
            <span>MISSILE</span>
          </button>

          <button
            onTouchStart={() => onUpdateInputs((prev) => ({ ...prev, fireGuns: true }))}
            onTouchEnd={() => onUpdateInputs((prev) => ({ ...prev, fireGuns: false }))}
            className="w-16 h-16 rounded-full bg-emerald-700/80 active:bg-emerald-500 border-2 border-emerald-400 text-emerald-100 flex flex-col items-center justify-center text-xs font-bold shadow-xl"
          >
            <Crosshair className="w-6 h-6" />
            <span>GUNS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
