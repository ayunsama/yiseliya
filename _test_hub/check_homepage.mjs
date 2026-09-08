// 校验 首页代码 HTML 内嵌 <script> 语法
import fs from 'node:fs';
import vm from 'node:vm';
const p = 'dist/伊瑟利亚/核心/首页代码';
const c = fs.readFileSync(p, 'utf8');
const m = c.match(/<script[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.log('❌ 未找到 script'); process.exit(1); }
try {
  new vm.Script(m[1]);
  console.log('✅ 首页代码 内嵌脚本语法 OK (' + m[1].length + ' chars)');
} catch (e) {
  console.error('❌ 语法错误:', e.message);
  process.exit(1);
}
