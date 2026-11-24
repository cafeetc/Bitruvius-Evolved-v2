import React, { useEffect, useState } from 'react';
import {
  ArmatureState,
  CharacterPoseSnapshot,
  ComputedJoint,
  EnvironmentalAnchorId,
  GridConfig,
  GridOriginMode,
  JointId,
  JointMode,
  KeystoneOrigin,
  MEGAPYXL_PX,
  PYXL_PX,
  PhysicsModeId,
  PosePresetId,
  SUBPYXL_PX,
  SnapMode,
} from '../types';
import {
  ENVIRONMENTAL_ANCHORS,
  JOINT_SPECS,
  computeModelWorkingSquare,
  formatSignedDeg,
} from '../utils/kinematics';
import { FKControls } from './FKControls';

interface InspectorConsoleProps {
  armature: ArmatureState;
  computedJoints: Record<JointId, ComputedJoint>;
  selectedJointId: JointId;
  onSelectJoint: (id: JointId) => void;
  onChangeJointAngle: (id: JointId, nextLocalAngle: number, recordHistory?: boolean) => void;
  onSetContinuousSpin: (enabled: boolean) => void;
  onChangePhysicsMode: (id: JointId, mode: PhysicsModeId) => void;
  onChangeModeERatio: (id: JointId, ratio: number) => void;
  onChangeBoneScale: (
    id: JointId,
    patch: { scaleLength?: number; scaleWidth?: number },
    recordHistory?: boolean
  ) => void;
  onChangeKeystone: (keystone: KeystoneOrigin) => void;
  onChangeEnvironmentalAnchor: (anchor: EnvironmentalAnchorId) => void;
  onToggleAnchorPin: () => void;
  onChangeRootPosition: (x: number, y: number) => void;
  onChangeJointMode: (id: JointId, mode: JointMode) => void;
  onCommitPoseHistory: () => void;
  snapshots: CharacterPoseSnapshot[];
  onSaveSnapshot: () => void;
  onRecallSnapshot: (snapshot: CharacterPoseSnapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  grid: GridConfig;
  onUpdateGrid: (patch: Partial<GridConfig>) => void;
  borderOpacity: number;
  onBorderOpacityChange: (val: number) => void;
  showFigure: boolean;
  onToggleFigure: () => void;
  showAllBadges: boolean;
  onToggleAllBadges: () => void;
  onSelectPreset: (preset: PosePresetId) => void;
}

type ConsoleTabId = 'pose' | 'physics' | 'rig' | 'stage';

const CONSOLE_TABS: { id: ConsoleTabId; label: string; requiresFigure?: boolean }[] = [
  { id: 'pose', label: 'Pose', requiresFigure: true },
  { id: 'physics', label: 'Physics', requiresFigure: true },
  { id: 'rig', label: 'Rig', requiresFigure: true },
  { id: 'stage', label: 'Stage' },
];

export const InspectorConsole: React.FC<InspectorConsoleProps> = ({
  armature,
  computedJoints,
  selectedJointId,
  onSelectJoint,
  onChangeJointAngle,
  onSetContinuousSpin,
  onChangePhysicsMode,
  onChangeModeERatio,
  onChangeBoneScale,
  onChangeKeystone,
  onChangeEnvironmentalAnchor,
  onToggleAnchorPin,
  onChangeRootPosition,
  onChangeJointMode,
  onCommitPoseHistory,
  snapshots,
  onSaveSnapshot,
  onRecallSnapshot,
  onDeleteSnapshot,
  grid,
  onUpdateGrid,
  borderOpacity,
  onBorderOpacityChange,
  showFigure,
  onToggleFigure,
  showAllBadges,
  onToggleAllBadges,
  onSelectPreset,
}) => {
  const [activeTab, setActiveTab] = useState<ConsoleTabId>('pose');
  const [sampleHover, setSampleHover] = useState(false);

  useEffect(() => {
    if (!showFigure && activeTab !== 'stage') {
      setActiveTab('stage');
    }
  }, [activeTab, showFigure]);

  return (
    /* Strict 2/3 Stage Canvas + 1/3 Console UI screen split layout */
    <aside className="w-full h-[33.33vh] lg:h-full lg:w-1/3 lg:max-w-[33.3333%] console-panel border-b-0 border-r-0 lg:border-t-0 flex flex-col z-10 shrink-0 overflow-hidden">
      <nav
        aria-label="Console Sections"
        className="grid grid-cols-4 border-b border-[#EBE0F5]/14 bg-[#0D0012]/90 shrink-0"
      >
        {CONSOLE_TABS.map((tab) => {
          const disabled = Boolean(tab.requiresFigure && !showFigure);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={disabled}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 font-vera font-bold text-[11px] tracking-wide border-b-2 transition-colors ${
                disabled
                  ? 'border-transparent text-[#8B7B9E]/35 cursor-not-allowed'
                  : isActive
                  ? 'border-[#D8B4FE] bg-[#250A33]/75 text-[#FAF6FF] cursor-pointer'
                  : 'border-transparent text-[#B8A9C9] hover:text-[#FAF6FF] hover:bg-[#1B0426] cursor-pointer'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto console-scroll p-3 space-y-2.5">
        {/* TAB 1: POSE (Delegated to FKControls + CharacterPoseSnapshot Ledger) */}
        {activeTab === 'pose' && showFigure && (
          <div className="space-y-2.5">
            <FKControls
              section="pose"
              armature={armature}
              computedJoints={computedJoints}
              selectedJointId={selectedJointId}
              originMode={grid.originMode}
              onChangeJointAngle={onChangeJointAngle}
              onSetContinuousSpin={onSetContinuousSpin}
              onChangeJointMode={onChangeJointMode}
              onChangePhysicsMode={onChangePhysicsMode}
              onChangeModeERatio={onChangeModeERatio}
              onChangeBoneScale={onChangeBoneScale}
              onChangeRootPosition={onChangeRootPosition}
              onCommitPoseHistory={onCommitPoseHistory}
            />

            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-vera font-bold text-[11px] text-[#FAF6FF]">
                  Pose Snapshots
                </span>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 xl:hidden">
                    {(['tpose', 'vitruvian', 'contrapposto'] as PosePresetId[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onSelectPreset(p)}
                        className="px-1.5 py-0.5 text-[9.5px] font-vera font-bold bg-[#21072B] border border-[#EBE0F5]/14 rounded-[2px] text-[#E6DCF0] cursor-pointer capitalize"
                      >
                        {p === 'contrapposto' ? 'Contra' : p === 'tpose' ? 'T-Pose' : 'Vitr'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={onSaveSnapshot}
                    className="px-2 py-0.5 font-vera font-bold text-[10px] bg-[#361547] hover:bg-[#491E60] border border-[#D8B4FE]/40 rounded-[2px] text-[#FAF6FF] cursor-pointer"
                  >
                    + Save Pose
                  </button>
                </div>
              </div>

              {snapshots.length === 0 ? (
                <div className="font-vera text-[10px] text-[#9E8EB3] bg-[#0D0012]/50 border border-[#EBE0F5]/10 rounded-[2px] px-2 py-1.5">
                  Save CharacterPoseSnapshot frames to transition via shortest-path wrapping.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.snapshotId}
                      className="px-2 py-1 flex items-center justify-between gap-1.5 bg-[#0D0012]/65 border border-[#EBE0F5]/14 rounded-[2px] hover:bg-[#21072B]/80"
                    >
                      <button
                        type="button"
                        onClick={() => onRecallSnapshot(snap)}
                        className="flex-1 text-left flex items-center justify-between gap-2 cursor-pointer min-w-0"
                      >
                        <span className="font-vera font-bold text-[10px] text-[#FAF6FF] truncate">
                          {snap.label}
                        </span>
                        <span className="font-typewriter text-[9px] text-[#C8B2E0] shrink-0">
                          {snap.continuousSpin ? 'Raw' : 'Norm 180°'} · {snap.keystone}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSnapshot(snap.snapshotId)}
                        title="Delete snapshot"
                        className="px-1 font-typewriter font-bold text-[11px] text-[#9E8EB3] hover:text-[#FCA5A5] cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PHYSICS (Delegated to FKControls) */}
        {activeTab === 'physics' && showFigure && (
          <FKControls
            section="physics"
            armature={armature}
            computedJoints={computedJoints}
            selectedJointId={selectedJointId}
            originMode={grid.originMode}
            onChangeJointAngle={onChangeJointAngle}
            onSetContinuousSpin={onSetContinuousSpin}
            onChangeJointMode={onChangeJointMode}
            onChangePhysicsMode={onChangePhysicsMode}
            onChangeModeERatio={onChangeModeERatio}
            onChangeBoneScale={onChangeBoneScale}
            onChangeRootPosition={onChangeRootPosition}
            onCommitPoseHistory={onCommitPoseHistory}
          />
        )}

        {/* TAB 3: RIG (Keystone Toggle Navel vs Crown + Environmental Anchor + 18-Joint Ledger) */}
        {activeTab === 'rig' && showFigure && (
          <div className="space-y-2.5">
            <div className="space-y-2 bg-[#0D0012]/70 border border-[#EBE0F5]/12 rounded-[2px] p-2.5">
              {/* Keystone Toggle (Navel Default vs Crown Keystone) */}
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#EBE0F5]/10">
                <span className="font-vera font-bold text-[10.5px] text-[#FDE68A]">
                  Internal Keystone
                </span>
                <div className="grid grid-cols-2 gap-1 bg-[#16001E] p-0.5 border border-[#FBBF24]/28 rounded-[2px]">
                  {(['navel', 'crown'] as KeystoneOrigin[]).map((k) => {
                    const active = armature.internalKeystone === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => onChangeKeystone(k)}
                        className={`px-2 py-0.5 text-[10px] font-vera font-bold rounded-[2px] capitalize cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#422006] text-[#FDE68A] border border-[#FBBF24]/45'
                            : 'text-[#B8A9C9] hover:text-[#FAF6FF] border border-transparent'
                        }`}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-vera font-bold text-[11px] text-[#FAF6FF]">
                  Environmental Anchor
                </span>
                <span className="font-typewriter text-[9.5px] text-[#C8B2E0]">
                  {armature.isAnchorPinned ? 'Origin Lock' : 'Free X/Y'}
                </span>
              </div>

              <div className="grid grid-cols-3 lg:grid-cols-2 gap-1">
                {ENVIRONMENTAL_ANCHORS.map((anc) => {
                  const active = armature.environmentalAnchor === anc.id;
                  return (
                    <button
                      key={anc.id}
                      type="button"
                      onClick={() => onChangeEnvironmentalAnchor(anc.id)}
                      className={`px-2 py-1 text-[10px] font-vera font-bold rounded-[2px] border text-left truncate cursor-pointer ${
                        active
                          ? 'bg-[#361547] border-[#D8B4FE]/45 text-[#FAF6FF]'
                          : 'bg-[#16001E]/75 border-[#EBE0F5]/12 text-[#B8A9C9] hover:text-[#FAF6FF]'
                      }`}
                    >
                      {anc.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onToggleAnchorPin}
                  className={`py-1 px-2 rounded-[2px] border flex items-center justify-between text-[10px] font-vera font-bold cursor-pointer ${
                    armature.isAnchorPinned
                      ? 'bg-[#1D2B44]/75 border-[#7DD3FC]/45 text-[#E0F2FE]'
                      : 'bg-[#16001E]/75 border-[#FBBF24]/30 text-[#FDE68A]'
                  }`}
                >
                  <span>{armature.isAnchorPinned ? 'Navel Pin: Locked' : 'Navel Pin: Free'}</span>
                  <span>{armature.isAnchorPinned ? '■' : '○'}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleAllBadges}
                  className={`py-1 px-2 text-[10px] font-vera font-bold rounded-[2px] border cursor-pointer ${
                    showAllBadges
                      ? 'bg-[#361547] border-[#D8B4FE]/35 text-[#FAF6FF]'
                      : 'bg-[#16001E]/75 border-[#EBE0F5]/12 text-[#9E8EB3]'
                  }`}
                >
                  {showAllBadges ? 'Rails: All 18' : 'Rails: Focus'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-vera font-bold text-[10.5px] text-[#D9CDE6]">
                  18-Joint Ledger
                </span>
                <span className="font-vera text-[9.5px] text-[#9E8EB3]">
                  Tap to select
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-1">
                {JOINT_SPECS.map((spec) => {
                  const j = computedJoints[spec.id];
                  const isSelected = selectedJointId === spec.id;
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => onSelectJoint(spec.id)}
                      className={`px-2 py-1 rounded-[2px] border flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#361547] border-[#D8B4FE]/45 text-[#FAF6FF]'
                          : 'bg-[#0D0012]/65 border-[#EBE0F5]/12 text-[#D9CDE6] hover:bg-[#21072B]/80'
                      }`}
                    >
                      <span className="font-vera font-bold text-[9.5px] text-[#C8B2E0]">
                        {spec.shortCode}
                      </span>
                      <span className="font-typewriter font-bold text-[10px] text-[#FAF6FF]">
                        {formatSignedDeg(j.localAngle)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STAGE (3-Tiered Grid, Origin, Snap, Borders & Styling Specimen) */}
        {activeTab === 'stage' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-1.5">
              {[
                {
                  key: 'showMegapyxl' as const,
                  title: 'Megapyxl (1,000 px)',
                  pyx: '10.00 pyx · 1 mpyx',
                },
                {
                  key: 'showPyxl' as const,
                  title: 'Base Pyxl (100 px)',
                  pyx: '1.00 pyx',
                },
                {
                  key: 'showSubpyxl' as const,
                  title: 'Subpyxl (10 px)',
                  pyx: '0.10 pyx',
                },
              ].map((tier) => {
                const enabled = grid[tier.key];
                return (
                  <button
                    key={tier.key}
                    type="button"
                    onClick={() => onUpdateGrid({ [tier.key]: !enabled })}
                    className={`px-2 py-1.5 rounded-[2px] border text-left transition-colors flex items-center justify-between cursor-pointer ${
                      enabled
                        ? 'bg-[#250A33] border-[#D8B4FE]/30 text-[#FAF6FF]'
                        : 'bg-[#0D0012]/50 border-[#EBE0F5]/10 text-[#8B7B9E] hover:text-[#D9CDE6]'
                    }`}
                  >
                    <span className="font-vera font-bold text-[10.5px] flex items-center gap-1">
                      <span>{enabled ? '■' : '□'}</span>
                      <span>{tier.title}</span>
                    </span>
                    <span className="font-typewriter text-[10px] text-[#C8B2E0]">
                      {tier.pyx}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-1">
                <span className="font-vera text-[9.5px] text-[#B8A9C9] block">Origin Datum</span>
                <div className="grid grid-cols-2 gap-1 bg-[#0D0012]/80 p-0.5 border border-[#EBE0F5]/14 rounded-[2px]">
                  {(['center', 'corner'] as GridOriginMode[]).map((orig) => (
                    <button
                      key={orig}
                      type="button"
                      onClick={() => onUpdateGrid({ originMode: orig })}
                      className={`py-1 text-[10px] font-vera font-bold rounded-[2px] capitalize cursor-pointer ${
                        grid.originMode === orig
                          ? 'bg-[#361547] text-[#FAF6FF]'
                          : 'text-[#9E8EB3] hover:text-[#FAF6FF]'
                      }`}
                    >
                      {orig}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-vera text-[9.5px] text-[#B8A9C9] block">Snap Increment</span>
                <div className="grid grid-cols-3 gap-0.5 bg-[#0D0012]/80 p-0.5 border border-[#EBE0F5]/14 rounded-[2px]">
                  {(
                    [
                      { id: 'none', label: 'Off' },
                      { id: 'subpyxl', label: '10' },
                      { id: 'pyxl', label: '100' },
                    ] as { id: SnapMode; label: string }[]
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onUpdateGrid({ snapMode: s.id })}
                      className={`py-1 text-[10px] font-typewriter font-bold rounded-[2px] cursor-pointer ${
                        grid.snapMode === s.id
                          ? 'bg-[#361547] text-[#FAF6FF]'
                          : 'text-[#9E8EB3] hover:text-[#FAF6FF]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => onUpdateGrid({ showLabels: !grid.showLabels })}
                className={`py-1 px-1.5 text-[10px] font-vera font-bold rounded-[2px] border cursor-pointer ${
                  grid.showLabels
                    ? 'bg-[#361547] border-[#D8B4FE]/35 text-[#FAF6FF]'
                    : 'bg-[#0D0012]/60 border-[#EBE0F5]/12 text-[#9E8EB3]'
                }`}
              >
                Axis Ticks
              </button>
              <button
                type="button"
                onClick={() => onUpdateGrid({ showVitruvianGuide: !grid.showVitruvianGuide })}
                className={`py-1 px-1.5 text-[10px] font-vera font-bold rounded-[2px] border cursor-pointer ${
                  grid.showVitruvianGuide
                    ? 'bg-[#361547] border-[#D8B4FE]/35 text-[#FAF6FF]'
                    : 'bg-[#0D0012]/60 border-[#EBE0F5]/12 text-[#9E8EB3]'
                }`}
              >
                Vitruvian
              </button>
              <button
                type="button"
                onClick={onToggleFigure}
                className={`py-1 px-1.5 text-[10px] font-vera font-bold rounded-[2px] border cursor-pointer ${
                  showFigure
                    ? 'bg-[#361547] border-[#D8B4FE]/35 text-[#FAF6FF]'
                    : 'bg-[#0D0012]/60 border-[#EBE0F5]/12 text-[#9E8EB3]'
                }`}
              >
                {showFigure ? 'Hide Fig' : 'Show Fig'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 bg-[#0D0012]/65 border border-[#EBE0F5]/12 rounded-[2px] p-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-vera text-[10px] text-[#B8A9C9]">Border Opacity</span>
                  <span className="font-typewriter font-bold text-[10.5px] text-[#FAF6FF]">
                    {borderOpacity.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={borderOpacity}
                  onChange={(e) => onBorderOpacityChange(parseFloat(e.target.value))}
                  className="w-full bitruvius-slider"
                />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-vera text-[#9E8EB3]">Base Envelope</span>
                <span className="font-typewriter text-[#FAF6FF] font-bold">
                  {computeModelWorkingSquare().sidePx.toFixed(2)} px ·{' '}
                  {(computeModelWorkingSquare().sidePx / PYXL_PX).toFixed(2)} pyx
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-vera text-[#9E8EB3]">Megapyxl Scale</span>
                <span className="font-typewriter text-[#C8B2E0]">
                  {(MEGAPYXL_PX / PYXL_PX).toFixed(2)} pyx · {(SUBPYXL_PX / PYXL_PX).toFixed(2)} sub
                </span>
              </div>
            </div>

            {/* Visual Styling Specimen: 10px Red Joint Dot, 15px Hover Halo, 3px Limb & Dashed Spine */}
            <div
              onMouseEnter={() => setSampleHover(true)}
              onMouseLeave={() => setSampleHover(false)}
              className="bg-[#EAE8E4] rounded-[2px] px-2.5 py-1.5 flex items-center justify-between cursor-crosshair"
            >
              <svg width="96" height="26" viewBox="0 0 96 26" className="overflow-visible">
                <line x1="4" y1="7" x2="44" y2="7" stroke="#16001E" strokeWidth={3} strokeLinecap="round" />
                <line x1="4" y1="19" x2="44" y2="19" stroke="#2A0F3B" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" />
                <g transform="translate(72, 13)">
                  {sampleHover && (
                    <circle r={7.5} fill="rgba(220, 38, 38, 0.28)" stroke="#EF4444" strokeWidth={1.5} />
                  )}
                  <circle
                    r={5}
                    fill={sampleHover ? '#EF4444' : '#DC2626'}
                    stroke="#F6F2FA"
                    strokeWidth={1.5}
                    style={{ transition: 'fill 140ms ease' }}
                  />
                  <circle r={1.5} fill="#FBBF24" />
                </g>
              </svg>
              <div className="px-1.5 py-0.5 bg-[#16001E]/90 border border-[#D8B4FE]/40 rounded-[2px] font-vera font-bold text-[9.5px] text-[#FCA5A5] whitespace-nowrap">
                10px Red · 15px Halo
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
