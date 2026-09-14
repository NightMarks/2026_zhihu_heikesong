# 沙游心语后续开发实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 把当前可本地运行的黑客松 Demo，升级为能够稳定读取知乎内容、完成真实互动解锁、生成沙盘报告并公开演示的作品。

**架构：** 保留 Express 后端和原生 HTML/CSS/JavaScript 前端。先建立测试边界，再修复 Windows 数据源和 OAuth，随后拆分前端、增强沙盘体验，最后增加持久化和部署配置。

**技术栈：** Node.js LTS、Express、原生 JavaScript、`node:test`、知乎开放平台 API、浏览器 `localStorage`（过渡阶段）。

## 阶段实施状态（2026-09-15）

- **P0 · 接入基线：已完成。** Windows/macOS CLI 探测、知乎真实内容数据源和 OAuth state 防护已接入。
- **P1 · 提高游戏完成度：已完成本轮目标。** 登录门禁、AI 分析方向、50 步撤销/重做、旋转、缩放、图层调整、PNG 导出，以及状态/API/用户中心/社区模块拆分已完成。
- **P2 · 部署和真实社区：已完成单实例比赛版。** 作品、点赞、收藏、评论、隐私过滤、游标分页、旧作品迁移、Docker 持久卷和三分钟演示流程已接入。多实例正式生产环境仍需将 JSON 存储与内存 Session 迁移到数据库和 Redis。

## 全局约束

- 真实秘钥只能写入 `.env`，不得提交到 Git。
- `node_modules/`、`.env`、日志和本地数据不得提交。
- 每项任务必须先写测试、再实现、最后单独提交。
- 知乎站内互动由用户本人完成，不得伪造开放平台没有提供的写入能力。
- 沙盘报告使用温和、非诊断式表达，并明确不能替代专业心理咨询。
- 开发基准为 Windows 11 与 Node.js LTS，不得写死个人电脑路径。

---

## 当前基线

已有功能：Express 服务、沙具解锁与拖拽、知乎搜索与热榜接口、OAuth 框架、回链验证、AI/本地报告、离线示例和本地社区。

主要缺口：Windows CLI 适配失效、OAuth 缺少一次性 `state`、没有自动测试、`public/app.js` 超过 1000 行、社区数据只在浏览器、本地回调不能完成真实 OAuth。

---

### 任务 1：建立可测试的服务器基线

**文件：**

- 创建：`server/app.js`
- 修改：`server/index.js`
- 修改：`package.json`
- 创建：`tests/server-smoke.test.js`

**接口：** `createApp(options)` 返回未监听端口的 Express 应用；`startServer(options)` 负责探测数据源并监听。

- [ ] **步骤 1：编写失败的能力接口测试**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

