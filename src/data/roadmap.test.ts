import test from 'node:test';
import assert from 'node:assert/strict';
import { ROADMAP_ENTRIES, ROADMAP_METADATA, SYSTEM_INVARIANTS } from './roadmap';

test('roadmap contains valid sections, unique ids, and matches v0.5-alpha metadata & phases', () => {
  assert.equal(ROADMAP_METADATA.version, 'v0.5-alpha');
  assert.equal(ROADMAP_METADATA.silhouetteColorHex, '#261D2E');
  assert.equal(ROADMAP_METADATA.highlightColorHex, '#22C55E');
  assert.equal(ROADMAP_METADATA.selectedColorHex, '#9D79BC');
  assert.equal(ROADMAP_METADATA.defaultStageZoom, 0.18);
  assert.equal(ROADMAP_METADATA.pyxlPx, 100);

  const ids = new Set<string>();
  const statuses = new Set<string>();
  const phases = new Set<number>();

  for (const entry of ROADMAP_ENTRIES) {
    assert.ok(!ids.has(entry.id), `Duplicate roadmap id: ${entry.id}`);
    ids.add(entry.id);
    statuses.add(entry.status);
    if (entry.phase !== undefined) {
      phases.add(entry.phase);
    }
    assert.ok(entry.title.trim().length > 0);
    assert.ok(entry.summary.trim().length > 0);
    assert.ok(entry.details.length > 0);
  }

  assert.ok(statuses.has('unresolved'));
  assert.ok(statuses.has('vision'));
  assert.ok(statuses.has('completed'));
  for (const p of [0, 1, 2, 3, 4, 5, 6]) {
    assert.ok(phases.has(p), `Missing roadmap phase ${p}`);
  }

  const bpIntake = ROADMAP_ENTRIES.find((e) => e.id === 'bp-intake');
  assert.ok(bpIntake, 'Missing bp-intake entry');
  assert.equal(bpIntake.status, 'completed');
  assert.equal(bpIntake.unitTested, true);

  const rigDecision = ROADMAP_ENTRIES.find((e) => e.id === 'dec-rig-topology');
  assert.ok(rigDecision, 'Missing dec-rig-topology entry');
  assert.equal(rigDecision.status, 'completed');
  assert.match(rigDecision.summary, /Option A/i);
  assert.match(rigDecision.summary, /43-joint/i);

  const rigInvariants = ROADMAP_ENTRIES.find((e) => e.id === 'rig-invariants');
  assert.ok(rigInvariants, 'Missing rig-invariants entry');
  assert.equal(rigInvariants.status, 'completed');

  assert.equal(SYSTEM_INVARIANTS.length, 9);
  for (const inv of SYSTEM_INVARIANTS) {
    assert.equal(inv.unitTested, true, `Invariant ${inv.id} must be unitTested`);
    assert.ok(inv.id.startsWith('INV-'));
  }
});
