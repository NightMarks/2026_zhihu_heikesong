# Daily Hot Choice Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a homepage “每日热题” mode beside “沙盘报告” that turns safe Zhihu hot topics into evidence-based choice-mirror challenges, lets users confirm evolving choice archetypes, and reuses the existing publishing and friend-matching flow.

**Architecture:** Keep the existing Express, JSON store, and browser-global JavaScript architecture. Add focused challenge, run/profile, and tray-diff modules; reuse the existing sandtray editor through a small bridge instead of duplicating it. Persist challenge runs and archetype privacy with community data, and extend community works with optional challenge metadata and opt-in archetype matching.

**Tech Stack:** Node.js 22+, Express 4, native browser JavaScript, `node:test`, existing OpenAI-compatible client, existing Zhihu API/CLI sources, JSON persistent store.

## Global Constraints

- Preserve the current free-play “我的沙盘 → 沙盘报告” flow unchanged.
- Put “每日热题” beside “沙盘报告” in the homepage navigation.
- AI output is non-diagnostic and follows “fact → at most two possibilities → user confirmation”.
- Unconfirmed or rejected interpretations never contribute to the long-term profile.
- Choice archetypes are private by default, individually publishable, and separately opt-in for matching.
- Disabling archetype matching must preserve the current structural matching score and order.
- Hot topics involving self-harm, death, serious disease, minors as victims, sexual/domestic violence, active public-safety incidents, or allegations about named people cannot become challenges.
- Existing secrets stay server-side; do not add credentials or personal data to browser payloads.
- Every code task follows test-first development and ends with a focused Conventional Commit.

---

## File Map

**Create**

- `server/challenge-schema.js` — whitelist and normalize challenge JSON.
- `server/challenges.js` — filter hot topics, map them to safe themes, and cache/fallback daily challenges.
- `server/challenge-runs.js` — challenge-run lifecycle, reflections, confirmations, profile, and router.
- `server/archetypes.js` — deterministic archetype evidence aggregation.
- `public/js/tray-diff.js` — browser-global snapshot differ with Node-compatible export.
- `public/js/challenge.js` — daily challenge UI state machine and editor bridge.
- `public/js/choice-profile.js` — profile rendering and archetype privacy controls.
- `tests/challenges.test.js` — topic filtering/schema/daily cache coverage.
- `tests/tray-diff.test.js` — objective snapshot-diff coverage.
- `tests/challenge-runs.test.js` — ownership, confirmation, profile, and privacy coverage.

**Modify**

- `server/store.js` — initialize and migrate challenge/profile collections.
- `server/index.js` — construct services, expose challenge endpoints, and fetch hot topics through the active source.
- `server/community.js` — optional challenge/archetype fields and opt-in matching score.
- `public/index.html` — navigation entry, challenge view, profile modal, and script tags.
- `public/style.css` — responsive challenge, reflection, archetype, and matching styles.
- `public/js/state.js` — resumable local challenge draft and last profile cache.
- `public/js/api.js` — challenge/profile endpoint wrappers.
- `public/js/community.js` — publish challenge works, show public archetypes, and select matching tags.
- `public/app.js` — expose an editor bridge and route the new view without changing free-play behavior.
- `tests/community.test.js` — challenge work fields and optional archetype matching.
- `tests/frontend-wiring.test.js` — navigation/scripts/bridge/publish wiring.
- `README.md` — mark implemented items current after the code ships.
- `docs/DEMO.md` — add the daily-hot demo path.

---

### Task 1: Persistent Store Collections

**Files:**
- Modify: `server/store.js`
- Test: `tests/community.test.js`

**Interfaces:**
- Produces: store data with `dailyChallenges: []`, `challengeRuns: []`, and `choiceProfiles: []`.
- Preserves: `version: 1`, `works`, `friendRequests`, and `friendships` without data loss.

- [x] **Step 1: Write the failing migration test**