test('capabilities work without credentials', async () => {
  const server = createApp({ source: 'none' }).listen(0);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/capabilities`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).contentApi, false);
  server.close();
});
```

- [ ] **步骤 2：运行 `npm test`，确认因 `server/app.js` 不存在而失败。**
- [ ] **步骤 3：将中间件和路由移入 `server/app.js`，导入模块时不得自动占用端口。**
- [ ] **步骤 4：在 `package.json` 增加 `"test": "node --test"`，运行 `npm test` 并确认通过。**
- [ ] **步骤 5：提交。**

```powershell
git add package.json server tests
git commit -m "test(server): add HTTP smoke-test baseline"
```

---

### 任务 2：打通 Windows 知乎数据源

**文件：**

- 修改：`server/cli-source.js`
- 修改：`.env.example`
- 修改：`README.md`
- 创建：`tests/cli-source.test.js`

**接口：** `resolveCliExecutable(env, platform)` 返回 CLI 路径或 `null`；`runCli(args, options)` 使用参数数组调用可执行文件；`ZHIHU_CLI_PATH` 可覆盖自动探测。

- [ ] **步骤 1：测试 Windows、macOS、环境变量覆盖和 CLI 缺失四种情况。**
- [ ] **步骤 2：运行 `npm test -- tests/cli-source.test.js`，确认硬编码实现失败。**
- [ ] **步骤 3：移除 `/private/var/.../AppTranslocation/...` 和 Windows 上的强制 `bash`。**
- [ ] **步骤 4：Windows 自动检查 `%LOCALAPPDATA%\ZhihuCLI\current\zhihu-cli.exe`。**
- [ ] **步骤 5：启动验证；CLI 缺失时必须降级到离线示例而不是崩溃。**
- [ ] **步骤 6：提交。**

```powershell
git add server/cli-source.js tests/cli-source.test.js .env.example README.md
git commit -m "fix(zhihu): support Windows CLI discovery"
```

---

### 任务 3：加固 OAuth 登录

**文件：**

- 修改：`server/index.js`
- 修改：`server/zhihu.js`
- 创建：`tests/oauth.test.js`

**接口：** `authorizeUrl(appId, redirectUri, state)` 必须携带 `state`；Session 保存 `oauthState` 与 `oauthStartedAt`；回调只接受十分钟内且未使用的匹配 state。

- [ ] **步骤 1：测试 state 缺失、错误、过期、重复使用均返回 400。**
- [ ] **步骤 2：生成安全随机 state。**

```javascript
import crypto from 'node:crypto';
const state = crypto.randomBytes(32).toString('base64url');
```

- [ ] **步骤 3：回调成功或失败后立即删除 state，不记录授权码或 token。**
- [ ] **步骤 4：生产环境 Cookie 使用 `httpOnly`、`sameSite: 'lax'` 和 `secure: true`。**
- [ ] **步骤 5：运行全部测试并提交。**

```powershell
npm test
git add server tests/oauth.test.js
git commit -m "fix(auth): validate one-time OAuth state"
```

---

### 任务 4：稳定知乎 API 与沙盘报告

**文件：**

- 修改：`server/zhihu.js`
- 修改：`server/index.js`
- 创建：`tests/zhihu-client.test.js`
- 创建：`tests/report.test.js`

**接口：** `requestZhihu(path, options)` 统一超时、请求头、JSON 解析和错误；直答使用 `/v1/chat/completions`；搜索数量限制为 1–20，热榜为 1–30。

- [ ] **步骤 1：用模拟 fetch 测试成功、401、429、500、超时和非 JSON 响应。**
- [ ] **步骤 2：将上游失败转换为稳定错误，不向浏览器返回 token 或完整响应。**

```javascript
{
  code: 'ZHIHU_UPSTREAM_ERROR',
  status: 502,
  retryable: false,
  message: '知乎服务暂时不可用'
}
```

- [ ] **步骤 3：空沙盘返回 400，并限制沙具数量和文本长度。**
- [ ] **步骤 4：测试 AI 失败时仍生成本地报告。**
- [ ] **步骤 5：运行 `npm test` 并提交。**

```powershell
git add server tests
git commit -m "fix(api): harden Zhihu requests and report fallback"
```

---

### 任务 5：拆分前端并增强沙盘体验

**文件：**

- 创建：`public/js/state.js`
- 创建：`public/js/api.js`
- 创建：`public/js/explore.js`
- 创建：`public/js/sandbox.js`
- 创建：`public/js/report.js`
- 创建：`public/js/community.js`
- 修改：`public/app.js`
- 修改：`public/index.html`
- 修改：`public/style.css`

**接口：** `state.js` 提供 `loadState/saveState/resetState`；`api.js` 提供能力、搜索、验证和报告请求；`sandbox.js` 提供 `addToy/moveToy/removeToy/undo/redo/renderSandbox`。

- [ ] **步骤 1：逐个移动模块，每次移动后完成“探索→解锁→摆放→报告”回归。**
- [ ] **步骤 2：增加撤销、重做、旋转、缩放和图层调整，最多保留 50 步历史。**
- [ ] **步骤 3：增加作品图片导出，并附带非心理诊断说明。**
- [ ] **步骤 4：检查 390×844、768×1024、1440×900 三种视口且无横向溢出。**
- [ ] **步骤 5：提交。**

```powershell
git add public
git commit -m "refactor(frontend): modularize game and improve sandbox controls"
```

---

### 任务 6：实现作品与社区持久化

**文件：**

- 创建：`server/store.js`
- 创建：`server/community.js`
- 创建：`data/.gitkeep`
- 修改：`.gitignore`
- 修改：`server/app.js`
- 创建：`tests/community.test.js`

**接口：** `saveWork(work)` 返回作品 ID；`getWork(id, viewer)` 执行隐私校验；`listPublicWorks(cursor, limit)` 返回公开作品；本地数据写入被忽略的 `data/local-store.json`。

- [ ] **步骤 1：测试公开、仅自己、仅好友三种权限；好友关系未实现前按仅自己处理。**
- [ ] **步骤 2：使用“临时文件→重命名”原子写入，损坏数据时停止写入并记录错误。**
- [ ] **步骤 3：社区前端改用服务端接口；离线内容标记“仅保存在此设备”。**
- [ ] **步骤 4：运行全部测试并提交。**

```powershell
npm test
git add server data .gitignore tests/community.test.js public
git commit -m "feat(community): persist works with privacy controls"
```

---

### 任务 7：部署与比赛演示验收

**文件：**

- 创建：`docs/DEMO.md`
- 创建：`docs/DEPLOYMENT.md`
- 修改：`README.md`
- 修改：`.env.example`

**接口：** `GET /api/health` 返回版本、运行状态和数据源类型，不得返回秘钥；演示文档覆盖完整三分钟体验。

- [ ] **步骤 1：在公网 HTTPS 环境配置 API Key、OAuth App ID/App Key 和完全匹配的回调地址。**
- [ ] **步骤 2：执行发布前检查。**

```powershell
npm ci
npm test
git status --short
git grep -n "ZHIHU_API_KEY="
```

预期：测试通过、工作区干净、仓库中没有真实秘钥。

- [ ] **步骤 3：按“随机沙具→知乎内容→回链验证→解锁→摆放→报告→社区”彩排三分钟演示。**
- [ ] **步骤 4：准备离线演示路径，并明确标注演示数据、报告边界和隐私策略。**
- [ ] **步骤 5：提交发布文档。**

```powershell
git add README.md .env.example docs
git commit -m "docs(release): add deployment and demo runbook"
```

---

## 推荐时间安排

1. 第一周：任务 1–2，建立测试并打通 Windows 数据源。
2. 第二周：任务 3–4，完成安全登录和稳定的知乎 API/报告闭环。
3. 第三周：任务 5，集中提升沙盘游戏感和移动端体验。
4. 第四周：任务 6–7，完成持久化、部署、文档和演示彩排。

## 每次开发的固定流程

```powershell
git pull --rebase origin main
git switch -c codex/任务短名称
npm ci
npm test
# 写一个失败测试，再进行最小实现
npm test
git status --short
git add 精确文件路径
git commit -m "类型(范围): 简短说明"
git push -u origin 当前分支名
```

合并前由另一位队友确认：需求符合、测试通过、没有秘钥、移动端可用、离线降级仍有效。
