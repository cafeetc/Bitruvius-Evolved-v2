import { PUPPYT_LANDMARKS, PUPPYT_SKELETON_PIECES, SkeletonPieceAsset } from '../data/skeletonRig';
import { ArmatureState, ComputedJoint, JointId } from '../types';
import { PUPPYT_TO_EVOLVED_SCALE, normalizeAngleDeg } from './kinematics';

export type Affine2D = readonly [number, number, number, number, number, number];

export interface SkeletonPieceRender {
  key: string;
  asset: SkeletonPieceAsset;
  jointId: JointId;
  matrix: Affine2D;
  matrixCss: string;
  drawOrder: number;
}

export interface DigitalModelSegment {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'primary' | 'strained' | 'ghost' | 'skull' | 'rib' | 'pelvis';
}

export interface DigitalModelDot {
  key: string;
  x: number;
  y: number;
  radius: number;
  strained: boolean;
  ghost: boolean;
}

export interface DigitalModelData {
  acromionR: { x: number; y: number };
  acromionL: { x: number; y: number };
  strainedR: boolean;
  strainedL: boolean;
  segments: DigitalModelSegment[];
  dots: DigitalModelDot[];
}

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
 * onto Evolved bone segment (origin -> target) with longitudinal lenScale and lateral widScale.
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

function formatMatrixCss(m: Affine2D): string {
  return `matrix(${m[0].toFixed(5)} ${m[1].toFixed(5)} ${m[2].toFixed(5)} ${m[3].toFixed(5)} ${m[4].toFixed(3)} ${m[5].toFixed(3)})`;
}

function vecAngleDeg(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax) * RAD_TO_DEG;
}