```js
function createLegacyStoreFile(t, data) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shayu-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'store.json');
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  return file;
}

test('legacy stores gain challenge collections without losing community data', t => {
  const file = createLegacyStoreFile(t, { version: 1, works: [], friendRequests: [], friendships: [] });
  const store = createJsonStore(file);
  assert.deepEqual(store.read(data => data.dailyChallenges), []);
  assert.deepEqual(store.read(data => data.challengeRuns), []);
  assert.deepEqual(store.read(data => data.choiceProfiles), []);
});
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="legacy stores gain challenge" tests/community.test.js`  
Expected: FAIL because the three collections are `undefined`.

- [x] **Step 3: Normalize collections on creation and load**

```js
const EMPTY_STORE = () => ({
  version: 1,
  works: [],
  friendRequests: [],
  friendships: [],
  dailyChallenges: [],
  challengeRuns: [],
  choiceProfiles: [],
});

function normalizeCollections(data) {
  data.friendRequests = Array.isArray(data.friendRequests) ? data.friendRequests : [];
  data.friendships = Array.isArray(data.friendships) ? data.friendships : [];
  data.dailyChallenges = Array.isArray(data.dailyChallenges) ? data.dailyChallenges : [];
  data.challengeRuns = Array.isArray(data.challengeRuns) ? data.challengeRuns : [];
  data.choiceProfiles = Array.isArray(data.choiceProfiles) ? data.choiceProfiles : [];
  return data;
}
```

- [x] **Step 4: Run store/community tests**

Run: `node --test tests/community.test.js`  
Expected: all tests PASS.

- [x] **Step 5: Commit**

```powershell
git add server/store.js tests/community.test.js
git commit -m "feat(store): add choice mirror collections"
```

### Task 2: Safe Daily Challenge Generation

**Files:**
- Create: `server/challenge-schema.js`
- Create: `server/challenges.js`
- Create: `tests/challenges.test.js`

**Interfaces:**
- Produces: `normalizeChallenge(input, { date, sourceTopic })`.
- Produces: `isSafeHotTopic(item)`, `themeForHotTopic(item)`, `fallbackChallenge(date)`, and `DailyChallengeService#getDaily({ date, hotItems })`.
- Challenge shape: `{ id, date, title, sourceTopic, primaryDimension, intro, rounds, fallback }`.

- [x] **Step 1: Write failing schema, risk-filter, and cache tests**

```js
function validGenerated({ source }) {
  return {
    title: '为未知留一个位置',
    primaryDimension: 'change',
    intro: `从“${source?.title || '今日'}”想到的一次变化`,
    rounds: [
      { id: 'approach', type: 'approach', dimension: 'change', prompt: '让新元素进入。', constraints: { maxMoves: 3 } },
      { id: 'tradeoff', type: 'tradeoff', dimension: 'resource', prompt: '选择要保留的元素。', constraints: { removeCount: 2 } },
      { id: 'relationship', type: 'relationship', dimension: 'relationship', prompt: '回应一个靠近请求。', constraints: { maxMoves: 3 } },
      { id: 'replay', type: 'replay', dimension: 'change', prompt: '这次由你接近未知。', constraints: { maxMoves: 3 } },
    ],
  };
}

test('unsafe hot topics are rejected', () => {
  assert.equal(isSafeHotTopic({ title: '未成年人受害事件调查' }), false);
});

test('daily challenge is stable for the same date', async () => {
  const service = new DailyChallengeService({ store, generate: async input => validGenerated(input) });
  const first = await service.getDaily({ date: '2026-09-15', hotItems: [{ title: '人工智能进入课堂' }] });
  const second = await service.getDaily({ date: '2026-09-15', hotItems: [{ title: '另一条新闻' }] });
  assert.deepEqual(second, first);
});

test('invalid generation falls back to an approved challenge', async () => {
  const service = new DailyChallengeService({ store, generate: async () => ({ title: '<script>' }) });
  assert.equal((await service.getDaily({ date: '2026-09-16', hotItems: [] })).fallback, true);
});
```

- [x] **Step 2: Run the new test and verify module-not-found failure**

Run: `node --test tests/challenges.test.js`  
Expected: FAIL because `server/challenges.js` does not exist.

