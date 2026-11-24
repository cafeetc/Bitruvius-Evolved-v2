import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJointAngleConstraint,
  applyPhysicsGearRatio,
  armatureToCharacterSnapshot,
  clampModeERatio,
  computeArmature,
  computeModelBounds,
  computeNavelCenterPan,
  computeStageSplitLayout,
  createLaunchPose,
  createPosePreset,
  interpolateArmatureShortestPath,
  JOINT_SPECS,
  POSE_PRESET_LABELS,
  POSE_RECALL_DURATION_MS,
  rectsIntersect,
  shortestAngleDelta,
} from '../utils/kinematics';
import { PAPER_HEIGHT, PAPER_WIDTH } from '../types';
import { audit90DegreeSeams } from '../utils/seamAudit';
import { runStudioExport, STUDIO_EXPORT_SUITE } from '../utils/export';
import { parseScenePlannerCommand } from '../utils/scenePlanner';
import { buildStoreZipArchive, importVectorSequenceZip } from '../utils/zipSequenceImporter';

test('INV-STAGE-01 & INV-STAGE-02 & INV-ROYAL-01: 2/3 stage split, optical navel center, and zero console overlap', () => {
  const windowWidth = 1440;
  const windowHeight = 900;
  const split = computeStageSplitLayout(windowWidth, true);

  assert.ok(Math.abs(split.stageRatio - 2 / 3) < 1e-6);
  assert.ok(Math.abs(split.consoleRatio - 1 / 3) < 1e-6);
  assert.equal(Math.round(split.stageWidth), 960);
  assert.equal(Math.round(split.consoleWidth), 480);

  // Navel origin (PAPER_WIDTH / 2, PAPER_HEIGHT / 2) lands at optical center (stageWidth/2, stageHeight/2)
  const zoom = 0.18;
  const navelWorldX = PAPER_WIDTH / 2;
  const navelWorldY = PAPER_HEIGHT / 2;
  const pan = computeNavelCenterPan(split.stageWidth, windowHeight, navelWorldX, navelWorldY, zoom);
  const screenX = pan.x + navelWorldX * zoom;
  const screenY = pan.y + navelWorldY * zoom;

  assert.ok(Math.abs(screenX - split.stageWidth / 2) < 1e-6);
  assert.ok(Math.abs(screenY - windowHeight / 2) < 1e-6);

  // Emperor.Clothes royal space check: mannequin screen bounds must stay strictly inside stage and disjoint from right 1/3 console
  const tpose = createPosePreset('tpose');
  const computed = computeArmature(tpose);
  const modelBounds = computeModelBounds(computed, tpose);
  const mannequinScreenRect = {
    left: pan.x + modelBounds.minX * zoom,
    right: pan.x + modelBounds.maxX * zoom,
    top: pan.y + modelBounds.minY * zoom,
    bottom: pan.y + modelBounds.maxY * zoom,
  };
  const consoleScreenRect = {
    left: split.stageWidth,
    right: windowWidth,
    top: 44,
    bottom: windowHeight,
  };

  assert.equal(rectsIntersect(mannequinScreenRect, consoleScreenRect), false);
});

test('INV-KIN-01 & INV-KIN-02: 0.25deg precision clamp and modulo-360 shortest-path angular delta', () => {
  assert.equal(applyJointAngleConstraint(215.14, false), 180);
  assert.equal(applyJointAngleConstraint(-250.3, false), -180);
  assert.equal(applyJointAngleConstraint(45.13, false), 45.25);

  const deltaWrapPos = shortestAngleDelta(170, -170);
  assert.equal(deltaWrapPos, 20);
  assert.ok(Math.abs(deltaWrapPos) <= 180);

  const deltaWrapNeg = shortestAngleDelta(-170, 170);
  assert.equal(deltaWrapNeg, -20);
  assert.ok(Math.abs(deltaWrapNeg) <= 180);
});

test('INV-SEAM-01: 90-degree flexions at elbows, knees, hips, and shoulders yield 0px seam gap and 0% socket distortion', () => {
  const report = audit90DegreeSeams(createPosePreset('tpose'));
  assert.equal(report.passed, true);
  assert.equal(report.maxSeamGapPixels, 0);
  assert.equal(report.maxSocketDistortionPercent, 0);
  assert.equal(report.checks.length, 8);
});

