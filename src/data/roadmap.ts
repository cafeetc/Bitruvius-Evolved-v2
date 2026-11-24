import { SystemInvariant } from '../types';

export type RoadmapStatus = 'awaiting_rules' | 'completed' | 'unresolved' | 'vision';

export type RoadmapCategory =
  | 'blueprint'
  | 'anatomy'
  | 'rendering'
  | 'kinematics'
  | 'animation'
  | 'workspace';

export interface RoadmapEntry {
  id: string;
  title: string;
  status: RoadmapStatus;
  category: RoadmapCategory;
  priority?: 'high' | 'medium' | 'low';
  phase?: number;
  summary: string;
  details: string[];
  codeRefs?: string[];
  dependsOn?: string[];
  unitTested?: boolean;
}

export const ROADMAP_METADATA = {
  version: 'v0.5-alpha',
  lastUpdated: '2026-11-23',
  silhouetteColorHex: '#261D2E',
  highlightColorHex: '#22C55E',
  selectedColorHex: '#9D79BC',
  activeScaleLabel: '0.14× Isotropic Adult (Bitruvian.Human.Puppyt)',
  hiddenScaleLabel: 'CHILD_PROPORTION_SPECS (Preserved / Hidden)',
  defaultStageZoom: 0.18,
  pyxlPx: 100,
} as const;

export const SYSTEM_INVARIANTS: readonly SystemInvariant[] = [
  {
    id: 'INV-STAGE-01',
    domain: 'Stage Layout',
    assertion: 'stageWidth === 0.666 * windowWidth',
    contract: 'Stage canvas occupies 66.6% width on left; console occupies 33.3% (#16001E) on right.',
    unitTested: true,
  },
  {
    id: 'INV-STAGE-02',
    domain: 'Center Origin',
    assertion: 'navelKeystone.center === (canvasWidth / 2, canvasHeight / 2)',
    contract: 'Origin (0,0) aligns to the exact optical center of the 2/3 stage container.',
    unitTested: true,
  },
  {
    id: 'INV-ROYAL-01',
    domain: 'UI Protection',
    assertion: 'consoleBounds.intersects(mannequinBounds) === false',
    contract: 'Emperor.Clothes protocol: console panels never overlap or obscure mannequin artwork or joint dots.',
    unitTested: true,
  },
  {
    id: 'INV-KIN-01',
    domain: 'Joint Range',
    assertion: '-180.00 <= jointAngle <= 180.00',
    contract: 'Joint angles clamp to [-180.00°, +180.00°] at 0.25° step precision unless continuous spin is toggled ON.',
    unitTested: true,
  },
  {
    id: 'INV-KIN-02',
    domain: 'Shortest Path',
    assertion: 'abs(deltaTheta) <= 180.00',
    contract: 'Joint transitions evaluate modulo shortest angular distance to prevent >180° counter-spins.',
    unitTested: true,
  },
  {
    id: 'INV-SEAM-01',
    domain: 'Seam Separation',
    assertion: 'seamGapPixels === 0 && socketDistortionPercent === 0',
    contract: 'Local (dx, dy) anatomical offsets keep limb vector artwork seated inside parent housings during 90° bends.',
    unitTested: true,
  },
  {
    id: 'INV-PHYS-01',
    domain: 'Physics Multiplier',
    assertion: 'outputDelta === inputDelta * physicsGearRatio',
    contract: 'Twins (1.0×), Elastic Rubber (1.5×), Damp (0.5×), Rigid (0.0×), and Mode E (0.50×–1.50×).',
    unitTested: true,
  },
  {
    id: 'INV-MEM-01',
    domain: 'Snapshot Recall',
    assertion: 'transitionDurationMs === 500 && easing === "ease-in-out"',
    contract: 'Clicking any saved Snapshot reel card triggers a deterministic 0.50s shortest-path ease-in-out recall.',
    unitTested: true,
  },
  {
    id: 'INV-EXPO-01',
    domain: 'Export Parity',
    assertion: 'exportSuite.formats.length === 5 && allFormatsReady === true',
    contract: 'Studio Export Suite delivers Pose JSON, SVG Snapshot, Transparent PNG, Adaptive Surface PNG, and Lottie JSON.',
    unitTested: true,
  },
];