- [x] **Step 3: Implement strict challenge normalization**

```js
export const DIMENSIONS = new Set(['change', 'boundary', 'relationship', 'resource', 'control']);
export const ROUND_TYPES = new Set(['approach', 'tradeoff', 'relationship', 'replay']);

export function normalizeChallenge(input, { date, sourceTopic = '' }) {
  if (!input || typeof input !== 'object' || !DIMENSIONS.has(input.primaryDimension)) {
    throw new Error('每日热题结构无效');
  }
  const rounds = Array.isArray(input.rounds) ? input.rounds.map(normalizeRound) : [];
  if (rounds.length !== 4 || rounds.at(-1).type !== 'replay') throw new Error('每日热题轮次无效');
  return { id: `${date}-${input.primaryDimension}`, date, title: clean(input.title, 48),
    sourceTopic: clean(sourceTopic, 120), primaryDimension: input.primaryDimension,
    intro: clean(input.intro, 240), rounds, fallback: Boolean(input.fallback) };
}
```

- [x] **Step 4: Implement filtering, template generation, persistence, and fallback**

```js
export class DailyChallengeService {
  constructor({ store, generate = generateFromTemplate }) { this.store = store; this.generate = generate; }
  async getDaily({ date, hotItems = [] }) {
    const cached = this.store.read(data => data.dailyChallenges.find(item => item.date === date));
    if (cached) return structuredClone(cached);
    const source = hotItems.find(isSafeHotTopic);
    let challenge;
    try { challenge = normalizeChallenge(await this.generate({ date, source }), { date, sourceTopic: source?.title }); }
    catch { challenge = fallbackChallenge(date); }
    this.store.update(data => data.dailyChallenges.push(challenge));
    return structuredClone(challenge);
  }
}
```

When an analysis client is available, inject this generator; otherwise inject `generateFromTemplate`. The prompt contains only the already-filtered abstract theme, requires the same JSON shape, bans diagnostic language, and is always passed through `normalizeChallenge`:

```js
export async function requestChallengeGeneration({ client, model, date, source, theme }) {
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '生成非诊断式沙盘选择挑战。只输出 JSON；不得提及现实当事人，不得评价选择好坏。' },
      { role: 'user', content: JSON.stringify({ date, sourceTopic: source?.title || '', abstractTheme: theme,
        requiredRoundTypes: ['approach', 'tradeoff', 'relationship', 'replay'] }) },
    ],
  });
  return JSON.parse(response.choices[0]?.message?.content || '{}');
}
```

- [x] **Step 5: Run focused tests and commit**

Run: `node --test tests/challenges.test.js`  
Expected: all tests PASS.

```powershell
git add server/challenge-schema.js server/challenges.js tests/challenges.test.js
git commit -m "feat(challenge): generate safe daily hot topics"
```

### Task 3: Objective Sandtray Difference Engine

**Files:**
- Create: `public/js/tray-diff.js`
- Create: `tests/tray-diff.test.js`

**Interfaces:**
- Produces: `ShaYuTrayDiff.diffSnapshots(before, after, actions)`.
- Returns: `{ added, removed, moved, resized, rotated, firstMeaningfulAction }`.
- Items receive a stable challenge-only `instanceId`; `toyId` alone is not unique.

- [x] **Step 1: Write failing add/move/remove/order tests**

```js
test('diffs stable instances and keeps the first meaningful action', () => {
  const before = [{ instanceId: 'a', toyId: 'bridge', x: 10, y: 10, scale: 1, rotation: 0 }];
  const after = [{ instanceId: 'a', toyId: 'bridge', x: 40, y: 10, scale: 1, rotation: 0 },
    { instanceId: 'b', toyId: 'tree', x: 60, y: 50, scale: 1, rotation: 0 }];
  const diff = diffSnapshots(before, after, [{ type: 'move', instanceId: 'a' }, { type: 'add', instanceId: 'b' }]);
  assert.deepEqual(diff.moved.map(item => item.instanceId), ['a']);
  assert.deepEqual(diff.added.map(item => item.instanceId), ['b']);
  assert.equal(diff.firstMeaningfulAction.type, 'move');
});
```

