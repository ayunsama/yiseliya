// 校验 状态栏 HTML 内嵌 <script type="module"> 的语法
const fs = require('fs');
const vm = require('vm');

const files = [
  'dist/变量结构与状态栏代码/状态栏',
  'dist/变量结构与状态栏代码/状态栏代码'
];

let allOk = true;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('跳过（不存在）:', f); continue; }
  const c = fs.readFileSync(f, 'utf8');
  // 匹配第一个 <script type="module">...</script>
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

// 也校验 升级代码（纯 JS）
try {
  new vm.Script(fs.readFileSync('dist/变量结构与状态栏代码/升级代码', 'utf8'));
  console.log('✅', '升级代码', '语法 OK');
} catch (e) {
  console.error('❌', '升级代码', '语法错误:', e.message);
  allOk = false;
}

process.exit(allOk ? 0 : 1);
