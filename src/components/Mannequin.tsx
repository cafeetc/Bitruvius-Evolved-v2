import React, { useMemo } from 'react';
import {
  ArmatureState,
  ComputedJoint,
  JointId,
  JointMode,
  SilhouetteDisplayMode,
} from '../types';
import {
  JOINT_SPECS,
  SideCalloutDescriptor,
  formatSignedDeg,
  getEnvironmentalAnchorPoint,
} from '../utils/kinematics';
import {
  buildSkeletonPieceRenders,
  computeDigitalModel,
} from '../utils/skeletonAttachment';
import { Bone } from './Bone';

interface MannequinProps {
  armature: ArmatureState;
  computedJoints: Record<JointId, ComputedJoint>;
  selectedJointId: JointId;
  hoveredJointId: JointId | null;
  silhouetteMode: SilhouetteDisplayMode;
  sideCallouts: SideCalloutDescriptor[];
  cameraMoveActive: boolean;
  isPanning: boolean;
  zoom: number;
  onSelectJoint: (id: JointId) => void;
  onHoverJoint: (id: JointId | null) => void;
  onPointerDownJoint: (e: React.PointerEvent<SVGGElement>, jointId: JointId) => void;
  onPointerDownBone: (e: React.PointerEvent<SVGGElement>, jointId: JointId) => void;
}

const MODE_GLYPH: Record<JointMode, string> = {
  ROOT: '◆',
  IK: '●',
  FK: '○',
  PIN: '■',
};

const CANVAS_MODE_INK: Record<JointMode, string> = {
  ROOT: '#4C1D95',
  IK: '#0369A1',
  FK: '#16001E',
  PIN: '#991B1B',
};

export const SILHOUETTE_INK_COLOR = '#261D2E';

