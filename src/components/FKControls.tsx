import React, { useEffect, useRef, useState } from 'react';
import {
  ANGLE_PRECISION_STEP,
  ArmatureState,
  BONE_SCALE_MAX,
  BONE_SCALE_MIN,
  ComputedJoint,
  JointId,
  JointMode,
  PAPER_HEIGHT,
  PAPER_WIDTH,
  PYXL_PX,
  PhysicsModeId,
} from '../types';
import {
  PHYSICS_MODE_INFO,
  applyJointAngleConstraint,
  formatSignedNum,
  getPhysicsMultiplier,
} from '../utils/kinematics';

interface FKControlsProps {
  section: 'pose' | 'physics';
  armature: ArmatureState;
  computedJoints: Record<JointId, ComputedJoint>;
  selectedJointId: JointId;
  originMode: 'corner' | 'center';
  onChangeJointAngle: (id: JointId, nextLocalAngle: number, recordHistory?: boolean) => void;
  onSetContinuousSpin: (enabled: boolean) => void;
  onChangeJointMode: (id: JointId, mode: JointMode) => void;
  onChangePhysicsMode: (id: JointId, mode: PhysicsModeId) => void;
  onChangeModeERatio: (id: JointId, ratio: number) => void;
  onChangeBoneScale: (
    id: JointId,
    patch: { scaleLength?: number; scaleWidth?: number },
    recordHistory?: boolean
  ) => void;
  onChangeRootPosition: (x: number, y: number) => void;
  onCommitPoseHistory: () => void;
}

const MODE_OPTIONS: { mode: JointMode; glyph: string; label: string }[] = [
  { mode: 'FK', glyph: '○', label: 'FK' },
  { mode: 'IK', glyph: '●', label: 'IK' },
  { mode: 'PIN', glyph: '■', label: 'PIN' },
];

const PHYSICS_ORDER: PhysicsModeId[] = [
  'twins',
  'elastic_rubber',
  'damp',
  'rigid',
  'mode_e',
];

