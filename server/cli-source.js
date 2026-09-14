/** Cross-platform adapter for the locally authenticated zhihu-cli. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);

let cliQueue = Promise.resolve();
function serialize(fn) {
  const next = cliQueue.then(fn, fn);
  cliQueue = next.then(() => {}, () => {});
  return next;
}

export function cliCandidates({ platform = process.platform, env = process.env } = {}) {
  const names = [];
  if (env.ZHIHU_CLI_PATH) names.push(env.ZHIHU_CLI_PATH);
  if (env.ZHIHU_CLI) names.push(env.ZHIHU_CLI);

  if (platform === 'win32' && env.LOCALAPPDATA) {
    names.push(path.win32.join(env.LOCALAPPDATA, 'ZhihuCLI', 'current', 'zhihu-cli.exe'));
  }

  const executable = platform === 'win32' ? 'zhihu-cli.exe' : 'zhihu-cli';
  const separator = platform === 'win32' ? ';' : ':';
  for (const directory of String(env.PATH || '').split(separator)) {
    if (!directory) continue;
    names.push(platform === 'win32'
      ? path.win32.join(directory, executable)
      : path.posix.join(directory, executable));
  }

  if (platform === 'darwin') {
    names.push('/opt/homebrew/bin/zhihu-cli', '/usr/local/bin/zhihu-cli');
  } else if (platform === 'linux') {
    names.push('/usr/local/bin/zhihu-cli', '/usr/bin/zhihu-cli');
  }

  return [...new Set(names.filter(Boolean))];
}

export function findCli({
  platform = process.platform,
  env = process.env,
  existsSync = fs.existsSync,
} = {}) {
  for (const candidate of cliCandidates({ platform, env })) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
}

export function cliInvocation(cliPath, platform = process.platform) {
  if (platform !== 'win32' && /\.sh$/i.test(cliPath)) {
    return { file: 'bash', argsPrefix: [cliPath] };
  }
  return { file: cliPath, argsPrefix: [] };
}

async function runCli(args, opts = {}) {
  const cliPath = findCli();
  if (!cliPath) throw new Error('未找到本地 zhihu-cli，请先安装并完成 auth 配置');
  const invocation = cliInvocation(cliPath);
  return serialize(() => exec(
    invocation.file,
    [...invocation.argsPrefix, ...args],
    { windowsHide: true, ...opts },
  ));
}

export function normalizeCliPayload(payload, label = 'CLI 请求失败') {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.ok === false) {
    throw new Error(payload.error?.message || payload.message || label);
  }
  if (payload.Code !== undefined && payload.Code !== 0 && payload.Code !== 20000) {
    const error = new Error(payload.Message || label);
    error.code = payload.Code;
    throw error;
  }
  return payload.Data ?? payload.data ?? payload;
}

async function runJson(args, label, opts = {}) {
  const { stdout } = await runCli(args, {
    timeout: 40000,
    maxBuffer: 8 * 1024 * 1024,
    ...opts,
  });
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`${label}: zhihu-cli 返回了无法解析的数据`);
  }
  return normalizeCliPayload(payload, label);
}

export async function cliAvailable() {
  if (!findCli()) return false;
  try {
    const { stdout } = await runCli(['auth', 'status'], { timeout: 15000 });
    const payload = JSON.parse(stdout);
    return payload.ok === true && Boolean(
      payload.source || payload.masked || payload.environment_set || payload.keychain === 'available',
    );
  } catch {
    return false;
  }
}

export async function cliSearch(query, count = 5) {
  return runJson(
    ['search', 'zhihu', '--query', query, '--count', String(Math.min(count, 10))],
    'CLI 搜索失败',
  );
}

export async function cliHot(limit = 30) {
  return runJson(['hot', '--limit', String(Math.min(limit, 30))], 'CLI 热榜失败');
}

export async function cliAnswer(query) {
  const { stdout } = await runCli(['answer', '--query', query], {
    timeout: 90000,
    maxBuffer: 8 * 1024 * 1024,
  });
  try {
    const payload = JSON.parse(stdout);
    normalizeCliPayload(payload, 'CLI 直答失败');
    return payload?.choices?.[0]?.message?.content
      ?? payload?.Data?.Content
      ?? payload?.Content
      ?? stdout.trim();
  } catch (error) {
    if (error instanceof SyntaxError) return stdout.trim();
    throw error;
  }
}

export async function cliMyContents(limit = 20, offset = 0, type = 'all') {
  return runJson([
    'me', 'contents', '--type', type,
    '--limit', String(Math.min(limit, 50)), '--offset', String(offset),
  ], 'CLI 读取创作失败');
}

export async function cliMyFollowees(limit = 20, offset = 0) {
  return runJson([
    'me', 'followees', '--limit', String(Math.min(limit, 50)), '--offset', String(offset),
  ], 'CLI 读取关注失败');
}