function vecLen(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function computeBilateralPriority(computed: Record<JointId, ComputedJoint>): {
  armFront: 'left' | 'right';
  legFront: 'left' | 'right';
} {
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

  return { armFront, legFront };
}

/**
 * Computes closed-chain acromion landmarks inside Evolved's collar/neck shoulder complex,
 * matching Puppyt's acromion placement inboard of the humeral heads.
 */
export function computeShoulderAcromionLandmarks(
  computed: Record<JointId, ComputedJoint>
): {
  acromionR: { x: number; y: number };
  acromionL: { x: number; y: number };
  strainedR: boolean;
  strainedL: boolean;
} {
  const collar = computed.collar;
  const neck = computed.neck;
  const rShd = computed.r_shoulder;
  const lShd = computed.l_shoulder;

  const cToNx = neck.x - collar.x;
  const cToNy = neck.y - collar.y;

  const acromionR = {
    x: collar.x + (rShd.x - collar.x) * 0.821 + cToNx * 0.166,
    y: collar.y + (rShd.y - collar.y) * 0.821 + cToNy * 0.166,
  };
  const acromionL = {
    x: collar.x + (lShd.x - collar.x) * 0.821 + cToNx * 0.166,
    y: collar.y + (lShd.y - collar.y) * 0.821 + cToNy * 0.166,
  };

  // Detect bond strain when neck <-> acromion distance deviates outside Puppyt's tendon corridor
  const restCollarToAcroRatio = 83.3; // nominal distance at 1.0x Puppyt adult scale
  const scaleFactor = Math.max(0.5, collar.effectiveWidthScale);
  const ratioR = vecLen(neck.x, neck.y, acromionR.x, acromionR.y) / (restCollarToAcroRatio * scaleFactor);
  const ratioL = vecLen(neck.x, neck.y, acromionL.x, acromionL.y) / (restCollarToAcroRatio * scaleFactor);

  const strainedR = ratioR < 0.78 || ratioR > 1.12;
  const strainedL = ratioL < 0.78 || ratioL > 1.12;

  return { acromionR, acromionL, strainedR, strainedL };
}

const PUPPYT_REST_VECS = {
  lumbarLen: vecLen(...PUPPYT_LANDMARKS.lumbar, ...PUPPYT_LANDMARKS.thorax),
  lumbarDeg: vecAngleDeg(...PUPPYT_LANDMARKS.lumbar, ...PUPPYT_LANDMARKS.thorax),

  thoraxLen: vecLen(...PUPPYT_LANDMARKS.thorax, ...PUPPYT_LANDMARKS.neck),
  thoraxDeg: vecAngleDeg(...PUPPYT_LANDMARKS.thorax, ...PUPPYT_LANDMARKS.neck),

  neckLen: vecLen(...PUPPYT_LANDMARKS.neck, ...PUPPYT_LANDMARKS.head),
  neckDeg: vecAngleDeg(...PUPPYT_LANDMARKS.neck, ...PUPPYT_LANDMARKS.head),

  headLen: 855.5,
  headDeg: -90,

  braceRLen: vecLen(...PUPPYT_LANDMARKS.neck, ...PUPPYT_LANDMARKS.acromionRSym),
  braceRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.neck, ...PUPPYT_LANDMARKS.acromionRSym),
  braceLLen: vecLen(...PUPPYT_LANDMARKS.neck, ...PUPPYT_LANDMARKS.acromionL),
  braceLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.neck, ...PUPPYT_LANDMARKS.acromionL),

  acromionRLen: vecLen(...PUPPYT_LANDMARKS.acromionR, ...PUPPYT_LANDMARKS.humerusR),
  acromionRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.acromionR, ...PUPPYT_LANDMARKS.humerusR),
  acromionLLen: vecLen(...PUPPYT_LANDMARKS.acromionL, ...PUPPYT_LANDMARKS.humerusL),
  acromionLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.acromionL, ...PUPPYT_LANDMARKS.humerusL),

  swivelRLen: vecLen(...PUPPYT_LANDMARKS.swivelR, ...PUPPYT_LANDMARKS.acromionR),
  swivelRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.swivelR, ...PUPPYT_LANDMARKS.acromionR),
  swivelLLen: vecLen(...PUPPYT_LANDMARKS.swivelL, ...PUPPYT_LANDMARKS.acromionL),
  swivelLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.swivelL, ...PUPPYT_LANDMARKS.acromionL),

  humerusRLen: vecLen(...PUPPYT_LANDMARKS.humerusR, ...PUPPYT_LANDMARKS.forearmR),
  humerusRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.humerusR, ...PUPPYT_LANDMARKS.forearmR),
  humerusLLen: vecLen(...PUPPYT_LANDMARKS.humerusL, ...PUPPYT_LANDMARKS.forearmL),
  humerusLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.humerusL, ...PUPPYT_LANDMARKS.forearmL),

  forearmRLen: vecLen(...PUPPYT_LANDMARKS.forearmR, ...PUPPYT_LANDMARKS.handR),
  forearmRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.forearmR, ...PUPPYT_LANDMARKS.handR),
  forearmLLen: vecLen(...PUPPYT_LANDMARKS.forearmL, ...PUPPYT_LANDMARKS.handL),
  forearmLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.forearmL, ...PUPPYT_LANDMARKS.handL),

  handLen: 825,
  handDeg: 90,

  femurRLen: vecLen(...PUPPYT_LANDMARKS.femurR, ...PUPPYT_LANDMARKS.shinR),
  femurRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.femurR, ...PUPPYT_LANDMARKS.shinR),
  femurLLen: vecLen(...PUPPYT_LANDMARKS.femurL, ...PUPPYT_LANDMARKS.shinL),
  femurLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.femurL, ...PUPPYT_LANDMARKS.shinL),

  shinRLen: vecLen(...PUPPYT_LANDMARKS.shinR, ...PUPPYT_LANDMARKS.footR),
  shinRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.shinR, ...PUPPYT_LANDMARKS.footR),
  shinLLen: vecLen(...PUPPYT_LANDMARKS.shinL, ...PUPPYT_LANDMARKS.footL),
  shinLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.shinL, ...PUPPYT_LANDMARKS.footL),

  footRLen: vecLen(...PUPPYT_LANDMARKS.footR, ...PUPPYT_LANDMARKS.toeR),
  footRDeg: vecAngleDeg(...PUPPYT_LANDMARKS.footR, ...PUPPYT_LANDMARKS.toeR),
  footLLen: vecLen(...PUPPYT_LANDMARKS.footL, ...PUPPYT_LANDMARKS.toeL),
  footLDeg: vecAngleDeg(...PUPPYT_LANDMARKS.footL, ...PUPPYT_LANDMARKS.toeL),
};

/**
 * Computes affine world transforms and Z-sorted draw list for all 33 Puppyt purple skeleton PNGs
 * mounted onto Bitruvius-Evolved's 18-joint kinematic rig.
 */
