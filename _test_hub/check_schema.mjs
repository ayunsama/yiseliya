// 校验 变量结构脚本 TS **语法**（只解析，不做类型检查；原文件第一行 @ts-nocheck）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const p = 'dist/伊瑟利亚/核心/变量结构脚本';
const t = fs.readFileSync(p, 'utf8');
fs.writeFileSync('_test_hub/_schema_check.ts', `declare const z: any; declare const _: any; declare const $: any; declare const registerMvuSchema: any;\n` + t.split('\n').filter(l => !l.startsWith('import { registerMvuSchema') && !l.includes('registerMvuSchema(Schema)')).join('\n'));
try {
  execSync('npx tsc --ignoreConfig --noCheck --module esnext --target es2020 _test_hub/_schema_check.ts 2>&1', { stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
  console.log('✅ 变量结构脚本 TS 语法 OK');
} catch (e) {
  console.log('❌ TS 语法错误：');
  console.log(String(e.stdout) + String(e.stderr));
  process.exit(1);
}
