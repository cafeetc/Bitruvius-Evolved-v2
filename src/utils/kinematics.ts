import {
  ANGLE_PRECISION_STEP,
  ArmatureState,
  BONE_SCALE_MAX,
  BONE_SCALE_MIN,
  BonePlateId,
  BoneRenderDescriptor,
  BoneScale,
  CharacterPoseSnapshot,
  ComputedJoint,
  EnvironmentalAnchorId,
  JointId,
  JointMode,
  JointRuntimeState,
  JointSpec,
  PAPER_HEIGHT,
  PAPER_WIDTH,
  PhysicsModeId,
  PivotOffset,
  PosePresetId,
  SilhouetteDisplayMode,
  WorkingSquareBase,
} from '../types';

/**
 * Asymmetric housing offsets (dx, dy) in bone-local (0,0) pivot space:
 * - Thighs: femoral neck 127° angle keeps femoral head ball seated inside Waist bowl
 * - Upper Arms: deltoid cap / bicep bulge keeps shoulder head seated inside Collar overlay
 */
export const THIGH_FEMORAL_PIVOT_OFFSET = (side: 'right' | 'left'): PivotOffset => ({
  dx: -6,
  dy: side === 'right' ? 8 : -8,
});

export const UPPER_ARM_DELTOID_PIVOT_OFFSET = (side: 'right' | 'left'): PivotOffset => ({
  dx: -5,
  dy: side === 'right' ? 7 : -7,
});

export const PHYSICS_MODE_INFO: Record<
  PhysicsModeId,
  { label: string; shortLabel: string; ratio: number | null; description: string }
> = {
  twins: {
    label: 'Twins',
    shortLabel: '1.00× Direct',
    ratio: 1.0,
    description: '1:1 direct rotational input response',
  },
  elastic_rubber: {
    label: 'Elastic Rubber',
    shortLabel: '1.50× Amplified',
    ratio: 1.5,
    description: '150% exaggerated whip & sweep ratio',
  },
  damp: {
    label: 'Damp',
    shortLabel: '0.50× Dampened',
    ratio: 0.5,
    description: '50% micro-precision resistance ratio',
  },
  rigid: {
    label: 'Rigid',
    shortLabel: '0.00× Freeze',
    ratio: 0.0,
    description: '0% locked freeze preventing angular change',
  },
  mode_e: {
    label: 'Mode E',
    shortLabel: 'Custom Blend',
    ratio: null,
    description: 'User-guided custom blend factor',
  },
};

export const ENVIRONMENTAL_ANCHORS: {
  id: EnvironmentalAnchorId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'bottom_of_spine', label: 'Bottom of Spine', shortLabel: 'Spine Btm' },
  { id: 'feet', label: 'Feet', shortLabel: 'Feet' },
  { id: 'navel', label: 'Navel', shortLabel: 'Navel' },
  { id: 'clavicle', label: 'Clavicle', shortLabel: 'Clavicle' },
  { id: 'neck', label: 'Neck', shortLabel: 'Neck' },
  { id: 'crown', label: 'Crown / Cranium', shortLabel: 'Crown' },
];

/**
 * Base Z-Index stacking across the 11 anatomical regions:
 * Waist -> Thighs -> Calves -> Feet -> Torso -> Collar -> Upper Arms -> Forearms -> Hands -> Neck -> Head
 */
export const BODY_PART_BASE_Z = {
  waist: 10,
  thighs: 20,
  calves: 30,
  feet: 40,
  torso: 50,
  collar: 60,
  upper_arms: 70,
  forearms: 80,
  hands: 90,
  neck: 95,
  head: 100,
} as const;

export const PUPPYT_TO_EVOLVED_SCALE = 0.14;

/**
 * Preserved original Evolved proportions retained as child proportions (hidden from UI for now).
 */
export const CHILD_PROPORTION_SPECS: JointSpec[] = [
  {
    id: 'waist',
    label: 'Waist (Bottom of Spine)',
    shortCode: 'WST',
    subtitle: 'Pelvic girdle & bottom-of-spine root',
    parentId: null,
    lengthPx: 0,
    bodyPartCategory: 'waist',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'ROOT',
  },
  {
    id: 'navel',
    label: 'Navel Keystone',
    shortCode: 'NVL',
    subtitle: 'Immutable internal proportion keystone',
    parentId: 'waist',
    lengthPx: 0,
    socketOffset: { dx: 0, dy: -75 },
    bodyPartCategory: 'torso',
    isSpine: true,
    defaultLocalAngle: -90,
    defaultMode: 'FK',
  },
  {
    id: 'torso',
    label: 'Torso Sternum',
    shortCode: 'TRS',
    subtitle: 'Mid-thoracic ribcage articulation',
    parentId: 'navel',
    lengthPx: 115,
    bodyPartCategory: 'torso',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'collar',
    label: 'Collar (Clavicle Hub)',
    shortCode: 'CLR',
    subtitle: 'Shoulder girdle & deltoid yoke',
    parentId: 'torso',
    lengthPx: 100,
    bodyPartCategory: 'collar',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'neck',
    label: 'Cervical Neck',
    shortCode: 'NCK',
    subtitle: 'Cervical column bridge',
    parentId: 'collar',
    lengthPx: 42,
    bodyPartCategory: 'neck',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'head',
    label: 'Head / Cranium',
    shortCode: 'HED',
    subtitle: 'Cranium pivot extending to vertex crown',
    parentId: 'neck',
    lengthPx: 48,
    endExtensionPx: 145,
    bodyPartCategory: 'head',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
    ikChain: 'spine',
  },
  {
    id: 'r_shoulder',
    label: 'Right Shoulder',
    shortCode: 'R.SHD',
    subtitle: 'Right glenohumeral housing (deltoid cap offset)',
    parentId: 'collar',
    lengthPx: 0,
    socketOffset: { dx: -16, dy: -108 },
    bodyPartCategory: 'upper_arms',
    defaultLocalAngle: -76,
    defaultMode: 'FK',
  },
  {
    id: 'r_elbow',
    label: 'Right Elbow',
    shortCode: 'R.ELB',
    subtitle: 'Right humeral-ulnar hinge',
    parentId: 'r_shoulder',
    lengthPx: 175,
    bodyPartCategory: 'forearms',
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'r_wrist',
    label: 'Right Wrist',
    shortCode: 'R.WRS',
    subtitle: 'Right radiocarpal effector & hand pivot',
    parentId: 'r_elbow',
    lengthPx: 155,
    endExtensionPx: 92,
    bodyPartCategory: 'hands',
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['r_shoulder', 'r_elbow', 'r_wrist'],
    bendDirection: -1,
  },
  {
    id: 'l_shoulder',
    label: 'Left Shoulder',
    shortCode: 'L.SHD',
    subtitle: 'Left glenohumeral housing (deltoid cap offset)',
    parentId: 'collar',
    lengthPx: 0,
    socketOffset: { dx: -16, dy: 108 },
    bodyPartCategory: 'upper_arms',
    defaultLocalAngle: 74,
    defaultMode: 'FK',
  },
  {
    id: 'l_elbow',
    label: 'Left Elbow',
    shortCode: 'L.ELB',
    subtitle: 'Left humeral-ulnar hinge',
    parentId: 'l_shoulder',
    lengthPx: 175,
    bodyPartCategory: 'forearms',
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'l_wrist',
    label: 'Left Wrist',
    shortCode: 'L.WRS',
    subtitle: 'Left radiocarpal effector & hand pivot',
    parentId: 'l_elbow',
    lengthPx: 155,
    endExtensionPx: 92,
    bodyPartCategory: 'hands',
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['l_shoulder', 'l_elbow', 'l_wrist'],
    bendDirection: 1,
  },
  {
    id: 'r_hip',
    label: 'Right Hip',
    shortCode: 'R.HIP',
    subtitle: 'Right acetabular socket (127° femoral neck)',
    parentId: 'waist',
    lengthPx: 0,
    socketOffset: { dx: -52, dy: 22 },
    bodyPartCategory: 'thighs',
    defaultLocalAngle: 106,
    defaultMode: 'FK',
  },
  {
    id: 'r_knee',
    label: 'Right Knee',
    shortCode: 'R.KNE',
    subtitle: 'Right femorotibial hinge',
    parentId: 'r_hip',
    lengthPx: 225,
    bodyPartCategory: 'calves',
    defaultLocalAngle: -2,
    defaultMode: 'FK',
  },
  {
    id: 'r_ankle',
    label: 'Right Ankle',
    shortCode: 'R.ANK',
    subtitle: 'Right talocrural effector & pedal pivot',
    parentId: 'r_knee',
    lengthPx: 215,
    endExtensionPx: 65,
    bodyPartCategory: 'feet',
    defaultLocalAngle: 34,
    defaultMode: 'IK',
    ikChain: ['r_hip', 'r_knee', 'r_ankle'],
    bendDirection: 1,
  },
  {
    id: 'l_hip',
    label: 'Left Hip',
    shortCode: 'L.HIP',
    subtitle: 'Left acetabular socket (127° femoral neck)',
    parentId: 'waist',
    lengthPx: 0,
    socketOffset: { dx: 52, dy: 22 },
    bodyPartCategory: 'thighs',
    defaultLocalAngle: 74,
    defaultMode: 'FK',
  },
  {
    id: 'l_knee',
    label: 'Left Knee',
    shortCode: 'L.KNE',
    subtitle: 'Left femorotibial hinge',
    parentId: 'l_hip',
    lengthPx: 225,
    bodyPartCategory: 'calves',
    defaultLocalAngle: 2,
    defaultMode: 'FK',
  },
  {
    id: 'l_ankle',
    label: 'Left Ankle',
    shortCode: 'L.ANK',
    subtitle: 'Left talocrural effector & pedal pivot',
    parentId: 'l_knee',
    lengthPx: 215,
    endExtensionPx: 65,
    bodyPartCategory: 'feet',
    defaultLocalAngle: -34,
    defaultMode: 'IK',
    ikChain: ['l_hip', 'l_knee', 'l_ankle'],
    bendDirection: -1,
  },
];

