import { PUPPYT_LANDMARKS } from '../data/skeletonRig';
import {
  ANGLE_PRECISION_STEP,
  ArmatureState,
  BONE_SCALE_MAX,
  BONE_SCALE_MIN,
  CharacterPoseSnapshot,
  ComputedJoint,
  EnvironmentalAnchorId,
  InspectionViewMode,
  JointId,
  JointMode,
  JointRuntimeState,
  JointSpec,
  LegacyJointSpec,
  PAPER_HEIGHT,
  PAPER_WIDTH,
  PhysicsModeId,
  PosePresetId,
  ProceduralMoodOffsets,
  RigHierarchyAuditReport,
  SilhouetteDisplayMode,
  WorkingSquareBase,
} from '../types';

export type Affine2D = readonly [number, number, number, number, number, number];

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function mulAffine(a: Affine2D, b: Affine2D): Affine2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function applyAffine(m: Affine2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

/**
 * Composes an affine matrix mapping Puppyt asset rest vector (pivot -> endRest)
 * onto stage bone segment (origin -> target) with longitudinal lenScale and lateral widScale.
 */
export function composeBoneMatrix(
  originX: number,
  originY: number,
  worldDeg: number,
  lenScale: number,
  widScale: number,
  restVecDeg: number,
  pivotX: number,
  pivotY: number
): Affine2D {
  const wr = worldDeg * DEG_TO_RAD;
  const rr = -restVecDeg * DEG_TO_RAD;
  const cw = Math.cos(wr);
  const sw = Math.sin(wr);
  const cr = Math.cos(rr);
  const sr = Math.sin(rr);

  const tOrigin: Affine2D = [1, 0, 0, 1, originX, originY];
  const rWorld: Affine2D = [cw, sw, -sw, cw, 0, 0];
  const scale: Affine2D = [lenScale, 0, 0, widScale, 0, 0];
  const rRestInv: Affine2D = [cr, sr, -sr, cr, 0, 0];
  const tPivotInv: Affine2D = [1, 0, 0, 1, -pivotX, -pivotY];

  return mulAffine(tOrigin, mulAffine(rWorld, mulAffine(scale, mulAffine(rRestInv, tPivotInv))));
}

function vecAngleDeg(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) * RAD_TO_DEG;
}

function vecLenScaled(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]) * PUPPYT_TO_EVOLVED_SCALE;
}

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
    shortLabel: '0.50×–1.50×',
    ratio: null,
    description: 'Continuous custom steering gear ratio (0.50× to 1.50×)',
  },
};

export const MODE_E_MIN = 0.5;
export const MODE_E_MAX = 1.5;
export const POSE_RECALL_DURATION_MS = 500;

export const POSE_PRESET_LABELS: Record<PosePresetId, string> = {
  tpose: 'Bitruvian T Pose',
  vitruvian: 'Vitruvian',
  contrapposto: 'Contrapposto',
  striding: 'Striding',
};

export const INSPECTION_VIEW_MODE_INFO: Record<
  SilhouetteDisplayMode,
  {
    id: SilhouetteDisplayMode;
    manifestMode: InspectionViewMode;
    label: string;
    shortLabel: string;
  }
> = {
  pure_shadow: {
    id: 'pure_shadow',
    manifestMode: 'silhouette',
    label: 'Pure Shadow',
    shortLabel: 'Silhouette',
  },
  purple_skeleton: {
    id: 'purple_skeleton',
    manifestMode: 'vector_only',
    label: 'Bitruvian Purple',
    shortLabel: 'Vector Only',
  },
  hybrid_overlay: {
    id: 'hybrid_overlay',
    manifestMode: 'hybrid_overlay',
    label: 'Hybrid Overlay',
    shortLabel: 'Hybrid',
  },
  wireframe: {
    id: 'wireframe',
    manifestMode: 'armature_only',
    label: 'Wireframe',
    shortLabel: 'Armature Only',
  },
};

export const ENVIRONMENTAL_ANCHORS: {
  id: EnvironmentalAnchorId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'bottom_of_spine', label: 'Pelvis / Spine Btm', shortLabel: 'Pelvis' },
  { id: 'feet', label: 'Feet', shortLabel: 'Feet' },
  { id: 'navel', label: 'Lumbar / Navel', shortLabel: 'Lumbar' },
  { id: 'clavicle', label: 'Thorax / Clavicle', shortLabel: 'Thorax' },
  { id: 'neck', label: 'Neck', shortLabel: 'Neck' },
  { id: 'crown', label: 'Crown / Cranium', shortLabel: 'Crown' },
];

export const PUPPYT_TO_EVOLVED_SCALE = 0.14;

/**
 * Preserved original 18-joint Evolved proportions retained as hidden child proportions
 * pending Phase 3 asset-child-proportions calibration.
 */
export const CHILD_PROPORTION_SPECS: LegacyJointSpec[] = [
  {
    id: 'waist',
    label: 'Waist (Bottom of Spine)',
    shortCode: 'WST',
    subtitle: 'Pelvic girdle & bottom-of-spine root',
    parentId: null,
    lengthPx: 0,
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
    defaultLocalAngle: -34,
    defaultMode: 'IK',
    ikChain: ['l_hip', 'l_knee', 'l_ankle'],
    bendDirection: -1,
  },
];

/**
 * Canonical 43-joint parent map matching Bitruvian.Human.Puppyt (RIG_METADATA).
 */
export const CANONICAL_RIG_PARENTS: Record<JointId, JointId | null> = {
  pelvis: null,
  lumbar: 'pelvis',
  thorax: 'lumbar',
  ribR: 'thorax',
  ribL: 'thorax',
  neck: 'thorax',
  head: 'neck',
  lip: 'head',
  chinTip: 'lip',
  swivelR: 'lumbar',
  swivelTipR: 'swivelR',
  acromionR: 'swivelR',
  braceR: 'thorax',
  wingR: 'braceR',
  humerusR: 'acromionR',
  forearmR: 'humerusR',
  handR: 'forearmR',
  thumbR: 'handR',
  thumbTipR: 'thumbR',
  fingerR: 'handR',
  fingerTipR: 'fingerR',
  swivelL: 'lumbar',
  swivelTipL: 'swivelL',
  acromionL: 'swivelL',
  braceL: 'thorax',
  wingL: 'braceL',
  humerusL: 'acromionL',
  forearmL: 'humerusL',
  handL: 'forearmL',
  thumbL: 'handL',
  thumbTipL: 'thumbL',
  fingerL: 'handL',
  fingerTipL: 'fingerL',
  hipR: 'pelvis',
  femurR: 'hipR',
  shinR: 'femurR',
  footR: 'shinR',
  toeR: 'footR',
  hipL: 'pelvis',
  femurL: 'hipL',
  shinL: 'femurL',
  footL: 'shinL',
  toeL: 'footL',
};

