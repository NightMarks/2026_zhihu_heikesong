import test from 'node:test';
import assert from 'node:assert/strict';

await import('../public/js/tray-diff.js');

const { diffSnapshots } = globalThis.ShaYuTrayDiff;

function item(instanceId, toyId, x, y, scale = 1, rotation = 0) {
  return { instanceId, toyId, x, y, scale, rotation };
}

test('diffs stable instances and preserves the first meaningful action', () => {
  const before = [item('a', 'bridge', 10, 10)];
  const after = [item('a', 'bridge', 40, 10), item('b', 'tree', 60, 50)];
  const diff = diffSnapshots(before, after, [
    { type: 'select', instanceId: 'a' },
    { type: 'move', instanceId: 'a' },
    { type: 'add', instanceId: 'b' },
  ]);

  assert.deepEqual(diff.moved.map(entry => entry.instanceId), ['a']);
  assert.deepEqual(diff.added.map(entry => entry.instanceId), ['b']);
  assert.equal(diff.firstMeaningfulAction.type, 'move');
});

test('distinguishes duplicate toys by instance id', () => {
  const before = [item('tree-1', 'tree', 10, 10), item('tree-2', 'tree', 20, 20)];
  const after = [item('tree-2', 'tree', 20, 20), item('tree-3', 'tree', 30, 30)];
  const diff = diffSnapshots(before, after, []);

  assert.deepEqual(diff.removed.map(entry => entry.instanceId), ['tree-1']);
  assert.deepEqual(diff.added.map(entry => entry.instanceId), ['tree-3']);
});

test('ignores tiny jitter but records meaningful resize and rotation', () => {
  const before = [item('a', 'bridge', 10, 10, 1, 0)];
  const jitter = diffSnapshots(before, [item('a', 'bridge', 10.5, 10.5, 1.04, 3)], []);
  const changed = diffSnapshots(before, [item('a', 'bridge', 10, 10, 1.2, 15)], []);

  assert.equal(jitter.moved.length, 0);
  assert.equal(jitter.resized.length, 0);
  assert.equal(jitter.rotated.length, 0);
  assert.equal(changed.resized.length, 1);
  assert.equal(changed.rotated.length, 1);
});
