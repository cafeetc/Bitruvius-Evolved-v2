import { CharacterPoseSnapshot, PosePresetId } from '../types';
import { POSE_PRESET_LABELS } from './kinematics';

export type ScenePlannerAction =
  | { type: 'select_preset'; preset: PosePresetId; matchedLabel: string }
  | { type: 'select_snapshot'; snapshotId: string; matchedLabel: string }
  | { type: 'name_pose'; name: string }
  | { type: 'reset_placement' };

export type ScenePlannerParseResult =
  | { ok: true; action: ScenePlannerAction }
  | { ok: false; error: string };

const PRESET_ALIASES: Record<string, PosePresetId> = {
  'bitruvian t pose': 'tpose',
  'bitruvian t-pose': 'tpose',
  't-pose': 'tpose',
  't pose': 'tpose',
  tpose: 'tpose',
  vitruvian: 'vitruvian',
  contrapposto: 'contrapposto',
  contra: 'contrapposto',
  striding: 'striding',
};

/**
 * Scene Planner First-Slice Grammar:
 * - `select pose [Name]`
 * - `name pose [Name]`
 * - `reset placement`
 */
export function parseScenePlannerCommand(
  rawInput: string,
  snapshots: readonly CharacterPoseSnapshot[] = []
): ScenePlannerParseResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: 'Enter a command: select pose [Name], name pose [Name], or reset placement.',
    };
  }

  const normalizedLower = trimmed.toLowerCase();

  if (normalizedLower === 'reset placement') {
    return { ok: true, action: { type: 'reset_placement' } };
  }

  const selectMatch = trimmed.match(/^select\s+pose\s+(.+)$/i);
  if (selectMatch) {
    const query = selectMatch[1].trim().replace(/^["']|["']$/g, '');
    if (!query) {
      return { ok: false, error: 'Specify a pose name after "select pose".' };
    }
    const qLower = query.toLowerCase();

    // Check saved snapshots first so user-named poses take priority if named identically
    const snap = snapshots.find((s) => s.label.trim().toLowerCase() === qLower);
    if (snap) {
      return {
        ok: true,
        action: {
          type: 'select_snapshot',
          snapshotId: snap.snapshotId,
          matchedLabel: snap.label,
        },
      };
    }

    const preset = PRESET_ALIASES[qLower];
    if (preset) {
      return {
        ok: true,
        action: {
          type: 'select_preset',
          preset,
          matchedLabel: POSE_PRESET_LABELS[preset],
        },
      };
    }

    return {
      ok: false,
      error: `Pose "${query}" not found in presets or captured snapshots.`,
    };
  }

  const nameMatch = trimmed.match(/^name\s+pose\s+(.+)$/i);
  if (nameMatch) {
    const nextName = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    if (!nextName) {
      return { ok: false, error: 'Specify a non-empty name after "name pose".' };
    }
    return {
      ok: true,
      action: { type: 'name_pose', name: nextName },
    };
  }

  return {
    ok: false,
    error: `Unrecognized syntax "${trimmed}". Supported: select pose [Name], name pose [Name], reset placement.`,
  };
}