/**
 * Canonical 18-joint kinematic rig specification using Bitruvian Human Puppyt adult proportions
 * (scaled uniformly at PUPPYT_TO_EVOLVED_SCALE = 0.140 from 2500x8742 anatomical space).
 */
export const JOINT_SPECS: JointSpec[] = [
  // Axial Skeleton (6 joints)
  {
    id: 'waist',
    label: 'Waist (Bottom of Spine)',
    shortCode: 'WST',
    subtitle: 'Pelvic girdle & bottom-of-spine root',
    parentId: null,
    lengthPx: 0,
    bodyPartCategory: 'waist',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'ROOT',
  },
  {
    id: 'navel',
    label: 'Navel Keystone',
    shortCode: 'NVL',
    subtitle: 'Immutable internal proportion keystone',
    parentId: 'waist',
    lengthPx: 0,
    socketOffset: { dx: 0, dy: -75 },
    bodyPartCategory: 'torso',
    isSpine: true,
    defaultLocalAngle: -90,
    defaultMode: 'FK',
  },
  {
    id: 'torso',
    label: 'Torso Sternum',
    shortCode: 'TRS',
    subtitle: 'Mid-thoracic ribcage articulation',
    parentId: 'navel',
    lengthPx: 104.55,
    bodyPartCategory: 'torso',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'collar',
    label: 'Collar (Clavicle Hub)',
    shortCode: 'CLR',
    subtitle: 'Shoulder girdle & deltoid yoke',
    parentId: 'torso',
    lengthPx: 140.7,
    bodyPartCategory: 'collar',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'neck',
    label: 'Cervical Neck',
    shortCode: 'NCK',
    subtitle: 'Cervical column bridge',
    parentId: 'collar',
    lengthPx: 32.5,
    bodyPartCategory: 'neck',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'head',
    label: 'Head / Cranium',
    shortCode: 'HED',
    subtitle: 'Cranium pivot extending to vertex crown',
    parentId: 'neck',
    lengthPx: 37.4,
    endExtensionPx: 119.8,
    bodyPartCategory: 'head',
    isSpine: true,
    defaultLocalAngle: 0,
    defaultMode: 'FK',
    ikChain: 'spine',
  },

  // Right Arm (3 joints, viewer left; socket aligned to Puppyt humeral head at collar height)
  {
    id: 'r_shoulder',
    label: 'Right Shoulder',
    shortCode: 'R.SHD',
    subtitle: 'Right glenohumeral housing (deltoid cap offset)',
    parentId: 'collar',
    lengthPx: 0,
    socketOffset: { dx: 0, dy: -95.9 },
    bodyPartCategory: 'upper_arms',
    defaultLocalAngle: -76,
    defaultMode: 'FK',
  },
  {
    id: 'r_elbow',
    label: 'Right Elbow',
    shortCode: 'R.ELB',
    subtitle: 'Right humeral-ulnar hinge',
    parentId: 'r_shoulder',
    lengthPx: 168.5,
    bodyPartCategory: 'forearms',
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'r_wrist',
    label: 'Right Wrist',
    shortCode: 'R.WRS',
    subtitle: 'Right radiocarpal effector & hand pivot',
    parentId: 'r_elbow',
    lengthPx: 176.3,
    endExtensionPx: 115.5,
    bodyPartCategory: 'hands',
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['r_shoulder', 'r_elbow', 'r_wrist'],
    bendDirection: -1,
  },

  // Left Arm (3 joints, viewer right; socket aligned to Puppyt humeral head at collar height)
  {
    id: 'l_shoulder',
    label: 'Left Shoulder',
    shortCode: 'L.SHD',
    subtitle: 'Left glenohumeral housing (deltoid cap offset)',
    parentId: 'collar',
    lengthPx: 0,
    socketOffset: { dx: 0, dy: 95.9 },
    bodyPartCategory: 'upper_arms',
    defaultLocalAngle: 74,
    defaultMode: 'FK',
  },
  {
    id: 'l_elbow',
    label: 'Left Elbow',
    shortCode: 'L.ELB',
    subtitle: 'Left humeral-ulnar hinge',
    parentId: 'l_shoulder',
    lengthPx: 168.5,
    bodyPartCategory: 'forearms',
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'l_wrist',
    label: 'Left Wrist',
    shortCode: 'L.WRS',
    subtitle: 'Left radiocarpal effector & hand pivot',
    parentId: 'l_elbow',
    lengthPx: 176.3,
    endExtensionPx: 115.5,
    bodyPartCategory: 'hands',
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['l_shoulder', 'l_elbow', 'l_wrist'],
    bendDirection: 1,
  },

  // Right Leg (3 joints, viewer left; Puppyt acetabular socket inside pelvis)
  {
    id: 'r_hip',
    label: 'Right Hip',
    shortCode: 'R.HIP',
    subtitle: 'Right acetabular socket (127° femoral neck)',
    parentId: 'waist',
    lengthPx: 0,
    socketOffset: { dx: -37.2, dy: 30.2 },
    bodyPartCategory: 'thighs',
    defaultLocalAngle: 106,
    defaultMode: 'FK',
  },
  {
    id: 'r_knee',
    label: 'Right Knee',
    shortCode: 'R.KNE',
    subtitle: 'Right femorotibial hinge',
    parentId: 'r_hip',
    lengthPx: 271.8,
    bodyPartCategory: 'calves',
    defaultLocalAngle: -2,
    defaultMode: 'FK',
  },
  {
    id: 'r_ankle',
    label: 'Right Ankle',
    shortCode: 'R.ANK',
    subtitle: 'Right talocrural effector & pedal pivot',
    parentId: 'r_knee',
    lengthPx: 206.9,
    endExtensionPx: 120.8,
    bodyPartCategory: 'feet',
    defaultLocalAngle: 34,
    defaultMode: 'IK',
    ikChain: ['r_hip', 'r_knee', 'r_ankle'],
    bendDirection: 1,
  },

  // Left Leg (3 joints, viewer right; Puppyt acetabular socket inside pelvis)
  {
    id: 'l_hip',
    label: 'Left Hip',
    shortCode: 'L.HIP',
    subtitle: 'Left acetabular socket (127° femoral neck)',
    parentId: 'waist',
    lengthPx: 0,
    socketOffset: { dx: 37.2, dy: 30.2 },
    bodyPartCategory: 'thighs',
    defaultLocalAngle: 74,
    defaultMode: 'FK',
  },
  {
    id: 'l_knee',
    label: 'Left Knee',
    shortCode: 'L.KNE',
    subtitle: 'Left femorotibial hinge',
    parentId: 'l_hip',
    lengthPx: 271.8,
    bodyPartCategory: 'calves',
    defaultLocalAngle: 2,
    defaultMode: 'FK',
  },
  {
    id: 'l_ankle',
    label: 'Left Ankle',
    shortCode: 'L.ANK',
    subtitle: 'Left talocrural effector & pedal pivot',
    parentId: 'l_knee',
    lengthPx: 206.9,
    endExtensionPx: 120.8,
    bodyPartCategory: 'feet',
    defaultLocalAngle: -34,
    defaultMode: 'IK',
    ikChain: ['l_hip', 'l_knee', 'l_ankle'],
    bendDirection: -1,
  },
];

