import {
  HEAD_TURN_ASSETS,
  HEAD_TURN_BOXES,
  PUPPYT_LANDMARKS,
  PUPPYT_SKELETON_PIECES,
  SkeletonPieceAsset,
} from '../data/skeletonRig';
import { ArmatureState, ComputedJoint, JointId } from '../types';
import {
  Affine2D,
  PUPPYT_TO_EVOLVED_SCALE,
  applyAffine,
  composeBoneMatrix,
  mulAffine,
  normalizeAngleDeg,
} from './kinematics';

export { applyAffine, composeBoneMatrix, mulAffine, type Affine2D };

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

function formatMatrixCss(m: Affine2D): string {
  return `matrix(${m[0].toFixed(5)} ${m[1].toFixed(5)} ${m[2].toFixed(5)} ${m[3].toFixed(5)} ${m[4].toFixed(3)} ${m[5].toFixed(3)})`;
}

function computeBilateralPriority(computed: Record<JointId, ComputedJoint>): {
  armFront: 'left' | 'right';
  legFront: 'left' | 'right';
} {
  const pelvisX = computed.pelvis.x;
  const pelvisY = computed.pelvis.y;

  const rLegScore =
    Math.abs(normalizeAngleDeg(computed.shinR.localAngle)) * 0.65 +
    Math.max(0, (computed.footR.x - pelvisX) * 0.45) +
    Math.max(0, (pelvisY + 420 - computed.footR.y) * 0.25);

  const lLegScore =
    Math.abs(normalizeAngleDeg(computed.shinL.localAngle)) * 0.65 +
    Math.max(0, (pelvisX - computed.footL.x) * 0.45) +
    Math.max(0, (pelvisY + 420 - computed.footL.y) * 0.25);

  const legDiff = Math.abs(lLegScore - rLegScore);
  const legFront: 'left' | 'right' =
    legDiff < 1.5 ? 'left' : lLegScore > rLegScore ? 'left' : 'right';

  const thoraxX = computed.thorax.x;
  const thoraxY = computed.thorax.y;

  const rArmScore =
    Math.abs(normalizeAngleDeg(computed.forearmR.localAngle)) * 0.65 +
    Math.max(0, (computed.handR.x - thoraxX) * 0.55) +
    Math.max(0, (thoraxY - computed.handR.y) * 0.15);

  const lArmScore =
    Math.abs(normalizeAngleDeg(computed.forearmL.localAngle)) * 0.65 +
    Math.max(0, (thoraxX - computed.handL.x) * 0.55) +
    Math.max(0, (thoraxY - computed.handL.y) * 0.15);

  const armDiff = Math.abs(lArmScore - rArmScore);
  const armFront: 'left' | 'right' =
    armDiff < 1.5 ? 'left' : lArmScore > rArmScore ? 'left' : 'right';

  return { armFront, legFront };
}

/**
 * Exposes closed-chain acromion positions and tendon strain flags computed on the 43-joint rig.
 */
export function computeShoulderAcromionLandmarks(
  computed: Record<JointId, ComputedJoint>
): {
  acromionR: { x: number; y: number };
  acromionL: { x: number; y: number };
  strainedR: boolean;
  strainedL: boolean;
} {
  return {
    acromionR: { x: computed.acromionR.x, y: computed.acromionR.y },
    acromionL: { x: computed.acromionL.x, y: computed.acromionL.y },
    strainedR: Boolean(computed.braceR.isStrained),
    strainedL: Boolean(computed.braceL.isStrained),
  };
}

/**
 * Computes affine world transforms and Z-sorted draw list for all 33 Puppyt purple skeleton PNGs
 * mounted directly onto Bitruvius-Evolved's canonical 43-joint kinematic hierarchy.
 */