export const FKControls: React.FC<FKControlsProps> = ({
  section,
  armature,
  computedJoints,
  selectedJointId,
  originMode,
  onChangeJointAngle,
  onSetContinuousSpin,
  onChangeJointMode,
  onChangePhysicsMode,
  onChangeModeERatio,
  onChangeBoneScale,
  onChangeRootPosition,
  onCommitPoseHistory,
}) => {
  const selected = computedJoints[selectedJointId];
  const selectedRuntime = armature.joints[selectedJointId];
  const originX = originMode === 'center' ? PAPER_WIDTH / 2 : 0;
  const originY = originMode === 'center' ? PAPER_HEIGHT / 2 : 0;

  const relX = selected.x - originX;
  const relY = selected.y - originY;

  const [angleInput, setAngleInput] = useState(selected.localAngle.toFixed(2));
  const [rootXInput, setRootXInput] = useState((armature.rootX - originX).toFixed(2));
  const [rootYInput, setRootYInput] = useState((armature.rootY - originY).toFixed(2));
  const [editingModeE, setEditingModeE] = useState(false);
  const [modeEText, setModeEText] = useState(selectedRuntime.modeERatio.toFixed(2));

  const sliderTrackRef = useRef<{ lastRaw: number; unquantizedAngle: number }>({
    lastRaw: selected.localAngle,
    unquantizedAngle: selected.localAngle,
  });

  useEffect(() => {
    setAngleInput(selected.localAngle.toFixed(2));
    sliderTrackRef.current = {
      lastRaw: selected.localAngle,
      unquantizedAngle: selected.localAngle,
    };
  }, [selected.id, selected.localAngle]);

  useEffect(() => {
    setRootXInput((armature.rootX - originX).toFixed(2));
    setRootYInput((armature.rootY - originY).toFixed(2));
  }, [armature.rootX, armature.rootY, originX, originY]);

  useEffect(() => {
    setEditingModeE(false);
    setModeEText(selectedRuntime.modeERatio.toFixed(2));
  }, [selected.id, selectedRuntime.modeERatio]);

  const physicsMultiplier = getPhysicsMultiplier(selectedRuntime);
  const isAngleLocked = selected.mode === 'PIN' || selectedRuntime.physicsMode === 'rigid';

  const commitAngleInput = () => {
    const parsed = parseFloat(angleInput);
    if (!Number.isNaN(parsed)) {
      const nextAngle = applyJointAngleConstraint(parsed, armature.continuousSpin);
      onChangeJointAngle(selected.id, nextAngle, true);
    } else {
      setAngleInput(selected.localAngle.toFixed(2));
    }
  };

  const handleSliderChange = (rawTarget: number) => {
    const delta = rawTarget - sliderTrackRef.current.lastRaw;
    sliderTrackRef.current.lastRaw = rawTarget;

    const scaledDelta = delta * physicsMultiplier;
    const nextUnquantized = sliderTrackRef.current.unquantizedAngle + scaledDelta;
    const boundedUnquantized = armature.continuousSpin
      ? nextUnquantized
      : Math.max(-180, Math.min(180, nextUnquantized));

    sliderTrackRef.current.unquantizedAngle = boundedUnquantized;
    const nextAngle = applyJointAngleConstraint(boundedUnquantized, armature.continuousSpin);
    onChangeJointAngle(selected.id, nextAngle, false);
  };

  const handleNudgeAngle = (dir: -1 | 1) => {
    if (isAngleLocked) return;
    const delta = dir * ANGLE_PRECISION_STEP * physicsMultiplier;
    const nextAngle = applyJointAngleConstraint(
      selected.localAngle + delta,
      armature.continuousSpin
    );
    onChangeJointAngle(selected.id, nextAngle, true);
  };

  const commitModeEText = () => {
    const parsed = parseFloat(modeEText.replace(/×|x/gi, '').trim());
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      const rounded = Math.round(parsed * 100) / 100;
      onChangeModeERatio(selected.id, rounded);
      setModeEText(rounded.toFixed(2));
    } else {
      setModeEText(selectedRuntime.modeERatio.toFixed(2));
    }
    setEditingModeE(false);
  };

  const commitRootCoords = () => {
    if (armature.isAnchorPinned) {
      setRootXInput((armature.rootX - originX).toFixed(2));
      setRootYInput((armature.rootY - originY).toFixed(2));
      return;
    }
    const px = parseFloat(rootXInput);
    const py = parseFloat(rootYInput);
    if (!Number.isNaN(px) && !Number.isNaN(py)) {
      onChangeRootPosition(px + originX, py + originY);
    } else {
      setRootXInput((armature.rootX - originX).toFixed(2));
      setRootYInput((armature.rootY - originY).toFixed(2));
    }
  };

  const sliderMin = armature.continuousSpin
    ? Math.min(-360, Math.floor((selected.localAngle - 180) / 90) * 90)
    : -180;
  const sliderMax = armature.continuousSpin
    ? Math.max(360, Math.ceil((selected.localAngle + 180) / 90) * 90)
    : 180;

  if (section === 'pose') {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-vera font-bold text-xs text-[#FAF6FF] truncate">
              {selected.spec.label}
            </h3>
            <p className="font-vera text-[9.5px] text-[#B8A9C9] truncate">
              {selected.spec.subtitle}
            </p>
          </div>
          <span className="font-typewriter font-bold text-[10.5px] px-1.5 py-0.5 bg-[#0D0012] border border-[#EBE0F5]/18 rounded-[2px] text-[#D8B4FE] shrink-0">
            {selected.spec.shortCode}
          </span>
        </div>

        {selected.id !== 'waist' && (
          <div className="grid grid-cols-3 gap-1 bg-[#0D0012]/80 p-0.5 border border-[#EBE0F5]/14 rounded-[2px]">
            {MODE_OPTIONS.map((opt) => {
              const active = selected.mode === opt.mode;
              const ikDisabled = opt.mode === 'IK' && !selected.spec.ikChain;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  disabled={ikDisabled}
                  onClick={() => onChangeJointMode(selected.id, opt.mode)}
                  className={`py-1 text-[10px] font-vera font-bold rounded-[2px] flex items-center justify-center gap-1 ${
                    ikDisabled
                      ? 'opacity-30 cursor-not-allowed text-[#8B7B9E]'
                      : active
                      ? 'bg-[#361547] text-[#FAF6FF] border border-[#D8B4FE]/40 cursor-pointer'
                      : 'text-[#B8A9C9] hover:text-[#FAF6FF] border border-transparent cursor-pointer'
                  }`}
                >
                  <span>{opt.glyph}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Precision 0.25° Rotation + Continuous Spin */}
        <div className="space-y-1.5 bg-[#0D0012]/70 border border-[#EBE0F5]/12 rounded-[2px] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="joint-angle-input"
              className="font-vera font-bold text-[10.5px] text-[#D9CDE6]"
            >
              {selected.id === 'waist' ? 'Root Tilt' : 'Local Angle'}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isAngleLocked}
                onClick={() => handleNudgeAngle(-1)}
                title="Step -0.25° (scaled by Physics Mode)"
                className="px-1.5 py-0.5 font-typewriter font-bold text-[10px] bg-[#16001E] hover:bg-[#361547] border border-[#EBE0F5]/20 rounded-[2px] text-[#E9D5FF] disabled:opacity-35 cursor-pointer"
              >
                -0.25°
              </button>
              <input
                id="joint-angle-input"
                type="text"
                disabled={isAngleLocked}
                value={angleInput}
                onChange={(e) => setAngleInput(e.target.value)}
                onBlur={commitAngleInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAngleInput();
                }}
                className="w-18 px-1.5 py-0.5 text-right font-typewriter font-bold text-[11px] text-[#FAF6FF] bg-[#16001E] border border-[#EBE0F5]/22 rounded-[2px] focus:outline-none focus:border-[#D8B4FE] disabled:opacity-50"
              />
              <button
                type="button"
                disabled={isAngleLocked}
                onClick={() => handleNudgeAngle(1)}
                title="Step +0.25° (scaled by Physics Mode)"
                className="px-1.5 py-0.5 font-typewriter font-bold text-[10px] bg-[#16001E] hover:bg-[#361547] border border-[#EBE0F5]/20 rounded-[2px] text-[#E9D5FF] disabled:opacity-35 cursor-pointer"
              >
                +0.25°
              </button>
            </div>
          </div>

          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={ANGLE_PRECISION_STEP}
            value={Math.max(sliderMin, Math.min(sliderMax, selected.localAngle))}
            disabled={isAngleLocked}
            onPointerDown={() => {
              sliderTrackRef.current = {
                lastRaw: selected.localAngle,
                unquantizedAngle: selected.localAngle,
              };
            }}
            onPointerUp={onCommitPoseHistory}
            onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
            className="w-full bitruvius-slider"
          />

          <div className="flex items-center justify-between pt-0.5">
            <span className="font-vera text-[9.5px] text-[#9E8EB3]">
              {armature.continuousSpin ? '>360° Free Sweep' : '±180.00° Clamp'}
            </span>
            <button
              type="button"
              onClick={() => onSetContinuousSpin(!armature.continuousSpin)}
              className={`px-2 py-0.5 text-[10px] font-vera font-bold rounded-[2px] border cursor-pointer transition-colors ${
                armature.continuousSpin
                  ? 'bg-[#361547] border-[#D8B4FE]/45 text-[#FAF6FF]'
                  : 'bg-[#16001E] border-[#EBE0F5]/16 text-[#9E8EB3] hover:text-[#FAF6FF]'
              }`}
            >
              {armature.continuousSpin ? 'Spin: Continuous' : 'Spin: Clamped'}
            </button>
          </div>
        </div>

        {/* World X / Y Coordinates & Unpinned Translation */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-[#0D0012]/65 border border-[#EBE0F5]/12 rounded-[2px] px-2 py-1">
            <div className="flex items-center justify-between">
              <span className="font-vera text-[9.5px] text-[#9E8EB3]">World X</span>
              <span className="font-typewriter text-[9.5px] text-[#C8B2E0]">
                {formatSignedNum(relX / PYXL_PX)} pyx
              </span>
            </div>
            {selected.id === 'waist' && !armature.isAnchorPinned ? (
              <input
                type="text"
                value={rootXInput}
                onChange={(e) => setRootXInput(e.target.value)}
                onBlur={commitRootCoords}
                onKeyDown={(e) => e.key === 'Enter' && commitRootCoords()}
                className="w-full mt-0.5 px-1 py-0.5 font-typewriter font-bold text-[10.5px] text-[#FAF6FF] bg-[#16001E] border border-[#EBE0F5]/20 rounded-[2px]"
              />
            ) : (
              <div className="font-typewriter font-bold text-[10.5px] text-[#FAF6FF]">
                {formatSignedNum(relX)} px
              </div>
            )}
          </div>
          <div className="bg-[#0D0012]/65 border border-[#EBE0F5]/12 rounded-[2px] px-2 py-1">
            <div className="flex items-center justify-between">
              <span className="font-vera text-[9.5px] text-[#9E8EB3]">World Y</span>
              <span className="font-typewriter text-[9.5px] text-[#C8B2E0]">
                {formatSignedNum(relY / PYXL_PX)} pyx
              </span>
            </div>
            {selected.id === 'waist' && !armature.isAnchorPinned ? (
              <input
                type="text"
                value={rootYInput}
                onChange={(e) => setRootYInput(e.target.value)}
                onBlur={commitRootCoords}
                onKeyDown={(e) => e.key === 'Enter' && commitRootCoords()}
                className="w-full mt-0.5 px-1 py-0.5 font-typewriter font-bold text-[10.5px] text-[#FAF6FF] bg-[#16001E] border border-[#EBE0F5]/20 rounded-[2px]"
              />
            ) : (
              <div className="font-typewriter font-bold text-[10.5px] text-[#FAF6FF]">
                {formatSignedNum(relY)} px
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-vera font-bold text-xs text-[#FAF6FF] truncate">
          {selected.spec.label}
        </span>
        <span className="font-typewriter font-bold text-[11px] text-[#D8B4FE] shrink-0">
          {physicsMultiplier.toFixed(2)}×
        </span>
      </div>

      {/* 5 Joint Physics Modes */}
      <div className="space-y-1.5 bg-[#0D0012]/70 border border-[#EBE0F5]/12 rounded-[2px] p-2.5">
        <div className="grid grid-cols-2 gap-1">
          {PHYSICS_ORDER.map((pmId) => {
            const info = PHYSICS_MODE_INFO[pmId];
            const active = selectedRuntime.physicsMode === pmId;
            return (
              <button
                key={pmId}
                type="button"
                title={info.description}
                onClick={() => onChangePhysicsMode(selected.id, pmId)}
                className={`px-2 py-1 text-left rounded-[2px] border transition-colors cursor-pointer ${
                  pmId === 'mode_e' ? 'col-span-2 flex items-center justify-between' : ''
                } ${
                  active
                    ? 'bg-[#361547] border-[#D8B4FE]/45 text-[#FAF6FF]'
                    : 'bg-[#16001E]/75 border-[#EBE0F5]/12 text-[#B8A9C9] hover:text-[#FAF6FF]'
                }`}
              >
                <span className="font-vera font-bold text-[10px] block">
                  {info.label}
                </span>
                <span className="font-typewriter text-[9.5px] text-[#C8B2E0]">
                  {pmId === 'mode_e'
                    ? `${selectedRuntime.modeERatio.toFixed(2)}× Custom`
                    : info.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {selectedRuntime.physicsMode === 'mode_e' && (
          <div className="pt-1.5 mt-1 border-t border-[#EBE0F5]/12 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-vera text-[10px] text-[#B8A9C9]">
                Mode E Blend Factor
              </span>
              {editingModeE ? (
                <input
                  type="text"
                  autoFocus
                  value={modeEText}
                  onChange={(e) => setModeEText(e.target.value)}
                  onBlur={commitModeEText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitModeEText();
                    if (e.key === 'Escape') {
                      setModeEText(selectedRuntime.modeERatio.toFixed(2));
                      setEditingModeE(false);
                    }
                  }}
                  className="w-20 px-1.5 py-0.5 text-right font-typewriter font-bold text-[11px] text-[#FAF6FF] bg-[#16001E] border border-[#D8B4FE] rounded-[2px] focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModeEText(selectedRuntime.modeERatio.toFixed(2));
                    setEditingModeE(true);
                  }}
                  title="Click to type custom multiplier (e.g. 0.85, 2.20)"
                  className="px-2 py-0.5 font-typewriter font-bold text-[11px] text-[#FAF6FF] bg-[#250A33] hover:bg-[#361547] border border-[#D8B4FE]/35 rounded-[2px] cursor-text"
                >
                  {selectedRuntime.modeERatio.toFixed(2)}×
                </button>
              )}
            </div>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.01}
              value={Math.max(0.5, Math.min(1.5, selectedRuntime.modeERatio))}
              onPointerUp={onCommitPoseHistory}
              onChange={(e) =>
                onChangeModeERatio(selected.id, parseFloat(e.target.value))
              }
              className="w-full bitruvius-slider"
            />
          </div>
        )}
      </div>

      {/* Non-Uniform Bone-Axis Scaling (0.50x - 2.00x) */}
      <div className="space-y-1.5 bg-[#0D0012]/70 border border-[#EBE0F5]/12 rounded-[2px] p-2.5">
        <div className="flex items-center justify-between">
          <span className="font-vera font-bold text-[10.5px] text-[#D9CDE6]">
            Bone-Axis Scaling
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeBoneScale(selected.id, { scaleLength: 1.0, scaleWidth: 1.0 }, true)
            }
            className="font-typewriter text-[10px] text-[#C8B2E0] hover:text-[#FAF6FF] cursor-pointer"
          >
            1.00× Reset
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-vera text-[10px] text-[#B8A9C9]">Length Axis</span>
              <span className="font-typewriter font-bold text-[10.5px] text-[#FAF6FF]">
                {selectedRuntime.scaleLength.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={BONE_SCALE_MIN}
              max={BONE_SCALE_MAX}
              step={0.01}
              value={selectedRuntime.scaleLength}
              onPointerUp={onCommitPoseHistory}
              onChange={(e) =>
                onChangeBoneScale(selected.id, { scaleLength: parseFloat(e.target.value) }, false)
              }
              className="w-full bitruvius-slider"
            />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-vera text-[10px] text-[#B8A9C9]">Width Axis</span>
              <span className="font-typewriter font-bold text-[10.5px] text-[#FAF6FF]">
                {selectedRuntime.scaleWidth.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={BONE_SCALE_MIN}
              max={BONE_SCALE_MAX}
              step={0.01}
              value={selectedRuntime.scaleWidth}
              onPointerUp={onCommitPoseHistory}
              onChange={(e) =>
                onChangeBoneScale(selected.id, { scaleWidth: parseFloat(e.target.value) }, false)
              }
              className="w-full bitruvius-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