const RAW_43_JOINT_SPECS: JointSpec[] = [
  // Axial & Head (7)
  {
    id: 'pelvis',
    label: 'Pelvis (Root)',
    shortCode: 'PLV',
    subtitle: 'Pelvic root & bottom-of-spine datum',
    parentId: null,
    role: 'root',
    side: 'center',
    restPivot: PUPPYT_LANDMARKS.pelvis,
    restTip: PUPPYT_LANDMARKS.thorax,
    lengthPx: 0,
    bodyPartCategory: 'pelvis',
    isSpine: true,
    limits: [-180, 180],
    defaultLocalAngle: 0,
    defaultMode: 'ROOT',
  },
  {
    id: 'lumbar',
    label: 'Lumbar Spine (Lower)',
    shortCode: 'LMB',
    subtitle: 'Lower spine swinging above pelvis swivel',
    parentId: 'pelvis',
    role: 'spine',
    side: 'center',
    restPivot: PUPPYT_LANDMARKS.lumbar,
    restTip: PUPPYT_LANDMARKS.thorax,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.lumbar, PUPPYT_LANDMARKS.thorax),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.lumbar, PUPPYT_LANDMARKS.thorax),
    bodyPartCategory: 'spine',
    isSpine: true,
    limits: [-78, 78],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'thorax',
    label: 'Thorax (Upper Spine)',
    shortCode: 'THX',
    subtitle: 'Upper spine column, sternum & neckring hub',
    parentId: 'lumbar',
    role: 'spine',
    side: 'center',
    restPivot: PUPPYT_LANDMARKS.thorax,
    restTip: PUPPYT_LANDMARKS.neck,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.thorax, PUPPYT_LANDMARKS.neck),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.thorax, PUPPYT_LANDMARKS.neck),
    bodyPartCategory: 'spine',
    isSpine: true,
    limits: [-72, 72],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'ribR',
    label: 'Ribcage R',
    shortCode: 'R.RIB',
    subtitle: 'Right ribcage flare (Chungus anchor-ready)',
    parentId: 'thorax',
    role: 'ribcage',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.ribR,
    restTip: PUPPYT_LANDMARKS.ribRTip,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.ribR, PUPPYT_LANDMARKS.ribRTip),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.ribR, PUPPYT_LANDMARKS.ribRTip),
    bodyPartCategory: 'ribs',
    limits: [-28, 28],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'ribL',
    label: 'Ribcage L',
    shortCode: 'L.RIB',
    subtitle: 'Left ribcage flare (Chungus anchor-ready)',
    parentId: 'thorax',
    role: 'ribcage',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.ribL,
    restTip: PUPPYT_LANDMARKS.ribLTip,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.ribL, PUPPYT_LANDMARKS.ribLTip),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.ribL, PUPPYT_LANDMARKS.ribLTip),
    bodyPartCategory: 'ribs',
    limits: [-28, 28],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'neck',
    label: 'Cervical Neck',
    shortCode: 'NCK',
    subtitle: 'Cervical column bridge',
    parentId: 'thorax',
    role: 'spine',
    side: 'center',
    restPivot: PUPPYT_LANDMARKS.neck,
    restTip: PUPPYT_LANDMARKS.head,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.neck, PUPPYT_LANDMARKS.head),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.neck, PUPPYT_LANDMARKS.head),
    bodyPartCategory: 'neck',
    isSpine: true,
    limits: [-45, 45],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'head',
    label: 'Head / Cranium',
    shortCode: 'HED',
    subtitle: 'Cranium pivot extending to vertex crown',
    parentId: 'neck',
    role: 'head_facial',
    side: 'center',
    restPivot: PUPPYT_LANDMARKS.head,
    restTip: PUPPYT_LANDMARKS.crownTip,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.head, PUPPYT_LANDMARKS.crownTip),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.head, PUPPYT_LANDMARKS.crownTip),
    bodyPartCategory: 'head',
    isSpine: true,
    limits: [-65, 65],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
    ikChain: 'spine',
  },
  {
    id: 'lip',
    label: 'Head Pose Swivel (Jaw)',
    shortCode: 'LIP',
    subtitle: 'Mandible swivel (locked at 0° during head turns)',
    parentId: 'head',
    role: 'head_facial',
    side: 'center',
    restPivot: PUPPYT_LANDMARKS.lip,
    restTip: PUPPYT_LANDMARKS.chinTip,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.lip, PUPPYT_LANDMARKS.chinTip),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.lip, PUPPYT_LANDMARKS.chinTip),
    bodyPartCategory: 'head',
    isSpine: true,
    limits: [-35, 18],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'chinTip',
    label: 'Chin / Skull Tip',
    shortCode: 'CHN',
    subtitle: 'Mandibular landmark tip',
    parentId: 'lip',
    role: 'head_facial',
    side: 'center',
    restPivot: PUPPYT_LANDMARKS.chinTip,
    lengthPx: 0,
    bodyPartCategory: 'head',
    isSpine: true,
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },

  // Right Closed-Chain Shoulder Girdle & Arm & Digits (12)
  {
    id: 'swivelR',
    label: 'Swivel R (Navel Brace)',
    shortCode: 'R.SWV',
    subtitle: 'Right shoulder swivel behind ribcage',
    parentId: 'lumbar',
    role: 'shoulder_girdle',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.swivelR,
    restTip: PUPPYT_LANDMARKS.acromionR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.swivelR, PUPPYT_LANDMARKS.acromionR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.swivelR, PUPPYT_LANDMARKS.acromionR),
    bodyPartCategory: 'girdle',
    limits: [-42, 42],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'swivelTipR',
    label: 'Swivel Tip R',
    shortCode: 'R.SWT',
    subtitle: 'Right shoulder swivel distal tip guide',
    parentId: 'swivelR',
    role: 'accessory_rig',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.swivelTipR,
    lengthPx: 0,
    bodyPartCategory: 'girdle',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },
  {
    id: 'acromionR',
    label: 'Shoulder Socket R',
    shortCode: 'R.ACR',
    subtitle: 'Right acromion cap driving glenohumeral socket',
    parentId: 'swivelR',
    role: 'shoulder_girdle',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.acromionR,
    restTip: PUPPYT_LANDMARKS.humerusR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.acromionR, PUPPYT_LANDMARKS.humerusR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.acromionR, PUPPYT_LANDMARKS.humerusR),
    bodyPartCategory: 'girdle',
    limits: [-60, 45],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'braceR',
    label: 'Collarbone R (Tendon)',
    shortCode: 'R.BRC',
    subtitle: 'Closed-chain collarbone tendon aiming at Shoulder Socket R',
    parentId: 'thorax',
    role: 'shoulder_girdle',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.braceR,
    restTip: PUPPYT_LANDMARKS.acromionR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.braceR, PUPPYT_LANDMARKS.acromionR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.braceR, PUPPYT_LANDMARKS.acromionR),
    bodyPartCategory: 'girdle',
    aimTarget: { to: 'acromionR', minRatio: 0.78, maxRatio: 1.12 },
    limits: [-18, 18],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'wingR',
    label: 'Back Shoulder R (Wing)',
    shortCode: 'R.WNG',
    subtitle: 'Right Prometheus dorsal wing',
    parentId: 'braceR',
    role: 'accessory_wing',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.wingR,
    lengthPx: 0,
    bodyPartCategory: 'wings',
    isTip: true,
    locked: true,
    isGhost: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },
  {
    id: 'humerusR',
    label: 'Humerus R (Upper Arm)',
    shortCode: 'R.HUM',
    subtitle: 'Right glenohumeral shoulder ball-and-socket',
    parentId: 'acromionR',
    role: 'limb_arm',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.humerusR,
    restTip: PUPPYT_LANDMARKS.forearmR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.humerusR, PUPPYT_LANDMARKS.forearmR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.humerusR, PUPPYT_LANDMARKS.forearmR),
    bodyPartCategory: 'upper_arms',
    limits: [-165, 175],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'forearmR',
    label: 'Forearm R (Elbow)',
    shortCode: 'R.FRM',
    subtitle: 'Right humeral-ulnar elbow & radius/ulna shaft',
    parentId: 'humerusR',
    role: 'limb_arm',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.forearmR,
    restTip: PUPPYT_LANDMARKS.handR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.forearmR, PUPPYT_LANDMARKS.handR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.forearmR, PUPPYT_LANDMARKS.handR),
    bodyPartCategory: 'forearms',
    limits: [-15, 155],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'handR',
    label: 'Hand R (Wrist)',
    shortCode: 'R.HND',
    subtitle: 'Right radiocarpal wrist effector',
    parentId: 'forearmR',
    role: 'limb_arm',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.handR,
    restTip: PUPPYT_LANDMARKS.handRTip,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.handR, PUPPYT_LANDMARKS.handRTip),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.handR, PUPPYT_LANDMARKS.handRTip),
    bodyPartCategory: 'hands',
    limits: [-85, 85],
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['humerusR', 'forearmR', 'handR'],
    bendDirection: -1,
  },
  {
    id: 'thumbR',
    label: 'Thumb R',
    shortCode: 'R.THM',
    subtitle: 'Right thumb metacarpal joint',
    parentId: 'handR',
    role: 'hand_digit',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.thumbR,
    restTip: PUPPYT_LANDMARKS.thumbTipR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.thumbR, PUPPYT_LANDMARKS.thumbTipR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.thumbR, PUPPYT_LANDMARKS.thumbTipR),
    bodyPartCategory: 'digits',
    limits: [-75, 75],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'thumbTipR',
    label: 'Thumb Tip R',
    shortCode: 'R.THT',
    subtitle: 'Right thumb distal tip',
    parentId: 'thumbR',
    role: 'hand_digit',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.thumbTipR,
    lengthPx: 0,
    bodyPartCategory: 'digits',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },
  {
    id: 'fingerR',
    label: 'Finger R',
    shortCode: 'R.FNG',
    subtitle: 'Right primary finger phalanx',
    parentId: 'handR',
    role: 'hand_digit',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.fingerR,
    restTip: PUPPYT_LANDMARKS.fingerTipR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.fingerR, PUPPYT_LANDMARKS.fingerTipR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.fingerR, PUPPYT_LANDMARKS.fingerTipR),
    bodyPartCategory: 'digits',
    limits: [-45, 95],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'fingerTipR',
    label: 'Finger Tip R',
    shortCode: 'R.FNT',
    subtitle: 'Right finger distal tip',
    parentId: 'fingerR',
    role: 'hand_digit',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.fingerTipR,
    lengthPx: 0,
    bodyPartCategory: 'digits',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },

  // Left Closed-Chain Shoulder Girdle & Arm & Digits (12)
  {
    id: 'swivelL',
    label: 'Swivel L (Navel Brace)',
    shortCode: 'L.SWV',
    subtitle: 'Left shoulder swivel behind ribcage',
    parentId: 'lumbar',
    role: 'shoulder_girdle',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.swivelL,
    restTip: PUPPYT_LANDMARKS.acromionL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.swivelL, PUPPYT_LANDMARKS.acromionL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.swivelL, PUPPYT_LANDMARKS.acromionL),
    bodyPartCategory: 'girdle',
    limits: [-42, 42],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'swivelTipL',
    label: 'Swivel Tip L',
    shortCode: 'L.SWT',
    subtitle: 'Left shoulder swivel distal tip guide',
    parentId: 'swivelL',
    role: 'accessory_rig',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.swivelTipL,
    lengthPx: 0,
    bodyPartCategory: 'girdle',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },
  {
    id: 'acromionL',
    label: 'Shoulder Socket L',
    shortCode: 'L.ACR',
    subtitle: 'Left acromion cap driving glenohumeral socket',
    parentId: 'swivelL',
    role: 'shoulder_girdle',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.acromionL,
    restTip: PUPPYT_LANDMARKS.humerusL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.acromionL, PUPPYT_LANDMARKS.humerusL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.acromionL, PUPPYT_LANDMARKS.humerusL),
    bodyPartCategory: 'girdle',
    limits: [-45, 60],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'braceL',
    label: 'Collarbone L (Tendon)',
    shortCode: 'L.BRC',
    subtitle: 'Closed-chain collarbone tendon aiming at Shoulder Socket L',
    parentId: 'thorax',
    role: 'shoulder_girdle',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.braceL,
    restTip: PUPPYT_LANDMARKS.acromionL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.braceL, PUPPYT_LANDMARKS.acromionL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.braceL, PUPPYT_LANDMARKS.acromionL),
    bodyPartCategory: 'girdle',
    aimTarget: { to: 'acromionL', minRatio: 0.78, maxRatio: 1.12 },
    limits: [-18, 18],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'wingL',
    label: 'Back Shoulder L (Wing)',
    shortCode: 'L.WNG',
    subtitle: 'Left Prometheus dorsal wing',
    parentId: 'braceL',
    role: 'accessory_wing',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.wingL,
    lengthPx: 0,
    bodyPartCategory: 'wings',
    isTip: true,
    locked: true,
    isGhost: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },
  {
    id: 'humerusL',
    label: 'Humerus L (Upper Arm)',
    shortCode: 'L.HUM',
    subtitle: 'Left glenohumeral shoulder ball-and-socket',
    parentId: 'acromionL',
    role: 'limb_arm',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.humerusL,
    restTip: PUPPYT_LANDMARKS.forearmL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.humerusL, PUPPYT_LANDMARKS.forearmL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.humerusL, PUPPYT_LANDMARKS.forearmL),
    bodyPartCategory: 'upper_arms',
    limits: [-175, 165],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'forearmL',
    label: 'Forearm L (Elbow)',
    shortCode: 'L.FRM',
    subtitle: 'Left humeral-ulnar elbow & radius/ulna shaft',
    parentId: 'humerusL',
    role: 'limb_arm',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.forearmL,
    restTip: PUPPYT_LANDMARKS.handL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.forearmL, PUPPYT_LANDMARKS.handL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.forearmL, PUPPYT_LANDMARKS.handL),
    bodyPartCategory: 'forearms',
    limits: [-155, 15],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'handL',
    label: 'Hand L (Wrist)',
    shortCode: 'L.HND',
    subtitle: 'Left radiocarpal wrist effector',
    parentId: 'forearmL',
    role: 'limb_arm',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.handL,
    restTip: PUPPYT_LANDMARKS.handLTip,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.handL, PUPPYT_LANDMARKS.handLTip),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.handL, PUPPYT_LANDMARKS.handLTip),
    bodyPartCategory: 'hands',
    limits: [-85, 85],
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['humerusL', 'forearmL', 'handL'],
    bendDirection: 1,
  },
  {
    id: 'thumbL',
    label: 'Thumb L',
    shortCode: 'L.THM',
    subtitle: 'Left thumb metacarpal joint',
    parentId: 'handL',
    role: 'hand_digit',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.thumbL,
    restTip: PUPPYT_LANDMARKS.thumbTipL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.thumbL, PUPPYT_LANDMARKS.thumbTipL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.thumbL, PUPPYT_LANDMARKS.thumbTipL),
    bodyPartCategory: 'digits',
    limits: [-75, 75],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'thumbTipL',
    label: 'Thumb Tip L',
    shortCode: 'L.THT',
    subtitle: 'Left thumb distal tip',
    parentId: 'thumbL',
    role: 'hand_digit',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.thumbTipL,
    lengthPx: 0,
    bodyPartCategory: 'digits',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },
  {
    id: 'fingerL',
    label: 'Finger L',
    shortCode: 'L.FNG',
    subtitle: 'Left primary finger phalanx',
    parentId: 'handL',
    role: 'hand_digit',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.fingerL,
    restTip: PUPPYT_LANDMARKS.fingerTipL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.fingerL, PUPPYT_LANDMARKS.fingerTipL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.fingerL, PUPPYT_LANDMARKS.fingerTipL),
    bodyPartCategory: 'digits',
    limits: [-95, 45],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'fingerTipL',
    label: 'Finger Tip L',
    shortCode: 'L.FNT',
    subtitle: 'Left finger distal tip',
    parentId: 'fingerL',
    role: 'hand_digit',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.fingerTipL,
    lengthPx: 0,
    bodyPartCategory: 'digits',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },

  // Right Leg & Foot (5)
  {
    id: 'hipR',
    label: 'Right Hip Swivel',
    shortCode: 'R.HIP',
    subtitle: 'Right pelvic half swivel about bottom of spine',
    parentId: 'pelvis',
    role: 'limb_leg',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.pelvis,
    restTip: PUPPYT_LANDMARKS.femurR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.pelvis, PUPPYT_LANDMARKS.femurR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.pelvis, PUPPYT_LANDMARKS.femurR),
    bodyPartCategory: 'pelvis',
    limits: [-145, 145],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'femurR',
    label: 'Femur R (Thigh)',
    shortCode: 'R.FMR',
    subtitle: 'Right acetabular socket & femoral shaft',
    parentId: 'hipR',
    role: 'limb_leg',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.femurR,
    restTip: PUPPYT_LANDMARKS.shinR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.femurR, PUPPYT_LANDMARKS.shinR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.femurR, PUPPYT_LANDMARKS.shinR),
    bodyPartCategory: 'thighs',
    limits: [-120, 135],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'shinR',
    label: 'Shin R (Knee)',
    shortCode: 'R.SHN',
    subtitle: 'Right femorotibial knee & tibia/fibula shaft',
    parentId: 'femurR',
    role: 'limb_leg',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.shinR,
    restTip: PUPPYT_LANDMARKS.footR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.shinR, PUPPYT_LANDMARKS.footR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.shinR, PUPPYT_LANDMARKS.footR),
    bodyPartCategory: 'calves',
    limits: [-150, 15],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'footR',
    label: 'Foot R (Ankle)',
    shortCode: 'R.FOT',
    subtitle: 'Right talocrural ankle effector & pedal pivot',
    parentId: 'shinR',
    role: 'limb_leg',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.footR,
    restTip: PUPPYT_LANDMARKS.toeR,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.footR, PUPPYT_LANDMARKS.toeR),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.footR, PUPPYT_LANDMARKS.toeR),
    bodyPartCategory: 'feet',
    limits: [-75, 65],
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['femurR', 'shinR', 'footR'],
    bendDirection: 1,
  },
  {
    id: 'toeR',
    label: 'Toe Tip R',
    shortCode: 'R.TOE',
    subtitle: 'Right distal phalanges contact point',
    parentId: 'footR',
    role: 'foot_digit',
    side: 'right',
    restPivot: PUPPYT_LANDMARKS.toeR,
    lengthPx: 0,
    bodyPartCategory: 'feet',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },

  // Left Leg & Foot (5)
  {
    id: 'hipL',
    label: 'Left Hip Swivel',
    shortCode: 'L.HIP',
    subtitle: 'Left pelvic half swivel about bottom of spine',
    parentId: 'pelvis',
    role: 'limb_leg',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.pelvis,
    restTip: PUPPYT_LANDMARKS.femurL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.pelvis, PUPPYT_LANDMARKS.femurL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.pelvis, PUPPYT_LANDMARKS.femurL),
    bodyPartCategory: 'pelvis',
    limits: [-145, 145],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'femurL',
    label: 'Femur L (Thigh)',
    shortCode: 'L.FMR',
    subtitle: 'Left acetabular socket & femoral shaft',
    parentId: 'hipL',
    role: 'limb_leg',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.femurL,
    restTip: PUPPYT_LANDMARKS.shinL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.femurL, PUPPYT_LANDMARKS.shinL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.femurL, PUPPYT_LANDMARKS.shinL),
    bodyPartCategory: 'thighs',
    limits: [-135, 120],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'shinL',
    label: 'Shin L (Knee)',
    shortCode: 'L.SHN',
    subtitle: 'Left femorotibial knee & tibia/fibula shaft',
    parentId: 'femurL',
    role: 'limb_leg',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.shinL,
    restTip: PUPPYT_LANDMARKS.footL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.shinL, PUPPYT_LANDMARKS.footL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.shinL, PUPPYT_LANDMARKS.footL),
    bodyPartCategory: 'calves',
    limits: [-15, 150],
    defaultLocalAngle: 0,
    defaultMode: 'FK',
  },
  {
    id: 'footL',
    label: 'Foot L (Ankle)',
    shortCode: 'L.FOT',
    subtitle: 'Left talocrural ankle effector & pedal pivot',
    parentId: 'shinL',
    role: 'limb_leg',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.footL,
    restTip: PUPPYT_LANDMARKS.toeL,
    lengthPx: vecLenScaled(PUPPYT_LANDMARKS.footL, PUPPYT_LANDMARKS.toeL),
    endExtensionPx: vecLenScaled(PUPPYT_LANDMARKS.footL, PUPPYT_LANDMARKS.toeL),
    bodyPartCategory: 'feet',
    limits: [-65, 75],
    defaultLocalAngle: 0,
    defaultMode: 'IK',
    ikChain: ['femurL', 'shinL', 'footL'],
    bendDirection: -1,
  },
  {
    id: 'toeL',
    label: 'Toe Tip L',
    shortCode: 'L.TOE',
    subtitle: 'Left distal phalanges contact point',
    parentId: 'footL',
    role: 'foot_digit',
    side: 'left',
    restPivot: PUPPYT_LANDMARKS.toeL,
    lengthPx: 0,
    bodyPartCategory: 'feet',
    isTip: true,
    locked: true,
    defaultLocalAngle: 0,
    defaultMode: 'PIN',
  },
];

