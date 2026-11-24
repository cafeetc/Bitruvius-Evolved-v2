import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAD_TURN_ASSETS,
  HEAD_TURN_BOXES,
  PUPPYT_LANDMARKS,
  PUPPYT_SKELETON_PIECES,
} from '../data/skeletonRig';
import {
  CHILD_PROPORTION_SPECS,
  JOINT_SPECS,
  PUPPYT_TO_EVOLVED_SCALE,
  applyAffine,
  armatureToCharacterSnapshot,
  auditRigHierarchy,
  characterSnapshotToArmature,
  computeArmature,
  createPosePreset,
  mirrorPose,
  solveSpineCCDIK,
  solveTwoBoneIK,
} from './kinematics';
import {
  buildSkeletonPieceRenders,
  computeDigitalModel,
} from './skeletonAttachment';
import { JointSpec, PosePresetId } from '../types';

test('canonical 43-joint Puppyt rig passes hierarchy & topological audits with zero orphans or cycles', () => {
  assert.equal(JOINT_SPECS.length, 43);
  const report = auditRigHierarchy(JOINT_SPECS);
  assert.equal(report.valid, true);
  assert.equal(report.totalJoints, 43);
  assert.deepEqual(report.orphanNodes, []);
  assert.deepEqual(report.cycles, []);
  assert.deepEqual(report.topologicalViolations, []);
  assert.deepEqual(report.aimOrderViolations, []);
  assert.deepEqual(report.parentMismatches, []);

  // Audit flags topological violation when a child precedes its parent
  const reversed = [...JOINT_SPECS].reverse();
  const badOrderReport = auditRigHierarchy(reversed);
  assert.equal(badOrderReport.valid, false);
  assert.ok(badOrderReport.topologicalViolations.length > 0);

  // Audit flags cycles and parent mismatches
  const cyclic: JointSpec[] = JOINT_SPECS.map((s) =>
    s.id === 'pelvis' ? { ...s, parentId: 'head' } : s
  );
  const cyclicReport = auditRigHierarchy(cyclic);
  assert.equal(cyclicReport.valid, false);
  assert.ok(cyclicReport.cycles.length > 0);
  assert.ok(cyclicReport.parentMismatches.some((m) => m.id === 'pelvis'));
});

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

test('skeleton limb, pelvis, rib, girdle, and spine pivots align tightly onto 43-joint computed nodes', () => {
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

  // Lumbar bottom sits at pelvis, top meets thorax
  const lumbar = byKey.get('lumbar-upperspine')!;
  assertClose(
    applyAffine(lumbar.matrix, ...PUPPYT_LANDMARKS.lumbar),
    computed.pelvis,
    0.05,
    'lumbar bottom -> pelvis'
  );
  assertClose(
    applyAffine(lumbar.matrix, ...PUPPYT_LANDMARKS.thorax),
    computed.thorax,
    0.05,
    'lumbar top -> thorax'
  );

  // Pelvis acetabular cups align tightly to Puppyt femurR and femurL sockets
  const hipR = byKey.get('hipR-pelvis')!;
  const hipL = byKey.get('hipL-pelvis')!;
  assertClose(
    applyAffine(hipR.matrix, ...PUPPYT_LANDMARKS.femurR),
    computed.femurR,
    0.5,
    'pelvis right socket -> femurR'
  );
  assertClose(
    applyAffine(hipL.matrix, ...PUPPYT_LANDMARKS.femurL),
    computed.femurL,
    0.5,
    'pelvis left socket -> femurL'
  );

  // Upper & lower limbs align end-to-end
  const humerusR = byKey.get('humerusR-humerus')!;
  assertClose(
    applyAffine(humerusR.matrix, ...PUPPYT_LANDMARKS.humerusR),
    computed.humerusR,
    0.05,
    'humerusR -> humerusR joint'
  );
  assertClose(
    applyAffine(humerusR.matrix, ...PUPPYT_LANDMARKS.forearmR),
    computed.forearmR,
    0.05,
    'humerusR end -> forearmR'
  );

  const shinL = byKey.get('shinL-tibia')!;
  assertClose(
    applyAffine(shinL.matrix, ...PUPPYT_LANDMARKS.shinL),
    computed.shinL,
    0.05,
    'shinL -> shinL joint'
  );
  assertClose(
    applyAffine(shinL.matrix, ...PUPPYT_LANDMARKS.footL),
    computed.footL,
    0.05,
    'shinL end -> footL'
  );

  // Foot sole tips track Puppyt toeR
  const footR = byKey.get('footR-foot')!;
  assertClose(
    applyAffine(footR.matrix, ...PUPPYT_LANDMARKS.toeR),
    computed.toeR,
    0.05,
    'footR toe -> toeR'
  );
});

