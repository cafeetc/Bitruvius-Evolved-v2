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
 * Canonical 18-joint kinematic skeleton:
 * - 6 axial joints: waist (Bottom of Spine), navel (Keystone), torso, collar, neck, head (Cranium/Crown)
 * - 6 upper limb joints: r/l_shoulder, r/l_elbow, r/l_wrist
 * - 6 lower limb joints: r/l_hip, r/l_knee, r/l_ankle
 */
export type JointId =
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

/**
 * 11 anatomical silhouette regions ordered by base Z-Index stacking:
 * Waist -> Thighs -> Calves -> Feet -> Torso -> Collar -> Upper Arms -> Forearms -> Hands -> Neck -> Head
 */
export type BodyPartCategory =
  | 'waist'
  | 'thighs'
  | 'calves'
  | 'feet'
  | 'torso'
  | 'collar'
  | 'upper_arms'
  | 'forearms'
  | 'hands'
  | 'neck'
  | 'head';

export type BonePlateId =
  | 'waist'
  | 'r_thigh'
  | 'l_thigh'
  | 'r_calf'
  | 'l_calf'
  | 'r_foot'
  | 'l_foot'
  | 'torso'
  | 'collar'
  | 'r_upper_arm'
  | 'l_upper_arm'
  | 'r_forearm'
  | 'l_forearm'
  | 'r_hand'
  | 'l_hand'
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

export type SilhouetteDisplayMode = 'wireframe' | 'pure_shadow';

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

export interface JointSpec {
  id: JointId;
  label: string;
  shortCode: string;
  subtitle: string;
  parentId: JointId | null;
  lengthPx: number;
  endExtensionPx?: number; // Terminal limb bone extension (head->crown, wrist->hand tip, ankle->foot sole)
  socketOffset?: PivotOffset; // Offset from parent joint center in parent's local frame (femoral cup, shoulder glenohumeral)
  bodyPartCategory?: BodyPartCategory;
  isSpine?: boolean;
  defaultLocalAngle: number;
  defaultMode: JointMode;
  ikChain?: [JointId, JointId, JointId] | 'spine';
  bendDirection?: 1 | -1;
}

export interface JointRuntimeState {
  localAngle: number; // degrees relative to parent worldAngle (continuous or clamped [-180, 180])
  mode: JointMode;
  physicsMode: PhysicsModeId;
  modeERatio: number; // user-guided blend multiplier for Mode E (defaults to 1.00)
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
  worldAngle: number;
  effectiveLengthPx: number;
  effectiveWidthScale: number;
  mode: JointMode;
}

export interface ArmatureState {
  rootX: number;
  rootY: number;
  rootRotation: number;
  continuousSpin: boolean;
  internalKeystone: KeystoneOrigin; // 'navel' default vs 'crown' toggle
  environmentalAnchor: EnvironmentalAnchorId; // defaults to 'bottom_of_spine'
  isAnchorPinned: boolean; // true locks active environmental anchor to canvas origin (0,0); false allows free X/Y
  joints: Record<JointId, JointRuntimeState>;
}

export interface BoneRenderDescriptor {
  id: BonePlateId;
  jointId: JointId;
  category: BodyPartCategory;
  side: 'center' | 'left' | 'right';
  label: string;
  originX: number;
  originY: number;
  worldAngle: number;
  lengthPx: number;
  scaleLength: number;
  scaleWidth: number;
  pivotOffset: PivotOffset; // (dx, dy) local asymmetrical housing offset
  zIndex: number;
}

/**
 * Phase 3 Canonical Pose Snapshot Specification.
 * Encapsulates normalized 18-joint FK state, per-joint modes, physics Mode E values,
 * aggregate & per-joint bone proportions, keystone/environmental anchor state, and spin mode.
 */
export interface CharacterPoseSnapshot {
  snapshotId: string;
  label: string;
  timestamp: number;
  viewMode: SilhouetteDisplayMode;
  joints: Record<JointId, number>; // 18 normalized angles in [-180.00, +180.00]
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
  armature?: ArmatureState;
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
