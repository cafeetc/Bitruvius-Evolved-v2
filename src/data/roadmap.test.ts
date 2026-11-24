import test from 'node:test';
import assert from 'node:assert/strict';
import { ROADMAP_ENTRIES, ROADMAP_METADATA } from './roadmap';

test('roadmap contains valid sections, unique ids, and matches active dark purple-gray silhouette hex', () => {
  assert.equal(ROADMAP_METADATA.silhouetteColorHex, '#261D2E');

  const ids = new Set<string>();
  const statuses = new Set<string>();

  for (const entry of ROADMAP_ENTRIES) {
    assert.ok(!ids.has(entry.id), `Duplicate roadmap id: ${entry.id}`);
    ids.add(entry.id);
    statuses.add(entry.status);
    assert.ok(entry.title.trim().length > 0);
    assert.ok(entry.summary.trim().length > 0);
    assert.ok(entry.details.length > 0);
  }

  assert.ok(statuses.has('awaiting_rules'));
  assert.ok(statuses.has('unresolved'));
  assert.ok(statuses.has('vision'));
  assert.ok(statuses.has('completed'));
});
