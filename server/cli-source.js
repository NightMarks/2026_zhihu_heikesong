/**
 * 本地 CLI 数据源适配器（可选）
 * ─────────────────────────────────────────────────────────
 * 场景：本机已通过 zhihu-cli 完成授权（凭证存在系统钥匙串），
 *      但没有把明文 Access Secret 写进 .env。
 *
 * 此时服务端可以改为调用本地 CLI 取数，效果与直连 HTTP API 一致。
 * 生产部署请用 .env 里的 ZHIHU_ACCESS_SECRET 直连，不要依赖本地 CLI。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const run = promisify(execFile);

/**
 * CLI 调用串行队列
 * ─────────────────────────────────────────────────────────
 * 每次调用都会 spawn 一个 bash 子进程去跑 zhihu-cli。实测并发调用时
 * 子进程会互相冲突，导致同一批请求全部返回非 0 退出码。
 * 前端"一次抽 3 个查询词"必然产生并发，因此这里把所有 CLI 调用排成队列，
 * 一次只跑一个；对上层仍是普通的 async 接口，无需改调用方。
 */
let cliQueue = Promise.resolve();
function serialize(fn) {
  const next = cliQueue.then(fn, fn);
  // 避免某次失败把整条链变成 rejected 状态
  cliQueue = next.then(() => {}, () => {});
  return next;
}

/** 带一次重试的 CLI 执行：偶发的子进程启动失败不应让整批内容降级 */
async function runCli(args, opts) {
  return serialize(async () => {
    try {
      return await run('bash', args, opts);
    } catch (e) {
      await new Promise(r => setTimeout(r, 350));
      return await run('bash', args, opts);
    }
  });
}

// 常见的内置 CLI 位置；也可用环境变量 ZHIHU_CLI 覆盖
const CANDIDATES = [
  process.env.ZHIHU_CLI,
  '/private/var/folders/g6/s8f2dfs51ys7s16sj8tk2_cc0000gn/T/AppTranslocation/50CDBBA7-478F-49B4-B58C-0BD769573942/d/看山工作台.app/Contents/Resources/box-agent-runtime/bin/_internal/box_agent/skills/zhihu/scripts/run.sh',
].filter(Boolean);

export function findCli() {
  for (const p of CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

export async function cliAvailable() {
  const cli = findCli();
  if (!cli) return false;
  try {
    const { stdout } = await run('bash', [cli, 'status'], { timeout: 15000 });
    const j = JSON.parse(stdout);
    return !!(j.installed && j.auth?.configured);
  } catch { return false; }
}

/** 站内搜索 —— 返回与 HTTP API 完全一致的结构 */
export async function cliSearch(query, count = 5) {
  const cli = findCli();
  if (!cli) throw new Error('未找到本地 zhihu-cli');
  const { stdout } = await runCli(
    [cli, 'search', 'zhihu', '--query', query, '--count', String(Math.min(count, 10))],
    { timeout: 40000, maxBuffer: 8 * 1024 * 1024 }
  );
  const j = JSON.parse(stdout);
  if (j.Code !== 0) throw new Error(j.Message || 'CLI 搜索失败');
  return j.Data;
}

/** 热榜 */
export async function cliHot(limit = 30) {
  const cli = findCli();
  if (!cli) throw new Error('未找到本地 zhihu-cli');
  const { stdout } = await runCli([cli, 'hot', '--limit', String(Math.min(limit, 30))],
    { timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  const j = JSON.parse(stdout);
  if (j.Code !== 0) throw new Error(j.Message || 'CLI 热榜失败');
  return j.Data;
}

/** 直答 */
export async function cliAnswer(query) {
  const cli = findCli();
  if (!cli) throw new Error('未找到本地 zhihu-cli');
  const { stdout } = await runCli([cli, 'answer', '--query', query],
    { timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
  try {
    const j = JSON.parse(stdout);
    return j?.choices?.[0]?.message?.content
        ?? j?.Data?.Content ?? j?.Content ?? stdout.trim();
  } catch { return stdout.trim(); }
}

/** 本人创作 —— 用于回链校验 */
export async function cliMyContents(limit = 50, offset = 0) {
  const cli = findCli();
  if (!cli) throw new Error('未找到本地 zhihu-cli');
  const { stdout } = await runCli(
    [cli, 'me', 'contents', '--type', 'all',
     '--limit', String(Math.min(limit, 50)), '--offset', String(offset)],
    { timeout: 40000, maxBuffer: 8 * 1024 * 1024 }
  );
  const j = JSON.parse(stdout);
  if (j.Code !== 0) throw new Error(j.Message || 'CLI 读取创作失败');
  return j.Data;
}
