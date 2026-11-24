export type GridOriginMode = 'corner' | 'center';

export type SnapMode = 'none' | 'subpyxl' | 'pyxl';

export type JointMode = 'ROOT' | 'FK' | 'IK' | 'PIN';

export type PosePresetId = 'vitruvian' | 'tpose' | 'contrapposto' | 'striding';

export type StudioExportFormat =
  | 'pose_json'
  | 'svg_snapshot'
  | 'transparent_png'
  | 'adaptive_png'
  | 'lottie_json';

/**
 * Canonical 43-joint Bitruvian.Human.Puppyt kinematic topology:
 * - Axial & Head (7): pelvis (root), lumbar, thorax, neck, head, lip, chinTip
 * - Bilateral Ribcage (2): ribR, ribL
 * - Closed-Chain Shoulder Girdle & Back Wings (10): swivelR/L, swivelTipR/L, acromionR/L, braceR/L, wingR/L
 * - Bilateral Arms & Hand Digits (14): humerusR/L, forearmR/L, handR/L, thumbR/L, thumbTipR/L, fingerR/L, fingerTipR/L
 * - Bilateral Legs & Feet (10): hipR/L, femurR/L, shinR/L, footR/L, toeR/L
 */
export type JointId =
  | 'pelvis'
  | 'lumbar'
  | 'thorax'
  | 'ribR'
  | 'ribL'
  | 'neck'
  | 'head'
  | 'lip'
  | 'chinTip'
  | 'swivelR'
  | 'swivelTipR'
  | 'acromionR'
  | 'braceR'
  | 'wingR'
  | 'humerusR'
  | 'forearmR'
  | 'handR'
  | 'thumbR'
  | 'thumbTipR'
  | 'fingerR'
  | 'fingerTipR'
  | 'swivelL'
  | 'swivelTipL'
  | 'acromionL'
  | 'braceL'
  | 'wingL'
  | 'humerusL'
  | 'forearmL'
  | 'handL'
  | 'thumbL'
  | 'thumbTipL'
  | 'fingerL'
  | 'fingerTipL'
  | 'hipR'
  | 'femurR'
  | 'shinR'
  | 'footR'
  | 'toeR'
  | 'hipL'
  | 'femurL'
  | 'shinL'
  | 'footL'
  | 'toeL';

/**
 * Legacy 18-joint Evolved IDs preserved strictly for the hidden CHILD_PROPORTION_SPECS archive
 * pending Phase 3 asset-child-proportions calibration.
 */
export type LegacyJointId =
  | 'waist'
  | 'navel'
  | 'torso'
  | 'collar'
  | 'neck'
  | 'head'
  | 'r_shoulder'
  | 'r_elbow'
  | 'r_wrist'
  | 'l_shoulder'
  | 'l_elbow'
  | 'l_wrist'
  | 'r_hip'
  | 'r_knee'
  | 'r_ankle'
  | 'l_hip'
  | 'l_knee'
  | 'l_ankle';

export type PuppytJointRole =
  | 'root'
  | 'spine'
  | 'ribcage'
  | 'head_facial'
  | 'shoulder_girdle'
  | 'accessory_rig'
  | 'accessory_wing'
  | 'limb_arm'
  | 'hand_digit'
  | 'limb_leg'
  | 'foot_digit';

export type BodyPartCategory =
  | 'pelvis'
  | 'thighs'
  | 'calves'
  | 'feet'
  | 'spine'
  | 'ribs'
  | 'girdle'
  | 'wings'
  | 'upper_arms'
  | 'forearms'
  | 'hands'
  | 'digits'
  | 'neck'
  | 'head';

export type KeystoneOrigin = 'navel' | 'crown';

export type EnvironmentalAnchorId =
  | 'bottom_of_spine'
  | 'feet'
  | 'navel'
  | 'clavicle'
  | 'neck'
  | 'crown';

