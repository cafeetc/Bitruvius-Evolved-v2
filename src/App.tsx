import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize2,
  Minus,
  Move,
  PanelRightClose,
  PanelRightOpen,
  Plus,
} from 'lucide-react';
import {
  ArmatureState,
  BONE_SCALE_MAX,
  BONE_SCALE_MIN,
  CharacterPoseSnapshot,
  EnvironmentalAnchorId,
  GridConfig,
  JointId,
  JointMode,
  KeystoneOrigin,
  MEGAPYXL_PX,
  PAPER_HEIGHT,
  PAPER_WIDTH,
  PYXL_PX,
  PhysicsModeId,
  PoseHistoryState,
  PosePresetId,
  SilhouetteDisplayMode,
} from './types';
import {
  JOINT_SPECS,
  applyJointAngleConstraint,
  armatureToCharacterSnapshot,
  characterSnapshotToArmature,
  clampAngle180,
  computeArmature,
  computeModelBounds,
  computeModelWorkingSquare,
  createPosePreset,
  formatSignedNum,
  getPhysicsMultiplier,
  interpolateArmatureShortestPath,
  mirrorPose,
  setJointMode,
} from './utils/kinematics';
import { StageCanvas } from './components/StageCanvas';
import { TopConsoleBar, WorkspaceTabId } from './components/TopConsoleBar';
import { InspectorConsole } from './components/InspectorConsole';
import { IntertitleItem } from './components/IntertitleOverlay';
import { RoadmapView } from './components/RoadmapView';
import { ROADMAP_ENTRIES } from './data/roadmap';

const INITIAL_INTERTITLE: IntertitleItem = {
  id: 'welcome-bitruvius',
  lines: ['Welcome', 'Bitruvius'],
  position: 'below-model',
};