- [x] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/tray-diff.test.js`  
Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement UMD-style export and normalized comparisons**

```js
(function exposeTrayDiff(global) {
  function diffSnapshots(before = [], after = [], actions = []) {
    const left = new Map(before.map(item => [item.instanceId, item]));
    const right = new Map(after.map(item => [item.instanceId, item]));
    const added = after.filter(item => !left.has(item.instanceId));
    const removed = before.filter(item => !right.has(item.instanceId));
    const common = after.filter(item => left.has(item.instanceId));
    return { added, removed,
      moved: common.filter(item => distance(left.get(item.instanceId), item) >= 2),
      resized: common.filter(item => Math.abs(number(left.get(item.instanceId).scale, 1) - number(item.scale, 1)) >= 0.1),
      rotated: common.filter(item => angularDistance(left.get(item.instanceId).rotation, item.rotation) >= 5),
      firstMeaningfulAction: actions.find(action => MEANINGFUL.has(action.type)) || null };
  }
  const api = Object.freeze({ diffSnapshots });
  if (typeof module !== 'undefined') module.exports = api;
  global.ShaYuTrayDiff = api;
})(typeof window === 'undefined' ? globalThis : window);
```

- [x] **Step 4: Run tests and commit**

Run: `node --test tests/tray-diff.test.js`  
Expected: all tests PASS.

```powershell
git add public/js/tray-diff.js tests/tray-diff.test.js
git commit -m "feat(challenge): track sandtray changes"
```

### Task 4: Challenge Runs, Reflections, and Archetypes

**Files:**
- Create: `server/archetypes.js`
- Create: `server/challenge-runs.js`
- Create: `tests/challenge-runs.test.js`

**Interfaces:**
- Produces: `computeArchetypes(confirmations)`.
- Produces: `ChallengeRunService#createRun`, `saveRound`, `createReflection`, `confirmObservation`, `getProfile`, `updateArchetypeSettings`, `deleteRecord`.
- Produces: `createChallengeRunRouter({ service, getUser })`.

- [x] **Step 1: Write failing ownership, confirmation, threshold, and privacy tests**

```js
function evidenceFor(archetypeId, { count, dimensions }) {
  return Array.from({ length: count }, (_, index) => ({
    id: `confirmation-${index}`,
    archetypeId,
    dimension: dimensions[index % dimensions.length],
    result: 'confirmed',
  }));
}

test('only confirmed cross-context evidence creates an archetype', () => {
  const confirmations = evidenceFor('boundary-keeper', { count: 3, dimensions: ['change', 'boundary'] });
  assert.equal(computeArchetypes(confirmations)[0].id, 'boundary-keeper');
  assert.deepEqual(computeArchetypes(confirmations.map(item => ({ ...item, result: 'situational' }))), []);
});

test('private archetypes are omitted from public views and matching', () => {
  service.updateArchetypeSettings(owner, 'boundary-keeper', { isPublic: true, matchEligible: true });
  assert.equal(service.getPublicArchetypes(owner.id)[0].id, 'boundary-keeper');
  service.updateArchetypeSettings(owner, 'boundary-keeper', { isPublic: false, matchEligible: true });
  assert.deepEqual(service.getPublicArchetypes(owner.id), []);
});
```

- [x] **Step 2: Run and verify module-not-found failure**

Run: `node --test tests/challenge-runs.test.js`  
Expected: FAIL because the modules do not exist.

- [x] **Step 3: Implement deterministic archetype aggregation**

```js
export function computeArchetypes(confirmations, { minimum = 3 } = {}) {
  const accepted = confirmations.filter(item => ['confirmed', 'rewritten'].includes(item.result));
  return ARCHETYPE_RULES.flatMap(rule => {
    const evidence = accepted.filter(rule.matches);
    const dimensions = new Set(evidence.map(item => item.dimension));
    return evidence.length >= minimum && dimensions.size >= 2
      ? [{ id: rule.id, name: rule.name, evidenceCount: evidence.length, dimensions: [...dimensions] }]
      : [];
  });
}
```