export const JOINT_SPEC_MAP: Record<JointId, JointSpec> = JOINT_SPECS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec;
    return acc;
  },
  {} as Record<JointId, JointSpec>
);

export function snapAnglePrecision(deg: number, step = ANGLE_PRECISION_STEP): number {
  return Math.round(deg / step) * step;
}

export function clampAngle180(deg: number): number {
  return Math.max(-180, Math.min(180, deg));
}

export function normalizeAngleDeg(deg: number): number {
  let a = (((deg + 180) % 360) + 360) % 360 - 180;
  if (a === -180) a = 180;
  return Math.abs(a) < 1e-6 ? 0 : a;
}

/**
 * Shortest-path angular wrapping formula:
 * Δθ = ((θ_target - θ_current + 540°) mod 360°) - 180°
 */
export function shortestAngleDelta(currentDeg: number, targetDeg: number): number {
  return ((((targetDeg - currentDeg + 540) % 360) + 360) % 360) - 180;
}

export function applyJointAngleConstraint(deg: number, continuousSpin: boolean): number {
  const snapped = snapAnglePrecision(deg);
  return continuousSpin ? snapped : clampAngle180(snapped);
}

export function getPhysicsMultiplier(runtime: JointRuntimeState): number {
  switch (runtime.physicsMode) {
    case 'twins':
      return 1.0;
    case 'elastic_rubber':
      return 1.5;
    case 'damp':
      return 0.5;
    case 'rigid':
      return 0.0;
    case 'mode_e':
      return Math.max(0, runtime.modeERatio);
  }
}

export function formatSignedDeg(deg: number): string {
  const abs = Math.abs(deg).toFixed(2);
  const sign = deg < -0.005 ? '-' : '+';
  return `${sign}${abs}°`;
}

export function formatSignedNum(val: number, decimals = 2): string {
  const abs = Math.abs(val).toFixed(decimals);
  const sign = val < -0.0005 ? '-' : '+';
  return `${sign}${abs}`;
}

function rotateLocalOffset(offset: PivotOffset, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: offset.dx * c - offset.dy * s,
    y: offset.dx * s + offset.dy * c,
  };
}

/**
 * Conceptual bounding square enclosing the Vitruvian model at all extremes.
 */
export function computeModelWorkingSquare(
  centerX = PAPER_WIDTH / 2,
  centerY = PAPER_HEIGHT / 2
): WorkingSquareBase {
  const spineUp =
    Math.abs(JOINT_SPEC_MAP.navel.socketOffset?.dy ?? 75) +
    JOINT_SPEC_MAP.torso.lengthPx +
    JOINT_SPEC_MAP.collar.lengthPx +
    JOINT_SPEC_MAP.neck.lengthPx +
    JOINT_SPEC_MAP.head.lengthPx +
    (JOINT_SPEC_MAP.head.endExtensionPx ?? 0);

  const armHalfSpan =
    Math.abs(JOINT_SPEC_MAP.r_shoulder.socketOffset?.dy ?? 108) +
    JOINT_SPEC_MAP.r_elbow.lengthPx +
    JOINT_SPEC_MAP.r_wrist.lengthPx +
    (JOINT_SPEC_MAP.r_wrist.endExtensionPx ?? 0);

  const legDown =
    (JOINT_SPEC_MAP.r_hip.socketOffset?.dy ?? 22) +
    JOINT_SPEC_MAP.r_knee.lengthPx +
    JOINT_SPEC_MAP.r_ankle.lengthPx +
    (JOINT_SPEC_MAP.r_ankle.endExtensionPx ?? 0);

  const horizontalSpanPx = armHalfSpan * 2;
  const maxReachUpPx = spineUp;
  const maxReachDownPx = legDown;
  const verticalSpanPx = maxReachUpPx + maxReachDownPx;
  const sidePx = Math.max(horizontalSpanPx, verticalSpanPx);
  const halfSidePx = sidePx / 2;
  const modelRootOffsetY = (maxReachUpPx - maxReachDownPx) / 2;

  return {
    sidePx,
    halfSidePx,
    centerX,
    centerY,
    minX: centerX - halfSidePx,
    maxX: centerX + halfSidePx,
    minY: centerY - halfSidePx,
    maxY: centerY + halfSidePx,
    modelRootOffsetY,
    extremes: {
      horizontalSpanPx,
      verticalSpanPx,
      maxReachUpPx,
      maxReachDownPx,
    },
  };
}

export interface ModelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/**
 * Live 2D bounding envelope enclosing the entire scaled mannequin silhouette.
 * Used as a strict exclusion zone so HUD badges, IK/Root menus, and intertitles never obscure the model.
 */
