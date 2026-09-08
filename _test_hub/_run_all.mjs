// 批量运行 _test_hub 全部 test_*.mjs（逐个独立进程）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = '_test_hub';
const tests = fs.readdirSync(dir)
  .filter(f => /^test_.*\.mjs$/.test(f))
  .filter(f => !['test_loose_schema.mjs'].includes(f)) // 单独处理
  .sort();

let allOk = true;
for (const f of tests) {
  try {
    const out = execSync(`node --experimental-strip-types ${path.join(dir, f)}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = out.trim().split('\n');
    const tail = lines[lines.length - 1];
    const passLine = lines.find(l => /通过 \/ .*失败/.test(l)) || tail;
    // 通过 = 无 ❌ 行，且（有汇总 0 失败 或 全 ✅行）；退出码 0 且不含 ❌ 即为通过
    const hasFailMark = /❌/.test(out);
    const good = !hasFailMark && (/0 失败/.test(passLine) || /全部通过/.test(passLine) || /语法 OK/.test(passLine) || /^✅/m.test(out));
    console.log((good ? '✅' : '❌') + ' ' + f + '  → ' + passLine.trim());
    if (!good) allOk = false;
  } catch (e) {
    console.log('❌ ' + f + '  进程退出码 ' + e.status);
    console.log(String(e.stdout || '').trim().split('\n').slice(-15).join('\n'));
    console.log(String(e.stderr || '').trim().split('\n').slice(-5).join('\n'));
    allOk = false;
  }
}
console.log(allOk ? '\n全部通过' : '\n存在失败');
process.exit(allOk ? 0 : 1);