test('INV-PHYS-01: all 5 physics steering gear ratios and Mode E 0.50x-1.50x bounds enforce contract', () => {
  const baseRt = createPosePreset('tpose').joints.humerusR;
  assert.equal(applyPhysicsGearRatio(10, { ...baseRt, physicsMode: 'twins' }), 10);
  assert.equal(applyPhysicsGearRatio(10, { ...baseRt, physicsMode: 'elastic_rubber' }), 15);
  assert.equal(applyPhysicsGearRatio(10, { ...baseRt, physicsMode: 'damp' }), 5);
  assert.equal(applyPhysicsGearRatio(10, { ...baseRt, physicsMode: 'rigid' }), 0);

  assert.equal(clampModeERatio(0.1), 0.5);
  assert.equal(clampModeERatio(2.4), 1.5);
  assert.equal(clampModeERatio(1.25), 1.25);
  assert.equal(
    applyPhysicsGearRatio(10, { ...baseRt, physicsMode: 'mode_e', modeERatio: 1.25 }),
    12.5
  );
});

test('INV-MEM-01: 500ms ease-in-out snapshot recall, Bitruvian T Pose launch mood, and Scene Planner grammar', () => {
  assert.equal(POSE_RECALL_DURATION_MS, 500);
  assert.equal(POSE_PRESET_LABELS.tpose, 'Bitruvian T Pose');

  const launchA = createLaunchPose(101);
  const launchB = createLaunchPose(202);
  assert.ok(launchA.proceduralMoodOffsets);
  assert.equal(launchA.environmentalAnchor, 'navel');
  // Mood offsets stay quantized within micro-range bounds while giving distinct session posture
  assert.notEqual(
    JSON.stringify(launchA.proceduralMoodOffsets),
    JSON.stringify(launchB.proceduralMoodOffsets)
  );
  assert.equal(Object.keys(launchA.joints).length, JOINT_SPECS.length);

  // Shortest-path ease-in-out halfway frame wraps -170 -> +170 across ±180 cleanly
  const from = createPosePreset('tpose');
  const to = createPosePreset('tpose');
  from.continuousSpin = false;
  to.continuousSpin = false;
  from.joints.humerusR.localAngle = 170;
  to.joints.humerusR.localAngle = -170;
  const mid = interpolateArmatureShortestPath(from, to, 0.5);
  assert.ok(Math.abs(mid.joints.humerusR.localAngle - 180) < 0.01);

  // Scene Planner commands
  const snap = armatureToCharacterSnapshot(to, 'Custom Hero', 'hybrid_overlay');
  const selSnap = parseScenePlannerCommand('select pose Custom Hero', [snap]);
  assert.equal(selSnap.ok, true);
  if (selSnap.ok) assert.equal(selSnap.action.type, 'select_snapshot');

  const selPreset = parseScenePlannerCommand('select pose Bitruvian T Pose', [snap]);
  assert.equal(selPreset.ok, true);
  if (selPreset.ok) {
    assert.equal(selPreset.action.type, 'select_preset');
    if (selPreset.action.type === 'select_preset') {
      assert.equal(selPreset.action.preset, 'tpose');
    }
  }

  const namePose = parseScenePlannerCommand('name pose Jump Apex', [snap]);
  assert.equal(namePose.ok, true);
  if (namePose.ok && namePose.action.type === 'name_pose') {
    assert.equal(namePose.action.name, 'Jump Apex');
  }

  const resetCmd = parseScenePlannerCommand('reset placement', [snap]);
  assert.equal(resetCmd.ok, true);
  if (resetCmd.ok) assert.equal(resetCmd.action.type, 'reset_placement');
});

test('INV-EXPO-01 & Vector Sequence ZIP Importer: 5 export formats and ZIP sequence keyframe extraction', async () => {
  assert.equal(STUDIO_EXPORT_SUITE.length, 5);
  const tpose = createPosePreset('tpose');
  const vitruvian = createPosePreset('vitruvian');
  const snap1 = armatureToCharacterSnapshot(tpose, 'Snapshot #1', 'pure_shadow');
  const snap2 = armatureToCharacterSnapshot(vitruvian, 'Snapshot #2', 'hybrid_overlay');

  for (const desc of STUDIO_EXPORT_SUITE) {
    const res = await runStudioExport(desc.format, {
      snapshot: snap1,
      snapshots: [snap1, snap2],
      theme: 'dark',
    });
    assert.equal(res.ready, true, `${desc.format} failed readiness`);
  }

  const zipBytes = buildStoreZipArchive([
    {
      name: 'frame-01.json',
      content: JSON.stringify({ label: 'Keyframe A', joints: { humerusR: 45, humerusL: -45 } }),
    },
    {
      name: 'frame-02.svg',
      content: '<svg><g data-joint-id="humerusR" data-angle="90"></g></svg>',
    },
  ]);

  const seq = await importVectorSequenceZip(zipBytes, 'test-cycle.zip', tpose);
  assert.equal(seq.name, 'test-cycle');
  assert.equal(seq.jsonFileCount, 1);
  assert.equal(seq.svgFileCount, 1);
  assert.equal(seq.frames.length, 2);
  assert.equal(seq.frames[0].snapshot.joints.humerusR, 45);
  assert.equal(seq.frames[1].snapshot.joints.humerusR, 90);
});