/**
 * Deterministic topological ordering guaranteeing every parent joint and every closed-chain
 * aim target (`acromionR/L`) always evaluates strictly before any child or dependent joint (`braceR/L`).
 */
export function sortJointsTopologically(specs: readonly JointSpec[]): JointSpec[] {
  const byId = new Map<JointId, JointSpec>();
  for (const s of specs) byId.set(s.id, s);

  const ordered: JointSpec[] = [];
  const visiting = new Set<JointId>();
  const visited = new Set<JointId>();

  const visit = (s: JointSpec) => {
    if (visited.has(s.id) || visiting.has(s.id)) return;
    visiting.add(s.id);
    if (s.parentId) {
      const parent = byId.get(s.parentId);
      if (parent) visit(parent);
    }
    if (s.aimTarget?.to) {
      const target = byId.get(s.aimTarget.to);
      if (target) visit(target);
    }
    visiting.delete(s.id);
    visited.add(s.id);
    ordered.push(s);
  };

  for (const s of specs) visit(s);
  return ordered;
}

export const JOINT_SPECS: JointSpec[] = sortJointsTopologically(RAW_43_JOINT_SPECS);

export const JOINT_SPEC_MAP: Record<JointId, JointSpec> = JOINT_SPECS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec;
    return acc;
  },
  {} as Record<JointId, JointSpec>
);

