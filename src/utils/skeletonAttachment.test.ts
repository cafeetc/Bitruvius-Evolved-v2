import test from 'node:test';
import assert from 'node:assert/strict';
import { PUPPYT_LANDMARKS } from '../data/skeletonRig';
import {
  CHILD_PROPORTION_SPECS,
  JOINT_SPECS,
  PUPPYT_TO_EVOLVED_SCALE,
  computeArmature,
  createPosePreset,
} from './kinematics';
import {
  applyAffine,
  buildSkeletonPieceRenders,
  computeDigitalModel,
} from './skeletonAttachment';
import { PosePresetId } from '../types';

test('all 33 skeleton pieces compute finite affine matrices across all 4 Evolved presets', () => {
  const presets: PosePresetId[] = ['tpose', 'vitruvian', 'contrapposto', 'striding'];

  for (const preset of presets) {
    const state = createPosePreset(preset);
    const computed = computeArmature(state);
    const pieces = buildSkeletonPieceRenders(state, computed);

    assert.equal(pieces.length, 33, `${preset} should emit all 33 skeleton pieces`);
    for (const p of pieces) {
      assert.equal(p.matrix.length, 6);
      for (const v of p.matrix) {
        assert.ok(Number.isFinite(v), `${preset} piece ${p.key} has non-finite matrix value`);
      }
      assert.ok(p.asset.assetUrl.startsWith('/assets/skeleton/'));
    }
  }
});

test('skeleton limb, pelvis, and spine pivots align tightly onto Evolved computed joints', () => {
  const state = createPosePreset('vitruvian');
  const computed = computeArmature(state);
  const pieces = buildSkeletonPieceRenders(state, computed);
  const byKey = new Map(pieces.map((p) => [p.key, p]));

  const assertClose = (
    actual: { x: number; y: number },
    expected: { x: number; y: number },
    tolPx: number,
    label: string
  ) => {
    const err = Math.hypot(actual.x - expected.x, actual.y - expected.y);
    assert.ok(err <= tolPx, `${label} alignment error ${err.toFixed(3)}px exceeds ${tolPx}px`);
  };

  // Lumbar bottom sits at waist, top meets torso
  const lumbar = byKey.get('lumbar-upperspine')!;
  assertClose(
    applyAffine(lumbar.matrix, ...PUPPYT_LANDMARKS.lumbar),
    computed.waist,
    0.05,
    'lumbar bottom -> waist'
  );
  assertClose(
    applyAffine(lumbar.matrix, ...PUPPYT_LANDMARKS.thorax),
    computed.torso,
    0.05,
    'lumbar top -> torso'
  );

  // Pelvis acetabular cups align tightly to Puppyt adult r_hip and l_hip sockets
  const hipR = byKey.get('hipR-pelvis')!;
  const hipL = byKey.get('hipL-pelvis')!;
  assertClose(
    applyAffine(hipR.matrix, ...PUPPYT_LANDMARKS.femurR),
    computed.r_hip,
    0.5,
    'pelvis right socket -> r_hip'
  );
  assertClose(
    applyAffine(hipL.matrix, ...PUPPYT_LANDMARKS.femurL),
    computed.l_hip,
    0.5,
    'pelvis left socket -> l_hip'
  );

  // Upper & lower limbs align end-to-end
  const humerusR = byKey.get('humerusR-humerus')!;
  assertClose(
    applyAffine(humerusR.matrix, ...PUPPYT_LANDMARKS.humerusR),
    computed.r_shoulder,
    0.05,
    'humerusR -> r_shoulder'
  );
  assertClose(
    applyAffine(humerusR.matrix, ...PUPPYT_LANDMARKS.forearmR),
    computed.r_elbow,
    0.05,
    'humerusR end -> r_elbow'
  );

  const shinL = byKey.get('shinL-tibia')!;
  assertClose(
    applyAffine(shinL.matrix, ...PUPPYT_LANDMARKS.shinL),
    computed.l_knee,
    0.05,
    'shinL -> l_knee'
  );
  assertClose(
    applyAffine(shinL.matrix, ...PUPPYT_LANDMARKS.footL),
    computed.l_ankle,
    0.05,
    'shinL end -> l_ankle'
  );

  // Foot sole tips track Evolved ankle extension points
  const footR = byKey.get('footR-foot')!;
  assertClose(
    applyAffine(footR.matrix, ...PUPPYT_LANDMARKS.toeR),
    { x: computed.r_ankle.endX, y: computed.r_ankle.endY },
    0.05,
    'footR toe -> r_ankle.end'
  );
});