export const ROADMAP_ENTRIES: readonly RoadmapEntry[] = [
  // Phase 0: Blueprint Rules & Architectural Decisions
  {
    id: 'bp-intake',
    title: 'Initial Blueprint Rules Intake & Master Invariants Audit',
    status: 'completed',
    category: 'blueprint',
    priority: 'high',
    phase: 0,
    summary:
      'Master System Invariants & Rules Manifest ingested, reconciled with the 43-joint Option A topology, and promoted into 9 automated INV-* unit assertions.',
    details: [
      'Stage 2/3 left split (lg:w-2/3), Navel Keystone (0,0) optical center pan, Emperor.Clothes royal space protection (lg:w-1/3 #16001E console), and Analog_paper surface cover mounting.',
      'Bitruvian T Pose session launch procedural mood offsets, 5-mode physics steering gear ratios (Mode E clamped 0.50×–1.50×), Bottom Snapshot Reel, 0.50s shortest-path recall, Vector ZIP Sequence Importer, 4-way inspection views + Overlay toggle, 90° Seam Audit, 5-format Export Suite, and Scene Planner parser.',
      'Strict rigid cardboard-cutout rotation invariant (zero dynamic brace/wing stretching) and uniform cranium peak alignment across Front, Side R, Back, and Side L head turntable sprites.',
    ],
    codeRefs: ['ROADMAP.md', 'src/data/roadmap.ts', 'src/data/invariants.test.ts', 'src/App.tsx'],
    unitTested: true,
  },
  {
    id: 'dec-rig-topology',
    title: 'Decide Rig Topology: 43-Joint Puppyt Rig vs. Extra Joints on 18-Joint Rig',
    status: 'completed',
    category: 'kinematics',
    priority: 'high',
    phase: 0,
    summary:
      'Decision Recorded — Option A Adopted: Rebuilt Bitruvius-Evolved on the canonical 43-joint Bitruvian.Human.Puppyt topology (dual spine, independent ribR/ribL, hipR/hipL pelvic swivels, closed-chain shoulder girdle, digits, and facial sub-chain).',
    details: [
      'Chosen: Option A — Full 43-joint Puppyt rig fidelity (pelvis root, lumbar/thorax dual spine, ribR/ribL, neck/head/lip/chinTip, swivelR/L + swivelTipR/L + acromionR/L + braceR/L + wingR/L, humerus/forearm/hand + thumb/thumbTip/finger/fingerTip, and hipR/L + femur/shin/foot/toe).',
      'Preserved original 18-joint Evolved proportions intact inside the hidden CHILD_PROPORTION_SPECS archive pending Phase 3 child-proportion calibration.',
      'Replaced approximated attachment formulas with direct per-joint 43-node affine matrix FK, presets, snapshots, wireframe dots, and Puppyt digital model segments.',
    ],
    codeRefs: ['ROADMAP.md', 'src/types.ts', 'src/utils/kinematics.ts', 'src/utils/skeletonAttachment.ts'],
    unitTested: true,
  },
  {
    id: 'dec-procedural-settings',
    title: 'Define Which Puppyt Procedural Settings to Port',
    status: 'unresolved',
    category: 'animation',
    priority: 'medium',
    phase: 0,
    summary:
      'The Procedural Suite Proportions tab has three global sliders (Global Scale, Limb Width, Limb Length). The cleanest-model settings were not named.',
    details: [
      'Name the specific settings, and decide per setting whether it applies to the static rig or to motion only.',
      'Note: the suite\'s "Limb" sliders scale every part, including head and torso. Decide whether that is intended.',
    ],
    codeRefs: ['Bitruvian Procedural Suite/docs/APP_FEATURES_v0.2.md'],
  },
  {
    id: 'dec-hip-setting',
    title: 'Define the Hip Control',
    status: 'unresolved',
    category: 'kinematics',
    priority: 'medium',
    phase: 0,
    summary:
      'Puppyt has a hip swivel. The intended control here was not specified (swivel, tilt, or lock).',
    details: ['Define before the two-bone hip port in phase 2.'],
  },
  {
    id: 'dec-bitruvian-purple',
    title: 'Confirm Bitruvian Purple Hex',
    status: 'unresolved',
    category: 'rendering',
    priority: 'low',
    phase: 0,
    summary:
      "Using #9D79BC, the app's brand accent, as a stand-in. No named Bitruvian Purple exists in the codebase.",
    details: ['Confirm the value. It is one constant (SELECTED_PIECE_COLOR) in Mannequin.tsx.'],
    codeRefs: ['src/components/Mannequin.tsx'],
  },

  // Phase 1: Baseline Shell, Display Modes & Stage Polish
  {
    id: 'done-evolved-shell',
    title: 'Bitruvius-Evolved Studio Shell & Archival Drafting Stage',
    status: 'completed',
    category: 'workspace',
    phase: 1,
    summary:
      '43-joint Puppyt studio, PYXL/MPYX endless grid, four pose presets, FK/IK/PIN, Physics multipliers, undo/redo.',
    details: [
      'Presets: T-Pose, Vitruvian, Contrapposto, Striding.',
      'Undo, Redo, Last Pose comparison, micro-nudging (±0.25° / ±1.00°).',
      'Inspector tabs: Pose, Physics, Rig (43-Joint Ledger), Stage, plus the Roadmap tab.',
    ],
    codeRefs: ['src/components/TopConsoleBar.tsx', 'src/components/InspectorConsole.tsx'],
  },
  {
    id: 'done-skeleton-rig',
    title: '33-Piece Purple Skeleton & Closed-Chain Shoulder Girdle',
    status: 'completed',
    category: 'rendering',
    phase: 1,
    summary: 'Puppyt PNG pieces mounted 1:1 onto the canonical 43-joint affine matrices.',
    details: [
      'Bilateral Z-order: Backshoulder < Shoulderswivel < Ribcage.',
      'Pelvis acetabular cups within ≤0.5px of femurR and femurL sockets.',
      'Closed-chain braceR/braceL -> acromionR/acromionL tendon strain alerts in the digital model.',
    ],
    codeRefs: ['src/data/skeletonRig.ts', 'src/utils/skeletonAttachment.ts'],
    unitTested: true,
  },
  {
    id: 'done-model-refinement',
    title: 'Refined Skeleton Model Intake (Ribs, Shoulders, Pelvis & Dual Access)',
    status: 'completed',
    category: 'anatomy',
    phase: 1,
    summary:
      'Preserved uploaded refined ribR pivot ([1257.5, 2155.5], y=865), braceR_tendon (y=818), iliac crest guides, and hybrid Record/Array collection.',
    details: [
      'Reconciled ribR pivot to [1257.5, 2155.5] (y=865), aligning with right shoulder swivel axis.',
      'Calibrated right shoulder tendon braceR_tendon y=818 for smoother anatomical slope.',
      'Added hipRTip, hipLTip, handRTip, handLTip, toeRTip, toeLTip anatomical landmarks and pelvic crest segments.',
      'PUPPYT_SKELETON_PIECES supports dual API: array iteration (.map, .find) and dictionary lookup (pieces.ribR, pieces.head_front).',
    ],
    codeRefs: ['src/data/skeletonRig.ts', 'src/utils/skeletonAttachment.ts', 'src/utils/skeletonAttachment.test.ts'],
    unitTested: true,
  },
  {
    id: 'done-display-modes',
    title: 'Four Inspection View Modes: Pure Shadow, Bitruvian Purple, Hybrid Overlay, Wireframe',
    status: 'completed',
    category: 'rendering',
    phase: 1,
    summary:
      'Toggle cycles Pure Shadow → Bitruvian Purple → Hybrid Overlay → Wireframe, plus dedicated Overlay toggle.',
    details: [
      'Pure Shadow (silhouette): flat #261D2E ink silhouette (Light) or #EFEAF4 (Dark).',
      'Bitruvian Purple (vector_only): solid #9D79BC skeleton without wireframe overlays.',
      'Hybrid Overlay (hybrid_overlay): Bitruvian Purple vector skeleton + live digital kinematic armature overlay & callouts.',
      'Wireframe (armature_only): digital bone model, closed-chain shoulder girdle telemetry, and half-size joint dots.',
    ],
    codeRefs: ['src/components/Mannequin.tsx', 'src/components/TopConsoleBar.tsx', 'src/App.tsx'],
  },
  {
    id: 'done-hover-select',
    title: 'Hover (Green) & Selected (Bitruvian Purple) Highlight with Halo',
    status: 'completed',
    category: 'rendering',
    phase: 1,
    summary:
      'Hovered pieces fade to green, selected to Bitruvian Purple, both on a feathered light-purple halo.',
    details: ['Overlay sits above the flattened skeleton. Selected wins over hovered.'],
    codeRefs: ['src/components/Mannequin.tsx', 'src/index.css'],
  },
  {
    id: 'done-centering-fit',
    title: 'Figure-Centered Fit & 18% Default Zoom',
    status: 'completed',
    category: 'workspace',
    phase: 1,
    summary:
      'Figure centered on X and Y at launch. Title appearance and dismissal never shift the figure.',
    details: ['Vertical reserve is fixed, so the intertitle does not re-fit the stage.'],
    codeRefs: ['src/App.tsx'],
  },
  {
    id: 'done-intertitle-border',
    title: 'Intertitle Centered Between Toes and Border; Border Draws the Dark Rim Only',
    status: 'completed',
    category: 'workspace',
    phase: 1,
    summary:
      'Intertitle is 1 pyxl cap height, centered in the toes-to-border gap. Paper border keeps only its dark edge.',
    details: ['The light interior of the border overlay is transparent, so the canvas shows through.'],
    codeRefs: ['src/components/IntertitleOverlay.tsx', 'src/components/StageCanvas.tsx'],
  },
  {
    id: 'done-joint-dots',
    title: 'Joint Markers Reduced to Half-Size Dots',
    status: 'completed',
    category: 'rendering',
    phase: 1,
    summary: '5px dots at 18% zoom, down from 10px. Selection and hover show as color only.',
    details: ['Hit targets are unchanged.'],
    codeRefs: ['src/components/Mannequin.tsx'],
  },
  {
    id: 'done-pointer-batching',
    title: 'Pointer Moves Batched to One Update per Frame',
    status: 'completed',
    category: 'workspace',
    phase: 1,
    summary: 'High-polling mice no longer trigger a full re-render per event.',
    details: [
      'Last position flushed on pointer up. Headless drag tests hold 60 fps; the benefit on high-polling mice is not benchmarked.',
    ],
    codeRefs: ['src/components/StageCanvas.tsx'],
  },
  {
    id: 'done-single-file-build',
    title: 'Single-File HTML Build & Artifact Publishing',
    status: 'completed',
    category: 'workspace',
    phase: 1,
    summary:
      'Modular Vite TypeScript app reconciled with single-file offline HTML release updates (v0.5-alpha).',
    details: ['Assets extracted locally to /public/assets/skeleton/ and wired into modular TypeScript components.'],
    codeRefs: ['vite.config.ts', 'src/data/skeletonRig.ts'],
  },
  {
    id: 'ver-export-parity',
    title: 'Verify Filter Tint in SVG/PNG Exports',
    status: 'unresolved',
    category: 'rendering',
    priority: 'medium',
    phase: 1,
    summary:
      'Export output must match the live view in all three display modes before anything is published as an asset.',
    details: ['Audit SVG serialization and rasterization across Pure Shadow, Bitruvian Purple, and Wireframe.'],
    codeRefs: ['src/components/Mannequin.tsx', 'src/utils/export.ts'],
  },
  {
    id: 'ver-head-review',
    title: 'Head Turn Sprite Review at Working Zoom',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'low',
    phase: 1,
    summary:
      'Side and back sprites were checked in isolation and in the page, not at a zoom where the head is large.',
    details: [
      'Side and back art is not color-matched to the front head; visible only in Bitruvian Purple and Wireframe.',
    ],
    codeRefs: [
      'public/assets/skeleton/head-side-r.png',
      'public/assets/skeleton/head-back.png',
      'public/assets/skeleton/head-side-l.png',
    ],
  },

  // Phase 2: Kinematics & Multi-Bone Rigging
  {
    id: 'done-body-unlock',
    title: 'Body Rotation Unlocked by Default',
    status: 'completed',
    category: 'kinematics',
    phase: 2,
    summary: 'continuousSpin defaults on, so no joint is clamped to ±180°.',
    details: [
      'Spin toggle still re-clamps all joints. Rigid and PIN modes still lock individual joints by choice.',
    ],
    codeRefs: ['src/utils/kinematics.ts'],
    unitTested: true,
  },
  {
    id: 'done-lower-spine',
    title: 'Lower Spine (Lumbar) Rotates About the Pelvis',
    status: 'completed',
    category: 'kinematics',
    phase: 2,
    summary: 'Lumbar belongs to the 43-joint lower spine node and swings about the pelvis, carrying thorax, ribs, girdle, neck, and head.',
    details: ['Lumbar direction follows its angle; rest pose unchanged.', 'Dragging lumbar pivots cleanly on the pelvis origin.'],
    codeRefs: ['src/utils/skeletonAttachment.ts', 'src/utils/kinematics.ts', 'src/components/StageCanvas.tsx'],
    unitTested: true,
  },
  {
    id: 'done-head-turn',
    title: 'Head Turntable & Rigid Cardboard Cutout Rule',
    status: 'completed',
    category: 'anatomy',
    phase: 2,
    summary: 'The "<->" control cycles Front → Side R → Back → Side L at uniform cranium peak height with zero sprite stretching on shoulder wings/braces.',
    details: [
      'Side R/L and Back head sprites are uniformly scaled to match the Front cranium peak (-256.67) and chin datum (+632.67) without aspect distortion.',
      'Cardboard cutout rule: braceR/braceL and wingR/wingL rotate rigidly at fixed 0.14× cutout scale with zero dynamic length stretching.',
      'Stored in undo history with mandible lip locked at 0°.',
    ],
    codeRefs: ['src/data/skeletonRig.ts', 'src/utils/skeletonAttachment.ts', 'src/utils/kinematics.ts', 'src/components/Mannequin.tsx'],
    unitTested: true,
  },
  {
    id: 'rig-invariants',
    title: 'Rig Audit: Every Joint Has a Parent and a Child',
    status: 'completed',
    category: 'kinematics',
    priority: 'high',
    phase: 2,
    summary: '43-joint topological sorter and runtime hierarchy audit enforcing zero orphans, zero cycles, parent-before-child order, and aim-target order.',
    details: [
      'auditRigHierarchy validates all 43 joints against CANONICAL_RIG_PARENTS (no orphans, no cycles, no order violations).',
      'sortJointsTopologically guarantees every parent and aim target (acromionR/L) evaluates before children and braces (braceR/L).',
      'Automated unit assertions verify all hierarchy invariants and synthetic failure detection.',
    ],
    codeRefs: ['src/utils/kinematics.ts', 'src/data/skeletonRig.ts', 'src/utils/skeletonAttachment.test.ts'],
    dependsOn: ['dec-rig-topology'],
    unitTested: true,
  },
  {
    id: 'rig-two-bone-port',
    title: 'Port Two-Bone Ribs, Two-Bone Hips & Shoulder Girdle from Puppyt',
    status: 'unresolved',
    category: 'kinematics',
    priority: 'high',
    phase: 2,
    summary:
      "Puppyt's dual spine, swivel and acromion girdle, and analytic two-bone IK. Keep FK, IK, and PIN at parity.",
    details: [
      'Requires piece mappings for rib, hip, and girdle sprites.',
      'Shoulder rule: the shoulder is the outside of the ribcage; the collarbone sets how far the swivel can go outward.',
      'Chungus limit applies when the inner rib cannot stretch past the swivel and the collarbone cannot rotate further.',
    ],
    codeRefs: ['src/utils/kinematics.ts', 'src/utils/skeletonAttachment.ts'],
    dependsOn: ['dec-rig-topology', 'dec-hip-setting', 'rig-invariants'],
  },
  {
    id: 'rig-ribcage-modes',
    title: 'Ribcage Front / Side / Back Modes & Chungus Origin',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'medium',
    phase: 2,
    summary:
      'Chungus mode originates where the upper and lower spine meet, not at the lower spine origin. Needs rib side and back art.',
    details: [
      'Puppyt rib anchor modes (upper, lower/Chungus, ribwings) are the behavior reference.',
      'The Puppyt repo has side and back skull art, but no rib side or back art yet.',
    ],
    codeRefs: ['src/utils/skeletonAttachment.ts'],
    dependsOn: ['rig-two-bone-port'],
  },
  {
    id: 'rig-leg-ik',
    title: 'Procedural Leg IK (Rebuild)',
    status: 'unresolved',
    category: 'kinematics',
    priority: 'medium',
    phase: 2,
    summary:
      'Known broken in the Puppyt reference. Deferred on purpose until the structure is in place, but required by hips-to-ground.',
    details: ['Rebuild from the two-bone solver, not the broken reference.'],
    codeRefs: ['src/utils/kinematics.ts'],
    dependsOn: ['rig-two-bone-port'],
  },
  {
    id: 'rig-hips-to-ground',
    title: 'IK Compensation: Hips Reach the Ground Plane Without Breaking Hip–Leg–Foot Links',
    status: 'unresolved',
    category: 'kinematics',
    priority: 'medium',
    phase: 2,
    summary:
      'Hips should go all the way down to the ground plane, or the current pose extreme, with the connections intact.',
    details: ["Include Puppyt's floor gravity and grounded-foot behavior as the reference."],
    codeRefs: ['src/utils/kinematics.ts'],
    dependsOn: ['rig-leg-ik', 'dec-hip-setting'],
  },
  {
    id: 'rig-pin-piece-template',
    title: 'Pin-and-Rotate Template for All Pieces',
    status: 'unresolved',
    category: 'kinematics',
    priority: 'medium',
    phase: 2,
    summary:
      'Jaw Hinge Rig logic is the template for every piece: pin-and-rotate, rigid, fixed-length bars. The built rig wins where the spec differs.',
    details: ['Apply to rib, hip, girdle, hand, and foot pieces as they are added.'],
    dependsOn: ['rig-invariants'],
  },
  {
    id: 'vis-fabrik-floor',
    title: 'Hybrid FABRIK, Floor Gravity & Elastic Pin Full',
    status: 'vision',
    category: 'kinematics',
    phase: 2,
    summary:
      'Multi-joint FABRIK fallback, ground-plane gravity, and elastic anchor tethers with live tension lines.',
    details: ['Elastic pull briefly before snapping pinned wrists and ankles back to anchors.'],
    dependsOn: ['rig-hips-to-ground'],
  },

  // Phase 3: Pyxl Unit Standard & Sub-Rigs
  {
    id: 'asset-pyxl-standard',
    title: 'Adopt the Pyxl Unit Standard for Assets',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'high',
    phase: 3,
    summary:
      '1 pyxl = 100 px. Skull 21 wide × 28 tall. Pieces are exactly two parts; kits hold three or more assets.',
    details: [
      'Pyxl unit set: fingertip = iris = pyxl = 1; fingerwidth = 0.5; head = 28 fingertips.',
      'Joint color model: child is a solid purple plug, parent is a green outline. Red marks are reserved for fingertips and the navel.',
      'Sub-unit marks (pupil, half-finger) stay inside their parent pyxl.',
    ],
    codeRefs: ['src/data/skeletonRig.ts'],
    dependsOn: ['rig-pin-piece-template'],
  },
  {
    id: 'asset-hand',
    title: 'Hand: Gotz Bone Shapes, Pyxl Finger Ladder, Body-Matched Color',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'medium',
    phase: 3,
    summary:
      'Gotz bone shapes look better than the current hand art. Finger ladder and splay limits come from the pyxl spec.',
    details: [
      'Finger ladder: middle = 1 (the Bird), proximal = 2, metacarpal = 4; ring 4/5, index 3/4 tall, pinky 3/4 of index.',
      'Splay limits: index 30° one way, ring 30° the other, pinky 60° from ring, thumb at a right angle to the index. Curl limit 90°.',
      'Hand color matches the body. Hand hierarchy fixed from the Procreate sources.',
    ],
    codeRefs: ['src/data/skeletonRig.ts'],
    dependsOn: ['asset-pyxl-standard'],
  },
  {
    id: 'asset-foot',
    title: 'Foot: Marketeer Distal, Piggy Foot, Stretched-Pyxl Rule',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'medium',
    phase: 3,
    summary:
      'Marketeer toe-tip and full foot rig are the source. The finger-chain master JSON governs stretched segments.',
    details: [
      'Stretched pyxl rule: one pyxl wide, length stretches on Y only, never tiled or subdivided.',
      'Distal segment pivots at (0, -0.5); only the distal is rotatable until the rest is authored.',
    ],
    codeRefs: ['src/data/skeletonRig.ts'],
    dependsOn: ['asset-pyxl-standard'],
  },
  {
    id: 'asset-hierarchy-fix',
    title: 'Fix Hand, Foot, and Head Hierarchies from the Procreate Sources',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'medium',
    phase: 3,
    summary:
      'Hierarchies in the modern build are rough. Use the Procreate files for structure, and the current repo art for pixels.',
    details: [
      'Sources: Exploded_Skullkit, Exploded_skulbones, Assets_Yorick, Piggy_Ink, marketeer-rig-studio, yorick-jaw-hinge-rig, gotz hand layers.',
      'Names and structure come from the uploads; art comes from the repo.',
    ],
    dependsOn: ['asset-hand', 'asset-foot'],
  },
  {
    id: 'asset-skull-360',
    title: 'Skull 360° Turn & Yorick 2.5D Skull',
    status: 'vision',
    category: 'anatomy',
    phase: 3,
    summary:
      "Extend the four-step turn to a continuous turntable with a locked jaw. Consolidate Yorick's Procreate skull layers into a sturdy 2.5D model.",
    details: [
      'Keep the skull triangle and digital glow guides in sync across turn angles.',
      'Jaw stays locked at lip = 0° during turns.',
    ],
    dependsOn: ['asset-hierarchy-fix', 'rig-pin-piece-template'],
  },
  {
    id: 'asset-child-proportions',
    title: 'Calibrate Hidden Child Proportions (CHILD_PROPORTION_SPECS)',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'medium',
    phase: 3,
    summary:
      'Original Evolved specs are kept as CHILD_PROPORTION_SPECS and hidden. Calibration is needed before any child mode is exposed.',
    details: [
      'Audit head-to-body ratio, pelvis socket width (±52px), and femur and tibia aspect scaling.',
      'Keep controls hidden until the blueprint rules say to expose them.',
    ],
    codeRefs: ['src/utils/kinematics.ts'],
    dependsOn: ['asset-pyxl-standard'],
  },

  // Phase 4: Animation & Gesture Engine
  {
    id: 'motion-abc',
    title: 'A–B–C Keyframes, Motion Curves & Procedural In-Betweening',
    status: 'vision',
    category: 'animation',
    phase: 4,
    summary:
      'Turn Pose Snapshots into a keyframe engine with stepped FPS, selectable motion feels, and Muybridge passing arcs.',
    details: [
      'Slots A, B, C; procedural B breakdown when only A and C are filled.',
      'Easing: Flow, Snap, Elastic, Mechanical, Clockwork. Onion-skin ghosts in Pure Shadow ink.',
      'Poses always interpolate; no snapping between poses.',
    ],
    dependsOn: ['rig-hips-to-ground', 'rig-ribcage-modes'],
  },
  {
    id: 'motion-gesture-engine',
    title: 'Procedure.Bitruvius Gesture Engine: Wheel, D-Pad, List',
    status: 'vision',
    category: 'animation',
    phase: 4,
    summary:
      'Separate repo (cafeetc/Procedure.Bitruvius). Consolidate controls into a wheel, a d-pad, and a list, each a third of the panel.',
    details: [
      'Wheel is a spectrum simulator, almost greyscale with hints of color; center refines the value.',
      '"Surprise me" long-press starts an endless screensaver loop at about 12 fps with procedural easing.',
      'A⇄B play runs from the last pose to the current pose. Undo keeps the last three poses for now.',
      'Bring the real model, figure, and bones into the deck prototype.',
    ],
    dependsOn: ['motion-abc'],
  },

  // Phase 5: UI Unification & Perspective
  {
    id: 'ui-merge-bytruvyus',
    title: 'Merge Projyct.Bytruvyus Features into Bytruvyus.Puppyt.Modern UI',
    status: 'unresolved',
    category: 'workspace',
    priority: 'medium',
    phase: 5,
    summary: 'Modern build is the UI base; the older build is the feature source. No rush.',
    details: [
      "Goal: the old build's features with a cleaner, lighter, more fluid UI.",
      'Take UI decisions from the modern build; take features from the older build.',
    ],
    dependsOn: ['motion-abc', 'asset-hierarchy-fix'],
  },
  {
    id: 'vis-dual-spine-perspective',
    title: 'Dual-Spine Horizon Perspective & Adult/Child Morphing',
    status: 'vision',
    category: 'anatomy',
    phase: 5,
    summary:
      'Subtle lumbar and thorax lean toward a vanishing point, and a morph slider between adult and child proportions.',
    details: ['Expose child proportions only after asset-child-proportions passes.'],
    dependsOn: ['asset-child-proportions', 'rig-two-bone-port'],
  },

  // Phase 6: Production & Export
  {
    id: 'prod-procedural-checklist',
    title: 'AI-Free Production Checklist & Procedural Suite Design Document',
    status: 'unresolved',
    category: 'blueprint',
    priority: 'medium',
    phase: 6,
    summary:
      "Written by hand, in the author's own words. Explains the physics in visual terms and gives each feature a reason to exist.",
    details: [
      'Can run in parallel with phases 2–4; it is writing, not code.',
      'The change worksheet is the working format.',
      'Feed the finished document to an AI only to convert it to code.',
    ],
    codeRefs: ['Bitruvian Procedural Suite/docs/CHANGE_WORKSHEET.md'],
  },
  {
    id: 'prod-export-pipeline',
    title: 'Export Pipeline (DragonBones & Studio PNG/SVG)',
    status: 'vision',
    category: 'workspace',
    phase: 6,
    summary:
      'Export animations and stills. A DragonBones 5.5 pipeline was built in the earlier Bitruvius work and can be a reference.',
    details: ['Verify export parity first (ver-export-parity).'],
    dependsOn: ['ver-export-parity', 'motion-abc'],
  },
];