export function buildSkeletonPieceRenders(
  state: ArmatureState,
  computed: Record<JointId, ComputedJoint>
): SkeletonPieceRender[] {
  const { armFront, legFront } = computeBilateralPriority(computed);
  const { acromionR, acromionL } = computeShoulderAcromionLandmarks(computed);

  const w = (id: JointId) => state.joints[id].scaleWidth;
  const l = (id: JointId) => state.joints[id].scaleLength;

  const waist = computed.waist;
  const torso = computed.torso;
  const collar = computed.collar;
  const neck = computed.neck;
  const head = computed.head;
  const rShd = computed.r_shoulder;
  const rElb = computed.r_elbow;
  const rWrs = computed.r_wrist;
  const lShd = computed.l_shoulder;
  const lElb = computed.l_elbow;
  const lWrs = computed.l_wrist;
  const rHip = computed.r_hip;
  const rKne = computed.r_knee;
  const rAnk = computed.r_ankle;
  const lHip = computed.l_hip;
  const lKne = computed.l_knee;
  const lAnk = computed.l_ankle;

  const waistRot = waist.worldAngle;
  // Exact 1:1 isotropic Puppyt adult scale so pelvis, ribcage, skull, and all limbs match original Puppyt proportions
  const pelvisScaleX = PUPPYT_TO_EVOLVED_SCALE * w('waist');
  const pelvisScaleY = PUPPYT_TO_EVOLVED_SCALE * l('waist');
  const pelvisOriginX = waist.x;
  const pelvisOriginY = waist.y;

  const renders: SkeletonPieceRender[] = PUPPYT_SKELETON_PIECES.map((asset) => {
    const [px, py] = asset.pivot;
    let matrix: Affine2D;
    let jointId: JointId;

    switch (asset.nodeId) {
      case 'hipR':
      case 'hipL': {
        jointId = 'waist';
        matrix = composeBoneMatrix(
          pelvisOriginX,
          pelvisOriginY,
          waistRot,
          pelvisScaleX,
          pelvisScaleY,
          0,
          px,
          py
        );
        break;
      }

      case 'lumbar': {
        jointId = 'torso';
        const dist = vecLen(waist.x, waist.y, torso.x, torso.y);
        const deg = vecAngleDeg(waist.x, waist.y, torso.x, torso.y);
        matrix = composeBoneMatrix(
          waist.x,
          waist.y,
          deg,
          dist / PUPPYT_REST_VECS.lumbarLen,
          PUPPYT_TO_EVOLVED_SCALE * w('torso'),
          PUPPYT_REST_VECS.lumbarDeg,
          px,
          py
        );
        break;
      }

      case 'thorax':
      case 'ribR':
      case 'ribL': {
        jointId = asset.nodeId === 'thorax' && asset.name === 'Neckring' ? 'collar' : 'torso';
        const dist = vecLen(torso.x, torso.y, neck.x, neck.y);
        const deg = vecAngleDeg(torso.x, torso.y, neck.x, neck.y);
        const widScale =
          asset.name === 'Neckring'
            ? PUPPYT_TO_EVOLVED_SCALE * w('collar')
            : PUPPYT_TO_EVOLVED_SCALE * w('torso');
        matrix = composeBoneMatrix(
          torso.x,
          torso.y,
          deg,
          dist / PUPPYT_REST_VECS.thoraxLen,
          widScale,
          PUPPYT_REST_VECS.thoraxDeg,
          px,
          py
        );
        break;
      }

      case 'neck': {
        jointId = 'neck';
        const dist = vecLen(neck.x, neck.y, head.x, head.y);
        const deg = vecAngleDeg(neck.x, neck.y, head.x, head.y);
        matrix = composeBoneMatrix(
          neck.x,
          neck.y,
          deg,
          dist / PUPPYT_REST_VECS.neckLen,
          PUPPYT_TO_EVOLVED_SCALE * w('neck'),
          PUPPYT_REST_VECS.neckDeg,
          px,
          py
        );
        break;
      }

      case 'head': {
        jointId = 'head';
        const dist = vecLen(head.x, head.y, head.endX, head.endY);
        const deg = vecAngleDeg(head.x, head.y, head.endX, head.endY);
        matrix = composeBoneMatrix(
          head.x,
          head.y,
          deg,
          dist / PUPPYT_REST_VECS.headLen,
          PUPPYT_TO_EVOLVED_SCALE * w('head'),
          PUPPYT_REST_VECS.headDeg,
          px,
          py
        );
        break;
      }

      case 'braceR': {
        jointId = 'collar';
        const dist = vecLen(neck.x, neck.y, acromionR.x, acromionR.y);
        const deg = vecAngleDeg(neck.x, neck.y, acromionR.x, acromionR.y);
        matrix = composeBoneMatrix(
          neck.x,
          neck.y,
          deg,
          dist / PUPPYT_REST_VECS.braceRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('collar'),
          PUPPYT_REST_VECS.braceRDeg,
          px,
          py
        );
        break;
      }

      case 'braceL': {
        jointId = 'collar';
        const dist = vecLen(neck.x, neck.y, acromionL.x, acromionL.y);
        const deg = vecAngleDeg(neck.x, neck.y, acromionL.x, acromionL.y);
        matrix = composeBoneMatrix(
          neck.x,
          neck.y,
          deg,
          dist / PUPPYT_REST_VECS.braceLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('collar'),
          PUPPYT_REST_VECS.braceLDeg,
          px,
          py
        );
        break;
      }

      case 'acromionR': {
        jointId = 'r_shoulder';
        const dist = vecLen(acromionR.x, acromionR.y, rShd.x, rShd.y);
        const deg = vecAngleDeg(acromionR.x, acromionR.y, rShd.x, rShd.y);
        matrix = composeBoneMatrix(
          acromionR.x,
          acromionR.y,
          deg,
          dist / PUPPYT_REST_VECS.acromionRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('collar'),
          PUPPYT_REST_VECS.acromionRDeg,
          px,
          py
        );
        break;
      }

      case 'acromionL': {
        jointId = 'l_shoulder';
        const dist = vecLen(acromionL.x, acromionL.y, lShd.x, lShd.y);
        const deg = vecAngleDeg(acromionL.x, acromionL.y, lShd.x, lShd.y);
        matrix = composeBoneMatrix(
          acromionL.x,
          acromionL.y,
          deg,
          dist / PUPPYT_REST_VECS.acromionLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('collar'),
          PUPPYT_REST_VECS.acromionLDeg,
          px,
          py
        );
        break;
      }

      case 'swivelR': {
        jointId = 'torso';
        const dist = vecLen(torso.x, torso.y, acromionR.x, acromionR.y);
        const deg = vecAngleDeg(torso.x, torso.y, acromionR.x, acromionR.y);
        matrix = composeBoneMatrix(
          torso.x,
          torso.y,
          deg,
          dist / PUPPYT_REST_VECS.swivelRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('torso'),
          PUPPYT_REST_VECS.swivelRDeg,
          px,
          py
        );
        break;
      }

      case 'swivelL': {
        jointId = 'torso';
        const dist = vecLen(torso.x, torso.y, acromionL.x, acromionL.y);
        const deg = vecAngleDeg(torso.x, torso.y, acromionL.x, acromionL.y);
        matrix = composeBoneMatrix(
          torso.x,
          torso.y,
          deg,
          dist / PUPPYT_REST_VECS.swivelLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('torso'),
          PUPPYT_REST_VECS.swivelLDeg,
          px,
          py
        );
        break;
      }

      case 'humerusR': {
        jointId = 'r_shoulder';
        const dist = vecLen(rShd.x, rShd.y, rElb.x, rElb.y);
        const deg = vecAngleDeg(rShd.x, rShd.y, rElb.x, rElb.y);
        matrix = composeBoneMatrix(
          rShd.x,
          rShd.y,
          deg,
          dist / PUPPYT_REST_VECS.humerusRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('r_shoulder'),
          PUPPYT_REST_VECS.humerusRDeg,
          px,
          py
        );
        break;
      }

      case 'humerusL': {
        jointId = 'l_shoulder';
        const dist = vecLen(lShd.x, lShd.y, lElb.x, lElb.y);
        const deg = vecAngleDeg(lShd.x, lShd.y, lElb.x, lElb.y);
        matrix = composeBoneMatrix(
          lShd.x,
          lShd.y,
          deg,
          dist / PUPPYT_REST_VECS.humerusLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('l_shoulder'),
          PUPPYT_REST_VECS.humerusLDeg,
          px,
          py
        );
        break;
      }

      case 'forearmR': {
        jointId = 'r_elbow';
        const dist = vecLen(rElb.x, rElb.y, rWrs.x, rWrs.y);
        const deg = vecAngleDeg(rElb.x, rElb.y, rWrs.x, rWrs.y);
        matrix = composeBoneMatrix(
          rElb.x,
          rElb.y,
          deg,
          dist / PUPPYT_REST_VECS.forearmRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('r_elbow'),
          PUPPYT_REST_VECS.forearmRDeg,
          px,
          py
        );
        break;
      }

      case 'forearmL': {
        jointId = 'l_elbow';
        const dist = vecLen(lElb.x, lElb.y, lWrs.x, lWrs.y);
        const deg = vecAngleDeg(lElb.x, lElb.y, lWrs.x, lWrs.y);
        matrix = composeBoneMatrix(
          lElb.x,
          lElb.y,
          deg,
          dist / PUPPYT_REST_VECS.forearmLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('l_elbow'),
          PUPPYT_REST_VECS.forearmLDeg,
          px,
          py
        );
        break;
      }

      case 'handR': {
        jointId = 'r_wrist';
        const dist = vecLen(rWrs.x, rWrs.y, rWrs.endX, rWrs.endY);
        const deg = vecAngleDeg(rWrs.x, rWrs.y, rWrs.endX, rWrs.endY);
        matrix = composeBoneMatrix(
          rWrs.x,
          rWrs.y,
          deg,
          dist / PUPPYT_REST_VECS.handLen,
          PUPPYT_TO_EVOLVED_SCALE * w('r_wrist'),
          PUPPYT_REST_VECS.handDeg,
          px,
          py
        );
        break;
      }

      case 'handL': {
        jointId = 'l_wrist';
        const dist = vecLen(lWrs.x, lWrs.y, lWrs.endX, lWrs.endY);
        const deg = vecAngleDeg(lWrs.x, lWrs.y, lWrs.endX, lWrs.endY);
        matrix = composeBoneMatrix(
          lWrs.x,
          lWrs.y,
          deg,
          dist / PUPPYT_REST_VECS.handLen,
          PUPPYT_TO_EVOLVED_SCALE * w('l_wrist'),
          PUPPYT_REST_VECS.handDeg,
          px,
          py
        );
        break;
      }

      case 'femurR': {
        jointId = 'r_hip';
        const dist = vecLen(rHip.x, rHip.y, rKne.x, rKne.y);
        const deg = vecAngleDeg(rHip.x, rHip.y, rKne.x, rKne.y);
        matrix = composeBoneMatrix(
          rHip.x,
          rHip.y,
          deg,
          dist / PUPPYT_REST_VECS.femurRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('r_hip'),
          PUPPYT_REST_VECS.femurRDeg,
          px,
          py
        );
        break;
      }

      case 'femurL': {
        jointId = 'l_hip';
        const dist = vecLen(lHip.x, lHip.y, lKne.x, lKne.y);
        const deg = vecAngleDeg(lHip.x, lHip.y, lKne.x, lKne.y);
        matrix = composeBoneMatrix(
          lHip.x,
          lHip.y,
          deg,
          dist / PUPPYT_REST_VECS.femurLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('l_hip'),
          PUPPYT_REST_VECS.femurLDeg,
          px,
          py
        );
        break;
      }

      case 'shinR': {
        jointId = 'r_knee';
        const dist = vecLen(rKne.x, rKne.y, rAnk.x, rAnk.y);
        const deg = vecAngleDeg(rKne.x, rKne.y, rAnk.x, rAnk.y);
        matrix = composeBoneMatrix(
          rKne.x,
          rKne.y,
          deg,
          dist / PUPPYT_REST_VECS.shinRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('r_knee'),
          PUPPYT_REST_VECS.shinRDeg,
          px,
          py
        );
        break;
      }

      case 'shinL': {
        jointId = 'l_knee';
        const dist = vecLen(lKne.x, lKne.y, lAnk.x, lAnk.y);
        const deg = vecAngleDeg(lKne.x, lKne.y, lAnk.x, lAnk.y);
        matrix = composeBoneMatrix(
          lKne.x,
          lKne.y,
          deg,
          dist / PUPPYT_REST_VECS.shinLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('l_knee'),
          PUPPYT_REST_VECS.shinLDeg,
          px,
          py
        );
        break;
      }

      case 'footR': {
        jointId = 'r_ankle';
        const dist = vecLen(rAnk.x, rAnk.y, rAnk.endX, rAnk.endY);
        const deg = vecAngleDeg(rAnk.x, rAnk.y, rAnk.endX, rAnk.endY);
        matrix = composeBoneMatrix(
          rAnk.x,
          rAnk.y,
          deg,
          dist / PUPPYT_REST_VECS.footRLen,
          PUPPYT_TO_EVOLVED_SCALE * w('r_ankle'),
          PUPPYT_REST_VECS.footRDeg,
          px,
          py
        );
        break;
      }

      case 'footL': {
        jointId = 'l_ankle';
        const dist = vecLen(lAnk.x, lAnk.y, lAnk.endX, lAnk.endY);
        const deg = vecAngleDeg(lAnk.x, lAnk.y, lAnk.endX, lAnk.endY);
        matrix = composeBoneMatrix(
          lAnk.x,
          lAnk.y,
          deg,
          dist / PUPPYT_REST_VECS.footLLen,
          PUPPYT_TO_EVOLVED_SCALE * w('l_ankle'),
          PUPPYT_REST_VECS.footLDeg,
          px,
          py
        );
        break;
      }
    }

    // Dynamic Z-order: larger drawOrder renders closer to viewer (later in SVG DOM),
    // strictly preserving per-side Backshoulder < Shoulderswivel < Ribcage from Puppyt.
    let drawOrder = 100 - asset.pieceIndex;

    // Enforce strict shoulder-girdle depth invariant on both sides:
    // Backshoulder (rear) < Shoulderswivel (mid) < Ribcage (front)
    if (asset.nodeId === 'braceL' && asset.name === 'Backshoulder') drawOrder = 60;
    else if (asset.nodeId === 'swivelL') drawOrder = 61;
    else if (asset.nodeId === 'ribL') drawOrder = 62;
    else if (asset.nodeId === 'braceR' && asset.name === 'Backshoulder') drawOrder = 63;
    else if (asset.nodeId === 'swivelR') drawOrder = 64;
    else if (asset.nodeId === 'ribR') drawOrder = 65;

    // Prioritize forward-projected arm or leg bilaterally
    if (
      asset.nodeId === 'humerusL' ||
      asset.nodeId === 'forearmL' ||
      asset.nodeId === 'handL' ||
      asset.nodeId === 'acromionL'
    ) {
      drawOrder += armFront === 'left' ? 18 : 0;
    } else if (
      asset.nodeId === 'humerusR' ||
      asset.nodeId === 'forearmR' ||
      asset.nodeId === 'handR' ||
      asset.nodeId === 'acromionR'
    ) {
      drawOrder += armFront === 'right' ? 18 : 0;
    } else if (
      asset.nodeId === 'femurL' ||
      asset.nodeId === 'shinL' ||
      asset.nodeId === 'footL'
    ) {
      drawOrder += legFront === 'left' ? 14 : 0;
    } else if (
      asset.nodeId === 'femurR' ||
      asset.nodeId === 'shinR' ||
      asset.nodeId === 'footR'
    ) {
      drawOrder += legFront === 'right' ? 14 : 0;
    }

    return {
      key: asset.key,
      asset,
      jointId,
      matrix,
      matrixCss: formatMatrixCss(matrix),
      drawOrder,
    };
  });

  return renders.sort((a, b) => a.drawOrder - b.drawOrder);
}

