// 校验 状态栏 HTML 内嵌 <script type="module"> 的语法（指向实际路径）
import fs from 'node:fs';
import vm from 'node:vm';

const files = [
  'dist/伊瑟利亚/核心/状态栏'
];

let allOk = true;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('跳过（不存在）:', f); allOk = false; continue; }
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) { console.log('❌ 未找到内嵌 script:', f); allOk = false; continue; }
  try {
    new vm.Script(m[1]);
    console.log('✅', f, '内嵌脚本语法 OK (' + m[1].length + ' chars)');
  } catch (e) {
    console.error('❌', f, '语法错误:', e.message);
    allOk = false;
  }
}

process.exit(allOk ? 0 : 1);