test('active rig uses isotropic 0.14 Puppyt adult proportions and preserves hidden child proportions', () => {
  const tpose = createPosePreset('tpose');
  const computed = computeArmature(tpose);
  const pieces = buildSkeletonPieceRenders(tpose, computed);

  // Every bone matrix scale magnitude (col0 & col1 norms) matches PUPPYT_TO_EVOLVED_SCALE (~0.14) isotropically
  for (const key of [
    'lumbar-upperspine',
    'thorax-upperspine',
    'neck-v',
    'head-front',
    'humerusR-humerus',
    'forearmL-radius',
    'femurR-femur',
    'shinL-tibia',
    'footR-foot',
    'hipR-pelvis',
  ]) {
    const piece = pieces.find((p) => p.key === key)!;
    const scaleX = Math.hypot(piece.matrix[0], piece.matrix[1]);
    const scaleY = Math.hypot(piece.matrix[2], piece.matrix[3]);
    assert.ok(
      Math.abs(scaleX - PUPPYT_TO_EVOLVED_SCALE) < 0.002,
      `${key} X scale ${scaleX.toFixed(5)} drifted from isotropic ${PUPPYT_TO_EVOLVED_SCALE}`
    );
    assert.ok(
      Math.abs(scaleY - PUPPYT_TO_EVOLVED_SCALE) < 0.002,
      `${key} Y scale ${scaleY.toFixed(5)} drifted from isotropic ${PUPPYT_TO_EVOLVED_SCALE}`
    );
  }

  // Vitruvian adult invariant: T-pose armspan vs standing crown-to-sole height within 3%
  const armspan = Math.abs(computed.l_wrist.endX - computed.r_wrist.endX);
  const ankleMidY = (computed.r_ankle.y + computed.l_ankle.y) / 2;
  const soleY = ankleMidY + 80; // ankle to heel/sole baseline
  const standingHeight = soleY - computed.head.endY;
  const ratio = armspan / standingHeight;
  assert.ok(
    Math.abs(ratio - 1.0) <= 0.03,
    `Expected Vitruvian adult armspan/height ~1.0 (±3%), got ${ratio.toFixed(4)}`
  );

  // Child proportions remain preserved intact with all 18 joints and distinct shorter femur
  assert.equal(CHILD_PROPORTION_SPECS.length, 18);
  assert.equal(JOINT_SPECS.length, 18);
  const childKnee = CHILD_PROPORTION_SPECS.find((j) => j.id === 'r_knee')!;
  const adultKnee = JOINT_SPECS.find((j) => j.id === 'r_knee')!;
  assert.equal(childKnee.lengthPx, 225);
  assert.ok(adultKnee.lengthPx > childKnee.lengthPx, 'Adult Puppyt femur must be longer than child spec');
});

test('strict shoulder girdle depth invariant holds (Backshoulder < Shoulderswivel < Ribcage)', () => {
  for (const preset of ['tpose', 'vitruvian', 'contrapposto', 'striding'] as const) {
    const state = createPosePreset(preset);
    const computed = computeArmature(state);
    const pieces = buildSkeletonPieceRenders(state, computed);
    const idx = new Map(pieces.map((p, i) => [p.key, i]));

    assert.ok(
      idx.get('braceL-backshoulder')! < idx.get('swivelL-shoulderswivel')! &&
        idx.get('swivelL-shoulderswivel')! < idx.get('ribL-ribcage')!,
      `${preset}: Left shoulder girdle depth invariant violated`
    );
    assert.ok(
      idx.get('braceR-backshoulder')! < idx.get('swivelR-shoulderswivel')! &&
        idx.get('swivelR-shoulderswivel')! < idx.get('ribR-ribcage')!,
      `${preset}: Right shoulder girdle depth invariant violated`
    );
  }
});

test('non-uniform bone scaling updates piece transforms smoothly', () => {
  const base = createPosePreset('tpose');
  const scaled = createPosePreset('tpose');
  scaled.joints.r_shoulder.scaleLength = 1.6;
  scaled.joints.r_shoulder.scaleWidth = 1.4;

  const baseComp = computeArmature(base);
  const scaledComp = computeArmature(scaled);

  const baseHumerus = buildSkeletonPieceRenders(base, baseComp).find(
    (p) => p.key === 'humerusR-humerus'
  )!;
  const scaledHumerus = buildSkeletonPieceRenders(scaled, scaledComp).find(
    (p) => p.key === 'humerusR-humerus'
  )!;

  const baseDet = Math.abs(
    baseHumerus.matrix[0] * baseHumerus.matrix[3] -
      baseHumerus.matrix[1] * baseHumerus.matrix[2]
  );
  const scaledDet = Math.abs(
    scaledHumerus.matrix[0] * scaledHumerus.matrix[3] -
      scaledHumerus.matrix[1] * scaledHumerus.matrix[2]
  );

  // Expected area ratio = 1.6 * 1.4 = 2.24
  assert.ok(
    Math.abs(scaledDet / baseDet - 2.24) < 0.05,
    `Expected determinant scale ratio ~2.24, got ${(scaledDet / baseDet).toFixed(3)}`
  );
});

test('digital model computes skull triangle, closed-chain shoulder bond, and strain detection', () => {
  const state = createPosePreset('tpose');
  const computed = computeArmature(state);
  const digital = computeDigitalModel(state, computed);

  assert.equal(digital.strainedR, false);
  assert.equal(digital.strainedL, false);
  assert.ok(digital.segments.some((s) => s.kind === 'skull'));
  assert.ok(digital.segments.some((s) => s.kind === 'pelvis'));
  assert.ok(digital.segments.some((s) => s.kind === 'rib'));
  assert.ok(digital.dots.length >= 10);

  // Extreme collar length elongation strains the neck <-> acromion bond
  const strainedState = createPosePreset('tpose');
  strainedState.joints.collar.scaleLength = 2.0;
  const strainedComp = computeArmature(strainedState);
  const strainedDigital = computeDigitalModel(strainedState, strainedComp);
  assert.equal(strainedDigital.strainedR, true);
  assert.equal(strainedDigital.strainedL, true);
  assert.ok(strainedDigital.segments.some((s) => s.kind === 'strained'));
});
