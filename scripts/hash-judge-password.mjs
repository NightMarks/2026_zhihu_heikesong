import process from 'node:process';
import { hashJudgePassword } from '../server/judge-auth.js';

let password = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/[\r\n]+$/, '');

if (password.length < 12) {
  console.error('密码至少需要 12 个字符，请通过标准输入传入。');
  process.exitCode = 1;
} else {
  process.stdout.write(`${hashJudgePassword(password)}\n`);
}
