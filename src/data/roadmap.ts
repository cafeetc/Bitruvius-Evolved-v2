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
  summary: string;
  details: string[];
  codeRefs?: string[];
}

export const ROADMAP_METADATA = {
  version: 'v0.3-alpha',
  lastUpdated: '2026-11-23',
  silhouetteColorHex: '#261D2E',
  activeScaleLabel: '0.14× Isotropic Adult (Bitruvian.Human.Puppyt)',
  hiddenScaleLabel: 'CHILD_PROPORTION_SPECS (Preserved / Hidden)',
} as const;

export const ROADMAP_ENTRIES: readonly RoadmapEntry[] = [
  // Blueprint Rules Intake
  {
    id: 'bp-intake',
    title: 'Initial Blueprint Rules Intake & Audit',
    status: 'awaiting_rules',
    category: 'blueprint',
    priority: 'high',
    summary:
      'Awaiting incoming initial blueprint rules to audit against Evolved kinematics, silhouette rules, and multi-phase priorities.',
    details: [
      'Ingest canonical ruleset as binding architectural invariants.',
      'Reconcile any conflicts between Bitruvius-Evolved stage behavior and Bitruvian.Human.Puppyt asset constraints.',
      'Promote reconciled specifications into automated unit assertions where applicable.',
    ],
    codeRefs: ['ROADMAP.md', 'src/data/roadmap.ts'],
  },
  {
    id: 'bp-active-invariants',
    title: 'Active Baseline Invariants Currently Enforced',
    status: 'completed',
    category: 'blueprint',
    summary:
      'Rules already established across the Evolved + Puppyt merge baseline.',
    details: [
      'Launch defaults immediately to Pure Shadow mode displaying the unified dark purple-gray (#261D2E) skeleton silhouette—never full color on initial boot.',
      'Wireframe mode reveals the emerald/crimson underlying digital kinematic model, full-color purple skeleton PNGs, and Evolved 10px joint HUD.',
      'Adult Puppyt proportions (0.14 isotropic scale) govern active JOINT_SPECS while original Evolved specs stay hidden as CHILD_PROPORTION_SPECS.',
      'Keep Bitruvius-Evolved workspace clean without extra Puppyt modals or mock telemetry.',
    ],
    codeRefs: ['src/App.tsx', 'src/components/Mannequin.tsx', 'src/utils/kinematics.ts'],
  },

  // Completed Baseline
  {
    id: 'done-evolved-shell',
    title: 'Bitruvius-Evolved Studio Shell & Archival Drafting Stage',
    status: 'completed',
    category: 'workspace',
    summary:
      'Core 18-joint studio workspace with PYXL/MPYX endless grid, 4 canonical pose presets, FK/IK/PIN modes, and Physics multipliers.',
    details: [
      'Presets active: T-Pose, Vitruvian, Contrapposto, and Striding.',
      'Session history stack with Undo, Redo, Last Pose comparison, and micro-nudging (±0.25° / ±1.00°).',
      'Console inspector tabs for Pose, Physics, Rig, Stage, plus persistent top Roadmap navigation.',
    ],
    codeRefs: ['src/components/TopConsoleBar.tsx', 'src/components/InspectorConsole.tsx'],
  },
  {
    id: 'done-skeleton-rig',
    title: '33-Piece Purple Skeleton Extraction & Closed-Chain Shoulder Girdle',
    status: 'completed',
    category: 'rendering',
    summary:
      'Extracted all unique post-antiPhallic PNG pieces from Bitruvian.Human.Puppyt mapped via affine matrices to Evolved joints.',
    details: [
      'Enforces bilateral Z-ordering invariant: Backshoulder < Shoulderswivel < Ribcage.',
      'Pelvis acetabular cups align within <= 0.5px of r_hip and l_hip.',
      'Computes neck-to-acromion tendon bond strain alerts in Wireframe digital model.',
    ],
    codeRefs: ['src/data/skeletonRig.ts', 'src/utils/skeletonAttachment.ts'],
  },
  {
    id: 'done-dark-silhouette',
    title: 'Dark Purple-Gray (#261D2E) Default Silhouette Filter',
    status: 'completed',
    category: 'rendering',
    summary:
      'Unified SVG feFlood + feComposite filter flattens all 33 pieces into a seamless dark purple-gray shadow silhouette on default launch.',
    details: [
      'Eliminates full-color bright purple fills, eye highlights, and joint alpha overlap seams in Pure Shadow.',
      'Preserves full click-and-drag joint/bone interactivity directly on the silhouette.',
    ],
    codeRefs: ['src/components/Mannequin.tsx', 'src/components/Bone.tsx'],
  },

  // Currently Unresolved
  {
    id: 'unres-blueprint-sync',
    title: 'Reconcile Incoming Blueprint Rules Against Rig & UI',
    status: 'unresolved',
    category: 'blueprint',
    priority: 'high',
    summary:
      'Pending rules feed from project author to confirm naming, constraints, coordinate conventions, and next milestone sequencing.',
    details: [
      'Cross-check every rule once submitted and flag any mismatches with current kinematics or UI controls.',
      'Lock approved constraints into Roadmap Section I and unit test suite.',
    ],
    codeRefs: ['ROADMAP.md'],
  },
  {
    id: 'unres-child-proportions',
    title: 'Calibrate & Refine Hidden Child Proportions (CHILD_PROPORTION_SPECS)',
    status: 'unresolved',
    category: 'anatomy',
    priority: 'medium',
    summary:
      'Original Evolved specs are saved in code as CHILD_PROPORTION_SPECS and hidden from UI; skeletal plate scaling needs dedicated child calibration.',
    details: [
      'Audit head-to-body cranial ratio, pelvis socket width (±52px), and shorter femur/tibia aspect scaling on skeleton PNGs.',
      'Keep UI controls hidden until refinement is complete and blueprint rules specify activation.',
    ],
    codeRefs: ['src/utils/kinematics.ts'],
  },
  {
    id: 'unres-intertitle-clearance',
    title: 'Adjust Welcome Intertitle Framing Under Taller Adult Stance',
    status: 'unresolved',
    category: 'workspace',
    priority: 'low',
    summary:
      'Adult 0.14 legs extend ~629px below center waist, placing the default below-model "Welcome Bitruvius" intertitle near the bottom border edge.',
    details: [
      'Review StageCanvas fitPaperToStage bottom margin vs IntertitleOverlay below-model clamping once layout rules are confirmed.',
    ],
    codeRefs: ['src/App.tsx', 'src/components/IntertitleOverlay.tsx'],
  },
  {
    id: 'unres-export-filter',
    title: 'Verify Pure-Shadow Filter Tint in SVG/PNG Exports',
    status: 'unresolved',
    category: 'rendering',
    priority: 'low',
    summary:
      'Ensure offscreen export serialization preserves #261D2E SVG filter output identically to live DOM rendering.',
    details: [
      'Audit SVG XML serialization and canvas rasterization across Pure Shadow and Wireframe modes.',
    ],
    codeRefs: ['src/components/Mannequin.tsx'],
  },

  // Future Visions
  {
    id: 'vis-skull-360',
    title: '360° Skull Turn (headStep / skullView)',
    status: 'vision',
    category: 'anatomy',
    summary:
      'Adopt Puppyt multi-angle cranial sprites with locked jaw stability (lip = 0°) synced smoothly with head/neck posing.',
    details: [
      'Map horizontal turn steps between front, three-quarter, profile, and rear cranium views.',
      'Keep skull triangle and digital glow guides synchronized across turn angles.',
    ],
  },
  {
    id: 'vis-modular-subrigs',
    title: 'On-Canvas Modular Sub-Rigs: Gotz Hand & Piggy Foot',
    status: 'vision',
    category: 'kinematics',
    summary:
      'Optional split-canvas sub-rig pop-ups launched from distal effectors for articulated digits without crowding the main drafting sheet.',
    details: [
      'Double-click wrist or ankle effector to slide stage beside detailed hand/foot sub-rig.',
      'Live forearm/calf angle synchronization back onto full figure.',
    ],
  },
  {
    id: 'vis-abc-motion',
    title: 'A–B–C Keyframes, Motion Curves & Procedural In-Betweening',
    status: 'vision',
    category: 'animation',
    summary:
      'Upgrade Evolved Pose Snapshots into a multi-keyframe animation engine with Muybridge passing arcs and selectable motion feels.',
    details: [
      'Support A/B/C slot capture, procedural B breakdown synthesis, stepped FPS, and Flow/Snap/Elastic/Mechanical/Clockwork easing.',
      'Add onion-skin ghost overlays respecting Pure Shadow silhouette ink.',
    ],
  },
  {
    id: 'vis-hybrid-ik-pin',
    title: 'Hybrid FABRIK Solver, Floor Gravity & Elastic Pin Full',
    status: 'vision',
    category: 'kinematics',
    summary:
      'Extend Evolved 2-bone IK with multi-joint FABRIK fallback, ground-plane gravity clamping, and elastic full-rig anchor tethers.',
    details: [
      'Allow brief elastic pull before snapping pinned wrists/ankles back to floor/air anchors.',
      'Display live dashed tension lines when pinned limbs stretch beyond anchor tolerance.',
    ],
  },
  {
    id: 'vis-perspective-morph',
    title: 'Dual-Spine Horizon Perspective & Adult/Child Proportion Morphing',
    status: 'vision',
    category: 'anatomy',
    summary:
      'Optional subtle lumbar/thorax perspective bend and continuous morph slider between Adult Puppyt (0.14) and calibrated Child proportions.',
    details: [
      'Expose refined CHILD_PROPORTION_SPECS once aspect compensation and skeletal proportions are verified.',
    ],
  },
];