test('active rig uses isotropic 0.14 Puppyt adult proportions and preserves hidden child proportions', () => {
  const tpose = createPosePreset('tpose');
  const computed = computeArmature(tpose);
  const pieces = buildSkeletonPieceRenders(tpose, computed);

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
    'ribR-ribcage',
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
  const armspan = Math.abs(computed.handL.endX - computed.handR.endX);
  const ankleMidY = (computed.footR.y + computed.footL.y) / 2;
  const soleY = ankleMidY + 80;
  const standingHeight = soleY - computed.head.endY;
  const ratio = armspan / standingHeight;
  assert.ok(
    Math.abs(ratio - 1.0) <= 0.03,
    `Expected Vitruvian adult armspan/height ~1.0 (±3%), got ${ratio.toFixed(4)}`
  );

  // Child proportions remain preserved intact inside the 18-joint archive
  assert.equal(CHILD_PROPORTION_SPECS.length, 18);
  assert.equal(JOINT_SPECS.length, 43);
  const childKnee = CHILD_PROPORTION_SPECS.find((j) => j.id === 'r_knee')!;
  const adultFemur = JOINT_SPECS.find((j) => j.id === 'femurR')!;
  assert.equal(childKnee.lengthPx, 225);
  assert.ok(adultFemur.lengthPx > childKnee.lengthPx, 'Adult Puppyt femur must be longer than child spec');
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
  scaled.joints.humerusR.scaleLength = 1.6;
  scaled.joints.humerusR.scaleWidth = 1.4;

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
  assert.ok(digital.dots.length >= 14);

  // Extreme thorax elongation strains the closed-chain braceR/L <-> acromionR/L tendon bond
  const strainedState = createPosePreset('tpose');
  strainedState.joints.thorax.scaleLength = 2.0;
  const strainedComp = computeArmature(strainedState);
  const strainedDigital = computeDigitalModel(strainedState, strainedComp);
  assert.equal(strainedDigital.strainedR, true);
  assert.equal(strainedDigital.strainedL, true);
  assert.ok(strainedDigital.segments.some((s) => s.kind === 'strained'));
});

test('independent ribR/ribL and hipR/hipL swivels articulate sprites and carry child limbs', () => {
  const base = createPosePreset('tpose');
  const rotated = createPosePreset('tpose');
  rotated.joints.ribR.localAngle = 15;
  rotated.joints.hipR.localAngle = -18;

  const compBase = computeArmature(base);
  const compRot = computeArmature(rotated);

  // ribR rotates its rib end tip while leaving thorax and ribL unaffected
  assert.ok(Math.hypot(compRot.ribR.endX - compBase.ribR.endX, compRot.ribR.endY - compBase.ribR.endY) > 5);
  assert.equal(compRot.thorax.worldAngle, compBase.thorax.worldAngle);
  assert.equal(compRot.ribL.worldAngle, compBase.ribL.worldAngle);

  // hipR swings the entire right leg hierarchy about pelvis while left leg stays stationary
  assert.ok(Math.hypot(compRot.footR.x - compBase.footR.x, compRot.footR.y - compBase.footR.y) > 20);
  assert.equal(compRot.footL.x, compBase.footL.x);
});

test('IK solvers, mirrorPose, and 43-joint snapshot roundtrip operate cleanly', () => {
  const start = createPosePreset('tpose');
  const compStart = computeArmature(start);
  const targetX = compStart.handR.x + 25;
  const targetY = compStart.handR.y - 35;

  const afterArmIK = solveTwoBoneIK(start, 'handR', targetX, targetY);
  const compArmIK = computeArmature(afterArmIK);
  const distErr = Math.hypot(compArmIK.handR.x - targetX, compArmIK.handR.y - targetY);
  assert.ok(distErr < 2.0, `Expected 2-bone arm IK error < 2px, got ${distErr.toFixed(2)}px`);

  const afterSpineIK = solveSpineCCDIK(start, compStart.head.endX + 40, compStart.head.endY + 20);
  const compSpine = computeArmature(afterSpineIK);
  assert.ok(compSpine.head.endX > compStart.head.endX);

  const contra = createPosePreset('contrapposto');
  const mirrored = mirrorPose(contra);
  assert.equal(mirrored.rootRotation, -contra.rootRotation);
  assert.equal(mirrored.joints.humerusR.localAngle, -contra.joints.humerusL.localAngle);
  assert.equal(mirrored.joints.hipR.localAngle, -contra.joints.hipL.localAngle);

  const snap = armatureToCharacterSnapshot(contra, 'Contra Snapshot', 'wireframe');
  assert.equal(Object.keys(snap.joints).length, 43);
  const restored = characterSnapshotToArmature(snap);
  assert.equal(restored.joints.lumbar.localAngle, contra.joints.lumbar.localAngle);
  assert.equal(restored.joints.hipL.localAngle, contra.joints.hipL.localAngle);
});

