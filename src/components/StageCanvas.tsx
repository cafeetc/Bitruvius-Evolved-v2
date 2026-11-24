import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArmatureState,
  ComputedJoint,
  GridConfig,
  JointId,
  MEGAPYXL_PX,
  PAPER_HEIGHT,
  PAPER_WIDTH,
  PYXL_PX,
  REPOSITORY_ASSET_PATHS,
  SUBPYXL_PX,
  SilhouetteDisplayMode,
} from '../types';
import {
  JOINT_SPEC_MAP,
  WorldExclusionRect,
  applyJointAngleConstraint,
  computeModelBounds,
  computePushedSideCallouts,
  formatSignedNum,
  getPhysicsMultiplier,
  shortestAngleDelta,
  solveSpineCCDIK,
  solveTwoBoneIK,
} from '../utils/kinematics';
import { GridIntertitleLayer, IntertitleItem } from './IntertitleOverlay';
import { Mannequin } from './Mannequin';

interface StageCanvasProps {
  armature: ArmatureState;
  computedJoints: Record<JointId, ComputedJoint>;
  selectedJointId: JointId;
  hoveredJointId: JointId | null;
  borderOpacity: number;
  grid: GridConfig;
  showFigure: boolean;
  silhouetteMode: SilhouetteDisplayMode;
  showAllBadges: boolean;
  cameraUnlocked: boolean;
  onShiftHoldChange?: (held: boolean) => void;
  zoom: number;
  pan: { x: number; y: number };
  onZoomChange: (nextZoom: number) => void;
  onPanChange: (nextPan: { x: number; y: number }) => void;
  onSelectJoint: (id: JointId) => void;
  onHoverJoint: (id: JointId | null) => void;
  onUpdateArmature: (next: ArmatureState) => void;
  onCommitPoseHistory?: () => void;
  onCursorMove: (coords: { x: number; y: number } | null) => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  intertitleItem: IntertitleItem | null;
  intertitleDismissing: boolean;
  onTriggerDismissIntertitle: () => void;
  onIntertitleDismissComplete: () => void;
}

type ActiveDragState =
  | {
      type: 'pan';
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      type: 'root_translate';
      offsetX: number;
      offsetY: number;
    }
  | {
      type: 'ik';
      jointId: JointId;
      offsetX: number;
      offsetY: number;
    }
  | {
      type: 'fk_rotate';
      targetJointId: JointId;
      pivotX: number;
      pivotY: number;
      lastCursorDeg: number;
      rawAngle: number;
    };

