import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(repo, 'public', 'js', 'state.js'), 'utf8');

function loadStateApi(saved = null) {
  const storage = new Map(saved ? [['shayu_v2', JSON.stringify(saved)]] : []);
  const context = {
    window: {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  vm.runInNewContext(source, context);
  return context.window.ShaYuState;
}

test('sandtoy unlock costs are randomly assigned from 1 to 3 and stay stable', () => {
  const api = loadStateApi();
  const categories = [{ id: 'people', toys: [{ id: 'child' }, { id: 'climber' }, { id: 'family' }] }];
  const state = api.load(categories);
  const rolls = [0, 0.34, 0.999];

  api.ensureUnlockCosts(state, categories, () => rolls.shift());

  assert.deepEqual({ ...state.unlockCosts }, { child: 1, climber: 2, family: 3 });
  api.ensureUnlockCosts(state, categories, () => 0);
  assert.deepEqual({ ...state.unlockCosts }, { child: 1, climber: 2, family: 3 });
});
