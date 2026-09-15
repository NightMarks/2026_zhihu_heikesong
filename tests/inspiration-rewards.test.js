import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateSource = fs.readFileSync(path.join(repo, 'public', 'js', 'state.js'), 'utf8');
const appSource = fs.readFileSync(path.join(repo, 'public', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(repo, 'public', 'index.html'), 'utf8');
const serverSource = fs.readFileSync(path.join(repo, 'server', 'index.js'), 'utf8');

function loadStateApi() {
  const storage = new Map();
  const context = {
    window: {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  vm.runInNewContext(stateSource, context);
  return context.window.ShaYuState;
}

test('inspiration rewards are 3 for opening, 1 for reflection, and cannot repeat', () => {
  const api = loadStateApi();
  const categories = [{ id: 'people', toys: [] }];
  const state = api.load(categories);

  assert.deepEqual({ ...api.INSPIRATION_REWARDS }, { open: 3, reflection: 1 });
  assert.equal(api.claimInspiration(state, 'people', 'open', 'https://zhihu.com/question/1'), 3);
  assert.equal(api.claimInspiration(state, 'people', 'open', 'https://zhihu.com/question/1'), 0);
  assert.equal(api.claimInspiration(state, 'people', 'reflection', 'https://zhihu.com/question/1'), 1);
  assert.equal(state.insp.people, 4);
});

test('browser copy and contribution endpoint advertise the same reward rules', () => {
  assert.match(appSource, /去知乎读原文 \+3💡/);
  assert.match(appSource, /读完写感受 \+1💡/);
  assert.match(appSource, /我在知乎回应了 \+5💡/);
  assert.match(htmlSource, /去知乎读原文 <b>\+3 💡<\/b>/);
  assert.match(htmlSource, /回链校验 <b>\+5 💡<\/b>/);
  assert.match(serverSource, /reward:\s*5/);
});