export type PhysicsModeId =
  | 'twins'
  | 'elastic_rubber'
  | 'damp'
  | 'rigid'
  | 'mode_e';

export type SilhouetteDisplayMode =
  | 'wireframe'
  | 'pure_shadow'
  | 'purple_skeleton'
  | 'hybrid_overlay';

export type InspectionViewMode =
  | 'silhouette'
  | 'vector_only'
  | 'hybrid_overlay'
  | 'armature_only';

export type ProceduralMoodOffsets = Partial<Record<JointId, number>>;

export interface PivotOffset {
  dx: number;
  dy: number;
}

export interface BoneScale {
  length: number; // 0.50x - 2.00x along bone axis
  width: number;  // 0.50x - 2.00x perpendicular to bone axis
}

export interface CharacterPoseProportions {
  globalScale: number;
  limbWidth: number;
  limbLength: number;
  perJoint?: Record<JointId, BoneScale>;
}

export interface AimConstraintSpec {
  to: JointId;
  minRatio: number;
  maxRatio: number;
}

export interface JointSpec {
  id: JointId;
  label: string;
  shortCode: string;
  subtitle: string;
  parentId: JointId | null;
  role: PuppytJointRole;
  side: 'center' | 'right' | 'left';
  restPivot: readonly [number, number];
  restTip?: readonly [number, number];
  lengthPx: number;
  endExtensionPx?: number;
  bodyPartCategory: BodyPartCategory;
  isSpine?: boolean;
  isTip?: boolean;
  locked?: boolean;
  isGhost?: boolean;
  aimTarget?: AimConstraintSpec;
  limits?: readonly [number, number];
  defaultLocalAngle: number;
  defaultMode: JointMode;
  ikChain?: [JointId, JointId, JointId] | 'spine';
  bendDirection?: 1 | -1;
}

export interface LegacyJointSpec {
  id: LegacyJointId;
  label: string;
  shortCode: string;
  subtitle: string;
  parentId: LegacyJointId | null;
  lengthPx: number;
  endExtensionPx?: number;
  socketOffset?: PivotOffset;
  isSpine?: boolean;
  defaultLocalAngle: number;
  defaultMode: JointMode;
  ikChain?: [LegacyJointId, LegacyJointId, LegacyJointId] | 'spine';
  bendDirection?: 1 | -1;
}

export interface JointRuntimeState {
  localAngle: number; // degrees relative to Puppyt anatomical rest (continuous or clamped [-180, 180])
  mode: JointMode;
  physicsMode: PhysicsModeId;
  modeERatio: number; // user-guided blend multiplier for Mode E (0.50 - 1.50, defaults to 1.00)
  scaleLength: number; // 0.50 - 2.00
  scaleWidth: number;  // 0.50 - 2.00
}

export interface ComputedJoint {
  id: JointId;
  spec: JointSpec;
  x: number;
  y: number;
  endX: number;
  endY: number;
  parentX: number | null;
  parentY: number | null;
  localAngle: number;
  worldAngle: number; // World orientation of bone vector (deg)
  restWorldDeg: number; // Puppyt rest vector direction (deg)
  cumulativeDeltaDeg: number; // Cumulative FK rotational offset from rest
  effectiveLengthPx: number;
  effectiveWidthScale: number;
  mode: JointMode;
  boneMatrix: readonly [number, number, number, number, number, number];
  isStrained?: boolean;
  tensionRatio?: number;
}

export interface RigHierarchyAuditReport {
  valid: boolean;
  totalJoints: number;
  orphanNodes: string[];
  cycles: string[];
  topologicalViolations: string[];
  aimOrderViolations: string[];
  parentMismatches: Array<{ id: string; expected: string | null; actual: string | null }>;
}