/**
 * Verifies every joint connects cleanly without orphans, cycles, parent-before-child violations,
 * aim-target order violations, or mismatches vs Puppyt's canonical 43-joint topology.
 */
export function auditRigHierarchy(specs: readonly JointSpec[] = JOINT_SPECS): RigHierarchyAuditReport {
  const byId = new Map<JointId, JointSpec>();
  const idxById = new Map<JointId, number>();
  specs.forEach((s, i) => {
    byId.set(s.id, s);
    idxById.set(s.id, i);
  });

  const orphanNodes: string[] = [];
  const cycles: string[] = [];
  const topologicalViolations: string[] = [];
  const aimOrderViolations: string[] = [];
  const parentMismatches: Array<{ id: string; expected: string | null; actual: string | null }> = [];

  specs.forEach((s, i) => {
    if (s.parentId) {
      if (!byId.has(s.parentId)) {
        orphanNodes.push(s.id);
      } else if ((idxById.get(s.parentId) ?? -1) >= i) {
        topologicalViolations.push(s.id);
      }
    }
    if (s.aimTarget?.to) {
      const tIdx = idxById.get(s.aimTarget.to);
      if (tIdx === undefined) {
        orphanNodes.push(s.id);
      } else if (tIdx >= i) {
        aimOrderViolations.push(s.id);
      }
    }
    const expectedParent = CANONICAL_RIG_PARENTS[s.id];
    if (expectedParent !== s.parentId) {
      parentMismatches.push({
        id: s.id,
        expected: expectedParent,
        actual: s.parentId,
      });
    }

    const seen = new Set<JointId>([s.id]);
    let cur = s.parentId ? byId.get(s.parentId) : undefined;
    while (cur) {
      if (seen.has(cur.id)) {
        cycles.push(s.id);
        break;
      }
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  });

  return {
    valid:
      specs.length === 43 &&
      orphanNodes.length === 0 &&
      cycles.length === 0 &&
      topologicalViolations.length === 0 &&
      aimOrderViolations.length === 0 &&
      parentMismatches.length === 0,
    totalJoints: specs.length,
    orphanNodes,
    cycles,
    topologicalViolations,
    aimOrderViolations,
    parentMismatches,
  };
}

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

export function clampModeERatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 1.0;
  return Math.max(MODE_E_MIN, Math.min(MODE_E_MAX, Math.round(ratio * 100) / 100));
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
      return clampModeERatio(runtime.modeERatio);
  }
}