- [x] **Step 4: Implement service validation and rule-based fallback reflection**

```js
createReflection(user, runId) {
  const run = this.ownedRun(user, runId);
  const facts = objectiveFacts(run.rounds);
  run.reflection = { source: 'rules', observations: facts.slice(0, 3).map(toObservation) };
  this.persist(run);
  return structuredClone(run.reflection);
}

confirmObservation(user, runId, input) {
  if (!['confirmed', 'situational', 'rejected', 'rewritten'].includes(input.result)) {
    throw httpError(400, '确认状态无效');
  }
  // Save only observations belonging to this run; recompute the owner's profile.
}
```

- [x] **Step 5: Add router endpoints and run tests**

Run: `node --test tests/challenge-runs.test.js`  
Expected: all tests PASS.

- [x] **Step 6: Commit**

```powershell
git add server/archetypes.js server/challenge-runs.js tests/challenge-runs.test.js
git commit -m "feat(profile): add confirmed choice archetypes"
```

### Task 5: Server and Browser API Wiring

**Files:**
- Modify: `server/index.js`
- Modify: `public/js/api.js`
- Test: `tests/challenges.test.js`
- Test: `tests/frontend-wiring.test.js`

**Interfaces:**
- Consumes: `DailyChallengeService`, `ChallengeRunService`, `createChallengeRunRouter`.
- Produces browser methods: `dailyChallenge`, `createChallengeRun`, `saveChallengeRound`, `createChallengeReflection`, `confirmChoiceObservation`, `choiceProfile`, `updateArchetypeSettings`, `deleteChoiceRecord`.

- [x] **Step 1: Add failing route/API wiring assertions**

```js
assert.match(apiSource, /dailyChallenge:\s*\(\)\s*=>\s*request\('\/api\/challenges\/daily'\)/);
assert.match(serverSource, /app\.get\('\/api\/challenges\/daily'/);
assert.match(serverSource, /app\.use\('\/api\/challenge-runs'/);
```

- [x] **Step 2: Run and verify failure**

Run: `node --test tests/challenges.test.js tests/frontend-wiring.test.js`  
Expected: FAIL because routes and client methods are absent.

- [x] **Step 3: Construct services and add daily route**

```js
const dailyChallengeService = new DailyChallengeService({ store: communityService.store });
const challengeRunService = new ChallengeRunService({ store: communityService.store });

app.get('/api/challenges/daily', async (req, res) => {
  const s = session(req, res);
  if (!s.user?.id) return res.status(401).json({ error: '请先登录知乎' });
  const hotItems = await loadHotItemsSafely();
  res.json(await dailyChallengeService.getDaily({ date: chinaDate(), hotItems }));
});
app.use('/api/challenge-runs', createChallengeRunRouter({
  service: challengeRunService,
  getUser: (req, res) => session(req, res).user || null,
}));
```

- [x] **Step 4: Add exact browser API wrappers**

