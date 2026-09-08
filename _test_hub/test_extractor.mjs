import fs from 'node:fs';
import vm from 'node:vm';
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const fnText = src.slice(src.indexOf('        function extractJsonArray'), src.indexOf('        /* ================= 自创职业检测'));
const fn = new Function(fnText + '; return { extractJsonArray };');
const api = fn();
let pass = 0, fail = 0;
function assert(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

console.log('========== extractJsonArray 行为 ==========');
// 场景1：AI 输出后跟尾随说明文字（用户报错的元凶）
const r1 = api.extractJsonArray('这是给你的装备：\n```json\n[{"name":"神器","type":"武器","effect":"+10","desc":"x"}]\n```\n希望你喜欢！');
assert('围栏+尾随文字 → 解析成功', Array.isArray(r1) && r1[0].name === '神器', JSON.stringify(r1));
// 场景2：无围栏，JSON 后带尾随标点/文字
const r2 = api.extractJsonArray('[{"name":"剑","effect":"x"}] 祝好运！');
assert('无围栏+尾随文字 → 解析成功', Array.isArray(r2) && r2[0].name === '剑');
// 场景3：JSON 描述内含 ] 字符（旧 lastIndexOf 会截错）
const r3 = api.extractJsonArray('[{"name":"宝箱","effect":"开启获得 2] 金币"},{"name":"盾","effect":"+2"}]');
assert('描述含] → 占位配对提取成功', r3.length === 2 && r3[1].name === '盾', JSON.stringify(r3));
// 场景4：fenced + 内部描述含]
const r4 = api.extractJsonArray('```json\n[{"name":"a","desc":"[稀有]"},{"name":"b"}]\n```');
assert('围栏+描述含] → 成功', r4.length === 2 && r4[0].desc === '[稀有]');
// 场景5：尾随逗号（JSON 后多逗号）
const r5 = api.extractJsonArray('[{"name":"x","effect":"a"},]');
assert('尾随逗号 → 自动修复解析', r5.length === 1 && r5[0].name === 'x', JSON.stringify(r5));
// 场景6：无效输入 → 抛出带预览的错误（不裸奔）
let errMsg = '';
try { api.extractJsonArray('这不是JSON内容'); } catch (e) { errMsg = e.message; }
assert('无JSON → 抛错且带原文预览', errMsg.includes('JSON解析失败') && errMsg.includes('原文尾部'));
// 场景7：对象JSON（{}）而非数组
const r7 = api.extractJsonArray('```json\n{"name":"混血","attributes":"+2"}\n```');
assert('对象JSON → 解析成功', r7 && r7.name === '混血', JSON.stringify(r7));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