export function applyPhysicsGearRatio(inputDelta: number, runtime: JointRuntimeState): number {
  return inputDelta * getPhysicsMultiplier(runtime);
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

/**
 * Conceptual bounding square enclosing the Vitruvian model at all extremes (0.14× adult scale).
 */
export function computeModelWorkingSquare(
  centerX = PAPER_WIDTH / 2,
  centerY = PAPER_HEIGHT / 2
): WorkingSquareBase {
  const spineUp =
    JOINT_SPEC_MAP.lumbar.lengthPx +
    JOINT_SPEC_MAP.thorax.lengthPx +
    JOINT_SPEC_MAP.neck.lengthPx +
    (JOINT_SPEC_MAP.head.endExtensionPx ?? 0);

  const armHalfSpan =
    Math.hypot(
      PUPPYT_LANDMARKS.handRTip[0] - PUPPYT_LANDMARKS.pelvis[0],
      PUPPYT_LANDMARKS.humerusR[1] - PUPPYT_LANDMARKS.humerusR[1]
    ) *
      PUPPYT_TO_EVOLVED_SCALE +
    JOINT_SPEC_MAP.humerusR.lengthPx +
    JOINT_SPEC_MAP.forearmR.lengthPx +
    (JOINT_SPEC_MAP.handR.endExtensionPx ?? 0);

  const legDown =
    Math.abs(PUPPYT_LANDMARKS.toeR[1] - PUPPYT_LANDMARKS.pelvis[1]) * PUPPYT_TO_EVOLVED_SCALE;

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

export function computeModelBounds(
  computed: Record<JointId, ComputedJoint>,
  state: ArmatureState
): ModelBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const spec of JOINT_SPECS) {
    if (spec.isGhost) continue;
    const j = computed[spec.id];
    const rt = state.joints[spec.id];
    const widthScale = Math.max(1, rt?.scaleWidth ?? 1);
    const basePad =
      spec.id === 'thorax'
        ? 92
        : spec.id === 'pelvis' || spec.id === 'ribR' || spec.id === 'ribL'
        ? 76
        : spec.id === 'head'
        ? 52
        : spec.role === 'hand_digit' || spec.role === 'foot_digit' || spec.isTip
        ? 18
        : 40;
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
    if (spec.id === 'pelvis' || spec.id === 'lumbar') {
      side = 'left';
    } else if (spec.isSpine) {
      side = 'right';
    } else if (spec.side === 'right') {
      side = 'left';
    } else if (spec.side === 'left') {
      side = 'right';
    } else if (joint.x < modelBounds.centerX - 6) {
      side = 'left';
    } else {
      side = 'right';
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

      for (const rect of exclusionRects) {
        const horizOverlap = boxX + boxW > rect.minX && boxX < rect.maxX;
        if (!horizOverlap) continue;
        const vertOverlap =
          c.calloutY + halfBoxH > rect.minY && c.calloutY - halfBoxH < rect.maxY;
        if (vertOverlap) {
          c.calloutY = Math.max(c.calloutY, rect.maxY + halfBoxH + 8 * invZoom);
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

const PROCEDURAL_MOOD_JOINT_MAX_DEG: Partial<Record<JointId, number>> = {
  lumbar: 1.0,
  thorax: 0.75,
  neck: 1.25,
  head: 1.25,
  ribR: 1.0,
  ribL: 1.0,
  swivelR: 0.75,
  swivelL: 0.75,
  hipR: 0.75,
  hipL: 0.75,
};

function seededUnit(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 0xffffffff;
}

/**
 * Generates quantized (±0.25° step) micro-range posture variations for the canonical
 * Bitruvian T Pose so each session opens with a subtle, organic mood while preserving
 * horizontal T-Pose arms, standing alignment, and Vitruvian structural integrity.
 */
export function createProceduralMoodOffsets(seed: number = Date.now()): ProceduralMoodOffsets {
  const offsets: ProceduralMoodOffsets = {};
  const entries = Object.entries(PROCEDURAL_MOOD_JOINT_MAX_DEG) as [JointId, number][];
  entries.forEach(([jointId, maxDeg], idx) => {
    const u = seededUnit(seed, idx + 1) * 2 - 1; // [-1, 1]
    const raw = u * maxDeg;
    const quantized = snapAnglePrecision(raw, ANGLE_PRECISION_STEP);
    offsets[jointId] = Math.abs(quantized) < 1e-6 ? 0 : quantized;
  });
  return offsets;
}

export function createPosePreset(
  preset: PosePresetId,
  existingState?: ArmatureState,
  options?: { proceduralMood?: boolean; moodSeed?: number }
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
    continuousSpin: existingState?.continuousSpin ?? true,
    internalKeystone: existingState?.internalKeystone ?? 'navel',
    environmentalAnchor: existingState?.environmentalAnchor ?? 'navel',
    isAnchorPinned: existingState?.isAnchorPinned ?? true,
    headTurn: existingState?.headTurn ?? 0,
    proceduralMoodOffsets: {},
    joints,
  };

  if (preset === 'tpose') {
    // Outstretched horizontal arms matching Puppyt armspan (~1.00 Vitruvian stature) & straight upright legs
    base.joints.humerusR.localAngle = 86.5;
    base.joints.forearmR.localAngle = 3.5;
    base.joints.handR.localAngle = 0;
    base.joints.humerusL.localAngle = -86.5;
    base.joints.forearmL.localAngle = -3.5;
    base.joints.handL.localAngle = 0;
    base.joints.femurR.localAngle = -3.75;
    base.joints.shinR.localAngle = 2.5;
    base.joints.footR.localAngle = 0;
    base.joints.femurL.localAngle = 3.0;
    base.joints.shinL.localAngle = -1.75;
    base.joints.footL.localAngle = 0;

    if (options?.proceduralMood) {
      const mood = createProceduralMoodOffsets(options.moodSeed);
      base.proceduralMoodOffsets = mood;
      for (const [jid, delta] of Object.entries(mood) as [JointId, number][]) {
        base.joints[jid].localAngle = applyJointAngleConstraint(
          base.joints[jid].localAngle + delta,
          base.continuousSpin
        );
      }
    }
  } else if (preset === 'contrapposto') {
    base.rootRotation = 4;
    base.joints.lumbar.localAngle = -5;
    base.joints.thorax.localAngle = -3;
    base.joints.neck.localAngle = 4;
    base.joints.head.localAngle = 4;
    base.joints.swivelR.localAngle = -4;
    base.joints.swivelL.localAngle = 4;
    base.joints.humerusR.localAngle = 14;
    base.joints.forearmR.localAngle = 42;
    base.joints.handR.localAngle = 12;
    base.joints.humerusL.localAngle = -18;
    base.joints.forearmL.localAngle = -38;
    base.joints.handL.localAngle = -14;
    base.joints.hipR.localAngle = 3;
    base.joints.femurR.localAngle = -6;
    base.joints.shinR.localAngle = -10;
    base.joints.footR.localAngle = 6;
    base.joints.hipL.localAngle = -5;
    base.joints.femurL.localAngle = 14;
    base.joints.shinL.localAngle = 20;
    base.joints.footL.localAngle = -14;
  } else if (preset === 'striding') {
    base.rootRotation = -5;
    base.joints.lumbar.localAngle = 5;
    base.joints.thorax.localAngle = 4;
    base.joints.neck.localAngle = -4;
    base.joints.head.localAngle = -2;
    base.joints.swivelR.localAngle = -6;
    base.joints.swivelL.localAngle = 6;
    base.joints.humerusR.localAngle = 28;
    base.joints.forearmR.localAngle = -34;
    base.joints.handR.localAngle = -10;
    base.joints.humerusL.localAngle = -26;
    base.joints.forearmL.localAngle = 30;
    base.joints.handL.localAngle = 10;
    base.joints.femurR.localAngle = 20;
    base.joints.shinR.localAngle = -24;
    base.joints.footR.localAngle = 18;
    base.joints.femurL.localAngle = -22;
    base.joints.shinL.localAngle = 22;
    base.joints.footL.localAngle = -12;
  } else {
    // Classical Vitruvian X/Y reach: elevated symmetrical arms & splayed legs inside circle/square
    base.joints.swivelR.localAngle = -4;
    base.joints.swivelL.localAngle = 4;
    base.joints.humerusR.localAngle = 104;
    base.joints.forearmR.localAngle = 3.5;
    base.joints.handR.localAngle = 0;
    base.joints.humerusL.localAngle = -104;
    base.joints.forearmL.localAngle = -3.5;
    base.joints.handL.localAngle = 0;
    base.joints.femurR.localAngle = 13;
    base.joints.shinR.localAngle = 0;
    base.joints.footR.localAngle = 12;
    base.joints.femurL.localAngle = -13;
    base.joints.shinL.localAngle = 0;
    base.joints.footL.localAngle = -12;
  }

  return base;
}

/**
 * Evaluates raw FK skeletal hierarchy across all 43 Puppyt joints before environmental anchor translation.
 * Solves parent-before-child hierarchical affine transforms and closed-chain collarbone aim (braceR/L -> acromionR/L).
 */
function evaluateRawArmature(state: ArmatureState): Record<JointId, ComputedJoint> {
  const computed = {} as Record<JointId, ComputedJoint>;

  for (const spec of JOINT_SPECS) {
    const runtime = state.joints[spec.id] ?? {
      localAngle: spec.defaultLocalAngle,
      mode: spec.defaultMode,
      physicsMode: 'twins' as PhysicsModeId,
      modeERatio: 1.0,
      scaleLength: 1.0,
      scaleWidth: 1.0,
    };

    const scaleLen = Math.max(BONE_SCALE_MIN, Math.min(BONE_SCALE_MAX, runtime.scaleLength));
    const scaleWid = Math.max(BONE_SCALE_MIN, Math.min(BONE_SCALE_MAX, runtime.scaleWidth));
    const effLocalAngle = spec.locked ? 0 : runtime.localAngle;

    if (spec.parentId === null) {
      const restWorldDeg = spec.restTip ? vecAngleDeg(spec.restPivot, spec.restTip) : -90;
      const pelvisMatrix = composeBoneMatrix(
        state.rootX,
        state.rootY,
        state.rootRotation,
        PUPPYT_TO_EVOLVED_SCALE * scaleWid,
        PUPPYT_TO_EVOLVED_SCALE * scaleLen,
        0,
        spec.restPivot[0],
        spec.restPivot[1]
      );
      const endPt = spec.restTip
        ? applyAffine(pelvisMatrix, spec.restTip[0], spec.restTip[1])
        : { x: state.rootX, y: state.rootY };

      computed[spec.id] = {
        id: spec.id,
        spec,
        x: state.rootX,
        y: state.rootY,
        endX: endPt.x,
        endY: endPt.y,
        parentX: null,
        parentY: null,
        localAngle: state.rootRotation,
        worldAngle: restWorldDeg + state.rootRotation,
        restWorldDeg,
        cumulativeDeltaDeg: state.rootRotation,
        effectiveLengthPx: Math.hypot(endPt.x - state.rootX, endPt.y - state.rootY),
        effectiveWidthScale: scaleWid,
        mode: runtime.mode,
        boneMatrix: pelvisMatrix,
      };
      continue;
    }

    const parent = computed[spec.parentId];
    const originPt = applyAffine(parent.boneMatrix, spec.restPivot[0], spec.restPivot[1]);
    const restWorldDeg = spec.restTip
      ? vecAngleDeg(spec.restPivot, spec.restTip)
      : parent.restWorldDeg;

    if (spec.aimTarget) {
      // Closed-chain collarbone brace aims dynamically from thorax neck-base toward solved acromion
      const targetJoint = computed[spec.aimTarget.to];
      const aimDx = targetJoint.x - originPt.x;
      const aimDy = targetJoint.y - originPt.y;
      const dist = Math.hypot(aimDx, aimDy);
      const restDist =
        Math.hypot(
          targetJoint.spec.restPivot[0] - spec.restPivot[0],
          targetJoint.spec.restPivot[1] - spec.restPivot[1]
        ) * PUPPYT_TO_EVOLVED_SCALE;

      const worldAimDeg =
        dist > 1e-3 ? Math.atan2(aimDy, aimDx) * RAD_TO_DEG + effLocalAngle : restWorldDeg + parent.cumulativeDeltaDeg;
      const cumulativeDeltaDeg = normalizeAngleDeg(worldAimDeg - restWorldDeg);
      const stretchRatio =
        restDist > 1e-3 ? dist / (restDist * Math.max(0.5, scaleWid)) : 1;
      const isStrained =
        stretchRatio < spec.aimTarget.minRatio || stretchRatio > spec.aimTarget.maxRatio;

      const matrix = composeBoneMatrix(
        originPt.x,
        originPt.y,
        worldAimDeg,
        PUPPYT_TO_EVOLVED_SCALE * scaleLen,
        PUPPYT_TO_EVOLVED_SCALE * scaleWid,
        restWorldDeg,
        spec.restPivot[0],
        spec.restPivot[1]
      );

      computed[spec.id] = {
        id: spec.id,
        spec,
        x: originPt.x,
        y: originPt.y,
        endX: targetJoint.x,
        endY: targetJoint.y,
        parentX: parent.x,
        parentY: parent.y,
        localAngle: effLocalAngle,
        worldAngle: worldAimDeg,
        restWorldDeg,
        cumulativeDeltaDeg,
        effectiveLengthPx: dist,
        effectiveWidthScale: scaleWid,
        mode: runtime.mode,
        boneMatrix: matrix,
        isStrained,
        tensionRatio: stretchRatio,
      };
      continue;
    }

    const cumulativeDeltaDeg = parent.cumulativeDeltaDeg + effLocalAngle;
    const worldAngle = restWorldDeg + cumulativeDeltaDeg;

    const matrix = composeBoneMatrix(
      originPt.x,
      originPt.y,
      worldAngle,
      PUPPYT_TO_EVOLVED_SCALE * scaleLen,
      PUPPYT_TO_EVOLVED_SCALE * scaleWid,
      restWorldDeg,
      spec.restPivot[0],
      spec.restPivot[1]
    );

    const endPt = spec.restTip
      ? applyAffine(matrix, spec.restTip[0], spec.restTip[1])
      : { x: originPt.x, y: originPt.y };

    computed[spec.id] = {
      id: spec.id,
      spec,
      x: originPt.x,
      y: originPt.y,
      endX: endPt.x,
      endY: endPt.y,
      parentX: parent.x,
      parentY: parent.y,
      localAngle: effLocalAngle,
      worldAngle,
      restWorldDeg,
      cumulativeDeltaDeg,
      effectiveLengthPx: Math.hypot(endPt.x - originPt.x, endPt.y - originPt.y),
      effectiveWidthScale: scaleWid,
      mode: runtime.mode,
      boneMatrix: matrix,
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
      return { x: computed.pelvis.x, y: computed.pelvis.y };
    case 'feet':
      return {
        x: (computed.footR.endX + computed.footL.endX) / 2,
        y: Math.max(computed.footR.endY, computed.footL.endY),
      };
    case 'navel':
      return { x: computed.lumbar.x, y: computed.lumbar.y };
    case 'clavicle':
      return { x: computed.thorax.x, y: computed.thorax.y };
    case 'neck':
      return { x: computed.neck.x, y: computed.neck.y };
    case 'crown':
      return { x: computed.head.endX, y: computed.head.endY };
  }
}

/**
 * Propagates FK parent-to-child transformations across all 43 joints in topological order,
 * applying closed-chain shoulder aim and pinning active Environmental Anchor to canvasOrigin when locked.
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
    const m = j.boneMatrix;
    pinned[spec.id] = {
      ...j,
      x: j.x + shiftX,
      y: j.y + shiftY,
      endX: j.endX + shiftX,
      endY: j.endY + shiftY,
      parentX: j.parentX !== null ? j.parentX + shiftX : null,
      parentY: j.parentY !== null ? j.parentY + shiftY : null,
      boneMatrix: [m[0], m[1], m[2], m[3], m[4] + shiftX, m[5] + shiftY],
    };
  }
  return pinned;
}

/**
 * 2-bone analytical IK solver for limbs:
 * Arms: [humerusR/L -> forearmR/L -> handR/L]
 * Legs: [femurR/L -> shinR/L -> footR/L]
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
  const midJoint = computed[midId];
  const endJoint = computed[endId];

  const L1 = Math.hypot(midJoint.x - rootJoint.x, midJoint.y - rootJoint.y);
  const L2 = Math.hypot(endJoint.x - midJoint.x, endJoint.y - midJoint.y);

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
  const desiredWorld1 = ((baseAngle + bendDir * alpha) * 180) / Math.PI;
  const desiredWorld2 = ((baseAngle + bendDir * alpha - bendDir * (Math.PI - beta)) * 180) / Math.PI;

  const multRoot = getPhysicsMultiplier(state.joints[rootId]);
  const multMid = getPhysicsMultiplier(state.joints[midId]);

  const rawDeltaRoot = shortestAngleDelta(rootJoint.worldAngle, desiredWorld1);
  const nextRootLocal = applyJointAngleConstraint(
    state.joints[rootId].localAngle + rawDeltaRoot * multRoot,
    state.continuousSpin
  );
  const appliedDeltaRoot = nextRootLocal - state.joints[rootId].localAngle;

  const midWorldAfterRoot = midJoint.worldAngle + appliedDeltaRoot;
  const rawDeltaMid = shortestAngleDelta(midWorldAfterRoot, desiredWorld2);
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
 * Spine CCD IK across dual-spine segments [lumbar, thorax, neck, head].
 */
export function solveSpineCCDIK(
  state: ArmatureState,
  targetX: number,
  targetY: number,
  canvasOrigin: { x: number; y: number } = { x: PAPER_WIDTH / 2, y: PAPER_HEIGHT / 2 }
): ArmatureState {
  const chain: JointId[] = ['lumbar', 'thorax', 'neck', 'head'];
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

  if (pivotJointId === 'pelvis') {
    const mult = getPhysicsMultiplier(state.joints.pelvis);
    if (mult === 0) return state;
    const rawDelta = shortestAngleDelta(pivot.worldAngle, targetWorldDeg);
    const nextRootRot = applyJointAngleConstraint(
      state.rootRotation + rawDelta * mult,
      state.continuousSpin
    );
    return { ...state, rootRotation: nextRootRot };
  }

  const spec = JOINT_SPEC_MAP[pivotJointId];
  if (spec.locked) return state;
  const runtime = state.joints[pivotJointId];
  const mult = getPhysicsMultiplier(runtime);
  if (mult === 0) return state;

  const rawDelta = shortestAngleDelta(pivot.worldAngle, targetWorldDeg);
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

export function armatureToCharacterSnapshot(
  state: ArmatureState,
  label: string,
  viewMode: SilhouetteDisplayMode = 'wireframe'
): CharacterPoseSnapshot {
  const joints = {} as Record<JointId, number>;
  const jointModes = {} as Record<JointId, JointMode>;
  const physicsModes = {} as Record<JointId, PhysicsModeId>;
  const modeEValues = {} as Record<JointId, number>;
  const perJointScale = {} as Record<JointId, { length: number; width: number }>;
  const armatureJointsCopy = {} as Record<JointId, JointRuntimeState>;

  const normalizeArmatureOnSave = !state.continuousSpin;
  let sumLen = 0;
  let sumWid = 0;

  for (const spec of JOINT_SPECS) {
    const rt = state.joints[spec.id];
    const baseAngle = spec.id === 'pelvis' ? state.rootRotation : rt.localAngle;
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
    proceduralMoodOffsets: state.proceduralMoodOffsets
      ? { ...state.proceduralMoodOffsets }
      : undefined,
    armature: {
      ...state,
      rootRotation: normalizeArmatureOnSave
        ? snapAnglePrecision(normalizeAngleDeg(state.rootRotation))
        : snapAnglePrecision(state.rootRotation),
      joints: armatureJointsCopy,
    },
  };
}

export function createLaunchPose(seed?: number): ArmatureState {
  return createPosePreset('tpose', undefined, {
    proceduralMood: true,
    moodSeed: seed,
  });
}

export function computeStageSplitLayout(windowWidth: number, inspectorOpen = true): {
  stageWidth: number;
  consoleWidth: number;
  stageRatio: number;
  consoleRatio: number;
} {
  if (!inspectorOpen) {
    return {
      stageWidth: windowWidth,
      consoleWidth: 0,
      stageRatio: 1,
      consoleRatio: 0,
    };
  }
  const consoleWidth = windowWidth / 3;
  const stageWidth = windowWidth - consoleWidth;
  return {
    stageWidth,
    consoleWidth,
    stageRatio: stageWidth / windowWidth,
    consoleRatio: consoleWidth / windowWidth,
  };
}

export function computeNavelCenterPan(
  stageWidth: number,
  stageHeight: number,
  navelWorldX: number,
  navelWorldY: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: stageWidth / 2 - navelWorldX * zoom,
    y: stageHeight / 2 - navelWorldY * zoom,
  };
}

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function rectsIntersect(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function createPoseSnapshot(
  state: ArmatureState,
  name: string,
  viewMode: SilhouetteDisplayMode = 'wireframe'
): CharacterPoseSnapshot {
  return armatureToCharacterSnapshot(state, name, viewMode);
}

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
        spec.id === 'pelvis'
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
    rootRotation: snapshot.joints.pelvis ?? fallback?.rootRotation ?? 0,
    continuousSpin: snapshot.continuousSpin,
    internalKeystone: snapshot.keystone,
    environmentalAnchor: snapshot.environmentalAnchor,
    isAnchorPinned: snapshot.navelPin,
    headTurn: fallback?.headTurn ?? 0,
    proceduralMoodOffsets: snapshot.proceduralMoodOffsets
      ? { ...snapshot.proceduralMoodOffsets }
      : fallback?.proceduralMoodOffsets,
    joints,
  };
}

export function interpolateArmatureShortestPath(
  fromState: ArmatureState,
  toState: ArmatureState,
  t: number
): ArmatureState {
  const clampedT = Math.max(0, Math.min(1, t));
  // 0.5s ease-in-out cubic transition curve
  const eased =
    clampedT < 0.5
      ? 4 * clampedT * clampedT * clampedT
      : 1 - Math.pow(-2 * clampedT + 2, 3) / 2;

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

/**
 * Mirrors all 43 joints cleanly around the sagittal midline using Puppyt relative-to-rest symmetry.
 */
export function mirrorPose(state: ArmatureState): ArmatureState {
  const nextJoints = { ...state.joints };
  const bilateralPairs: [JointId, JointId][] = [
    ['ribR', 'ribL'],
    ['swivelR', 'swivelL'],
    ['swivelTipR', 'swivelTipL'],
    ['acromionR', 'acromionL'],
    ['braceR', 'braceL'],
    ['wingR', 'wingL'],
    ['humerusR', 'humerusL'],
    ['forearmR', 'forearmL'],
    ['handR', 'handL'],
    ['thumbR', 'thumbL'],
    ['thumbTipR', 'thumbTipL'],
    ['fingerR', 'fingerL'],
    ['fingerTipR', 'fingerTipL'],
    ['hipR', 'hipL'],
    ['femurR', 'femurL'],
    ['shinR', 'shinL'],
    ['footR', 'footL'],
    ['toeR', 'toeL'],
  ];

  for (const [rId, lId] of bilateralPairs) {
    const r = state.joints[rId];
    const l = state.joints[lId];
    nextJoints[rId] = {
      ...r,
      localAngle: applyJointAngleConstraint(-l.localAngle, state.continuousSpin),
    };
    nextJoints[lId] = {
      ...l,
      localAngle: applyJointAngleConstraint(-r.localAngle, state.continuousSpin),
    };
  }

  const spineIds: JointId[] = ['lumbar', 'thorax', 'neck', 'head', 'lip', 'chinTip'];
  for (const id of spineIds) {
    const rt = state.joints[id];
    nextJoints[id] = {
      ...rt,
      localAngle: applyJointAngleConstraint(-rt.localAngle, state.continuousSpin),
    };
  }

  return {
    ...state,
    rootRotation: applyJointAngleConstraint(-state.rootRotation, state.continuousSpin),
    joints: nextJoints,
  };
}