```js
dailyChallenge: () => request('/api/challenges/daily'),
createChallengeRun: payload => request('/api/challenge-runs', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
}),
saveChallengeRound: (runId, roundId, payload) =>
  request(`/api/challenge-runs/${encodeURIComponent(runId)}/rounds/${encodeURIComponent(roundId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
choiceProfile: () => request('/api/challenge-runs/profile'),
```

- [x] **Step 5: Run focused and full tests; commit**

Run: `npm test`  
Expected: all tests PASS.

```powershell
git add server/index.js public/js/api.js tests/challenges.test.js tests/frontend-wiring.test.js
git commit -m "feat(api): expose daily choice mirror flow"
```

### Task 6: Homepage Entry and Challenge UI

**Files:**
- Create: `public/js/challenge.js`
- Create: `public/js/choice-profile.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/js/state.js`
- Modify: `public/app.js`
- Test: `tests/frontend-wiring.test.js`

**Interfaces:**
- Consumes: `ShaYuApi`, `ShaYuTrayDiff`, and `ShaYuChallenge.init(bridge)`.
- Editor bridge: `{ getState, saveState, snapshotTray, replaceTray, resetTrayProcess, renderSandbox, toyOf, switchView, toast, escapeHtml }`.
- Produces: challenge stages `intro`, `initial`, `round`, `reflection`, `complete`.

- [x] **Step 1: Add failing navigation, script-order, and bridge assertions**

```js
assert.match(html, /data-view="challenge"[^>]*>[^<]*每日热题/);
assert.match(html, /id="view-challenge"/);
assert.ok(html.indexOf('js/tray-diff.js') < html.indexOf('js/challenge.js'));
assert.match(app, /ShaYuChallenge\.init\(/);
assert.match(app, /snapshotTray/);
```

- [x] **Step 2: Run and verify failure**

Run: `node --test tests/frontend-wiring.test.js`  
Expected: FAIL because the challenge view and bridge are absent.

- [x] **Step 3: Add persisted local draft fields**

```js
challengeDraft: null,
choiceProfileCache: null,
```

On load, accept `challengeDraft` only when it is an object with a string `runId`; otherwise set it to `null`.

- [x] **Step 4: Add navigation and semantic challenge containers**

```html
<button data-view="report">沙盘报告</button>
<button data-view="challenge">每日热题</button>
<section class="view" id="view-challenge">
  <div id="challenge-area" aria-live="polite"></div>
</section>
```

Load `tray-diff.js`, `challenge.js`, and `choice-profile.js` after `api.js` and before `app.js`.

- [x] **Step 5: Implement the challenge state machine**

```js
async function open() {
  model.challenge = await bridge.api.dailyChallenge();
  model.stage = model.runId ? model.stage : 'intro';
  render();
}

async function completeRound() {
  const after = bridge.snapshotTray();
  const diff = global.ShaYuTrayDiff.diffSnapshots(model.before, after, model.actions);
  await bridge.api.saveChallengeRound(model.runId, currentRound().id, { before: model.before, after, actions: model.actions, diff });
  advanceOrReflect();
}
```

- [x] **Step 6: Expose editor events without changing free-play behavior**

Every existing tray mutation calls `ShaYuChallenge.recordAction(action)` only when the challenge module reports an active round. Free-play continues to update `state.trayProcess` and invalidate `state.report` exactly as before.

- [x] **Step 7: Add responsive styles and reflection controls**

Use existing CSS variables and cards. At widths below `760px`, stack the prompt above the editor, keep the primary action sticky, and preserve current touch placement behavior.

- [x] **Step 8: Run tests and commit**

Run: `npm test`  
Expected: all tests PASS.

```powershell
git add public/index.html public/style.css public/js/state.js public/js/challenge.js public/js/choice-profile.js public/app.js tests/frontend-wiring.test.js
git commit -m "feat(game): add daily choice mirror mode"
```

### Task 7: Publish Challenge Works and Optional Archetype Matching

**Files:**
- Modify: `server/community.js`
- Modify: `public/js/community.js`
- Modify: `public/js/api.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Test: `tests/community.test.js`
- Test: `tests/frontend-wiring.test.js`

**Interfaces:**
- Work additions: `challenge: null | { id, title }`, `mirrorCard: null | { title, confirmedText }`, `publicArchetypes: [{ id, name }]`.
- Match request addition: `archetypeIds: string[]`; omitted/empty means original score formula.
- Candidate archetypes come only from `isPublic && matchEligible` profile settings.

- [x] **Step 1: Write failing publishing/privacy/matching tests**

```js
test('challenge works expose only explicitly public archetypes', t => {
  const work = service.createWork(owner, { ...input, challenge: { id: 'daily-1', title: '为未知留一个位置' },
    archetypeIds: ['boundary-keeper', 'private-type'] });
  assert.deepEqual(work.publicArchetypes.map(item => item.id), ['boundary-keeper']);
});

test('empty archetype selection preserves structural matching scores', t => {
  const baseline = service.findMatches(seeker.id, query);
  const disabled = service.findMatches(seeker.id, { ...query, archetypeIds: [] });
  assert.deepEqual(disabled.map(item => item.score), baseline.map(item => item.score));
});
```

- [x] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/community.test.js tests/frontend-wiring.test.js`  
Expected: FAIL because work/profile fields and controls are absent.

- [x] **Step 3: Normalize challenge metadata and resolve public archetypes server-side**

```js
const challenge = input?.challenge && typeof input.challenge.id === 'string'
  ? { id: cleanText(input.challenge.id, 100), title: cleanText(input.challenge.title, 80) }
  : null;
const publicArchetypes = this.resolveShareableArchetypes(user.id, input?.archetypeIds);
```

Never accept client-provided archetype names or visibility.

- [x] **Step 4: Add optional matching weight without changing disabled behavior**

```js
const enabledArchetypes = normalizeIds(input?.archetypeIds);
const structural = baseMatchScore(query, work);
if (!enabledArchetypes.length) return structural;
const archetypeScore = overlap(enabledArchetypes, work.publicArchetypes.map(item => item.id));
return { score: Math.round(structural.score * 0.85 + archetypeScore * 15),
  reasons: archetypeScore ? [...structural.reasons, '主动公开的选择原型相近'] : structural.reasons,
  scoreBreakdown: { structural: structural.score, archetype: Math.round(archetypeScore * 100) } };
```

- [x] **Step 5: Reuse publish and matcher modals in the browser**

When a challenge is complete, `openPublish()` reads the active challenge result from the bridge and displays opt-in checkboxes for currently public archetypes. `openMatcher()` leaves archetype matching unchecked by default and submits only checked IDs.

- [x] **Step 6: Render public archetypes with non-diagnostic copy**

Show small tags on challenge works and details. Add the fixed note “近期选择方式，会随新记录变化，不是心理诊断。” Do not show private, match-only, or rejected evidence.

- [x] **Step 7: Run tests and commit**

Run: `npm test`  
Expected: all tests PASS.

```powershell
git add server/community.js public/js/community.js public/js/api.js public/index.html public/style.css tests/community.test.js tests/frontend-wiring.test.js
git commit -m "feat(community): match opt-in choice archetypes"
```

### Task 8: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/DEMO.md`
- Modify: `docs/superpowers/plans/2026-09-15-daily-hot-choice-mirror.md`

**Interfaces:**
- Consumes the completed daily challenge, publishing, profile, and matching flows.
- Produces truthful current-feature documentation and a checked implementation plan.

- [x] **Step 1: Run the complete automated suite**

Run: `npm test`  
Expected: all tests PASS with zero failures.

- [x] **Step 2: Run the server smoke checks**

Run the app with a temporary `COMMUNITY_DATA_PATH`, then request `/healthz`, `/api/capabilities`, and the authenticated daily challenge endpoint.  
Expected: health is `ok`, capabilities remain valid, unauthenticated challenge requests return `401`, and authenticated requests return a four-round challenge.

- [x] **Step 3: Complete the manual browser checklist**

- Free-play still reaches the original report and publish dialog.
- “每日热题” appears beside “沙盘报告”.
- Built-in fallback challenge completes from intro through reflection.
- Refresh during a round restores the draft.
- Confirmed observations affect the profile; rejected ones do not.
- Archetypes remain private until individually enabled.
- Challenge works publish to the existing community.
- Matching with tags disabled matches the old result; enabling selected tags adds a separate reason.
- Mobile layout remains usable at 390 px width.

- [x] **Step 4: Update documentation truthfully**

Remove “下一阶段” from the README daily-hot heading only after all acceptance checks pass. Add the new three-minute flow to `docs/DEMO.md`, including the fallback path and privacy note.

- [x] **Step 5: Mark completed plan checkboxes and commit**

```powershell
git add README.md docs/DEMO.md docs/superpowers/plans/2026-09-15-daily-hot-choice-mirror.md
git commit -m "docs(game): document daily choice mirror mode"
```

- [x] **Step 6: Push and verify GitHub state**

Run: `git push origin main`  
Expected: `main` advances successfully and `git status -sb` reports `main...origin/main` with a clean worktree.
