/**
 * 首页代码 · 传奇装备（AI 定制）增强测试
 * 验证：
 *  1. 数量自定义下拉存在（默认3，可选1~6）
 *  2. JS 读取数量（leg-count），默认3，钳制 1~6
 *  3. 提示词：恰好 N 件 / 数值规范（+N -N 固定值）/ 禁百分比条款 / 按等级校准
 *  4. 面板文案（提示行 / placeholder / 风格按钮引导）不含百分比误导
 */
import fs from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const src = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('✗ 未找到 script'); process.exit(1); }
const script = m[1];
try { new vm.Script(script); assert('首页代码 script 语法 OK', true); }
catch (e) { console.log('✗ 语法错误: ' + e.message); process.exit(1); }

console.log('===== ① UI：数量下拉 =====');
assert('面板含 数量下拉 leg-count', src.includes('id="leg-count"'));
assert('下拉 默认 3 件（selected）', /id="leg-count"[\s\S]*?<option value="3" selected>3 件<\/option>/.test(src));
const countSel = src.slice(src.indexOf('id="leg-count"'), src.indexOf('</select>', src.indexOf('id="leg-count"')));
assert('下拉 可选 1~6', ['1','2','3','4','5','6'].every(n => countSel.includes('value="' + n + '"')) && !countSel.includes('value="7"'));

console.log('\n===== ② JS：数量读取与提示词 =====');
assert('读取 leg-count 并默认 3', script.includes("parseInt((document.getElementById('leg-count') || {}).value, 10)") && script.includes('if (!(legCount >= 1)) legCount = 3;'));
assert('数量钳制 1~6', script.includes('legCount = Math.max(1, Math.min(6, legCount));'));
assert('提示词含 动态 N 件（定制 N 件专属传奇装备）', script.includes("'请为以下角色定制 ' + legCount + ' 件专属传奇装备"));
assert('要求1：恰好 N 件（不多不少）', script.includes("'1. 严格生成恰好 ' + legCount + ' 件（不多不少）"));
assert('要求2：修正用 +N/-N 固定值', script.includes('属性/命中/防御/施法修正') && script.includes('禁止超过 +5'));
assert('要求2：伤害用固定骰/骰面升阶', script.includes('额外1d6火焰伤害') && script.includes('禁止超过 2d10'));
assert('要求2：禁百分比-暴击改范围', script.includes('禁止写「暴击率+X%」') && script.includes('暴击范围 20→19-20'));
assert('要求2：禁百分比-减伤改固定', script.includes('禁止百分比（如禁写「受到伤害-15%」') && script.includes('每次受到攻击伤害-2'));
assert('要求2：按总等级校准防超模', script.includes('以角色总等级 Lv.' ) && script.includes('禁止与体系不符的超模数值'));
assert('要求5：只输出JSON无多余文字', script.includes("'5. 只输出JSON数组本身，不要代码围栏、不要解释、不要多余文字'"));
assert('JSON 模板 effect 注明禁百分比', script.includes('"effect": "效果描述（用清晰的数值与修正，禁止百分比）"'));
assert('状态文案 请求 vs 实际', script.includes("'✅ AI定制完成！请求 ' + legCount + ' 件，实际生成 ' + items.length + ' 件"));

console.log('\n===== ③ 面板文案（无百分比误导）=====');
assert('提示行说明 数值规则（禁百分比）', src.includes('不会出现百分比'));
assert('placeholder 用固定数值示例（不再写暴击率）', !src.includes('暴击率越高'));
assert('placeholder 含 19-20 范围与骰面升阶示例', src.includes('暴击范围20→19-20') && src.includes('4d6→5d6'));
assert('风格按钮引导 注明不要百分比', src.includes('不要百分比'));

console.log('\n===== ④ 行为：数量钳制逻辑（纯函数复现验证）=====');
function clampCount(v) { var n = parseInt(v, 10); if (!(n >= 1)) n = 3; return Math.max(1, Math.min(6, n)); }
assert('leg-count=5 → 5', clampCount('5') === 5);
assert('leg-count 空/NaN → 默认 3', clampCount('') === 3 && clampCount('abc') === 3);
assert('leg-count=0 → 视为未设置 → 默认 3', clampCount('0') === 3);
assert('leg-count=99 → 钳到 6', clampCount('99') === 6);
assert('leg-count=2 → 2', clampCount('2') === 2);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