export function buildSkeletonPieceRenders(
  state: ArmatureState,
  computed: Record<JointId, ComputedJoint>
): SkeletonPieceRender[] {
  const { armFront, legFront } = computeBilateralPriority(computed);
  const headTurn = state.headTurn ?? 0;

  const renders: SkeletonPieceRender[] = PUPPYT_SKELETON_PIECES.map((rawAsset) => {
    const headBox = HEAD_TURN_BOXES[headTurn];
    const asset =
      rawAsset.nodeId === 'head'
        ? {
            ...rawAsset,
            assetUrl: HEAD_TURN_ASSETS[headTurn],
            x: headBox.x,
            y: headBox.y,
            w: headBox.w,
            h: headBox.h,
          }
        : rawAsset;

    const jointId: JointId = asset.nodeId;
    const matrix = computed[jointId].boneMatrix;

    // Dynamic Z-order: larger drawOrder renders closer to viewer (later in SVG DOM),
    // strictly preserving per-side Backshoulder < Shoulderswivel < Ribcage from Puppyt.
    let drawOrder = 100 - asset.pieceIndex;

    if (asset.nodeId === 'braceL' && asset.name === 'Backshoulder') drawOrder = 60;
    else if (asset.nodeId === 'swivelL') drawOrder = 61;
    else if (asset.nodeId === 'ribL') drawOrder = 62;
    else if (asset.nodeId === 'braceR' && asset.name === 'Backshoulder') drawOrder = 63;
    else if (asset.nodeId === 'swivelR') drawOrder = 64;
    else if (asset.nodeId === 'ribR') drawOrder = 65;

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
 * Computes Puppyt's underlying digital kinematic model (43-joint bone vectors, skull triangle,
 * bilateral pelvic plates & iliac crests, independent rib guides, closed-chain shoulder bond triangle
 * with live strain detection, and hand/foot digit guides) positioned cleanly under the skeleton.
 */
export function computeDigitalModel(
  _state: ArmatureState,
  computed: Record<JointId, ComputedJoint>
): DigitalModelData {
  const { acromionR, acromionL, strainedR, strainedL } =
    computeShoulderAcromionLandmarks(computed);

  const pelvis = computed.pelvis;
  const lumbar = computed.lumbar;
  const thorax = computed.thorax;
  const ribR = computed.ribR;
  const ribL = computed.ribL;
  const neck = computed.neck;
  const head = computed.head;
  const lip = computed.lip;
  const chin = computed.chinTip;

  const swivelR = computed.swivelR;
  const swivelTipR = computed.swivelTipR;
  const braceR = computed.braceR;
  const wingR = computed.wingR;
  const humerusR = computed.humerusR;
  const forearmR = computed.forearmR;
  const handR = computed.handR;
  const thumbR = computed.thumbR;
  const thumbTipR = computed.thumbTipR;
  const fingerR = computed.fingerR;
  const fingerTipR = computed.fingerTipR;

  const swivelL = computed.swivelL;
  const swivelTipL = computed.swivelTipL;
  const braceL = computed.braceL;
  const wingL = computed.wingL;
  const humerusL = computed.humerusL;
  const forearmL = computed.forearmL;
  const handL = computed.handL;
  const thumbL = computed.thumbL;
  const thumbTipL = computed.thumbTipL;
  const fingerL = computed.fingerL;
  const fingerTipL = computed.fingerTipL;

  const hipR = computed.hipR;
  const femurR = computed.femurR;
  const shinR = computed.shinR;
  const footR = computed.footR;
  const toeR = computed.toeR;

  const hipL = computed.hipL;
  const femurL = computed.femurL;
  const shinL = computed.shinL;
  const footL = computed.footL;
  const toeL = computed.toeL;

  const templeR = applyAffine(
    head.boneMatrix,
    PUPPYT_LANDMARKS.skullTempleR[0],
    PUPPYT_LANDMARKS.skullTempleR[1]
  );
  const templeL = applyAffine(
    head.boneMatrix,
    PUPPYT_LANDMARKS.skullTempleL[0],
    PUPPYT_LANDMARKS.skullTempleL[1]
  );

  const crestR = applyAffine(
    hipR.boneMatrix,
    PUPPYT_LANDMARKS.hipRTip[0],
    PUPPYT_LANDMARKS.hipRTip[1]
  );
  const crestL = applyAffine(
    hipL.boneMatrix,
    PUPPYT_LANDMARKS.hipLTip[0],
    PUPPYT_LANDMARKS.hipLTip[1]
  );

  const segments: DigitalModelSegment[] = [
    // Dual Spine & Head/Jaw chain
    { key: 'dig-lumbar-thorax', x1: lumbar.x, y1: lumbar.y, x2: thorax.x, y2: thorax.y, kind: 'primary' },
    { key: 'dig-thorax-neck', x1: thorax.x, y1: thorax.y, x2: neck.x, y2: neck.y, kind: 'primary' },
    { key: 'dig-neck-head', x1: neck.x, y1: neck.y, x2: head.x, y2: head.y, kind: 'primary' },
    { key: 'dig-head-crown', x1: head.x, y1: head.y, x2: head.endX, y2: head.endY, kind: 'primary' },
    { key: 'dig-head-lip', x1: head.x, y1: head.y, x2: lip.x, y2: lip.y, kind: 'skull' },
    { key: 'dig-lip-chin', x1: lip.x, y1: lip.y, x2: chin.x, y2: chin.y, kind: 'skull' },

    // Puppyt Skull Triangle (Temples + live articulated Chin)
    { key: 'dig-skull-top', x1: templeR.x, y1: templeR.y, x2: templeL.x, y2: templeL.y, kind: 'skull' },
    { key: 'dig-skull-r', x1: templeR.x, y1: templeR.y, x2: chin.x, y2: chin.y, kind: 'skull' },
    { key: 'dig-skull-l', x1: templeL.x, y1: templeL.y, x2: chin.x, y2: chin.y, kind: 'skull' },

    // Independent Bilateral Pelvic Swivel Plates & Iliac Crests
    { key: 'dig-pelvis-bar', x1: femurR.x, y1: femurR.y, x2: femurL.x, y2: femurL.y, kind: 'pelvis' },
    { key: 'dig-pelvis-rhip', x1: pelvis.x, y1: pelvis.y, x2: femurR.x, y2: femurR.y, kind: 'pelvis' },
    { key: 'dig-pelvis-lhip', x1: pelvis.x, y1: pelvis.y, x2: femurL.x, y2: femurL.y, kind: 'pelvis' },
    { key: 'dig-pelvis-crest-r', x1: hipR.x, y1: hipR.y, x2: crestR.x, y2: crestR.y, kind: 'pelvis' },
    { key: 'dig-pelvis-crest-l', x1: hipL.x, y1: hipL.y, x2: crestL.x, y2: crestL.y, kind: 'pelvis' },
    { key: 'dig-crest-rfemur', x1: crestR.x, y1: crestR.y, x2: femurR.x, y2: femurR.y, kind: 'pelvis' },
    { key: 'dig-crest-lfemur', x1: crestL.x, y1: crestL.y, x2: femurL.x, y2: femurL.y, kind: 'pelvis' },

    // Independent Articulated Ribcage R/L
    { key: 'dig-rib-r', x1: ribR.x, y1: ribR.y, x2: ribR.endX, y2: ribR.endY, kind: 'rib' },
    { key: 'dig-rib-l', x1: ribL.x, y1: ribL.y, x2: ribL.endX, y2: ribL.endY, kind: 'rib' },

    // Closed-Chain Shoulder Girdle (swivel -> acromion -> humerus, brace tendon -> acromion, dorsal wings)
    { key: 'dig-swivel-r', x1: swivelR.x, y1: swivelR.y, x2: acromionR.x, y2: acromionR.y, kind: 'ghost' },
    { key: 'dig-swivel-l', x1: swivelL.x, y1: swivelL.y, x2: acromionL.x, y2: acromionL.y, kind: 'ghost' },
    { key: 'dig-swiveltip-r', x1: acromionR.x, y1: acromionR.y, x2: swivelTipR.x, y2: swivelTipR.y, kind: 'ghost' },
    { key: 'dig-swiveltip-l', x1: acromionL.x, y1: acromionL.y, x2: swivelTipL.x, y2: swivelTipL.y, kind: 'ghost' },
    {
      key: 'dig-bond-r',
      x1: braceR.x,
      y1: braceR.y,
      x2: braceR.endX,
      y2: braceR.endY,
      kind: strainedR ? 'strained' : 'primary',
    },
    {
      key: 'dig-bond-l',
      x1: braceL.x,
      y1: braceL.y,
      x2: braceL.endX,
      y2: braceL.endY,
      kind: strainedL ? 'strained' : 'primary',
    },
    { key: 'dig-wing-r', x1: braceR.x, y1: braceR.y, x2: wingR.x, y2: wingR.y, kind: 'ghost' },
    { key: 'dig-wing-l', x1: braceL.x, y1: braceL.y, x2: wingL.x, y2: wingL.y, kind: 'ghost' },
    { key: 'dig-acro-rshd', x1: acromionR.x, y1: acromionR.y, x2: humerusR.x, y2: humerusR.y, kind: 'primary' },
    { key: 'dig-acro-lshd', x1: acromionL.x, y1: acromionL.y, x2: humerusL.x, y2: humerusL.y, kind: 'primary' },

    // Arms & Hand Digits
    { key: 'dig-r-uarm', x1: humerusR.x, y1: humerusR.y, x2: forearmR.x, y2: forearmR.y, kind: 'primary' },
    { key: 'dig-r-farm', x1: forearmR.x, y1: forearmR.y, x2: handR.x, y2: handR.y, kind: 'primary' },
    { key: 'dig-r-hand', x1: handR.x, y1: handR.y, x2: handR.endX, y2: handR.endY, kind: 'primary' },
    { key: 'dig-r-thumb', x1: thumbR.x, y1: thumbR.y, x2: thumbTipR.x, y2: thumbTipR.y, kind: 'ghost' },
    { key: 'dig-r-finger', x1: fingerR.x, y1: fingerR.y, x2: fingerTipR.x, y2: fingerTipR.y, kind: 'ghost' },

    { key: 'dig-l-uarm', x1: humerusL.x, y1: humerusL.y, x2: forearmL.x, y2: forearmL.y, kind: 'primary' },
    { key: 'dig-l-farm', x1: forearmL.x, y1: forearmL.y, x2: handL.x, y2: handL.y, kind: 'primary' },
    { key: 'dig-l-hand', x1: handL.x, y1: handL.y, x2: handL.endX, y2: handL.endY, kind: 'primary' },
    { key: 'dig-l-thumb', x1: thumbL.x, y1: thumbL.y, x2: thumbTipL.x, y2: thumbTipL.y, kind: 'ghost' },
    { key: 'dig-l-finger', x1: fingerL.x, y1: fingerL.y, x2: fingerTipL.x, y2: fingerTipL.y, kind: 'ghost' },

    // Legs & Feet
    { key: 'dig-r-thigh', x1: femurR.x, y1: femurR.y, x2: shinR.x, y2: shinR.y, kind: 'primary' },
    { key: 'dig-r-shin', x1: shinR.x, y1: shinR.y, x2: footR.x, y2: footR.y, kind: 'primary' },
    { key: 'dig-r-foot', x1: footR.x, y1: footR.y, x2: toeR.x, y2: toeR.y, kind: 'primary' },
    { key: 'dig-l-thigh', x1: femurL.x, y1: femurL.y, x2: shinL.x, y2: shinL.y, kind: 'primary' },
    { key: 'dig-l-shin', x1: shinL.x, y1: shinL.y, x2: footL.x, y2: footL.y, kind: 'primary' },
    { key: 'dig-l-foot', x1: footL.x, y1: footL.y, x2: toeL.x, y2: toeL.y, kind: 'primary' },
  ];

  const dots: DigitalModelDot[] = [
    { key: 'dot-acro-r', x: acromionR.x, y: acromionR.y, radius: 5, strained: strainedR, ghost: false },
    { key: 'dot-acro-l', x: acromionL.x, y: acromionL.y, radius: 5, strained: strainedL, ghost: false },
    { key: 'dot-crest-r', x: crestR.x, y: crestR.y, radius: 4, strained: false, ghost: false },
    { key: 'dot-crest-l', x: crestL.x, y: crestL.y, radius: 4, strained: false, ghost: false },
    { key: 'dot-rib-r', x: ribR.endX, y: ribR.endY, radius: 4, strained: false, ghost: true },
    { key: 'dot-rib-l', x: ribL.endX, y: ribL.endY, radius: 4, strained: false, ghost: true },
    { key: 'dot-swiveltip-r', x: swivelTipR.x, y: swivelTipR.y, radius: 3.5, strained: false, ghost: true },
    { key: 'dot-swiveltip-l', x: swivelTipL.x, y: swivelTipL.y, radius: 3.5, strained: false, ghost: true },
    { key: 'dot-wing-r', x: wingR.x, y: wingR.y, radius: 3.5, strained: false, ghost: true },
    { key: 'dot-wing-l', x: wingL.x, y: wingL.y, radius: 3.5, strained: false, ghost: true },
    { key: 'dot-temple-r', x: templeR.x, y: templeR.y, radius: 4, strained: false, ghost: false },
    { key: 'dot-temple-l', x: templeL.x, y: templeL.y, radius: 4, strained: false, ghost: false },
    { key: 'dot-chin', x: chin.x, y: chin.y, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-crown', x: head.endX, y: head.endY, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-hand-r', x: handR.endX, y: handR.endY, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-hand-l', x: handL.endX, y: handL.endY, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-foot-r', x: toeR.x, y: toeR.y, radius: 4.5, strained: false, ghost: false },
    { key: 'dot-foot-l', x: toeL.x, y: toeL.y, radius: 4.5, strained: false, ghost: false },
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
