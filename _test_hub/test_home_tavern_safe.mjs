/**
 * 首页代码 · 酒馆正则注入结构性安全检查
 * 回滚版实况：extractJsonArray 保留 '$1'（用户环境 findRegex 无捕获组 → 引擎把 $1 替换为空串，语法无损，已亲测可用）。
 * 此处只守护真正的结构性破坏源：
 *   - {{ 宏展开锚点（substituteParams）
 *   - $<name> / {{match}}（SillyTavern 引擎展开锚点）
 *   - </script / <!-- 使浏览器提前闭合脚本
 */
import fs from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const src = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('✗ 未找到 script'); process.exit(1); }
const script = m[1];

assert('script 语法 OK', (() => { try { new vm.Script(script); return true; } catch (e) { return false; } })());
assert('script 内无 {{ 宏起点（substituteParams 不会触发）', !/\{\{/.test(script));
assert('script 内无 $<name> 展开锚点', !/\$</.test(script));
assert('script 内无 {{match}} 锚点', !/\{\{match\}\}/i.test(script));
assert('script 内无 </script 提前闭合', !/<\/script/i.test(script));
assert('script 内无 <!-- 注释序列', !/<!--/.test(script));
// 模拟酒馆引擎的无捕获组情形：$N → 空串（用户实际环境）→ 处理后仍须语法 OK
const sim = script.replaceAll(/\$(\d+)|\$<([^>]+)>/g, () => '');
assert('模拟引擎无捕获组展开（$N→空）后语法仍 OK', (() => { try { new vm.Script(sim); return true; } catch (e) { return false; } })());
// parseAiNpcJson 定义存在（本会话修复：定义曾丢失导致 ReferenceError 被吞）
assert('parseAiNpcJson 定义存在', script.includes('function parseAiNpcJson('));
assert('parseAiNpcJson 已被调用（generateNpcWithAI）', script.includes('parseAiNpcJson(resultText)'));
// 宽容解析工具链齐全
assert('宽容解析工具函数齐全', ['findCharOutOfString','findObjectEnd','looseCleanJson','unwrapAiResult'].every(fn => script.includes('function ' + fn)));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