test('updated model incorporates refined rib, shoulder, and pelvis landmarks and supports dual record/array access', () => {
  assert.equal(PUPPYT_SKELETON_PIECES.length, 33);
  assert.ok(PUPPYT_SKELETON_PIECES.head_front);
  assert.ok(PUPPYT_SKELETON_PIECES.ribR);
  assert.ok(PUPPYT_SKELETON_PIECES.braceR_tendon);

  assert.equal(PUPPYT_SKELETON_PIECES.ribR.pivot[0], 1257.5);
  assert.equal(PUPPYT_SKELETON_PIECES.ribR.pivot[1], 2155.5);
  assert.equal(PUPPYT_SKELETON_PIECES.ribR.y, 865);
  assert.equal(PUPPYT_SKELETON_PIECES.braceR_tendon.y, 818);

  assert.deepEqual(PUPPYT_LANDMARKS.hipRTip, [825, 3115]);
  assert.deepEqual(PUPPYT_LANDMARKS.hipLTip, [1689, 3115]);
  assert.deepEqual(PUPPYT_LANDMARKS.skullTriangle[0], [1006, -138]);
  assert.deepEqual(PUPPYT_LANDMARKS.skullTriangle[1], [1511, -138]);
  assert.deepEqual(PUPPYT_LANDMARKS.skullTriangle[2], [1259, 612]);
});

test('continuousSpin defaults on and lumbar swings about pelvis', () => {
  const base = createPosePreset('tpose');
  assert.equal(base.continuousSpin, true);

  const rotated = createPosePreset('tpose');
  rotated.joints.lumbar.localAngle = 30;
  const compBase = computeArmature(base);
  const compRot = computeArmature(rotated);

  const baseLumbar = buildSkeletonPieceRenders(base, compBase).find(
    (p) => p.key === 'lumbar-upperspine'
  )!;
  const rotLumbar = buildSkeletonPieceRenders(rotated, compRot).find(
    (p) => p.key === 'lumbar-upperspine'
  )!;

  assert.equal(baseLumbar.jointId, 'lumbar');
  assert.equal(rotLumbar.jointId, 'lumbar');

  const baseLen = Math.hypot(compBase.thorax.x - compBase.pelvis.x, compBase.thorax.y - compBase.pelvis.y);
  const rotLen = Math.hypot(compRot.thorax.x - compRot.pelvis.x, compRot.thorax.y - compRot.pelvis.y);
  assert.ok(Math.abs(baseLen - rotLen) < 0.05);
  assert.ok(Math.abs(compRot.thorax.x - compBase.thorax.x) > 5);
});

test('headTurn cycles head-front piece URL across Front, Side R, Back, and Side L sprites at matching cranium peak', () => {
  const opaqueTopFractionByTurn = [1 / 269, 37 / 269, 0 / 269, 37 / 269];
  const peaks: number[] = [];

  for (const turn of [0, 1, 2, 3] as const) {
    const state = createPosePreset('tpose');
    state.headTurn = turn;
    const comp = computeArmature(state);
    const headPiece = buildSkeletonPieceRenders(state, comp).find((p) => p.key === 'head-front')!;
    assert.equal(headPiece.asset.assetUrl, HEAD_TURN_ASSETS[turn]);
    assert.deepEqual(
      {
        x: headPiece.asset.x,
        y: headPiece.asset.y,
        w: headPiece.asset.w,
        h: headPiece.asset.h,
      },
      HEAD_TURN_BOXES[turn]
    );
    // Uniform aspect ratio preserved (180x269 PNG aspect = 0.6691)
    const ratio = headPiece.asset.w / headPiece.asset.h;
    assert.ok(Math.abs(ratio - 180 / 269) < 0.002, `Turn ${turn} aspect ratio skewed: ${ratio}`);
    const opaqueTopY = headPiece.asset.y + headPiece.asset.h * opaqueTopFractionByTurn[turn];
    peaks.push(opaqueTopY);
  }

  for (let i = 1; i < peaks.length; i++) {
    assert.ok(
      Math.abs(peaks[i] - peaks[0]) < 0.25,
      `Head turn ${i} peak ${peaks[i].toFixed(2)} drifted from Front peak ${peaks[0].toFixed(2)}`
    );
  }
});

test('cardboard cutout rule: shoulder backs/tendons/wings never stretch under extreme swivel or spine bends', () => {
  const bent = createPosePreset('tpose');
  bent.joints.swivelR.localAngle = 38;
  bent.joints.swivelL.localAngle = -35;
  bent.joints.lumbar.localAngle = 25;
  bent.joints.thorax.localAngle = -18;

  const computed = computeArmature(bent);
  const pieces = buildSkeletonPieceRenders(bent, computed);

  for (const key of [
    'braceR-shouldertendon',
    'braceR-backshoulder',
    'braceL-shouldertendon',
    'braceL-backshoulder',
    'swivelR-shoulderswivel',
    'swivelL-shoulderswivel',
  ]) {
    const piece = pieces.find((p) => p.key === key)!;
    const scaleX = Math.hypot(piece.matrix[0], piece.matrix[1]);
    const scaleY = Math.hypot(piece.matrix[2], piece.matrix[3]);
    assert.ok(
      Math.abs(scaleX - PUPPYT_TO_EVOLVED_SCALE) < 0.0005,
      `${key} X scale stretched to ${scaleX.toFixed(5)} (must remain rigid ${PUPPYT_TO_EVOLVED_SCALE})`
    );
    assert.ok(
      Math.abs(scaleY - PUPPYT_TO_EVOLVED_SCALE) < 0.0005,
      `${key} Y scale stretched to ${scaleY.toFixed(5)} (must remain rigid ${PUPPYT_TO_EVOLVED_SCALE})`
    );
  }
});