export function computeModelBounds(
  computed: Record<JointId, ComputedJoint>,
  state: ArmatureState
): ModelBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const spec of JOINT_SPECS) {
    const j = computed[spec.id];
    const rt = state.joints[spec.id];
    const widthScale = Math.max(1, rt?.scaleWidth ?? 1);
    const basePad =
      spec.id === 'collar'
        ? 138
        : spec.id === 'torso' || spec.id === 'waist'
        ? 96
        : spec.id === 'head'
        ? 56
        : 46;
    const pad = basePad * widthScale;

    minX = Math.min(minX, j.x - pad, j.endX - pad);
    maxX = Math.max(maxX, j.x + pad, j.endX + pad);
    minY = Math.min(minY, j.y - pad, j.endY - pad);
    maxY = Math.max(maxY, j.y + pad, j.endY + pad);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export interface WorldExclusionRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SideCalloutDescriptor {
  joint: ComputedJoint;
  isRigid: boolean;
  isSelected: boolean;
  isHovered: boolean;
  side: 'left' | 'right';
  railEdgeX: number;
  perimeterX: number;
  calloutY: number;
  boxWidthPx: number;
  worldRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Computes collision-free Left & Right outer side-rail layout rects for active joint badges,
 * strictly outside ModelBounds and any screen-space exclusion zones (e.g., top-left Scale Legend).
 * Provides exact worldRect bounds so intersecting X/Y datum axes mask cleanly behind transparent on-canvas menus.
 */
export function computePushedSideCallouts(
  armature: ArmatureState,
  computedJoints: Record<JointId, ComputedJoint>,
  modelBounds: ModelBounds,
  selectedJointId: JointId,
  hoveredJointId: JointId | null,
  showAllBadges: boolean,
  zoom: number,
  exclusionRects: WorldExclusionRect[] = []
): SideCalloutDescriptor[] {
  const invZoom = 1 / Math.max(0.15, zoom);
  const railGapWorld = Math.max(20, 24 * invZoom);
  const minRowGapWorld = 24 * invZoom;
  const halfBoxH = 10 * invZoom;

  const leftItems: SideCalloutDescriptor[] = [];
  const rightItems: SideCalloutDescriptor[] = [];

  for (const spec of JOINT_SPECS) {
    const joint = computedJoints[spec.id];
    const runtime = armature.joints[spec.id];
    const isSelected = selectedJointId === spec.id;
    const isHovered = hoveredJointId === spec.id;
    const showBadge =
      showAllBadges || isSelected || isHovered || joint.mode === 'ROOT';

    if (!showBadge) continue;

    let side: 'left' | 'right';
    if (spec.id === 'waist' || spec.id === 'navel') {
      side = 'left';
    } else if (spec.isSpine) {
      side = 'right';
    } else if (joint.x < modelBounds.centerX - 6) {
      side = 'left';
    } else if (joint.x > modelBounds.centerX + 6) {
      side = 'right';
    } else {
      side = spec.id.startsWith('r_') ? 'left' : 'right';
    }

    const isRigid = runtime.physicsMode === 'rigid';
    const boxWidthPx = 168;
    const railEdgeX =
      side === 'left'
        ? modelBounds.minX - railGapWorld
        : modelBounds.maxX + railGapWorld;

    const entry: SideCalloutDescriptor = {
      joint,
      isRigid,
      isSelected,
      isHovered,
      side,
      railEdgeX,
      perimeterX: side === 'left' ? modelBounds.minX : modelBounds.maxX,
      calloutY: joint.y,
      boxWidthPx,
      worldRect: {
        x: 0,
        y: 0,
        width: boxWidthPx * invZoom,
        height: 20 * invZoom,
      },
    };

    if (side === 'left') {
      leftItems.push(entry);
    } else {
      rightItems.push(entry);
    }
  }

  const deoverlapAndFinalize = (list: SideCalloutDescriptor[]) => {
    list.sort((a, b) => a.joint.y - b.joint.y);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (i > 0) {
        const minAllowed = list[i - 1].calloutY + minRowGapWorld;
        if (c.calloutY < minAllowed) {
          c.calloutY = minAllowed;
        }
      }

      const boxW = c.boxWidthPx * invZoom;
      const boxX = c.railEdgeX + (c.side === 'left' ? -boxW : 0);

      // Push clear of any canvas exclusion zone (such as top-left Scale Legend)
      for (const rect of exclusionRects) {
        const horizOverlap = boxX + boxW > rect.minX && boxX < rect.maxX;
        if (!horizOverlap) continue;
        const vertOverlap =
          c.calloutY + halfBoxH > rect.minY && c.calloutY - halfBoxH < rect.maxY;
        if (vertOverlap) {
          c.calloutY = Math.max(
            c.calloutY,
            rect.maxY + halfBoxH + 8 * invZoom
          );
        }
      }

      c.worldRect = {
        x: boxX,
        y: c.calloutY - halfBoxH,
        width: boxW,
        height: 20 * invZoom,
      };
    }
  };

  deoverlapAndFinalize(leftItems);
  deoverlapAndFinalize(rightItems);

  return [...leftItems, ...rightItems];
}

export function createPosePreset(
  preset: PosePresetId,
  existingState?: ArmatureState
): ArmatureState {
  const joints = {} as Record<JointId, JointRuntimeState>;
  for (const spec of JOINT_SPECS) {
    const prev = existingState?.joints[spec.id];
    joints[spec.id] = {
      localAngle: spec.defaultLocalAngle,
      mode: prev?.mode ?? spec.defaultMode,
      physicsMode: prev?.physicsMode ?? 'twins',
      modeERatio: prev?.modeERatio ?? 1.0,
      scaleLength: prev?.scaleLength ?? 1.0,
      scaleWidth: prev?.scaleWidth ?? 1.0,
    };
  }

  const base: ArmatureState = {
    rootX: existingState?.rootX ?? PAPER_WIDTH / 2,
    rootY: existingState?.rootY ?? PAPER_HEIGHT / 2,
    rootRotation: 0,
    continuousSpin: existingState?.continuousSpin ?? false,
    internalKeystone: 'navel',
    environmentalAnchor: existingState?.environmentalAnchor ?? 'bottom_of_spine',
    isAnchorPinned: existingState?.isAnchorPinned ?? true,
    joints,
  };

  if (preset === 'tpose') {
    base.joints.r_shoulder.localAngle = -90;
    base.joints.r_elbow.localAngle = 0;
    base.joints.r_wrist.localAngle = 0;
    base.joints.l_shoulder.localAngle = 90;
    base.joints.l_elbow.localAngle = 0;
    base.joints.l_wrist.localAngle = 0;
    base.joints.r_hip.localAngle = 90;
    base.joints.r_knee.localAngle = 0;
    base.joints.r_ankle.localAngle = 0;
    base.joints.l_hip.localAngle = 90;
    base.joints.l_knee.localAngle = 0;
    base.joints.l_ankle.localAngle = 0;
  } else if (preset === 'contrapposto') {
    base.rootRotation = 4;
    base.joints.navel.localAngle = -94;
    base.joints.torso.localAngle = -3;
    base.joints.collar.localAngle = -3;
    base.joints.neck.localAngle = 4;
    base.joints.head.localAngle = 4;
    base.joints.r_shoulder.localAngle = -148;
    base.joints.r_elbow.localAngle = 52;
    base.joints.r_wrist.localAngle = 14;
    base.joints.l_shoulder.localAngle = 146;
    base.joints.l_elbow.localAngle = -48;
    base.joints.l_wrist.localAngle = -16;
    base.joints.r_hip.localAngle = 98;
    base.joints.r_knee.localAngle = -12;
    base.joints.r_ankle.localAngle = 4;
    base.joints.l_hip.localAngle = 78;
    base.joints.l_knee.localAngle = 18;
    base.joints.l_ankle.localAngle = -20;
  } else if (preset === 'striding') {
    base.rootRotation = -6;
    base.joints.navel.localAngle = -84;
    base.joints.torso.localAngle = 6;
    base.joints.collar.localAngle = 2;
    base.joints.neck.localAngle = -4;
    base.joints.head.localAngle = -2;
    base.joints.r_shoulder.localAngle = -132;
    base.joints.r_elbow.localAngle = -42;
    base.joints.r_wrist.localAngle = -18;
    base.joints.l_shoulder.localAngle = 128;
    base.joints.l_elbow.localAngle = 36;
    base.joints.l_wrist.localAngle = 12;
    base.joints.r_hip.localAngle = 118;
    base.joints.r_knee.localAngle = -26;
    base.joints.r_ankle.localAngle = 28;
    base.joints.l_hip.localAngle = 58;
    base.joints.l_knee.localAngle = 22;
    base.joints.l_ankle.localAngle = -12;
  } else {
    // Classical Vitruvian X/Y reach: elevated symmetrical arms (+16° above horizontal) & splayed legs
    base.joints.r_shoulder.localAngle = -74;
    base.joints.r_elbow.localAngle = 0;
    base.joints.r_wrist.localAngle = 0;
    base.joints.l_shoulder.localAngle = 74;
    base.joints.l_elbow.localAngle = 0;
    base.joints.l_wrist.localAngle = 0;
    base.joints.r_hip.localAngle = 107;
    base.joints.r_knee.localAngle = -1;
    base.joints.r_ankle.localAngle = 34;
    base.joints.l_hip.localAngle = 73;
    base.joints.l_knee.localAngle = 1;
    base.joints.l_ankle.localAngle = -34;
  }

  return base;
}

/**
 * Evaluates raw FK skeletal hierarchy from waist root before environmental anchor translation.
 */
function evaluateRawArmature(state: ArmatureState): Record<JointId, ComputedJoint> {
  const computed = {} as Record<JointId, ComputedJoint>;

  for (const spec of JOINT_SPECS) {
    const runtime = state.joints[spec.id];
    const scaleLen = Math.max(BONE_SCALE_MIN, Math.min(BONE_SCALE_MAX, runtime.scaleLength));
    const scaleWid = Math.max(BONE_SCALE_MIN, Math.min(BONE_SCALE_MAX, runtime.scaleWidth));

    if (spec.parentId === null) {
      const worldAngle = state.rootRotation;
      computed[spec.id] = {
        id: spec.id,
        spec,
        x: state.rootX,
        y: state.rootY,
        endX: state.rootX,
        endY: state.rootY,
        parentX: null,
        parentY: null,
        localAngle: state.rootRotation,
        worldAngle,
        effectiveLengthPx: 0,
        effectiveWidthScale: scaleWid,
        mode: runtime.mode,
      };
      continue;
    }

    const parent = computed[spec.parentId];
    const parentRuntime = state.joints[spec.parentId];
    const parentScaleLen = Math.max(
      BONE_SCALE_MIN,
      Math.min(BONE_SCALE_MAX, parentRuntime.scaleLength)
    );

    let x: number;
    let y: number;

    if (spec.socketOffset) {
      // Scale lateral socket offsets by parent thickness (width) and vertical spine rise by parent length
      const scaledOffset: PivotOffset = spec.isSpine
        ? {
            dx: spec.socketOffset.dx * parentRuntime.scaleWidth,
            dy: spec.socketOffset.dy * parentScaleLen,
          }
        : {
            dx: spec.socketOffset.dx * parentRuntime.scaleWidth,
            dy: spec.socketOffset.dy * parentRuntime.scaleWidth,
          };
      const rotated = rotateLocalOffset(scaledOffset, parent.worldAngle);
      x = parent.x + rotated.x;
      y = parent.y + rotated.y;
    } else {
      const radParent = (parent.worldAngle * Math.PI) / 180;
      const dist = spec.lengthPx * parentScaleLen;
      x = parent.x + Math.cos(radParent) * dist;
      y = parent.y + Math.sin(radParent) * dist;
    }

    const worldAngle = parent.worldAngle + runtime.localAngle;
    const endExt = (spec.endExtensionPx ?? 0) * scaleLen;
    const radSelf = (worldAngle * Math.PI) / 180;
    const endX = x + Math.cos(radSelf) * endExt;
    const endY = y + Math.sin(radSelf) * endExt;

    computed[spec.id] = {
      id: spec.id,
      spec,
      x,
      y,
      endX,
      endY,
      parentX: parent.x,
      parentY: parent.y,
      localAngle: runtime.localAngle,
      worldAngle,
      effectiveLengthPx: endExt,
      effectiveWidthScale: scaleWid,
      mode: runtime.mode,
    };
  }

  return computed;
}

export function getEnvironmentalAnchorPoint(
  computed: Record<JointId, ComputedJoint>,
  anchor: EnvironmentalAnchorId
): { x: number; y: number } {
  switch (anchor) {
    case 'bottom_of_spine':
      return { x: computed.waist.x, y: computed.waist.y };
    case 'feet':
      return {
        x: (computed.r_ankle.endX + computed.l_ankle.endX) / 2,
        y: Math.max(computed.r_ankle.endY, computed.l_ankle.endY),
      };
    case 'navel':
      return { x: computed.navel.x, y: computed.navel.y };
    case 'clavicle':
      return { x: computed.collar.x, y: computed.collar.y };
    case 'neck':
      return { x: computed.neck.x, y: computed.neck.y };
    case 'crown':
      return { x: computed.head.endX, y: computed.head.endY };
  }
}

/**
 * Propagates FK parent-to-child transformations across the 18 joints, applying:
 * 1) Immutable Navel keystone proportion lengths (non-uniform bone-axis scaling)
 * 2) Environmental Anchor pinning to canvas origin (0,0) in active coordinate datum when Pinned
 */
export function computeArmature(
  state: ArmatureState,
  canvasOrigin: { x: number; y: number } = { x: PAPER_WIDTH / 2, y: PAPER_HEIGHT / 2 }
): Record<JointId, ComputedJoint> {
  const raw = evaluateRawArmature(state);

  if (!state.isAnchorPinned) {
    return raw;
  }

  const anchorPt = getEnvironmentalAnchorPoint(raw, state.environmentalAnchor);
  const shiftX = canvasOrigin.x - anchorPt.x;
  const shiftY = canvasOrigin.y - anchorPt.y;

  const pinned = {} as Record<JointId, ComputedJoint>;
  for (const spec of JOINT_SPECS) {
    const j = raw[spec.id];
    pinned[spec.id] = {
      ...j,
      x: j.x + shiftX,
      y: j.y + shiftY,
      endX: j.endX + shiftX,
      endY: j.endY + shiftY,
      parentX: j.parentX !== null ? j.parentX + shiftX : null,
      parentY: j.parentY !== null ? j.parentY + shiftY : null,
    };
  }
  return pinned;
}

/**
 * Dynamic Procedural Z-Indexing for bilateral limbs:
 * Evaluates pose rotation/forward projection to favor the forward-pointing limb;
 * if limbs are neutral/centered, deterministically selects Left primary with subtle decimal Z-shift compensation.
 */
function computeBilateralPriority(
  computed: Record<JointId, ComputedJoint>
): { armFront: 'left' | 'right'; armDelta: number; legFront: 'left' | 'right'; legDelta: number } {
  // Forward projection score for legs: knee flexion bend + thigh inward cross toward center
  const torsoMidX = computed.waist.x;
  const rLegScore =
    Math.abs(normalizeAngleDeg(computed.r_knee.localAngle)) * 0.65 +
    Math.max(0, (computed.r_ankle.x - torsoMidX) * 0.45) +
    Math.max(0, (computed.waist.y + 420 - computed.r_ankle.y) * 0.25);

  const lLegScore =
    Math.abs(normalizeAngleDeg(computed.l_knee.localAngle)) * 0.65 +
    Math.max(0, (torsoMidX - computed.l_ankle.x) * 0.45) +
    Math.max(0, (computed.waist.y + 420 - computed.l_ankle.y) * 0.25);

  const legDiff = Math.abs(lLegScore - rLegScore);
  const legFront: 'left' | 'right' = legDiff < 1.5 ? 'left' : lLegScore > rLegScore ? 'left' : 'right';

  // Forward projection score for arms: elbow flexion + hand cross-body projection toward sternum centerline
  const sternumX = computed.collar.x;
  const rArmScore =
    Math.abs(normalizeAngleDeg(computed.r_elbow.localAngle)) * 0.65 +
    Math.max(0, (computed.r_wrist.x - sternumX) * 0.55) +
    Math.max(0, (computed.collar.y - computed.r_wrist.y) * 0.15);

  const lArmScore =
    Math.abs(normalizeAngleDeg(computed.l_elbow.localAngle)) * 0.65 +
    Math.max(0, (sternumX - computed.l_wrist.x) * 0.55) +
    Math.max(0, (computed.collar.y - computed.l_wrist.y) * 0.15);

  const armDiff = Math.abs(lArmScore - rArmScore);
  const armFront: 'left' | 'right' = armDiff < 1.5 ? 'left' : lArmScore > rArmScore ? 'left' : 'right';

  return {
    armFront,
    armDelta: armDiff < 1.5 ? 0.52 : 1.52,
    legFront,
    legDelta: legDiff < 1.5 ? 0.52 : 1.52,
  };
}

/**
 * Generates sorted 3-anchor descriptors for all 11 anatomical body-part layers:
 * Waist -> Thighs -> Calves -> Feet -> Torso -> Collar -> Upper Arms -> Forearms -> Hands -> Neck -> Head
 */
export function buildSortedBoneDescriptors(
  state: ArmatureState,
  computed: Record<JointId, ComputedJoint>
): BoneRenderDescriptor[] {
  const zOrder = computeBilateralPriority(computed);

  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
  const r = (id: JointId) => state.joints[id];

  const legZ = (base: number, side: 'left' | 'right') =>
    side === zOrder.legFront ? base + zOrder.legDelta : base - zOrder.legDelta * 0.45;
  const armZ = (base: number, side: 'left' | 'right') =>
    side === zOrder.armFront ? base + zOrder.armDelta : base - zOrder.armDelta * 0.45;

  const descriptors: BoneRenderDescriptor[] = [
    // 1. Waist (oriented upright along spine axis so +X faces navel and ±Y spans hip sockets)
    {
      id: 'waist',
      jointId: 'waist',
      category: 'waist',
      side: 'center',
      label: 'Waist',
      originX: computed.waist.x,
      originY: computed.waist.y,
      worldAngle: computed.waist.worldAngle - 90,
      lengthPx: dist(computed.waist.x, computed.waist.y, computed.navel.x, computed.navel.y),
      scaleLength: r('waist').scaleLength,
      scaleWidth: r('waist').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: BODY_PART_BASE_Z.waist,
    },
    // 2. Thighs (127° femoral neck offset inside Waist housing)
    {
      id: 'r_thigh',
      jointId: 'r_hip',
      category: 'thighs',
      side: 'right',
      label: 'Right Thigh',
      originX: computed.r_hip.x,
      originY: computed.r_hip.y,
      worldAngle: computed.r_hip.worldAngle,
      lengthPx: dist(computed.r_hip.x, computed.r_hip.y, computed.r_knee.x, computed.r_knee.y),
      scaleLength: r('r_hip').scaleLength,
      scaleWidth: r('r_hip').scaleWidth,
      pivotOffset: THIGH_FEMORAL_PIVOT_OFFSET('right'),
      zIndex: legZ(BODY_PART_BASE_Z.thighs, 'right'),
    },
    {
      id: 'l_thigh',
      jointId: 'l_hip',
      category: 'thighs',
      side: 'left',
      label: 'Left Thigh',
      originX: computed.l_hip.x,
      originY: computed.l_hip.y,
      worldAngle: computed.l_hip.worldAngle,
      lengthPx: dist(computed.l_hip.x, computed.l_hip.y, computed.l_knee.x, computed.l_knee.y),
      scaleLength: r('l_hip').scaleLength,
      scaleWidth: r('l_hip').scaleWidth,
      pivotOffset: THIGH_FEMORAL_PIVOT_OFFSET('left'),
      zIndex: legZ(BODY_PART_BASE_Z.thighs, 'left'),
    },
    // 3. Calves
    {
      id: 'r_calf',
      jointId: 'r_knee',
      category: 'calves',
      side: 'right',
      label: 'Right Calf',
      originX: computed.r_knee.x,
      originY: computed.r_knee.y,
      worldAngle: computed.r_knee.worldAngle,
      lengthPx: dist(computed.r_knee.x, computed.r_knee.y, computed.r_ankle.x, computed.r_ankle.y),
      scaleLength: r('r_knee').scaleLength,
      scaleWidth: r('r_knee').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: legZ(BODY_PART_BASE_Z.calves, 'right'),
    },
    {
      id: 'l_calf',
      jointId: 'l_knee',
      category: 'calves',
      side: 'left',
      label: 'Left Calf',
      originX: computed.l_knee.x,
      originY: computed.l_knee.y,
      worldAngle: computed.l_knee.worldAngle,
      lengthPx: dist(computed.l_knee.x, computed.l_knee.y, computed.l_ankle.x, computed.l_ankle.y),
      scaleLength: r('l_knee').scaleLength,
      scaleWidth: r('l_knee').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: legZ(BODY_PART_BASE_Z.calves, 'left'),
    },
    // 4. Feet
    {
      id: 'r_foot',
      jointId: 'r_ankle',
      category: 'feet',
      side: 'right',
      label: 'Right Foot',
      originX: computed.r_ankle.x,
      originY: computed.r_ankle.y,
      worldAngle: computed.r_ankle.worldAngle,
      lengthPx: computed.r_ankle.effectiveLengthPx,
      scaleLength: r('r_ankle').scaleLength,
      scaleWidth: r('r_ankle').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: legZ(BODY_PART_BASE_Z.feet, 'right'),
    },
    {
      id: 'l_foot',
      jointId: 'l_ankle',
      category: 'feet',
      side: 'left',
      label: 'Left Foot',
      originX: computed.l_ankle.x,
      originY: computed.l_ankle.y,
      worldAngle: computed.l_ankle.worldAngle,
      lengthPx: computed.l_ankle.effectiveLengthPx,
      scaleLength: r('l_ankle').scaleLength,
      scaleWidth: r('l_ankle').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: legZ(BODY_PART_BASE_Z.feet, 'left'),
    },
    // 5. Torso (Navel keystone bridging abdomen & ribcage seamlessly up to Collar)
    {
      id: 'torso',
      jointId: 'torso',
      category: 'torso',
      side: 'center',
      label: 'Torso',
      originX: computed.navel.x,
      originY: computed.navel.y,
      worldAngle:
        (Math.atan2(computed.collar.y - computed.navel.y, computed.collar.x - computed.navel.x) *
          180) /
        Math.PI,
      lengthPx: dist(computed.navel.x, computed.navel.y, computed.collar.x, computed.collar.y),
      scaleLength: r('torso').scaleLength,
      scaleWidth: r('torso').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: BODY_PART_BASE_Z.torso,
    },
    // 6. Collar (Clavicle shoulder housing yoke)
    {
      id: 'collar',
      jointId: 'collar',
      category: 'collar',
      side: 'center',
      label: 'Collar',
      originX: computed.collar.x,
      originY: computed.collar.y,
      worldAngle: computed.collar.worldAngle,
      lengthPx: dist(computed.collar.x, computed.collar.y, computed.neck.x, computed.neck.y),
      scaleLength: r('collar').scaleLength,
      scaleWidth: r('collar').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: BODY_PART_BASE_Z.collar,
    },
    // 7. Upper Arms (deltoid cap / bicep bulge local offset)
    {
      id: 'r_upper_arm',
      jointId: 'r_shoulder',
      category: 'upper_arms',
      side: 'right',
      label: 'Right Upper Arm',
      originX: computed.r_shoulder.x,
      originY: computed.r_shoulder.y,
      worldAngle: computed.r_shoulder.worldAngle,
      lengthPx: dist(
        computed.r_shoulder.x,
        computed.r_shoulder.y,
        computed.r_elbow.x,
        computed.r_elbow.y
      ),
      scaleLength: r('r_shoulder').scaleLength,
      scaleWidth: r('r_shoulder').scaleWidth,
      pivotOffset: UPPER_ARM_DELTOID_PIVOT_OFFSET('right'),
      zIndex: armZ(BODY_PART_BASE_Z.upper_arms, 'right'),
    },
    {
      id: 'l_upper_arm',
      jointId: 'l_shoulder',
      category: 'upper_arms',
      side: 'left',
      label: 'Left Upper Arm',
      originX: computed.l_shoulder.x,
      originY: computed.l_shoulder.y,
      worldAngle: computed.l_shoulder.worldAngle,
      lengthPx: dist(
        computed.l_shoulder.x,
        computed.l_shoulder.y,
        computed.l_elbow.x,
        computed.l_elbow.y
      ),
      scaleLength: r('l_shoulder').scaleLength,
      scaleWidth: r('l_shoulder').scaleWidth,
      pivotOffset: UPPER_ARM_DELTOID_PIVOT_OFFSET('left'),
      zIndex: armZ(BODY_PART_BASE_Z.upper_arms, 'left'),
    },
    // 8. Forearms
    {
      id: 'r_forearm',
      jointId: 'r_elbow',
      category: 'forearms',
      side: 'right',
      label: 'Right Forearm',
      originX: computed.r_elbow.x,
      originY: computed.r_elbow.y,
      worldAngle: computed.r_elbow.worldAngle,
      lengthPx: dist(
        computed.r_elbow.x,
        computed.r_elbow.y,
        computed.r_wrist.x,
        computed.r_wrist.y
      ),
      scaleLength: r('r_elbow').scaleLength,
      scaleWidth: r('r_elbow').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: armZ(BODY_PART_BASE_Z.forearms, 'right'),
    },
    {
      id: 'l_forearm',
      jointId: 'l_elbow',
      category: 'forearms',
      side: 'left',
      label: 'Left Forearm',
      originX: computed.l_elbow.x,
      originY: computed.l_elbow.y,
      worldAngle: computed.l_elbow.worldAngle,
      lengthPx: dist(
        computed.l_elbow.x,
        computed.l_elbow.y,
        computed.l_wrist.x,
        computed.l_wrist.y
      ),
      scaleLength: r('l_elbow').scaleLength,
      scaleWidth: r('l_elbow').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: armZ(BODY_PART_BASE_Z.forearms, 'left'),
    },
    // 9. Hands
    {
      id: 'r_hand',
      jointId: 'r_wrist',
      category: 'hands',
      side: 'right',
      label: 'Right Hand',
      originX: computed.r_wrist.x,
      originY: computed.r_wrist.y,
      worldAngle: computed.r_wrist.worldAngle,
      lengthPx: computed.r_wrist.effectiveLengthPx,
      scaleLength: r('r_wrist').scaleLength,
      scaleWidth: r('r_wrist').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: armZ(BODY_PART_BASE_Z.hands, 'right'),
    },
    {
      id: 'l_hand',
      jointId: 'l_wrist',
      category: 'hands',
      side: 'left',
      label: 'Left Hand',
      originX: computed.l_wrist.x,
      originY: computed.l_wrist.y,
      worldAngle: computed.l_wrist.worldAngle,
      lengthPx: computed.l_wrist.effectiveLengthPx,
      scaleLength: r('l_wrist').scaleLength,
      scaleWidth: r('l_wrist').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: armZ(BODY_PART_BASE_Z.hands, 'left'),
    },
    // 10. Neck (bridges Collar to Head base smoothly across cervical bend)
    {
      id: 'neck',
      jointId: 'neck',
      category: 'neck',
      side: 'center',
      label: 'Neck',
      originX: computed.collar.x,
      originY: computed.collar.y,
      worldAngle:
        (Math.atan2(computed.head.x - computed.collar.x, computed.head.x - computed.collar.x ? computed.head.x - computed.collar.x : 0) !== -999
          ? (Math.atan2(computed.head.y - computed.collar.y, computed.head.x - computed.collar.x) * 180) /
            Math.PI
          : computed.neck.worldAngle),
      lengthPx: dist(computed.collar.x, computed.collar.y, computed.head.x, computed.head.y),
      scaleLength: r('neck').scaleLength,
      scaleWidth: r('neck').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: BODY_PART_BASE_Z.neck,
    },
    // 11. Head
    {
      id: 'head',
      jointId: 'head',
      category: 'head',
      side: 'center',
      label: 'Head',
      originX: computed.head.x,
      originY: computed.head.y,
      worldAngle: computed.head.worldAngle,
      lengthPx: computed.head.effectiveLengthPx,
      scaleLength: r('head').scaleLength,
      scaleWidth: r('head').scaleWidth,
      pivotOffset: { dx: 0, dy: 0 },
      zIndex: BODY_PART_BASE_Z.head,
    },
  ];

  return descriptors.sort((a, b) => a.zIndex - b.zIndex);
}

/**
 * 2-bone analytical IK solver for chain [rootJoint (shoulder/hip) -> midJoint (elbow/knee) -> endJoint (wrist/ankle)].
 */
export function solveTwoBoneIK(
  state: ArmatureState,
  endId: JointId,
  targetX: number,
  targetY: number,
  canvasOrigin: { x: number; y: number } = { x: PAPER_WIDTH / 2, y: PAPER_HEIGHT / 2 }
): ArmatureState {
  const endSpec = JOINT_SPEC_MAP[endId];
  if (!endSpec.ikChain || endSpec.ikChain === 'spine') return state;

  const [rootId, midId] = endSpec.ikChain;
  const computed = computeArmature(state, canvasOrigin);
  const rootJoint = computed[rootId];
  const rootParentWorld =
    JOINT_SPEC_MAP[rootId].parentId !== null
      ? computed[JOINT_SPEC_MAP[rootId].parentId!].worldAngle
      : state.rootRotation;

  const L1 = Math.hypot(
    computed[midId].x - rootJoint.x,
    computed[midId].y - rootJoint.y
  );
  const L2 = Math.hypot(
    computed[endId].x - computed[midId].x,
    computed[endId].y - computed[midId].y
  );

  const dx = targetX - rootJoint.x;
  const dy = targetY - rootJoint.y;
  const rawDist = Math.hypot(dx, dy);
  const minDist = Math.abs(L1 - L2) + 2;
  const maxDist = Math.max(minDist + 1, L1 + L2 - 0.5);
  const d = Math.max(minDist, Math.min(maxDist, rawDist));

  const baseAngle = Math.atan2(dy, dx);
  const cosAlpha = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const alpha = Math.acos(cosAlpha);

  const cosBeta = Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
  const beta = Math.acos(cosBeta);

  const bendDir = endSpec.bendDirection ?? 1;
  const worldAngle1 = ((baseAngle + bendDir * alpha) * 180) / Math.PI;
  const worldAngle2 = ((baseAngle + bendDir * alpha - bendDir * (Math.PI - beta)) * 180) / Math.PI;

  const multRoot = getPhysicsMultiplier(state.joints[rootId]);
  const multMid = getPhysicsMultiplier(state.joints[midId]);

  const rawDeltaRoot = shortestAngleDelta(
    state.joints[rootId].localAngle,
    worldAngle1 - rootParentWorld
  );
  const rawDeltaMid = shortestAngleDelta(state.joints[midId].localAngle, worldAngle2 - worldAngle1);

  const nextRootLocal = applyJointAngleConstraint(
    state.joints[rootId].localAngle + rawDeltaRoot * multRoot,
    state.continuousSpin
  );
  const nextMidLocal = applyJointAngleConstraint(
    state.joints[midId].localAngle + rawDeltaMid * multMid,
    state.continuousSpin
  );

  return {
    ...state,
    joints: {
      ...state.joints,
      [rootId]: { ...state.joints[rootId], localAngle: nextRootLocal },
      [midId]: { ...state.joints[midId], localAngle: nextMidLocal },
    },
  };
}

/**
 * Spine CCD IK when dragging head/crown in IK mode.
 */
export function solveSpineCCDIK(
  state: ArmatureState,
  targetX: number,
  targetY: number,
  canvasOrigin: { x: number; y: number } = { x: PAPER_WIDTH / 2, y: PAPER_HEIGHT / 2 }
): ArmatureState {
  const chain: JointId[] = ['navel', 'torso', 'collar', 'neck', 'head'];
  let current: ArmatureState = {
    ...state,
    joints: { ...state.joints },
  };

  for (let iter = 0; iter < 8; iter++) {
    for (let i = chain.length - 1; i >= 0; i--) {
      const jointId = chain[i];
      const runtime = current.joints[jointId];
      if (runtime.mode === 'PIN' || runtime.physicsMode === 'rigid') continue;

      const computed = computeArmature(current, canvasOrigin);
      const pivot = computed[jointId];
      const effectorX = computed.head.endX;
      const effectorY = computed.head.endY;

      const aEff = Math.atan2(effectorY - pivot.y, effectorX - pivot.x);
      const aTgt = Math.atan2(targetY - pivot.y, targetX - pivot.x);
      let deltaDeg = ((aTgt - aEff) * 180) / Math.PI;
      deltaDeg = normalizeAngleDeg(deltaDeg);
      deltaDeg = Math.max(-16, Math.min(16, deltaDeg * 0.6)) * getPhysicsMultiplier(runtime);

      current = {
        ...current,
        joints: {
          ...current.joints,
          [jointId]: {
            ...runtime,
            localAngle: applyJointAngleConstraint(
              runtime.localAngle + deltaDeg,
              current.continuousSpin
            ),
          },
        },
      };
    }
  }
  return current;
}

/**
 * Rotates a bone joint directly toward (targetX, targetY) respecting its active
 * physics multiplier (1.0x, 1.5x, 0.5x, 0.0x, or Mode E) and Continuous Spin toggle.
 */
export function solveBoneAimRotation(
  state: ArmatureState,
  pivotJointId: JointId,
  targetX: number,
  targetY: number,
  canvasOrigin: { x: number; y: number } = { x: PAPER_WIDTH / 2, y: PAPER_HEIGHT / 2 }
): ArmatureState {
  const computed = computeArmature(state, canvasOrigin);
  const pivot = computed[pivotJointId];
  const dx = targetX - pivot.x;
  const dy = targetY - pivot.y;
  if (Math.hypot(dx, dy) < 1e-3) return state;

  const targetWorldDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (pivotJointId === 'waist') {
    const mult = getPhysicsMultiplier(state.joints.waist);
    if (mult === 0) return state;
    const rawDelta = shortestAngleDelta(state.rootRotation, targetWorldDeg);
    const nextRootRot = applyJointAngleConstraint(
      state.rootRotation + rawDelta * mult,
      state.continuousSpin
    );
    return { ...state, rootRotation: nextRootRot };
  }

  const spec = JOINT_SPEC_MAP[pivotJointId];
  if (!spec.parentId) return state;
  const parentWorldAngle = computed[spec.parentId].worldAngle;
  const runtime = state.joints[pivotJointId];
  const mult = getPhysicsMultiplier(runtime);
  if (mult === 0) return state;

  const desiredLocal = targetWorldDeg - parentWorldAngle;
  const rawDelta = shortestAngleDelta(runtime.localAngle, desiredLocal);
  const nextLocal = applyJointAngleConstraint(
    runtime.localAngle + rawDelta * mult,
    state.continuousSpin
  );

  return {
    ...state,
    joints: {
      ...state.joints,
      [pivotJointId]: {
        ...runtime,
        localAngle: nextLocal,
      },
    },
  };
}

/**
 * Serializes current ArmatureState into a canonical Phase 3 CharacterPoseSnapshot:
 * - `joints` always holds 18 normalized angles in [-180.00°, +180.00°]
 * - When `continuousSpin` is ON, `armature` retains raw >360° rotational sweeps
 * - When `continuousSpin` is OFF, `armature` angles are also normalized to [-180.00°, +180.00°]
 */
export function armatureToCharacterSnapshot(
  state: ArmatureState,
  label: string,
  viewMode: SilhouetteDisplayMode = 'wireframe'
): CharacterPoseSnapshot {
  const joints = {} as Record<JointId, number>;
  const jointModes = {} as Record<JointId, JointMode>;
  const physicsModes = {} as Record<JointId, PhysicsModeId>;
  const modeEValues = {} as Record<JointId, number>;
  const perJointScale = {} as Record<JointId, BoneScale>;
  const armatureJointsCopy = {} as Record<JointId, JointRuntimeState>;

  const normalizeArmatureOnSave = !state.continuousSpin;
  let sumLen = 0;
  let sumWid = 0;

  for (const spec of JOINT_SPECS) {
    const rt = state.joints[spec.id];
    const baseAngle = spec.id === 'waist' ? state.rootRotation : rt.localAngle;
    const normalized = snapAnglePrecision(normalizeAngleDeg(baseAngle));

    joints[spec.id] = normalized;
    jointModes[spec.id] = rt.mode;
    physicsModes[spec.id] = rt.physicsMode;
    modeEValues[spec.id] = rt.modeERatio;
    perJointScale[spec.id] = { length: rt.scaleLength, width: rt.scaleWidth };

    sumLen += rt.scaleLength;
    sumWid += rt.scaleWidth;

    armatureJointsCopy[spec.id] = {
      ...rt,
      localAngle: normalizeArmatureOnSave
        ? snapAnglePrecision(normalizeAngleDeg(rt.localAngle))
        : snapAnglePrecision(rt.localAngle),
    };
  }

  const limbLength = Number((sumLen / JOINT_SPECS.length).toFixed(3));
  const limbWidth = Number((sumWid / JOINT_SPECS.length).toFixed(3));

  return {
    snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    timestamp: Date.now(),
    viewMode,
    joints,
    jointModes,
    physicsModes,
    modeEValues,
    proportions: {
      globalScale: Number(((limbLength + limbWidth) / 2).toFixed(3)),
      limbWidth,
      limbLength,
      perJoint: perJointScale,
    },
    keystone: state.internalKeystone,
    environmentalAnchor: state.environmentalAnchor,
    navelPin: state.isAnchorPinned,
    continuousSpin: state.continuousSpin,
    rootX: state.rootX,
    rootY: state.rootY,
    armature: {
      ...state,
      rootRotation: normalizeArmatureOnSave
        ? snapAnglePrecision(normalizeAngleDeg(state.rootRotation))
        : snapAnglePrecision(state.rootRotation),
      joints: armatureJointsCopy,
    },
  };
}

export function createPoseSnapshot(
  state: ArmatureState,
  name: string,
  viewMode: SilhouetteDisplayMode = 'wireframe'
): CharacterPoseSnapshot {
  return armatureToCharacterSnapshot(state, name, viewMode);
}

/**
 * Restores a full executable ArmatureState from a CharacterPoseSnapshot.
 */
export function characterSnapshotToArmature(
  snapshot: CharacterPoseSnapshot,
  fallback?: ArmatureState
): ArmatureState {
  if (snapshot.armature) {
    return snapshot.armature;
  }

  const joints = {} as Record<JointId, JointRuntimeState>;
  for (const spec of JOINT_SPECS) {
    const prev = fallback?.joints[spec.id];
    const perJoint = snapshot.proportions.perJoint?.[spec.id];
    joints[spec.id] = {
      localAngle:
        spec.id === 'waist'
          ? 0
          : snapshot.joints[spec.id] ?? prev?.localAngle ?? spec.defaultLocalAngle,
      mode: snapshot.jointModes[spec.id] ?? prev?.mode ?? spec.defaultMode,
      physicsMode: snapshot.physicsModes?.[spec.id] ?? prev?.physicsMode ?? 'twins',
      modeERatio: snapshot.modeEValues[spec.id] ?? prev?.modeERatio ?? 1.0,
      scaleLength: perJoint?.length ?? snapshot.proportions.limbLength ?? 1.0,
      scaleWidth: perJoint?.width ?? snapshot.proportions.limbWidth ?? 1.0,
    };
  }

  return {
    rootX: snapshot.rootX ?? fallback?.rootX ?? PAPER_WIDTH / 2,
    rootY: snapshot.rootY ?? fallback?.rootY ?? PAPER_HEIGHT / 2,
    rootRotation: snapshot.joints.waist ?? fallback?.rootRotation ?? 0,
    continuousSpin: snapshot.continuousSpin,
    internalKeystone: snapshot.keystone,
    environmentalAnchor: snapshot.environmentalAnchor,
    isAnchorPinned: snapshot.navelPin,
    joints,
  };
}

/**
 * Shortest-path pose interpolation at progress t in [0..1] using:
 * Δθ = ((θ_target - θ_current + 540°) mod 360°) - 180°
 */
export function interpolateArmatureShortestPath(
  fromState: ArmatureState,
  toState: ArmatureState,
  t: number
): ArmatureState {
  const clampedT = Math.max(0, Math.min(1, t));
  const eased = 1 - Math.pow(1 - clampedT, 3);

  const nextJoints = {} as Record<JointId, JointRuntimeState>;
  for (const spec of JOINT_SPECS) {
    const a = fromState.joints[spec.id];
    const b = toState.joints[spec.id];
    const delta = shortestAngleDelta(a.localAngle, b.localAngle);
    const interpolatedAngle =
      clampedT >= 1
        ? toState.continuousSpin || fromState.continuousSpin
          ? b.localAngle
          : clampAngle180(b.localAngle)
        : a.localAngle + delta * eased;

    nextJoints[spec.id] = {
      ...(clampedT >= 1 ? b : a),
      localAngle: snapAnglePrecision(interpolatedAngle, 0.01),
      scaleLength: a.scaleLength + (b.scaleLength - a.scaleLength) * eased,
      scaleWidth: a.scaleWidth + (b.scaleWidth - a.scaleWidth) * eased,
    };
  }

  const rootDelta = shortestAngleDelta(fromState.rootRotation, toState.rootRotation);
  return {
    ...(clampedT >= 1 ? toState : fromState),
    rootX: fromState.rootX + (toState.rootX - fromState.rootX) * eased,
    rootY: fromState.rootY + (toState.rootY - fromState.rootY) * eased,
    rootRotation:
      clampedT >= 1 ? toState.rootRotation : fromState.rootRotation + rootDelta * eased,
    joints: nextJoints,
  };
}

export function setJointMode(
  state: ArmatureState,
  jointId: JointId,
  mode: JointMode
): ArmatureState {
  return {
    ...state,
    joints: {
      ...state.joints,
      [jointId]: { ...state.joints[jointId], mode },
    },
  };
}

export function mirrorPose(state: ArmatureState): ArmatureState {
  const nextJoints = { ...state.joints };
  const pairs: [JointId, JointId][] = [
    ['r_shoulder', 'l_shoulder'],
    ['r_elbow', 'l_elbow'],
    ['r_wrist', 'l_wrist'],
    ['r_hip', 'l_hip'],
    ['r_knee', 'l_knee'],
    ['r_ankle', 'l_ankle'],
  ];

  for (const [rId, lId] of pairs) {
    const r = state.joints[rId];
    const l = state.joints[lId];
    // Left vs Right symmetry around upright axis
    if (rId === 'r_hip') {
      nextJoints[rId] = {
        ...r,
        localAngle: applyJointAngleConstraint(180 - l.localAngle, state.continuousSpin),
      };
      nextJoints[lId] = {
        ...l,
        localAngle: applyJointAngleConstraint(180 - r.localAngle, state.continuousSpin),
      };
    } else {
      nextJoints[rId] = {
        ...r,
        localAngle: applyJointAngleConstraint(-l.localAngle, state.continuousSpin),
      };
      nextJoints[lId] = {
        ...l,
        localAngle: applyJointAngleConstraint(-r.localAngle, state.continuousSpin),
      };
    }
  }

  const spineIds: JointId[] = ['navel', 'torso', 'collar', 'neck', 'head'];
  for (const id of spineIds) {
    const rt = state.joints[id];
    if (id === 'navel') {
      nextJoints[id] = {
        ...rt,
        localAngle: applyJointAngleConstraint(-180 - rt.localAngle, state.continuousSpin),
      };
    } else {
      nextJoints[id] = {
        ...rt,
        localAngle: applyJointAngleConstraint(-rt.localAngle, state.continuousSpin),
      };
    }
  }

  return {
    ...state,
    rootRotation: applyJointAngleConstraint(-state.rootRotation, state.continuousSpin),
    joints: nextJoints,
  };
}
