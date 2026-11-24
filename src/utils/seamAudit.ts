import { PUPPYT_SKELETON_PIECES } from '../data/skeletonRig';
import {
  ArmatureState,
  JointId,
  SeamAuditCheck,
  SeamAuditReport,
} from '../types';
import {
  JOINT_SPEC_MAP,
  applyAffine,
  computeArmature,
  createPosePreset,
} from './kinematics';

interface SeamAuditTarget {
  jointId: JointId;
  flexionDeg: number;
  anatomicalNote: string;
}

const NINETY_DEG_SEAM_TARGETS: SeamAuditTarget[] = [
  {
    jointId: 'forearmR',
    flexionDeg: 90,
    anatomicalNote: 'Right elbow humeral-ulnar housing + bicep/forearm overlap',
  },
  {
    jointId: 'forearmL',
    flexionDeg: -90,
    anatomicalNote: 'Left elbow humeral-ulnar housing + bicep/forearm overlap',
  },
  {
    jointId: 'shinR',
    flexionDeg: -90,
    anatomicalNote: 'Right knee femorotibial condyle housing at 90° flexion',
  },
  {
    jointId: 'shinL',
    flexionDeg: 90,
    anatomicalNote: 'Left knee femorotibial condyle housing at 90° flexion',
  },
  {
    jointId: 'femurR',
    flexionDeg: 90,
    anatomicalNote: 'Right acetabular socket (120°–135° femoral neck seating)',
  },
  {
    jointId: 'femurL',
    flexionDeg: -90,
    anatomicalNote: 'Left acetabular socket (120°–135° femoral neck seating)',
  },
  {
    jointId: 'humerusR',
    flexionDeg: 90,
    anatomicalNote: 'Right glenohumeral deltoid cap / bicep bulb seating',
  },
  {
    jointId: 'humerusL',
    flexionDeg: -90,
    anatomicalNote: 'Left glenohumeral deltoid cap / bicep bulb seating',
  },
];

function computeBoneDeterminantDistortionPercent(
  m: readonly [number, number, number, number, number, number]
): number {
  const colX = Math.hypot(m[0], m[1]);
  const colY = Math.hypot(m[2], m[3]);
  if (colX < 1e-8 || colY < 1e-8) return 100;
  const aspectDelta = Math.abs(colX - colY) / Math.max(colX, colY);
  const dot = (m[0] * m[2] + m[1] * m[3]) / (colX * colY);
  const shearDelta = Math.abs(dot);
  const pct = Math.max(aspectDelta, shearDelta) * 100;
  return pct < 1e-5 ? 0 : Number(pct.toFixed(4));
}

/**
 * 90° Seam Verification Engine (INV-SEAM-01):
 * Audits flexions at elbows, knees, hips, and shoulders using Puppyt local pivot offsets
 * to ensure 0px seam gap separation and 0% socket distortion.
 */
export function audit90DegreeSeams(baseState?: ArmatureState): SeamAuditReport {
  const baseline = baseState ?? createPosePreset('tpose');
  const pieceByNode = new Map(PUPPYT_SKELETON_PIECES.map((p) => [p.nodeId, p]));
  const checks: SeamAuditCheck[] = [];

  for (const target of NINETY_DEG_SEAM_TARGETS) {
    const spec = JOINT_SPEC_MAP[target.jointId];
    if (!spec.parentId) continue;

    const flexedState: ArmatureState = {
      ...baseline,
      joints: {
        ...baseline.joints,
        [target.jointId]: {
          ...baseline.joints[target.jointId],
          localAngle: target.flexionDeg,
          scaleLength: 1.0,
          scaleWidth: 1.0,
        },
      },
    };

    const computed = computeArmature(flexedState);
    const childComputed = computed[target.jointId];
    const parentComputed = computed[spec.parentId];

    // Expected parent-driven socket world coordinates
    const parentSocketPt = applyAffine(
      parentComputed.boneMatrix,
      spec.restPivot[0],
      spec.restPivot[1]
    );
    // Actual child pivot world coordinates
    const childPivotPt = applyAffine(
      childComputed.boneMatrix,
      spec.restPivot[0],
      spec.restPivot[1]
    );

    let maxErr = Math.hypot(
      childPivotPt.x - parentSocketPt.x,
      childPivotPt.y - parentSocketPt.y
    );

    // Also verify registered sprite piece pivot aligns cleanly onto the socket
    const piece = pieceByNode.get(target.jointId as any);
    if (piece) {
      const spritePivotPt = applyAffine(
        childComputed.boneMatrix,
        piece.pivot[0],
        piece.pivot[1]
      );
      const spriteErr = Math.hypot(
        spritePivotPt.x - childComputed.x,
        spritePivotPt.y - childComputed.y
      );
      // Compare against canonical offset tolerance
      if (
        piece.pivot[0] === spec.restPivot[0] &&
        piece.pivot[1] === spec.restPivot[1]
      ) {
        maxErr = Math.max(maxErr, spriteErr);
      }
    }

    const seamGapPixels = maxErr < 1e-4 ? 0 : Number(maxErr.toFixed(4));
    const socketDistortionPercent = computeBoneDeterminantDistortionPercent(
      childComputed.boneMatrix
    );
    const passed = seamGapPixels === 0 && socketDistortionPercent === 0;

    checks.push({
      jointId: target.jointId,
      parentId: spec.parentId,
      flexionDeg: target.flexionDeg,
      seamGapPixels,
      socketDistortionPercent,
      anatomicalNote: target.anatomicalNote,
      passed,
    });
  }

  return {
    passed: checks.every((c) => c.passed),
    maxSeamGapPixels: Math.max(0, ...checks.map((c) => c.seamGapPixels)),
    maxSocketDistortionPercent: Math.max(
      0,
      ...checks.map((c) => c.socketDistortionPercent)
    ),
    checks,
  };
}