const MAX_POSE_HISTORY = 64;

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const autoFitRef = useRef<boolean>(true);
  const transitionRafRef = useRef<number | null>(null);

  // Initialize strictly to the canonical Vitruvian T-Pose baseline
  const [poseSession, setPoseSession] = useState<PoseHistoryState>(() => {
    const initial = createPosePreset('tpose');
    return {
      currentPose: initial,
      lastPose: null,
      history: [initial],
      historyIndex: 0,
    };
  });

  const armature = poseSession.currentPose;

  const [activePreset, setActivePreset] = useState<PosePresetId | null>('tpose');
  const [selectedJointId, setSelectedJointId] = useState<JointId>('r_wrist');
  const [hoveredJointId, setHoveredJointId] = useState<JointId | null>(null);
  const [snapshots, setSnapshots] = useState<CharacterPoseSnapshot[]>([]);

  const [borderOpacity, setBorderOpacity] = useState<number>(1.0);

  const [grid, setGrid] = useState<GridConfig>({
    showSubpyxl: true,
    showPyxl: true,
    showMegapyxl: true,
    showLabels: true,
    showVitruvianGuide: false,
    originMode: 'center',
    snapMode: 'none',
  });

  // Start visible immediately on load displaying the integrated skeleton silhouette (Pure Shadow)
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabId>('studio');
  const [showFigure, setShowFigure] = useState(true);
  const [silhouetteMode, setSilhouetteMode] = useState<SilhouetteDisplayMode>('pure_shadow');
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const unresolvedRoadmapCount = useMemo(
    () =>
      ROADMAP_ENTRIES.filter(
        (e) => e.status === 'unresolved' || e.status === 'awaiting_rules'
      ).length,
    []
  );

  const [activeIntertitle, setActiveIntertitle] = useState<IntertitleItem | null>(
    INITIAL_INTERTITLE
  );
  const [intertitleDismissing, setIntertitleDismissing] = useState(false);

  const [zoom, setZoom] = useState(0.45);
  const [pan, setPan] = useState({ x: 160, y: 40 });
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [cameraUnlocked, setCameraUnlocked] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);

  const canvasOrigin = useMemo(
    () =>
      grid.originMode === 'center'
        ? { x: PAPER_WIDTH / 2, y: PAPER_HEIGHT / 2 }
        : { x: 0, y: 0 },
    [grid.originMode]
  );

  const computedJoints = useMemo(
    () => computeArmature(armature, canvasOrigin),
    [armature, canvasOrigin]
  );

  const setLiveArmature = useCallback((updater: (prev: ArmatureState) => ArmatureState) => {
    setPoseSession((prev) => ({
      ...prev,
      currentPose: updater(prev.currentPose),
    }));
  }, []);

  const commitPoseMilestone = useCallback((targetPose?: ArmatureState) => {
    setPoseSession((prev) => {
      const nextPose = targetPose ?? prev.currentPose;
      const head = prev.history[prev.historyIndex];
      if (head === nextPose) return prev;
      const sliced = prev.history.slice(0, prev.historyIndex + 1);
      const nextHistory = [...sliced, nextPose];
      const trimmed =
        nextHistory.length > MAX_POSE_HISTORY
          ? nextHistory.slice(nextHistory.length - MAX_POSE_HISTORY)
          : nextHistory;
      return {
        currentPose: nextPose,
        lastPose: head ?? prev.lastPose,
        history: trimmed,
        historyIndex: trimmed.length - 1,
      };
    });
  }, []);

  const applyAndCommitPose = useCallback(
    (updater: (prev: ArmatureState) => ArmatureState) => {
      setPoseSession((prev) => {
        const nextPose = updater(prev.currentPose);
        if (nextPose === prev.currentPose) return prev;
        const head = prev.history[prev.historyIndex];
        const sliced = prev.history.slice(0, prev.historyIndex + 1);
        const nextHistory = [...sliced, nextPose];
        const trimmed =
          nextHistory.length > MAX_POSE_HISTORY
            ? nextHistory.slice(nextHistory.length - MAX_POSE_HISTORY)
            : nextHistory;
        return {
          currentPose: nextPose,
          lastPose: head ?? prev.currentPose,
          history: trimmed,
          historyIndex: trimmed.length - 1,
        };
      });
    },
    []
  );

  const cancelPoseTransition = useCallback(() => {
    if (transitionRafRef.current !== null) {
      window.cancelAnimationFrame(transitionRafRef.current);
      transitionRafRef.current = null;
    }
  }, []);

  const animateToArmature = useCallback(
    (targetState: ArmatureState, durationMs = 280, recordHistory = true) => {
      cancelPoseTransition();
      const startState = armature;
      if (recordHistory) {
        commitPoseMilestone(targetState);
      }
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const frameState = interpolateArmatureShortestPath(startState, targetState, t);
        setLiveArmature(() => frameState);
        if (t < 1) {
          transitionRafRef.current = window.requestAnimationFrame(step);
        } else {
          transitionRafRef.current = null;
          setLiveArmature(() => targetState);
        }
      };

      transitionRafRef.current = window.requestAnimationFrame(step);
    },
    [armature, cancelPoseTransition, commitPoseMilestone, setLiveArmature]
  );

  useEffect(() => cancelPoseTransition, [cancelPoseTransition]);

  const computedJointsRef = useRef(computedJoints);
  computedJointsRef.current = computedJoints;
  const armatureRef = useRef(armature);
  armatureRef.current = armature;

  const fitPaperToStage = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const workingBase = computeModelWorkingSquare();
    const liveBounds = computeModelBounds(computedJointsRef.current, armatureRef.current);

    // Reserve outer horizontal & top-left clearance so pushed-aside callouts and top-left legend never crowd model
    const sideRailMargin = showFigure ? 210 : 0;
    const targetMinX = showFigure ? liveBounds.minX - sideRailMargin : workingBase.minX;
    const targetMaxX = showFigure ? liveBounds.maxX + sideRailMargin : workingBase.maxX;
    const targetMinY = showFigure ? liveBounds.minY - 120 : workingBase.minY;
    const targetMaxY = showFigure ? liveBounds.maxY + (activeIntertitle ? 320 : 80) : workingBase.maxY;

    const frameW = Math.max(PAPER_WIDTH, targetMaxX - targetMinX);
    const frameH = Math.max(PAPER_HEIGHT, targetMaxY - targetMinY);
    const centerX = (targetMinX + targetMaxX) / 2;
    const centerY = (targetMinY + targetMaxY) / 2;

    const padX = rect.width < 640 ? 52 : 76;
    const padY = rect.height < 520 ? 44 : 56;
    const availW = Math.max(140, rect.width - padX * 2);
    const availH = Math.max(140, rect.height - padY * 2);
    const nextZoom = Math.min(availW / frameW, availH / frameH, 1.25);

    const nextPanX = rect.width / 2 - centerX * nextZoom;
    const nextPanY = rect.height / 2 - centerY * nextZoom;

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  }, [activeIntertitle, showFigure]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (autoFitRef.current) {
        fitPaperToStage();
      }
    });

    observer.observe(el);
    fitPaperToStage();
    return () => observer.disconnect();
  }, [fitPaperToStage]);

  const handleManualZoom = useCallback((nextZoom: number) => {
    autoFitRef.current = false;
    setZoom(nextZoom);
  }, []);

  const handleManualPan = useCallback((nextPan: { x: number; y: number }) => {
    autoFitRef.current = false;
    setPan(nextPan);
  }, []);

  const handleFitClick = useCallback(() => {
    autoFitRef.current = true;
    fitPaperToStage();
  }, [fitPaperToStage]);

  const handleDismissIntertitle = useCallback(() => {
    if (activeIntertitle && !intertitleDismissing) {
      setIntertitleDismissing(true);
    }
  }, [activeIntertitle, intertitleDismissing]);

  const handleIntertitleComplete = useCallback(() => {
    setActiveIntertitle(null);
    setIntertitleDismissing(false);
  }, []);

  useEffect(() => {
    if (!activeIntertitle || intertitleDismissing) return;
    const onFirstClick = () => {
      setIntertitleDismissing(true);
    };
    window.addEventListener('pointerdown', onFirstClick, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstClick, { capture: true });
    };
  }, [activeIntertitle, intertitleDismissing]);

  const handleUpdateArmature = useCallback(
    (next: ArmatureState) => {
      cancelPoseTransition();
      setLiveArmature(() => next);
      setActivePreset(null);
    },
    [cancelPoseTransition, setLiveArmature]
  );

  const handleCommitPoseHistory = useCallback(() => {
    commitPoseMilestone();
  }, [commitPoseMilestone]);

  const handleUndo = useCallback(() => {
    if (poseSession.historyIndex <= 0) return;
    const nextIdx = poseSession.historyIndex - 1;
    const targetPose = poseSession.history[nextIdx];
    setPoseSession((prev) => ({
      ...prev,
      lastPose: prev.currentPose,
      historyIndex: nextIdx,
    }));
    setActivePreset(null);
    animateToArmature(targetPose, 220, false);
  }, [animateToArmature, poseSession.history, poseSession.historyIndex]);

  const handleRedo = useCallback(() => {
    if (poseSession.historyIndex >= poseSession.history.length - 1) return;
    const nextIdx = poseSession.historyIndex + 1;
    const targetPose = poseSession.history[nextIdx];
    setPoseSession((prev) => ({
      ...prev,
      lastPose: prev.currentPose,
      historyIndex: nextIdx,
    }));
    setActivePreset(null);
    animateToArmature(targetPose, 220, false);
  }, [animateToArmature, poseSession.history, poseSession.historyIndex]);

  const handleToggleLastPose = useCallback(() => {
    if (!poseSession.lastPose) return;
    const target = poseSession.lastPose;
    setActivePreset(null);
    animateToArmature(target, 240, true);
  }, [animateToArmature, poseSession.lastPose]);

  const handleSelectPreset = useCallback(
    (preset: PosePresetId) => {
      const target = createPosePreset(preset, armature);
      animateToArmature(target);
      setActivePreset(preset);
    },
    [animateToArmature, armature]
  );

  const handleMirrorPose = useCallback(() => {
    animateToArmature(mirrorPose(armature));
    setActivePreset(null);
  }, [animateToArmature, armature]);

  const handleResetPose = useCallback(() => {
    cancelPoseTransition();
    const baseline = createPosePreset('tpose');
    applyAndCommitPose(() => baseline);
    setActivePreset('tpose');
    autoFitRef.current = true;
    fitPaperToStage();
  }, [applyAndCommitPose, cancelPoseTransition, fitPaperToStage]);

  const handleChangeJointAngle = useCallback(
    (id: JointId, nextLocalAngle: number, recordHistory = false) => {
      cancelPoseTransition();
      setActivePreset(null);
      const update = (prev: ArmatureState): ArmatureState => {
        const constrained = applyJointAngleConstraint(nextLocalAngle, prev.continuousSpin);
        if (id === 'waist') {
          return { ...prev, rootRotation: constrained };
        }
        return {
          ...prev,
          joints: {
            ...prev.joints,
            [id]: {
              ...prev.joints[id],
              localAngle: constrained,
            },
          },
        };
      };
      if (recordHistory) {
        applyAndCommitPose(update);
      } else {
        setLiveArmature(update);
      }
    },
    [applyAndCommitPose, cancelPoseTransition, setLiveArmature]
  );

  const handleSetContinuousSpin = useCallback(
    (enabled: boolean) => {
      cancelPoseTransition();
      applyAndCommitPose((prev) => {
        if (enabled) {
          return { ...prev, continuousSpin: true };
        }
        const nextJoints = { ...prev.joints };
        for (const spec of JOINT_SPECS) {
          nextJoints[spec.id] = {
            ...nextJoints[spec.id],
            localAngle: clampAngle180(nextJoints[spec.id].localAngle),
          };
        }
        return {
          ...prev,
          continuousSpin: false,
          rootRotation: clampAngle180(prev.rootRotation),
          joints: nextJoints,
        };
      });
    },
    [applyAndCommitPose, cancelPoseTransition]
  );

  const handleChangePhysicsMode = useCallback(
    (id: JointId, mode: PhysicsModeId) => {
      cancelPoseTransition();
      applyAndCommitPose((prev) => ({
        ...prev,
        joints: {
          ...prev.joints,
          [id]: {
            ...prev.joints[id],
            physicsMode: mode,
            modeERatio: mode === 'mode_e' ? 1.0 : prev.joints[id].modeERatio,
          },
        },
      }));
    },
    [applyAndCommitPose, cancelPoseTransition]
  );

  const handleChangeModeERatio = useCallback(
    (id: JointId, ratio: number) => {
      cancelPoseTransition();
      const clamped = Math.max(0, Math.min(10, Math.round(ratio * 100) / 100));
      applyAndCommitPose((prev) => ({
        ...prev,
        joints: {
          ...prev.joints,
          [id]: {
            ...prev.joints[id],
            modeERatio: clamped,
          },
        },
      }));
    },
    [applyAndCommitPose, cancelPoseTransition]
  );

  const handleChangeBoneScale = useCallback(
    (id: JointId, patch: { scaleLength?: number; scaleWidth?: number }, recordHistory = false) => {
      cancelPoseTransition();
      const update = (prev: ArmatureState): ArmatureState => {
        const cur = prev.joints[id];
        const nextLen =
          patch.scaleLength !== undefined
            ? Math.max(BONE_SCALE_MIN, Math.min(BONE_SCALE_MAX, patch.scaleLength))
            : cur.scaleLength;
        const nextWid =
          patch.scaleWidth !== undefined
            ? Math.max(BONE_SCALE_MIN, Math.min(BONE_SCALE_MAX, patch.scaleWidth))
            : cur.scaleWidth;
        return {
          ...prev,
          joints: {
            ...prev.joints,
            [id]: {
              ...cur,
              scaleLength: nextLen,
              scaleWidth: nextWid,
            },
          },
        };
      };
      if (recordHistory) {
        applyAndCommitPose(update);
      } else {
        setLiveArmature(update);
      }
    },
    [applyAndCommitPose, cancelPoseTransition, setLiveArmature]
  );

  const handleChangeKeystone = useCallback(
    (keystone: KeystoneOrigin) => {
      cancelPoseTransition();
      applyAndCommitPose((prev) => ({
        ...prev,
        internalKeystone: keystone,
      }));
    },
    [applyAndCommitPose, cancelPoseTransition]
  );

  const handleChangeEnvironmentalAnchor = useCallback(
    (anchor: EnvironmentalAnchorId) => {
      cancelPoseTransition();
      applyAndCommitPose((prev) => ({
        ...prev,
        environmentalAnchor: anchor,
      }));
    },
    [applyAndCommitPose, cancelPoseTransition]
  );

  useEffect(() => {
    if (autoFitRef.current) {
      fitPaperToStage();
    }
  }, [armature.environmentalAnchor, fitPaperToStage]);

  const handleToggleAnchorPin = useCallback(() => {
    cancelPoseTransition();
    applyAndCommitPose((prev) => {
      if (prev.isAnchorPinned) {
        const solved = computeArmature(prev, canvasOrigin);
        return {
          ...prev,
          isAnchorPinned: false,
          rootX: solved.waist.x,
          rootY: solved.waist.y,
        };
      }
      return {
        ...prev,
        isAnchorPinned: true,
      };
    });
  }, [applyAndCommitPose, cancelPoseTransition, canvasOrigin]);

  const handleChangeRootPosition = useCallback(
    (x: number, y: number) => {
      cancelPoseTransition();
      setActivePreset(null);
      applyAndCommitPose((prev) => ({
        ...prev,
        rootX: x,
        rootY: y,
      }));
    },
    [applyAndCommitPose, cancelPoseTransition]
  );

  const handleChangeJointMode = useCallback(
    (id: JointId, mode: JointMode) => {
      cancelPoseTransition();
      applyAndCommitPose((prev) => setJointMode(prev, id, mode));
    },
    [applyAndCommitPose, cancelPoseTransition]
  );

  const handleSaveSnapshot = useCallback(() => {
    setSnapshots((prev) => {
      const nextIdx = prev.length + 1;
      const snap = armatureToCharacterSnapshot(
        armature,
        `Pose ${String(nextIdx).padStart(2, '0')}`,
        silhouetteMode
      );
      return [snap, ...prev];
    });
  }, [armature, silhouetteMode]);

  const handleRecallSnapshot = useCallback(
    (snapshot: CharacterPoseSnapshot) => {
      setActivePreset(null);
      setSilhouetteMode(snapshot.viewMode);
      const restored = characterSnapshotToArmature(snapshot, armature);
      animateToArmature(restored);
    },
    [animateToArmature, armature]
  );

  const handleDeleteSnapshot = useCallback((snapshotId: string) => {
    setSnapshots((prev) => prev.filter((s) => s.snapshotId !== snapshotId));
  }, []);

  const handleUpdateGrid = useCallback((patch: Partial<GridConfig>) => {
    setGrid((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleZoomStep = useCallback(
    (factor: number) => {
      const el = stageRef.current;
      if (!el) return;
      autoFitRef.current = false;
      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const nextZoom = Math.max(0.15, Math.min(4.0, zoom * factor));
      const wx = (cx - pan.x) / zoom;
      const wy = (cy - pan.y) / zoom;
      setZoom(nextZoom);
      setPan({ x: cx - wx * nextZoom, y: cy - wy * nextZoom });
    },
    [pan.x, pan.y, zoom]
  );

  const handleSetExactZoom = useCallback(
    (targetZoom: number) => {
      const el = stageRef.current;
      if (!el) return;
      autoFitRef.current = false;
      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const wx = (cx - pan.x) / zoom;
      const wy = (cy - pan.y) / zoom;
      setZoom(targetZoom);
      setPan({ x: cx - wx * targetZoom, y: cy - wy * targetZoom });
    },
    [pan.x, pan.y, zoom]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (activeWorkspaceTab !== 'studio' || !showFigure) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const current = computedJoints[selectedJointId];
        const runtime = armature.joints[selectedJointId];
        if (!current || current.mode === 'PIN' || runtime.physicsMode === 'rigid') return;
        e.preventDefault();
        const mult = getPhysicsMultiplier(runtime);
        const baseStep = e.shiftKey ? 0.25 : 1.0;
        const delta = (e.key === 'ArrowRight' ? baseStep : -baseStep) * mult;
        handleChangeJointAngle(selectedJointId, current.localAngle + delta, true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeWorkspaceTab,
    armature.joints,
    computedJoints,
    handleChangeJointAngle,
    handleRedo,
    handleUndo,
    selectedJointId,
    showFigure,
  ]);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#E0E0E0] text-[#F2EEF7]">
      <TopConsoleBar
        activeWorkspaceTab={activeWorkspaceTab}
        onSelectWorkspaceTab={setActiveWorkspaceTab}
        unresolvedCount={unresolvedRoadmapCount}
        showFigure={showFigure}
        onToggleFigure={() => setShowFigure((v) => !v)}
        silhouetteMode={silhouetteMode}
        onToggleSilhouetteMode={() =>
          setSilhouetteMode((m) => (m === 'wireframe' ? 'pure_shadow' : 'wireframe'))
        }
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        onMirrorPose={handleMirrorPose}
        onResetPose={handleResetPose}
        canUndo={poseSession.historyIndex > 0}
        canRedo={poseSession.historyIndex < poseSession.history.length - 1}
        hasLastPose={poseSession.lastPose !== null}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleLastPose={handleToggleLastPose}
      />

      {activeWorkspaceTab === 'roadmap' ? (
        <RoadmapView />
      ) : (
        /* Strict 2/3 Stage Canvas + 1/3 Dark #16001E Console Split Layout */
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div
            className="flex-1 relative min-h-0"
            onPointerDownCapture={handleDismissIntertitle}
          >
            <StageCanvas
              armature={armature}
              computedJoints={computedJoints}
              selectedJointId={selectedJointId}
              hoveredJointId={hoveredJointId}
              borderOpacity={borderOpacity}
              grid={grid}
              showFigure={showFigure}
              silhouetteMode={silhouetteMode}
              showAllBadges={showAllBadges}
              cameraUnlocked={cameraUnlocked}
              onShiftHoldChange={setShiftHeld}
              zoom={zoom}
              pan={pan}
              onZoomChange={handleManualZoom}
              onPanChange={handleManualPan}
              onSelectJoint={setSelectedJointId}
              onHoverJoint={setHoveredJointId}
              onUpdateArmature={handleUpdateArmature}
              onCommitPoseHistory={handleCommitPoseHistory}
              onCursorMove={setCursorCoords}
              stageRef={stageRef}
              svgRef={svgRef}
              intertitleItem={activeIntertitle}
              intertitleDismissing={intertitleDismissing}
              onTriggerDismissIntertitle={handleDismissIntertitle}
              onIntertitleDismissComplete={handleIntertitleComplete}
            />
          </div>

          {/* Dedicated Bottom Status, Console Tab & Zoom Strip */}
          <div className="h-9 px-3 console-panel border-b-0 border-x-0 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-4 text-[11px] min-w-0 overflow-x-auto whitespace-nowrap">
              <div>
                <span className="font-vera text-[#9E8EB3] mr-1">X</span>
                <span className="font-typewriter font-bold text-[#FAF6FF]">
                  {cursorCoords ? `${formatSignedNum(cursorCoords.x)} px` : '+0.00 px'}
                </span>
                <span className="font-typewriter text-[#C8B2E0] ml-1">
                  ({cursorCoords ? `${formatSignedNum(cursorCoords.x / PYXL_PX)} pyx` : '+0.00 pyx'})
                </span>
              </div>
              <div>
                <span className="font-vera text-[#9E8EB3] mr-1">Y</span>
                <span className="font-typewriter font-bold text-[#FAF6FF]">
                  {cursorCoords ? `${formatSignedNum(cursorCoords.y)} px` : '+0.00 px'}
                </span>
                <span className="font-typewriter text-[#C8B2E0] ml-1">
                  ({cursorCoords ? `${formatSignedNum(cursorCoords.y / PYXL_PX)} pyx` : '+0.00 pyx'})
                </span>
              </div>
              <div className="hidden sm:block">
                <span className="font-vera text-[#9E8EB3] mr-1">mpyx</span>
                <span className="font-typewriter font-bold text-[#E9D5FF]">
                  {cursorCoords
                    ? `${formatSignedNum(cursorCoords.x / MEGAPYXL_PX)}, ${formatSignedNum(
                        cursorCoords.y / MEGAPYXL_PX
                      )}`
                    : '+0.00, +0.00'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setInspectorOpen((v) => !v)}
                title={inspectorOpen ? 'Collapse console inspector' : 'Expand console inspector'}
                className={`px-2.5 py-0.5 mr-1 font-vera font-bold text-[10.5px] rounded-[2px] border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  inspectorOpen
                    ? 'bg-[#361547] border-[#D8B4FE]/40 text-[#FAF6FF]'
                    : 'bg-[#21072B]/80 border-[#EBE0F5]/18 text-[#C8B2E0] hover:text-[#FAF6FF]'
                }`}
              >
                {inspectorOpen ? (
                  <PanelRightClose className="w-3 h-3" />
                ) : (
                  <PanelRightOpen className="w-3 h-3" />
                )}
                Console
              </button>
              <button
                type="button"
                onClick={() => setCameraUnlocked((v) => !v)}
                title="Hold Shift or toggle to enable click-and-drag camera pan & wheel zoom"
                className={`px-2 py-0.5 mr-1 font-vera font-bold text-[10.5px] rounded-[2px] border flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  shiftHeld || cameraUnlocked
                    ? 'bg-[#361547] border-[#D8B4FE]/45 text-[#FAF6FF]'
                    : 'bg-[#21072B]/70 border-[#EBE0F5]/16 text-[#B8A9C9] hover:text-[#FAF6FF]'
                }`}
              >
                <Move className="w-3 h-3" />
                {shiftHeld || cameraUnlocked ? 'Cam: Shift On' : 'Cam: Static [Shift]'}
              </button>
              <button
                type="button"
                onClick={() => handleZoomStep(0.85)}
                title="Zoom out"
                className="p-1 text-[#E6DCF0] hover:bg-[#2A0E38] rounded-[2px] cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleSetExactZoom(1.0)}
                title="Set 100.00% actual pixel scale"
                className="px-1.5 py-0.5 font-typewriter font-bold text-[11px] text-[#FAF6FF] hover:bg-[#2A0E38] rounded-[2px] cursor-pointer min-w-[58px] text-center"
              >
                {(zoom * 100).toFixed(2)}%
              </button>
              <button
                type="button"
                onClick={() => handleZoomStep(1.18)}
                title="Zoom in"
                className="p-1 text-[#E6DCF0] hover:bg-[#2A0E38] rounded-[2px] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleFitClick}
                title="Fit working frame to viewport"
                className="px-2 py-0.5 font-vera font-bold text-[10.5px] text-[#D8B4FE] hover:bg-[#2A0E38] rounded-[2px] flex items-center gap-1 cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                Fit
              </button>
            </div>
          </div>
        </main>

        {inspectorOpen && (
          <InspectorConsole
            armature={armature}
            computedJoints={computedJoints}
            selectedJointId={selectedJointId}
            onSelectJoint={setSelectedJointId}
            onChangeJointAngle={handleChangeJointAngle}
            onSetContinuousSpin={handleSetContinuousSpin}
            onChangePhysicsMode={handleChangePhysicsMode}
            onChangeModeERatio={handleChangeModeERatio}
            onChangeBoneScale={handleChangeBoneScale}
            onChangeKeystone={handleChangeKeystone}
            onChangeEnvironmentalAnchor={handleChangeEnvironmentalAnchor}
            onToggleAnchorPin={handleToggleAnchorPin}
            onChangeRootPosition={handleChangeRootPosition}
            onChangeJointMode={handleChangeJointMode}
            onCommitPoseHistory={handleCommitPoseHistory}
            snapshots={snapshots}
            onSaveSnapshot={handleSaveSnapshot}
            onRecallSnapshot={handleRecallSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            grid={grid}
            onUpdateGrid={handleUpdateGrid}
            borderOpacity={borderOpacity}
            onBorderOpacityChange={setBorderOpacity}
            showFigure={showFigure}
            onToggleFigure={() => setShowFigure((v) => !v)}
            showAllBadges={showAllBadges}
            onToggleAllBadges={() => setShowAllBadges((v) => !v)}
            onSelectPreset={handleSelectPreset}
          />
        )}
        </div>
      )}
    </div>
  );
}
