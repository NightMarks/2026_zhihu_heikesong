import test from 'node:test';
import assert from 'node:assert/strict';
import * as cli from '../server/cli-source.js';

test('findCli discovers Windows CLI from LOCALAPPDATA', () => {
  const expected = 'C:\\Users\\dev\\AppData\\Local\\ZhihuCLI\\current\\zhihu-cli.exe';
  assert.equal(cli.findCli({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\dev\\AppData\\Local' }, existsSync: value => value === expected }), expected);
});

test('findCli discovers macOS CLI from PATH without personal paths', () => {
  const expected = '/usr/local/bin/zhihu-cli';
  assert.equal(cli.findCli({ platform: 'darwin', env: { PATH: '/usr/local/bin:/usr/bin' }, existsSync: value => value === expected }), expected);
});

test('cliInvocation runs Windows binary directly and shell scripts via bash', () => {
  assert.equal(typeof cli.cliInvocation, 'function');
  assert.deepEqual(cli.cliInvocation('C:\\ZhihuCLI\\zhihu-cli.exe', 'win32'), { file: 'C:\\ZhihuCLI\\zhihu-cli.exe', argsPrefix: [] });
  assert.deepEqual(cli.cliInvocation('/opt/zhihu/run.sh', 'darwin'), { file: 'bash', argsPrefix: ['/opt/zhihu/run.sh'] });
});

test('normalizeCliPayload rejects CLI error envelopes', () => {
  assert.equal(typeof cli.normalizeCliPayload, 'function');
  assert.throws(() => cli.normalizeCliPayload({ ok: false, error: { message: '鉴权失败' } }, '读取失败'), /鉴权失败/);
});