/**
 * Computes Puppyt's underlying digital kinematic model (bone vectors, skull triangle,
 * pelvic bar, rib tips, closed-chain shoulder bond triangle with strain detection, and glow nodes)
 * positioned cleanly under the purple skeleton.
 */
export function computeDigitalModel(
  state: ArmatureState,
  computed: Record<JointId, ComputedJoint>
): DigitalModelData {
  const { acromionR, acromionL, strainedR, strainedL } = computeShoulderAcromionLandmarks(computed);

  const waist = computed.waist;
  const navel = computed.navel;
  const torso = computed.torso;
  const collar = computed.collar;
  const neck = computed.neck;
  const head = computed.head;

  const rShd = computed.r_shoulder;
  const rElb = computed.r_elbow;
  const rWrs = computed.r_wrist;
  const lShd = computed.l_shoulder;
  const lElb = computed.l_elbow;
  const lWrs = computed.l_wrist;

  const rHip = computed.r_hip;
  const rKne = computed.r_knee;
  const rAnk = computed.r_ankle;
  const lHip = computed.l_hip;
  const lKne = computed.l_knee;
  const lAnk = computed.l_ankle;

  // Transform Puppyt's skull triangle (temples + chinTip) through head's affine transform
  const headLen = vecLen(head.x, head.y, head.endX, head.endY);
  const headDeg = vecAngleDeg(head.x, head.y, head.endX, head.endY);
  const headMat = composeBoneMatrix(
    head.x,
    head.y,
    headDeg,
    headLen / PUPPYT_REST_VECS.headLen,
    PUPPYT_TO_EVOLVED_SCALE * state.joints.head.scaleWidth,
    PUPPYT_REST_VECS.headDeg,
    PUPPYT_LANDMARKS.head[0],
    PUPPYT_LANDMARKS.head[1]
  );

  const templeR = applyAffine(headMat, PUPPYT_LANDMARKS.skullTempleR[0], PUPPYT_LANDMARKS.skullTempleR[1]);
  const templeL = applyAffine(headMat, PUPPYT_LANDMARKS.skullTempleL[0], PUPPYT_LANDMARKS.skullTempleL[1]);
  const chinTip = applyAffine(headMat, PUPPYT_LANDMARKS.chinTip[0], PUPPYT_LANDMARKS.chinTip[1]);

  // Rib flare tips (right and left costal tips around sternum/thorax)
  const tToNx = neck.x - torso.x;
  const tToNy = neck.y - torso.y;
  const torsoAxisLen = Math.hypot(tToNx, tToNy) || 1;
  const perpX = -tToNy / torsoAxisLen;
  const perpY = tToNx / torsoAxisLen;
  const ribReach = 64 * state.joints.torso.scaleWidth;
  const ribTipR = {
    x: torso.x + tToNx * 0.42 - perpX * ribReach,
    y: torso.y + tToNy * 0.42 - perpY * ribReach,
  };
  const ribTipL = {
    x: torso.x + tToNx * 0.42 + perpX * ribReach,
    y: torso.y + tToNy * 0.42 + perpY * ribReach,
  };

  const segments: DigitalModelSegment[] = [
    // Axial spine
    { key: 'dig-waist-navel', x1: waist.x, y1: waist.y, x2: navel.x, y2: navel.y, kind: 'primary' },
    { key: 'dig-navel-torso', x1: navel.x, y1: navel.y, x2: torso.x, y2: torso.y, kind: 'primary' },
    { key: 'dig-torso-collar', x1: torso.x, y1: torso.y, x2: collar.x, y2: collar.y, kind: 'primary' },
    { key: 'dig-collar-neck', x1: collar.x, y1: collar.y, x2: neck.x, y2: neck.y, kind: 'primary' },
    { key: 'dig-neck-head', x1: neck.x, y1: neck.y, x2: head.x, y2: head.y, kind: 'primary' },
    { key: 'dig-head-crown', x1: head.x, y1: head.y, x2: head.endX, y2: head.endY, kind: 'primary' },

    // Puppyt Skull Triangle
    { key: 'dig-skull-top', x1: templeR.x, y1: templeR.y, x2: templeL.x, y2: templeL.y, kind: 'skull' },
    { key: 'dig-skull-r', x1: templeR.x, y1: templeR.y, x2: chinTip.x, y2: chinTip.y, kind: 'skull' },
    { key: 'dig-skull-l', x1: templeL.x, y1: templeL.y, x2: chinTip.x, y2: chinTip.y, kind: 'skull' },

    // Pelvis bar & hip struts
    { key: 'dig-pelvis-bar', x1: rHip.x, y1: rHip.y, x2: lHip.x, y2: lHip.y, kind: 'pelvis' },
    { key: 'dig-waist-rhip', x1: waist.x, y1: waist.y, x2: rHip.x, y2: rHip.y, kind: 'pelvis' },
    { key: 'dig-waist-lhip', x1: waist.x, y1: waist.y, x2: lHip.x, y2: lHip.y, kind: 'pelvis' },

    // Rib flare guides
    { key: 'dig-rib-r', x1: torso.x, y1: torso.y, x2: ribTipR.x, y2: ribTipR.y, kind: 'rib' },
    { key: 'dig-rib-l', x1: torso.x, y1: torso.y, x2: ribTipL.x, y2: ribTipL.y, kind: 'rib' },

    // Closed-chain shoulder girdle (swivel -> acromion -> shoulder, neck -> acromion tendon bond)
    { key: 'dig-swivel-r', x1: torso.x, y1: torso.y, x2: acromionR.x, y2: acromionR.y, kind: 'ghost' },
    { key: 'dig-swivel-l', x1: torso.x, y1: torso.y, x2: acromionL.x, y2: acromionL.y, kind: 'ghost' },
    {
      key: 'dig-bond-r',
      x1: neck.x,
      y1: neck.y,
      x2: acromionR.x,
      y2: acromionR.y,
      kind: strainedR ? 'strained' : 'primary',
    },
    {
      key: 'dig-bond-l',
      x1: neck.x,
      y1: neck.y,
      x2: acromionL.x,
      y2: acromionL.y,
      kind: strainedL ? 'strained' : 'primary',
    },
    { key: 'dig-acro-rshd', x1: acromionR.x, y1: acromionR.y, x2: rShd.x, y2: rShd.y, kind: 'primary' },
    { key: 'dig-acro-lshd', x1: acromionL.x, y1: acromionL.y, x2: lShd.x, y2: lShd.y, kind: 'primary' },

    // Arms & hands
    { key: 'dig-r-uarm', x1: rShd.x, y1: rShd.y, x2: rElb.x, y2: rElb.y, kind: 'primary' },
    { key: 'dig-r-farm', x1: rElb.x, y1: rElb.y, x2: rWrs.x, y2: rWrs.y, kind: 'primary' },
    { key: 'dig-r-hand', x1: rWrs.x, y1: rWrs.y, x2: rWrs.endX, y2: rWrs.endY, kind: 'primary' },
    { key: 'dig-l-uarm', x1: lShd.x, y1: lShd.y, x2: lElb.x, y2: lElb.y, kind: 'primary' },
    { key: 'dig-l-farm', x1: lElb.x, y1: lElb.y, x2: lWrs.x, y2: lWrs.y, kind: 'primary' },
    { key: 'dig-l-hand', x1: lWrs.x, y1: lWrs.y, x2: lWrs.endX, y2: lWrs.endY, kind: 'primary' },

    // Legs & feet
    { key: 'dig-r-thigh', x1: rHip.x, y1: rHip.y, x2: rKne.x, y2: rKne.y, kind: 'primary' },
    { key: 'dig-r-shin', x1: rKne.x, y1: rKne.y, x2: rAnk.x, y2: rAnk.y, kind: 'primary' },
    { key: 'dig-r-foot', x1: rAnk.x, y1: rAnk.y, x2: rAnk.endX, y2: rAnk.endY, kind: 'primary' },
    { key: 'dig-l-thigh', x1: lHip.x, y1: lHip.y, x2: lKne.x, y2: lKne.y, kind: 'primary' },
    { key: 'dig-l-shin', x1: lKne.x, y1: lKne.y, x2: lAnk.x, y2: lAnk.y, kind: 'primary' },
    { key: 'dig-l-foot', x1: lAnk.x, y1: lAnk.y, x2: lAnk.endX, y2: lAnk.endY, kind: 'primary' },
  ];

  const dots: DigitalModelDot[] = [
    { key: 'dot-acro-r', x: acromionR.x, y: acromionR.y, radius: 5, strained: strainedR, ghost: false },
    { key: 'dot-acro-l', x: acromionL.x, y: acromionL.y, radius: 5, strained: strainedL, ghost: false },
    { key: 'dot-rib-r', x: ribTipR.x, y: ribTipR.y, radius: 4, strained: false, ghost: true },
    { key: 'dot-rib-l', x: ribTipL.x, y: ribTipL.y, radius: 4, strained: false, ghost: true },
    { key: 'dot-temple-r', x: templeR.x, y: templeR.y, radius: 4, strained: false, ghost: false },
    { key: 'dot-temple-l', x: templeL.x, y: templeL.y, radius: 4, strained: false, ghost: false },
    { key: 'dot-chin', x: chinTip.x, y: chinTip.y, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-crown', x: head.endX, y: head.endY, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-hand-r', x: rWrs.endX, y: rWrs.endY, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-hand-l', x: lWrs.endX, y: lWrs.endY, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-foot-r', x: rAnk.endX, y: rAnk.endY, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-foot-l', x: lAnk.endX, y: lAnk.endY, radius: 4.5, strained: false, ghost: false },
  ];

  return {
    acromionR,
    acromionL,
    strainedR,
    strainedL,
    segments,
    dots,
  };
}