export interface ArmatureState {
  rootX: number;
  rootY: number;
  rootRotation: number;
  continuousSpin: boolean;
  internalKeystone: KeystoneOrigin; // 'navel' default vs 'crown' toggle
  environmentalAnchor: EnvironmentalAnchorId; // defaults to 'navel'
  isAnchorPinned: boolean; // true locks active environmental anchor to canvas origin (0,0); false allows free X/Y
  headTurn?: 0 | 1 | 2 | 3; // 0: Front, 1: Side R, 2: Back, 3: Side L
  proceduralMoodOffsets?: ProceduralMoodOffsets;
  joints: Record<JointId, JointRuntimeState>;
}

/**
 * Canonical Pose Snapshot Specification.
 * Encapsulates normalized 43-joint FK state, per-joint modes, 5 physics modes + Mode E ratios,
 * aggregate & per-joint bone proportions, keystone/environmental anchor state, and procedural mood offsets.
 */
export interface CharacterPoseSnapshot {
  snapshotId: string;
  label: string;
  timestamp: number;
  viewMode: SilhouetteDisplayMode;
  joints: Record<JointId, number>; // 43 normalized angles in [-180.00, +180.00]
  jointModes: Record<JointId, JointMode>;
  physicsModes: Record<JointId, PhysicsModeId>;
  modeEValues: Record<JointId, number>;
  proportions: CharacterPoseProportions;
  keystone: KeystoneOrigin;
  environmentalAnchor: EnvironmentalAnchorId;
  navelPin: boolean;
  continuousSpin: boolean;
  rootX: number;
  rootY: number;
  proceduralMoodOffsets?: ProceduralMoodOffsets;
  armature?: ArmatureState;
}

export interface SeamAuditCheck {
  jointId: JointId;
  parentId: JointId;
  flexionDeg: number;
  seamGapPixels: number;
  socketDistortionPercent: number;
  anatomicalNote: string;
  passed: boolean;
}

export interface SeamAuditReport {
  passed: boolean;
  maxSeamGapPixels: number;
  maxSocketDistortionPercent: number;
  checks: SeamAuditCheck[];
}

export interface SystemInvariant {
  id: string;
  domain: string;
  assertion: string;
  contract: string;
  unitTested: boolean;
}

export interface PoseHistoryState {
  currentPose: ArmatureState;
  lastPose: ArmatureState | null;
  history: ArmatureState[];
  historyIndex: number;
}

export type PoseSnapshot = CharacterPoseSnapshot;

export interface GridConfig {
  showSubpyxl: boolean;  // 10px = 0.10 pyx
  showPyxl: boolean;     // 100px = 1.00 pyx
  showMegapyxl: boolean; // 1,000px = 10.00 pyx
  showLabels: boolean;
  showVitruvianGuide: boolean;
  originMode: GridOriginMode;
  snapMode: SnapMode;
}

/**
 * Conceptual bounding square enclosing the figure model at all extremes
 * (left, right, top, bottom). Not rendered on canvas; acts as the base
 * coordinate/anchoring mechanism that the armature model connects to.
 */
export interface WorkingSquareBase {
  sidePx: number;
  halfSidePx: number;
  centerX: number;
  centerY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  modelRootOffsetY: number;
  extremes: {
    horizontalSpanPx: number;
    verticalSpanPx: number;
    maxReachUpPx: number;
    maxReachDownPx: number;
  };
}

export const ANGLE_PRECISION_STEP = 0.25;
export const BONE_SCALE_MIN = 0.5;
export const BONE_SCALE_MAX = 2.0;

export const PAPER_WIDTH = 1363;
export const PAPER_HEIGHT = 1800;

export const SUBPYXL_PX = 10;
export const PYXL_PX = 100;
export const MEGAPYXL_PX = 1000;

export const REPOSITORY_ASSET_PATHS = {
  vectorBorderSvg: '/assets/aistudio/Vector_paper_2dac36ce.svg',
  vectorPaperSvg: '/assets/aistudio/Vector_paper_png_2dac36ce.svg',
  analogPaperPng: '/assets/aistudio/Analog_paper_png_1a4024ad.png',
} as const;