export const Mannequin: React.FC<MannequinProps> = ({
  armature,
  computedJoints,
  selectedJointId,
  hoveredJointId,
  silhouetteMode,
  sideCallouts,
  cameraMoveActive,
  isPanning,
  zoom,
  onSelectJoint,
  onHoverJoint,
  onPointerDownJoint,
  onPointerDownBone,
}) => {
  const pureShadow = silhouetteMode === 'pure_shadow';

  const sortedSkeletonPieces = useMemo(
    () => buildSkeletonPieceRenders(armature, computedJoints),
    [armature, computedJoints]
  );

  const digitalModel = useMemo(
    () => (pureShadow ? null : computeDigitalModel(armature, computedJoints)),
    [armature, computedJoints, pureShadow]
  );

  const selectedJoint = computedJoints[selectedJointId];
  const anchorPoint = useMemo(
    () => getEnvironmentalAnchorPoint(computedJoints, armature.environmentalAnchor),
    [computedJoints, armature.environmentalAnchor]
  );

  const wireframeSegments = useMemo(() => {
    const segments: {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isSpine: boolean;
      isActive: boolean;
    }[] = [];

    for (const spec of JOINT_SPECS) {
      if (!spec.parentId) continue;
      const child = computedJoints[spec.id];
      const parent = computedJoints[spec.parentId];
      const isActive =
        selectedJointId === spec.id ||
        hoveredJointId === spec.id ||
        selectedJointId === spec.parentId;

      segments.push({
        key: `seg-${spec.id}`,
        x1: parent.x,
        y1: parent.y,
        x2: child.x,
        y2: child.y,
        isSpine: Boolean(spec.isSpine),
        isActive,
      });

      if (spec.endExtensionPx && spec.endExtensionPx > 0) {
        segments.push({
          key: `ext-${spec.id}`,
          x1: child.x,
          y1: child.y,
          x2: child.endX,
          y2: child.endY,
          isSpine: Boolean(spec.isSpine),
          isActive: selectedJointId === spec.id || hoveredJointId === spec.id,
        });
      }
    }

    return segments;
  }, [computedJoints, hoveredJointId, selectedJointId]);

  return (
    <g data-mannequin="vitruvian" data-silhouette-mode={silhouetteMode}>
      <defs>
        <filter
          id="skeleton-silhouette-tint"
          colorInterpolationFilters="sRGB"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feFlood floodColor={SILHOUETTE_INK_COLOR} floodOpacity="1" result="silhouetteInk" />
          <feComposite in="silhouetteInk" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id="skeleton-selected-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#A855F7" floodOpacity="0.85" />
        </filter>
        <filter id="skeleton-hover-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#7DD3FC" floodOpacity="0.78" />
        </filter>
      </defs>

      {/* Pass 0: Puppyt Underlying Digital Kinematic Model (rendered beneath purple skeleton in wireframe view) */}
      {!pureShadow && digitalModel && (
        <g data-digital-model="true" pointerEvents="none">
          {digitalModel.segments.map((seg) => {
            const isStrained = seg.kind === 'strained';
            const isGhost = seg.kind === 'ghost';
            const haloColor = isStrained
              ? 'rgba(225, 29, 72, 0.36)'
              : isGhost
              ? 'rgba(22, 163, 74, 0.22)'
              : 'rgba(34, 197, 94, 0.38)';
            const coreColor = isStrained
              ? '#E11D48'
              : isGhost
              ? 'rgba(22, 163, 74, 0.72)'
              : '#16A34A';

            return (
              <g key={seg.key}>
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={haloColor}
                  strokeWidth={isStrained ? 10 : 8}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={coreColor}
                  strokeOpacity={isGhost ? 0.78 : 0.94}
                  strokeWidth={isStrained ? 2.6 : 1.9}
                  strokeDasharray={isGhost ? '4 4' : undefined}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {digitalModel.dots.map((dot) => (
            <g key={dot.key} transform={`translate(${dot.x}, ${dot.y}) scale(${1 / zoom})`}>
              <circle
                r={dot.radius * 2.1}
                fill={dot.strained ? 'rgba(225, 29, 72, 0.26)' : 'rgba(34, 197, 94, 0.28)'}
              />
              <circle
                r={dot.radius * 0.8}
                fill={dot.strained ? '#E11D48' : '#22C55E'}
                fillOpacity={dot.ghost ? 0.65 : 0.96}
                stroke="#F0FDF4"
                strokeWidth={1.0}
              />
            </g>
          ))}
        </g>
      )}

      {/* Pass 1: Z-Sorted 33-Piece Skeleton (Unified Dark Purple-Gray Silhouette by default; full color in Wireframe) */}
      <g
        data-skeleton-silhouette="true"
        data-silhouette-color={pureShadow ? SILHOUETTE_INK_COLOR : undefined}
        filter={pureShadow ? 'url(#skeleton-silhouette-tint)' : undefined}
        style={{
          opacity: pureShadow ? 0.96 : 1,
        }}
      >
        {sortedSkeletonPieces.map((piece) => (
          <Bone
            key={piece.key}
            piece={piece}
            isSelected={!pureShadow && selectedJointId === piece.jointId}
            isHovered={!pureShadow && hoveredJointId === piece.jointId}
            pureShadow={pureShadow}
            onPointerDown={onPointerDownBone}
            onPointerEnter={onHoverJoint}
            onPointerLeave={() => onHoverJoint(null)}
          />
        ))}
      </g>

      {/* Pass 2: Alignment Wireframe & Transparent Bordered On-Canvas Callouts */}
      {!pureShadow && (
        <g>
          {/* Selected Joint Reference Parent-Axis Ray */}
          {selectedJoint &&
            selectedJoint.parentX !== null &&
            selectedJoint.parentY !== null && (
              <line
                x1={selectedJoint.parentX}
                y1={selectedJoint.parentY}
                x2={
                  selectedJoint.parentX +
                  Math.cos(
                    ((selectedJoint.worldAngle - selectedJoint.localAngle) * Math.PI) / 180
                  ) *
                    72
                }
                y2={
                  selectedJoint.parentY +
                  Math.sin(
                    ((selectedJoint.worldAngle - selectedJoint.localAngle) * Math.PI) / 180
                  ) *
                    72
                }
                stroke="#C084FC"
                strokeOpacity={0.75}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}

          {/* 3px Solid Limb & 3px Dashed Spine Armature Lines */}
          <g pointerEvents="none">
            {wireframeSegments.map((seg) => (
              <g key={seg.key}>
                {seg.isActive && (
                  <line
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke="rgba(168, 85, 247, 0.36)"
                    strokeWidth={8}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke="#16001E"
                  strokeOpacity={0.65}
                  strokeWidth={5}
                  strokeDasharray={seg.isSpine ? '8 6' : undefined}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={seg.isActive ? '#E9D5FF' : seg.isSpine ? '#D8B4FE' : '#F3EEF9'}
                  strokeOpacity={seg.isActive ? 0.96 : 0.84}
                  strokeWidth={3}
                  strokeDasharray={seg.isSpine ? '8 6' : undefined}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </g>

          {/* Active Environmental Anchor Diamond */}
          <g
            transform={`translate(${anchorPoint.x}, ${anchorPoint.y}) scale(${1 / zoom})`}
            pointerEvents="none"
          >
            <polygon
              points="0,-10 10,0 0,10 -10,0"
              fill="none"
              stroke={armature.isAnchorPinned ? '#0369A1' : '#B45309'}
              strokeWidth={1.5}
              strokeDasharray={armature.isAnchorPinned ? undefined : '2 2'}
            />
          </g>

          {/* Interactive 10px Red Joint Dots & 15px Hover Halos */}
          <g>
            {JOINT_SPECS.map((spec) => {
              const joint = computedJoints[spec.id];
              const runtime = armature.joints[spec.id];
              const isSelected = selectedJointId === spec.id;
              const isHovered = hoveredJointId === spec.id;
              const isRigid = runtime.physicsMode === 'rigid';
              const isKeystoneJoint =
                (armature.internalKeystone === 'navel' && joint.id === 'navel') ||
                (armature.internalKeystone === 'crown' && joint.id === 'head');

              return (
                <g
                  key={`joint-${spec.id}`}
                  transform={`translate(${joint.x}, ${joint.y})`}
                  onPointerEnter={() => onHoverJoint(spec.id)}
                  onPointerLeave={() => onHoverJoint(null)}
                  onPointerDown={(e) => onPointerDownJoint(e, spec.id)}
                  style={{
                    cursor: isPanning
                      ? 'grabbing'
                      : cameraMoveActive
                      ? 'grab'
                      : joint.mode === 'PIN' || isRigid
                      ? 'not-allowed'
                      : 'pointer',
                  }}
                >
                  <g transform={`scale(${1 / zoom})`}>
                    <circle r={16} fill="transparent" />
                    {/* Selected 10px joint target ring */}
                    {isSelected && (
                      <circle
                        r={12.5}
                        fill="rgba(220, 38, 38, 0.14)"
                        stroke="#EF4444"
                        strokeWidth={1.25}
                        strokeDasharray="3 3"
                      />
                    )}
                    {/* 15px (r=7.5) crimson hover halo */}
                    {isHovered && (
                      <circle
                        r={7.5}
                        fill="rgba(220, 38, 38, 0.28)"
                        stroke="#EF4444"
                        strokeWidth={1.5}
                      />
                    )}
                    {/* 10px (r=5) default red joint dot */}
                    <circle
                      r={5}
                      fill={
                        joint.mode === 'PIN' || isRigid
                          ? '#7F1D1D'
                          : isSelected || isHovered
                          ? '#EF4444'
                          : '#DC2626'
                      }
                      stroke="#F6F2FA"
                      strokeWidth={1.5}
                      style={{
                        transition: 'fill 140ms ease',
                      }}
                    />
                    <circle
                      r={1.5}
                      fill={
                        isKeystoneJoint
                          ? '#FBBF24'
                          : joint.mode === 'IK'
                          ? '#7DD3FC'
                          : '#F6F2FA'
                      }
                      pointerEvents="none"
                    />
                  </g>
                </g>
              );
            })}
          </g>

          {/* Transparent On-Canvas Side-Rail Callouts with Subtle Drafting Borders */}
          <g>
            {sideCallouts.map((c) => {
              const isActive = c.isSelected || c.isHovered;
              const boxXOffset = c.side === 'left' ? -c.boxWidthPx : 0;
              return (
                <g
                  key={`side-callout-${c.joint.id}`}
                  style={{
                    opacity: isActive ? 1 : 0.42,
                    transition: 'opacity 140ms ease',
                  }}
                >
                  <polyline
                    points={`${c.perimeterX},${c.joint.y} ${(c.perimeterX + c.railEdgeX) / 2},${c.calloutY} ${c.railEdgeX},${c.calloutY}`}
                    fill="none"
                    stroke={
                      c.isSelected
                        ? 'rgba(109, 40, 217, 0.56)'
                        : c.isHovered
                        ? 'rgba(3, 105, 161, 0.52)'
                        : 'rgba(22, 0, 30, 0.34)'
                    }
                    strokeWidth={isActive ? 1.1 : 0.85}
                    strokeDasharray={c.isSelected ? undefined : '2 2'}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <circle
                    cx={c.perimeterX}
                    cy={c.joint.y}
                    r={1.75 / zoom}
                    fill={c.isSelected ? 'rgba(109, 40, 217, 0.7)' : 'rgba(22, 0, 30, 0.45)'}
                    pointerEvents="none"
                  />
                  <g
                    transform={`translate(${c.railEdgeX}, ${c.calloutY}) scale(${1 / zoom})`}
                    onPointerEnter={() => onHoverJoint(c.joint.id)}
                    onPointerLeave={() => onHoverJoint(null)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectJoint(c.joint.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={boxXOffset}
                      y={-10}
                      width={c.boxWidthPx}
                      height={20}
                      rx={2}
                      fill="transparent"
                      stroke={
                        c.isSelected
                          ? 'rgba(109, 40, 217, 0.72)'
                          : c.isHovered
                          ? 'rgba(3, 105, 161, 0.65)'
                          : 'rgba(22, 0, 30, 0.45)'
                      }
                      strokeWidth={c.isSelected ? 1.25 : 0.9}
                    />
                    <text
                      x={boxXOffset + 7}
                      y={3.5}
                      fill="rgba(22, 0, 30, 0.75)"
                      fontSize={9}
                      fontWeight={700}
                      fontFamily="UMTypewriter, monospace"
                    >
                      {c.joint.spec.shortCode}
                    </text>
                    <text
                      x={boxXOffset + 48}
                      y={3.5}
                      fill={c.isRigid ? '#991B1B' : CANVAS_MODE_INK[c.joint.mode]}
                      fontSize={9.5}
                      fontWeight={700}
                      fontFamily="UMTypewriter, monospace"
                    >
                      {c.isRigid ? '■ LOCK' : `${MODE_GLYPH[c.joint.mode]} ${c.joint.mode}`}
                    </text>
                    <text
                      x={boxXOffset + 104}
                      y={3.5}
                      fill="#16001E"
                      fontSize={9.5}
                      fontWeight={700}
                      fontFamily="UMTypewriter, monospace"
                    >
                      {formatSignedDeg(c.joint.localAngle)}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      )}
    </g>
  );
};