export const StageCanvas: React.FC<StageCanvasProps> = ({
  armature,
  computedJoints,
  selectedJointId,
  hoveredJointId,
  borderOpacity,
  grid,
  showFigure,
  silhouetteMode,
  showAllBadges,
  cameraUnlocked,
  onShiftHoldChange,
  zoom,
  pan,
  onZoomChange,
  onPanChange,
  onSelectJoint,
  onHoverJoint,
  onUpdateArmature,
  onCommitPoseHistory,
  onCursorMove,
  stageRef,
  svgRef: externalSvgRef,
  intertitleItem,
  intertitleDismissing,
  onTriggerDismissIntertitle,
  onIntertitleDismissComplete,
}) => {
  const internalSvgRef = useRef<SVGSVGElement | null>(null);
  const svgRef = externalSvgRef ?? internalSvgRef;
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageRef]);

  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);

  useEffect(() => {
    const updateShift = (held: boolean) => {
      setShiftPressed(held);
      onShiftHoldChange?.(held);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.shiftKey) {
        updateShift(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || !e.shiftKey) {
        updateShift(false);
      }
    };
    const handleBlur = () => updateShift(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onShiftHoldChange]);

  const cameraMoveActive = shiftPressed || cameraUnlocked;

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - pan.x) / zoom,
        y: (sy - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  const originOffset = useMemo(() => {
    return grid.originMode === 'center'
      ? { x: PAPER_WIDTH / 2, y: PAPER_HEIGHT / 2 }
      : { x: 0, y: 0 };
  }, [grid.originMode]);

  const snapCoord = useCallback(
    (val: number, axisOrigin: number) => {
      if (grid.snapMode === 'none') return val;
      const step = grid.snapMode === 'pyxl' ? PYXL_PX : SUBPYXL_PX;
      return Math.round((val - axisOrigin) / step) * step + axisOrigin;
    },
    [grid.snapMode]
  );

  const beginPanDrag = useCallback(
    (e: React.PointerEvent) => {
      svgRef.current?.setPointerCapture(e.pointerId);
      setDragState({
        type: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
    },
    [pan.x, pan.y]
  );

  const startCumulativeFKRotate = useCallback(
    (e: React.PointerEvent, targetJointId: JointId) => {
      const runtime = armature.joints[targetJointId];
      if (!runtime || runtime.mode === 'PIN' || runtime.physicsMode === 'rigid') return;

      const world = clientToWorld(e.clientX, e.clientY);
      const pivot = computedJoints[targetJointId];
      const cursorDeg = (Math.atan2(world.y - pivot.y, world.x - pivot.x) * 180) / Math.PI;
      const rawAngle = targetJointId === 'waist' ? armature.rootRotation : runtime.localAngle;

      svgRef.current?.setPointerCapture(e.pointerId);
      setDragState({
        type: 'fk_rotate',
        targetJointId,
        pivotX: pivot.x,
        pivotY: pivot.y,
        lastCursorDeg: cursorDeg,
        rawAngle,
      });
    },
    [armature.joints, armature.rootRotation, clientToWorld, computedJoints]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (!cameraMoveActive && !e.shiftKey) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 0.909;
      const nextZoom = Math.max(0.15, Math.min(4.0, zoom * factor));
      const worldX = (sx - pan.x) / zoom;
      const worldY = (sy - pan.y) / zoom;

      onZoomChange(nextZoom);
      onPanChange({
        x: sx - worldX * nextZoom,
        y: sy - worldY * nextZoom,
      });
    },
    [cameraMoveActive, zoom, pan.x, pan.y, onZoomChange, onPanChange]
  );

  const handlePointerDownStage = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!(cameraMoveActive || e.shiftKey)) return;
      if (e.button === 0 || e.button === 1) {
        beginPanDrag(e);
      }
    },
    [beginPanDrag, cameraMoveActive]
  );

  const handlePointerDownJoint = useCallback(
    (e: React.PointerEvent<SVGGElement>, jointId: JointId) => {
      e.stopPropagation();
      if (cameraMoveActive || e.shiftKey) {
        beginPanDrag(e);
        return;
      }

      onSelectJoint(jointId);
      const joint = computedJoints[jointId];
      if (joint.mode === 'PIN' || armature.joints[jointId].physicsMode === 'rigid') return;

      const world = clientToWorld(e.clientX, e.clientY);

      if (joint.mode === 'ROOT' || jointId === 'waist') {
        if (!armature.isAnchorPinned) {
          svgRef.current?.setPointerCapture(e.pointerId);
          setDragState({
            type: 'root_translate',
            offsetX: joint.x - world.x,
            offsetY: joint.y - world.y,
          });
        } else {
          startCumulativeFKRotate(e, 'waist');
        }
        return;
      }

      if (joint.mode === 'IK' && joint.spec.ikChain) {
        svgRef.current?.setPointerCapture(e.pointerId);
        setDragState({
          type: 'ik',
          jointId,
          offsetX: joint.x - world.x,
          offsetY: joint.y - world.y,
        });
        return;
      }

      // FK dot drag: dragging distal segment tip aims parent bone under pointer; socket origins rotate self
      const spec = JOINT_SPEC_MAP[jointId];
      const aimJointId =
        spec.parentId && !spec.socketOffset ? spec.parentId : jointId;
      startCumulativeFKRotate(e, aimJointId);
    },
    [
      armature.isAnchorPinned,
      armature.joints,
      beginPanDrag,
      cameraMoveActive,
      clientToWorld,
      computedJoints,
      onSelectJoint,
      startCumulativeFKRotate,
    ]
  );

  const handlePointerDownBone = useCallback(
    (e: React.PointerEvent<SVGGElement>, jointId: JointId) => {
      e.stopPropagation();
      if (cameraMoveActive || e.shiftKey) {
        beginPanDrag(e);
        return;
      }

      onSelectJoint(jointId);
      const runtime = armature.joints[jointId];
      if (!runtime || runtime.mode === 'PIN' || runtime.physicsMode === 'rigid') return;

      if (jointId === 'waist' && !armature.isAnchorPinned) {
        const world = clientToWorld(e.clientX, e.clientY);
        const waist = computedJoints.waist;
        svgRef.current?.setPointerCapture(e.pointerId);
        setDragState({
          type: 'root_translate',
          offsetX: waist.x - world.x,
          offsetY: waist.y - world.y,
        });
        return;
      }

      startCumulativeFKRotate(e, jointId);
    },
    [
      armature.isAnchorPinned,
      armature.joints,
      beginPanDrag,
      cameraMoveActive,
      clientToWorld,
      computedJoints,
      onSelectJoint,
      startCumulativeFKRotate,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const world = clientToWorld(e.clientX, e.clientY);
      onCursorMove({
        x: world.x - originOffset.x,
        y: world.y - originOffset.y,
      });

      if (!dragState) return;

      if (dragState.type === 'pan') {
        onPanChange({
          x: dragState.startPanX + (e.clientX - dragState.startClientX),
          y: dragState.startPanY + (e.clientY - dragState.startClientY),
        });
        return;
      }

      if (dragState.type === 'root_translate') {
        const targetX = snapCoord(world.x + dragState.offsetX, originOffset.x);
        const targetY = snapCoord(world.y + dragState.offsetY, originOffset.y);
        onUpdateArmature({
          ...armature,
          rootX: targetX,
          rootY: targetY,
        });
        return;
      }

      if (dragState.type === 'ik') {
        const targetX = snapCoord(world.x + dragState.offsetX, originOffset.x);
        const targetY = snapCoord(world.y + dragState.offsetY, originOffset.y);
        const joint = computedJoints[dragState.jointId];
        if (joint.spec.ikChain === 'spine') {
          onUpdateArmature(solveSpineCCDIK(armature, targetX, targetY, originOffset));
        } else {
          onUpdateArmature(
            solveTwoBoneIK(armature, dragState.jointId, targetX, targetY, originOffset)
          );
        }
        return;
      }

      if (dragState.type === 'fk_rotate') {
        const { targetJointId, pivotX, pivotY, lastCursorDeg, rawAngle } = dragState;
        const currDeg = (Math.atan2(world.y - pivotY, world.x - pivotX) * 180) / Math.PI;
        const deltaCursor = shortestAngleDelta(lastCursorDeg, currDeg);
        if (Math.abs(deltaCursor) < 1e-4) return;

        const runtime = armature.joints[targetJointId];
        const mult = getPhysicsMultiplier(runtime);
        if (mult === 0) return;

        const nextUnclamped = rawAngle + deltaCursor * mult;
        const nextRawAngle = armature.continuousSpin
          ? nextUnclamped
          : Math.max(-180, Math.min(180, nextUnclamped));
        const nextAppliedAngle = applyJointAngleConstraint(
          nextRawAngle,
          armature.continuousSpin
        );

        setDragState({
          ...dragState,
          lastCursorDeg: currDeg,
          rawAngle: nextRawAngle,
        });

        if (targetJointId === 'waist') {
          onUpdateArmature({
            ...armature,
            rootRotation: nextAppliedAngle,
          });
        } else {
          onUpdateArmature({
            ...armature,
            joints: {
              ...armature.joints,
              [targetJointId]: {
                ...runtime,
                localAngle: nextAppliedAngle,
              },
            },
          });
        }
      }
    },
    [
      armature,
      clientToWorld,
      computedJoints,
      dragState,
      onCursorMove,
      onPanChange,
      onUpdateArmature,
      originOffset,
      snapCoord,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragState) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // ignore if already released
        }
        if (dragState.type !== 'pan') {
          onCommitPoseHistory?.();
        }
        setDragState(null);
      }
    },
    [dragState, onCommitPoseHistory]
  );

  const endlessBounds = useMemo(() => {
    const overscan = Math.max(2000, 1500 / zoom);
    const minX = -pan.x / zoom - overscan;
    const minY = -pan.y / zoom - overscan;
    const width = viewportSize.width / zoom + overscan * 2;
    const height = viewportSize.height / zoom + overscan * 2;
    return {
      minX,
      minY,
      width,
      height,
      maxX: minX + width,
      maxY: minY + height,
    };
  }, [pan.x, pan.y, zoom, viewportSize.width, viewportSize.height]);

  const rulerTicks = useMemo(() => {
    type RawTick = {
      screen: number;
      candidateLabel: string | null;
      label: string | null;
      tier: 'mega' | 'major' | 'minor';
    };

    const showMinorLabels = PYXL_PX * zoom >= 72;
    const showMajorLabels = 5 * PYXL_PX * zoom >= 90;

    const assignNonOverlappingLabels = (ticks: RawTick[], minLabelGap: number) => {
      const placed: number[] = [];
      for (const tier of ['mega', 'major', 'minor'] as const) {
        for (const tick of ticks) {
          if (tick.tier !== tier || !tick.candidateLabel) continue;
          const collides = placed.some((pos) => Math.abs(pos - tick.screen) < minLabelGap);
          if (!collides) {
            tick.label = tick.candidateLabel;
            placed.push(tick.screen);
          }
        }
      }
      return ticks.map(({ screen, label, tier }) => ({ screen, label, tier }));
    };

    const rawXTicks: RawTick[] = [];
    const minWorldX = -pan.x / zoom;
    const maxWorldX = (viewportSize.width - pan.x) / zoom;
    const minKx = Math.floor((minWorldX - originOffset.x) / PYXL_PX);
    const maxKx = Math.ceil((maxWorldX - originOffset.x) / PYXL_PX);

    for (let k = minKx; k <= maxKx; k++) {
      const world = originOffset.x + k * PYXL_PX;
      const screen = pan.x + world * zoom;
      // Exclude top-left corner Scale Legend zone (x < 150) & right border edge
      if (screen < 150 || screen > viewportSize.width - 36) continue;

      const isMega = k % 10 === 0;
      const isMajor = !isMega && k % 5 === 0;
      let candidateLabel: string | null = null;
      if (isMega) {
        candidateLabel = k === 0 ? '0' : formatSignedNum(k / 10, 1);
      } else if (isMajor && showMajorLabels) {
        candidateLabel = formatSignedNum(k, 0);
      } else if (!isMajor && showMinorLabels) {
        candidateLabel = formatSignedNum(k, 0);
      }
      rawXTicks.push({
        screen,
        candidateLabel,
        label: null,
        tier: isMega ? 'mega' : isMajor ? 'major' : 'minor',
      });
    }

    const rawYTicks: RawTick[] = [];
    const minWorldY = -pan.y / zoom;
    const maxWorldY = (viewportSize.height - pan.y) / zoom;
    const minKy = Math.floor((minWorldY - originOffset.y) / PYXL_PX);
    const maxKy = Math.ceil((maxWorldY - originOffset.y) / PYXL_PX);

    for (let k = minKy; k <= maxKy; k++) {
      const world = originOffset.y + k * PYXL_PX;
      const screen = pan.y + world * zoom;
      // Exclude top-left corner Scale Legend zone (y < 80) & bottom border edge
      if (screen < 80 || screen > viewportSize.height - 36) continue;

      const isMega = k % 10 === 0;
      const isMajor = !isMega && k % 5 === 0;
      let candidateLabel: string | null = null;
      if (isMega) {
        candidateLabel = k === 0 ? '0' : formatSignedNum(k / 10, 1);
      } else if (isMajor && showMajorLabels) {
        candidateLabel = formatSignedNum(k, 0);
      } else if (!isMajor && showMinorLabels) {
        candidateLabel = formatSignedNum(k, 0);
      }
      rawYTicks.push({
        screen,
        candidateLabel,
        label: null,
        tier: isMega ? 'mega' : isMajor ? 'major' : 'minor',
      });
    }

    return {
      xTicks: assignNonOverlappingLabels(rawXTicks, 40),
      yTicks: assignNonOverlappingLabels(rawYTicks, 22),
    };
  }, [originOffset.x, originOffset.y, pan.x, pan.y, viewportSize.height, viewportSize.width, zoom]);

  // Top-left Scale Legend resting footprint (~106x38px at left:30, top:30) mapped to world space
  const legendExclusionWorld = useMemo<WorldExclusionRect>(
    () => ({
      minX: (24 - pan.x) / zoom,
      maxX: (150 - pan.x) / zoom,
      minY: (24 - pan.y) / zoom,
      maxY: (80 - pan.y) / zoom,
    }),
    [pan.x, pan.y, zoom]
  );

  const modelBounds = useMemo(
    () => (showFigure ? computeModelBounds(computedJoints, armature) : null),
    [armature, computedJoints, showFigure]
  );

  const sideCallouts = useMemo(() => {
    if (!showFigure || !modelBounds || silhouetteMode === 'pure_shadow') return [];
    return computePushedSideCallouts(
      armature,
      computedJoints,
      modelBounds,
      selectedJointId,
      hoveredJointId,
      showAllBadges,
      zoom,
      [legendExclusionWorld]
    );
  }, [
    armature,
    computedJoints,
    hoveredJointId,
    legendExclusionWorld,
    modelBounds,
    selectedJointId,
    showAllBadges,
    showFigure,
    silhouetteMode,
    zoom,
  ]);

  const subpyxlOpacity = zoom < 0.3 ? 0.16 : zoom < 0.55 ? 0.48 : 1.0;

  return (
    <div
      ref={stageRef}
      className="relative w-full h-full overflow-hidden bg-[#E0E0E0] select-none"
      style={{
        cursor:
          dragState?.type === 'pan'
            ? 'grabbing'
            : cameraMoveActive
            ? 'grab'
            : 'crosshair',
      }}
    >
      <svg
        ref={svgRef}
        className="w-full h-full block touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDownStage}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => onCursorMove(null)}
      >
        <defs>
          <pattern
            id="grid-subpyxl"
            width={SUBPYXL_PX}
            height={SUBPYXL_PX}
            patternUnits="userSpaceOnUse"
            x={originOffset.x}
            y={originOffset.y}
          >
            <path
              d={`M ${SUBPYXL_PX} 0 L 0 0 0 ${SUBPYXL_PX}`}
              fill="none"
              stroke="rgba(22, 0, 30, 0.10)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>

          <pattern
            id="grid-pyxl"
            width={PYXL_PX}
            height={PYXL_PX}
            patternUnits="userSpaceOnUse"
            x={originOffset.x}
            y={originOffset.y}
          >
            <path
              d={`M ${PYXL_PX} 0 L 0 0 0 ${PYXL_PX}`}
              fill="none"
              stroke="rgba(22, 0, 30, 0.24)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>

          <pattern
            id="grid-megapyxl"
            width={MEGAPYXL_PX}
            height={MEGAPYXL_PX}
            patternUnits="userSpaceOnUse"
            x={originOffset.x}
            y={originOffset.y}
          >
            <path
              d={`M ${MEGAPYXL_PX} 0 L 0 0 0 ${MEGAPYXL_PX}`}
              fill="none"
              stroke="rgba(22, 0, 30, 0.52)"
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>

          {/* Mask hiding X & Y datum lines behind transparent on-canvas callout boxes */}
          <mask
            id="datum-axis-callout-mask"
            maskUnits="userSpaceOnUse"
            x={endlessBounds.minX}
            y={endlessBounds.minY}
            width={endlessBounds.width}
            height={endlessBounds.height}
          >
            <rect
              x={endlessBounds.minX}
              y={endlessBounds.minY}
              width={endlessBounds.width}
              height={endlessBounds.height}
              fill="white"
            />
            {sideCallouts.map((c) => (
              <rect
                key={`axis-knockout-${c.joint.id}`}
                x={c.worldRect.x - 2 / zoom}
                y={c.worldRect.y - 2 / zoom}
                width={c.worldRect.width + 4 / zoom}
                height={c.worldRect.height + 4 / zoom}
                rx={2 / zoom}
                fill="black"
              />
            ))}
          </mask>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ isolation: 'isolate' }}>
          {/* Unified Neutral Grayscale Endless Canvas (#E0E0E0 inside and out) */}
          <rect
            x={endlessBounds.minX}
            y={endlessBounds.minY}
            width={endlessBounds.width}
            height={endlessBounds.height}
            fill="#E0E0E0"
            data-stage-pan="true"
          />

          {/* Continuous Unified Endless Grid Guidelines across entire canvas */}
          {grid.showSubpyxl && (
            <rect
              x={endlessBounds.minX}
              y={endlessBounds.minY}
              width={endlessBounds.width}
              height={endlessBounds.height}
              fill="url(#grid-subpyxl)"
              opacity={subpyxlOpacity}
              pointerEvents="none"
            />
          )}
          {grid.showPyxl && (
            <rect
              x={endlessBounds.minX}
              y={endlessBounds.minY}
              width={endlessBounds.width}
              height={endlessBounds.height}
              fill="url(#grid-pyxl)"
              pointerEvents="none"
            />
          )}
          {grid.showMegapyxl && (
            <rect
              x={endlessBounds.minX}
              y={endlessBounds.minY}
              width={endlessBounds.width}
              height={endlessBounds.height}
              fill="url(#grid-megapyxl)"
              pointerEvents="none"
            />
          )}

          {/* Endless Datum Axes & Center Reticle (masked cleanly behind intersecting transparent callouts) */}
          <g mask={sideCallouts.length > 0 ? 'url(#datum-axis-callout-mask)' : undefined}>
            <line
              x1={originOffset.x}
              y1={endlessBounds.minY}
              x2={originOffset.x}
              y2={endlessBounds.maxY}
              stroke="rgba(22, 0, 30, 0.45)"
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <line
              x1={endlessBounds.minX}
              y1={originOffset.y}
              x2={endlessBounds.maxX}
              y2={originOffset.y}
              stroke="rgba(22, 0, 30, 0.45)"
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            {/* Center Intersection Reticle (0.00 mpyx, 0.00 mpyx) */}
            <g
              transform={`translate(${originOffset.x}, ${originOffset.y}) scale(${1 / zoom})`}
              pointerEvents="none"
            >
              <circle r={7} fill="none" stroke="rgba(22, 0, 30, 0.65)" strokeWidth={1.25} />
              <circle r={2} fill="rgba(22, 0, 30, 0.85)" />
            </g>
          </g>

          {/* Grid-Locked Movable Typeset Intertitle (automatically clears model, callouts & top-left legend) */}
          <GridIntertitleLayer
            item={intertitleItem}
            dismissing={intertitleDismissing}
            originMode={grid.originMode}
            originOffset={originOffset}
            viewportWidth={viewportSize.width}
            zoom={zoom}
            modelBounds={modelBounds}
            sideCallouts={sideCallouts}
            extraExclusions={[legendExclusionWorld]}
            onTriggerDismiss={onTriggerDismissIntertitle}
            onDismissComplete={onIntertitleDismissComplete}
          />

          {/* Vitruvian Proportions Classical Circle & Square Overlay */}
          {grid.showVitruvianGuide && (
            <g pointerEvents="none">
              <rect
                x={computedJoints.waist.x - 535}
                y={computedJoints.waist.y - 530}
                width={1070}
                height={1060}
                fill="none"
                stroke="rgba(22, 0, 30, 0.34)"
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={computedJoints.navel.x}
                cy={computedJoints.navel.y}
                r={635}
                fill="none"
                stroke="rgba(22, 0, 30, 0.34)"
                strokeWidth={1.25}
                strokeDasharray="5 5"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={computedJoints.waist.x}
                y1={computedJoints.waist.y - 600}
                x2={computedJoints.waist.x}
                y2={computedJoints.waist.y + 600}
                stroke="rgba(22, 0, 30, 0.22)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}

          {/* Procedural 18-Joint Silhouette & Wireframe Mannequin */}
          {showFigure && (
            <Mannequin
              armature={armature}
              computedJoints={computedJoints}
              selectedJointId={selectedJointId}
              hoveredJointId={hoveredJointId}
              silhouetteMode={silhouetteMode}
              sideCallouts={sideCallouts}
              cameraMoveActive={cameraMoveActive}
              isPanning={dragState?.type === 'pan'}
              zoom={zoom}
              onSelectJoint={onSelectJoint}
              onHoverJoint={onHoverJoint}
              onPointerDownJoint={handlePointerDownJoint}
              onPointerDownBone={handlePointerDownBone}
            />
          )}
        </g>
      </svg>

      {/* Isolated Vector Edge Borders stretched seamlessly to current view window edges */}
      {(() => {
        const vw = viewportSize.width;
        const vh = viewportSize.height;
        const SRC_CORNER = 48;
        const SRC_EDGE = 28;
        const s = Math.min(1, vw / (SRC_CORNER * 2), vh / (SRC_CORNER * 2));
        const c = SRC_CORNER * s;
        const e = SRC_EDGE * s;
        const midW = Math.max(0, vw - c * 2);
        const midH = Math.max(0, vh - c * 2);
        const srcMidW = PAPER_WIDTH - SRC_CORNER * 2;
        const srcMidH = PAPER_HEIGHT - SRC_CORNER * 2;

        return (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full z-[5]"
            viewBox={`0 0 ${vw} ${vh}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="vector-border-grayscale">
                <feColorMatrix type="saturate" values="0" />
              </filter>
            </defs>
            <g opacity={borderOpacity} filter="url(#vector-border-grayscale)">
              <svg x={0} y={0} width={c} height={c} viewBox={`0 0 ${SRC_CORNER} ${SRC_CORNER}`} preserveAspectRatio="none">
                <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
              </svg>
              <svg x={vw - c} y={0} width={c} height={c} viewBox={`${PAPER_WIDTH - SRC_CORNER} 0 ${SRC_CORNER} ${SRC_CORNER}`} preserveAspectRatio="none">
                <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
              </svg>
              <svg x={0} y={vh - c} width={c} height={c} viewBox={`0 ${PAPER_HEIGHT - SRC_CORNER} ${SRC_CORNER} ${SRC_CORNER}`} preserveAspectRatio="none">
                <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
              </svg>
              <svg x={vw - c} y={vh - c} width={c} height={c} viewBox={`${PAPER_WIDTH - SRC_CORNER} ${PAPER_HEIGHT - SRC_CORNER} ${SRC_CORNER} ${SRC_CORNER}`} preserveAspectRatio="none">
                <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
              </svg>

              {midW > 0 && (
                <svg x={c} y={0} width={midW} height={e} viewBox={`${SRC_CORNER} 0 ${srcMidW} ${SRC_EDGE}`} preserveAspectRatio="none">
                  <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
                </svg>
              )}
              {midW > 0 && (
                <svg x={c} y={vh - e} width={midW} height={e} viewBox={`${SRC_CORNER} ${PAPER_HEIGHT - SRC_EDGE} ${srcMidW} ${SRC_EDGE}`} preserveAspectRatio="none">
                  <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
                </svg>
              )}
              {midH > 0 && (
                <svg x={0} y={c} width={e} height={midH} viewBox={`0 ${SRC_CORNER} ${SRC_EDGE} ${srcMidH}`} preserveAspectRatio="none">
                  <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
                </svg>
              )}
              {midH > 0 && (
                <svg x={vw - e} y={c} width={e} height={midH} viewBox={`${PAPER_WIDTH - SRC_EDGE} ${SRC_CORNER} ${SRC_EDGE} ${srcMidH}`} preserveAspectRatio="none">
                  <image href={REPOSITORY_ASSET_PATHS.vectorBorderSvg} x={0} y={0} width={PAPER_WIDTH} height={PAPER_HEIGHT} />
                </svg>
              )}
            </g>

            {grid.showLabels && (
              <g pointerEvents="none">
                {rulerTicks.xTicks.map((tick, idx) => (
                  <g key={`xt-${idx}`} transform={`translate(${tick.screen}, ${e})`}>
                    <line
                      x1={0}
                      y1={0}
                      x2={0}
                      y2={tick.tier === 'mega' ? 9 : tick.tier === 'major' ? 7 : 4}
                      stroke={
                        tick.tier === 'mega'
                          ? 'rgba(22, 0, 30, 0.82)'
                          : tick.tier === 'major'
                          ? 'rgba(22, 0, 30, 0.56)'
                          : 'rgba(22, 0, 30, 0.28)'
                      }
                      strokeWidth={tick.tier === 'mega' ? 1.5 : 1}
                    />
                    {tick.label && (
                      <text
                        x={0}
                        y={20}
                        textAnchor="middle"
                        fill={
                          tick.tier === 'mega'
                            ? '#16001E'
                            : tick.tier === 'major'
                            ? 'rgba(22, 0, 30, 0.78)'
                            : 'rgba(22, 0, 30, 0.55)'
                        }
                        fontSize={tick.tier === 'mega' ? 10.5 : 9.5}
                        fontWeight={tick.tier === 'mega' ? 700 : 400}
                        fontFamily="UMTypewriter, monospace"
                      >
                        {tick.label}
                      </text>
                    )}
                  </g>
                ))}
                {rulerTicks.yTicks.map((tick, idx) => (
                  <g key={`yt-${idx}`} transform={`translate(${e}, ${tick.screen})`}>
                    <line
                      x1={0}
                      y1={0}
                      x2={tick.tier === 'mega' ? 9 : tick.tier === 'major' ? 7 : 4}
                      y2={0}
                      stroke={
                        tick.tier === 'mega'
                          ? 'rgba(22, 0, 30, 0.82)'
                          : tick.tier === 'major'
                          ? 'rgba(22, 0, 30, 0.56)'
                          : 'rgba(22, 0, 30, 0.28)'
                      }
                      strokeWidth={tick.tier === 'mega' ? 1.5 : 1}
                    />
                    {tick.label && (
                      <text
                        x={13}
                        y={3.5}
                        textAnchor="start"
                        fill={
                          tick.tier === 'mega'
                            ? '#16001E'
                            : tick.tier === 'major'
                            ? 'rgba(22, 0, 30, 0.78)'
                            : 'rgba(22, 0, 30, 0.55)'
                        }
                        fontSize={tick.tier === 'mega' ? 10.5 : 9.5}
                        fontWeight={tick.tier === 'mega' ? 700 : 400}
                        fontFamily="UMTypewriter, monospace"
                      >
                        {tick.label}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )}
          </svg>
        );
      })()}

      {/* Micro Top-Left Corner Drafting Scale Legend (zooms gently on hover for easy reading) */}
      <div
        className="absolute left-[30px] top-[30px] z-[8] origin-top-left transition-all duration-200 ease-out hover:scale-[1.85] bg-[#E0E0E0]/88 backdrop-blur-[2px] border border-[#16001E]/28 hover:border-[#16001E]/55 rounded-[2px] px-1.5 py-0.5 text-[#16001E] cursor-help hover:shadow-sm"
        aria-label="Grid scale legend"
      >
        <div className="font-typewriter font-bold text-[6.5px] uppercase tracking-[0.06em] text-[#16001E]/65 pb-[1px] mb-[2px] border-b border-[#16001E]/15">
          scale
        </div>
        <div className="space-y-[1px] font-typewriter text-[7px] leading-[1.2]">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="inline-block w-2.5 h-[1.5px] bg-[#16001E]/75 shrink-0" />
            <span className="font-bold">1 mpyx</span>
            <span className="text-[#16001E]/60">10 pyx</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="inline-block w-2.5 h-[1px] bg-[#16001E]/50 shrink-0" />
            <span className="font-bold">1 pyx</span>
            <span className="text-[#16001E]/60">100 px</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="inline-block w-2.5 h-[0.5px] bg-[#16001E]/30 shrink-0" />
            <span className="font-bold">0.1 pyx</span>
            <span className="text-[#16001E]/60">10 px</span>
          </div>
        </div>
      </div>
    </div>
  );
};
