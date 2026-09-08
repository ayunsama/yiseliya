import fs from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const src = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
const script = m[1];
try { new vm.Script(script); assert('script 语法 OK', true); } catch (e) { console.log('✗ ' + e.message); process.exit(1); }

// 切段：解析工具函数（findCharOutOfString ~ parseAiNpcJson + normalizeAiNpc）
const s0 = script.indexOf('function findCharOutOfString');
const e0 = script.indexOf('function generateNpcWithAI()');
const seg = script.slice(s0, e0);
let api;
try {
  const fn = new Function('var customNpcIdCounter = 0;\n' + seg + '\n; return { parseAiNpcJson: parseAiNpcJson, normalizeAiNpc: normalizeAiNpc };');
  api = fn();
} catch (e) { console.log('✗ 切段失败: ' + e.message); process.exit(1); }
const parseAiNpcJson = api.parseAiNpcJson;
const normalizeAiNpc = api.normalizeAiNpc;

console.log('===== ① 用户报错场景：合法对象 =====');
const SAMPLE = '{ "name": "伊格妮斯", "race": "龙裔", "gender": "女", "age": 19, "identity": "流浪佣兵", "className": "魔剑士", "faction": "无", "relation": "旅途结识", "rank": "超凡", "level": 6, "appearance": "银发红瞳", "personality": "热情", "inner": "想变强", "desc": "流浪的龙裔佣兵", "stats": { "力量": 14, "敏捷": 12, "体质": 13, "智力": 12, "感知": 10, "魅力": 11 }, "skills": [ { "name": "龙炎斩", "desc": "消耗SP2，附加1d6火焰" } ], "items": [] }';
let p = parseAiNpcJson(SAMPLE);
assert('用户样例 → 解析成功', p && p.name === '伊格妮斯' && p.className === '魔剑士');
assert('样例 stats/skills 完整', p.stats && p.stats.力量 === 14 && p.skills.length === 1);

console.log('\n===== ② AI 脏输出容错 =====');
// 行注释（对象内）
p = parseAiNpcJson('{ "name": "A", "desc": "x", // 这是注释\n "race": "精灵" }');
assert('// 行注释容错', p && p.name === 'A' && p.race === '精灵');
// 块注释
p = parseAiNpcJson('{ "name": "B", /* 块注释 */ "race": "矮人" }');
assert('/* */ 块注释容错', p && p.name === 'B' && p.race === '矮人');
// 尾逗号
p = parseAiNpcJson('{ "name": "C", "stats": { "力量": 12, }, "items": [], }');
assert('尾逗号容错', p && p.name === 'C' && p.stats.力量 === 12);
// 字符串内裸换行
p = parseAiNpcJson('{ "name": "D", "desc": "第一行\n第二行继续的背景故事", "race": "人类" }');
assert('字符串内裸换行容错', p && p.name === 'D' && p.desc.indexOf('第一行') !== -1 && p.desc.indexOf('第二行') !== -1);
// 围栏
p = parseAiNpcJson('```json\n{ "name": "E", "race": "兽人" }\n```');
assert('```json 围栏剥离', p && p.name === 'E');
// 数组包装（AI 偶尔返回数组）→ 取第一个对象
p = parseAiNpcJson('[{ "name": "F1", "race": "A" }, { "name": "F2", "race": "B" }]');
assert('数组包装 → 取首个对象', p && p.name === 'F1');
// 前后杂文
p = parseAiNpcJson('好的，生成结果如下：\n{ "name": "G", "race": "翼民" }\n希望你喜欢！');
assert('前后杂文容忍', p && p.name === 'G');
// 字符串内含特殊字符
p = parseAiNpcJson('{ "name": "H", "desc": "含 { } [ ] 与 \\"转义引号\\"", "race": "海妖" }');
assert('字符串内 { } [ ] 转义不干扰', p && p.name === 'H' && p.desc.indexOf('{') !== -1);
// 非法 → 抛错（不吞）
let threw = false;
try { parseAiNpcJson('完全没有 JSON'); } catch (e) { threw = true; }
assert('无对象 → 抛错', threw);

console.log('\n===== ③ normalizeAiNpc 仍正常 =====');
let n = normalizeAiNpc({ 姓名: '焰舞', 种族: '龙裔', 职业: '战士', 等级: 13, 属性: { 力量: 19 } });
assert('normalize 中文键 + 等阶推断', n.name === '焰舞' && n.rank === '史诗' && n.stats.力量 === 19);
n = normalizeAiNpc(null);
assert('normalize null 容错', n && n.name === '' && n.stats.力量 === 8);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
