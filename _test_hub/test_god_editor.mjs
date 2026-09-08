/**
 * 全局修改器（修改模式）新增可编辑/可删除能力 验证：
 *   1. 主角 总等级/未分配属性点/待分配职业等级 → jrpg-edit-val 点击编辑
 *   2. 职业信息 职业等级/剩余技能点 → jrpg-edit-val（等级改大自动补三维/技能点/总等级）
 *   3. 世界见闻.动态新闻 → jrpg-del-tag 🗑 删除
 *   4. 同伴 未分配属性点/待分配职业等级 同步可改
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

console.log('========== ① 总等级 / 未分配属性点 / 待分配职业等级 可改 ==========');
assert('主角 · 总等级 可编辑', src.includes('data-path="主角.基础状态.总等级"') && src.includes('jrpg-edit-val" data-path="主角.基础状态.总等级"'));
assert('主角 · 未分配属性点 可编辑', src.includes('data-path="主角.基础属性.未分配点数"'));
assert('主角 · 待分配职业等级 可编辑', src.includes('data-path="主角.基础状态.待分配职业等级"'));
assert('三值均在 #level-info-row 上（含 0 值也可编辑）', src.includes("$('#level-info-row').html('<span>总等级: <strong class=\"jrpg-edit-val\""));

console.log('\n========== ② 职业信息 职业等级 / 技能点 可改 ==========');
assert('职业等级 可编辑（路径含职业名）', src.includes("data-path=\"主角.基础状态.职业信息.' + escapeAttr(k) + '.等级\""), '(未找到职业等级路径)');
assert('剩余技能点 可编辑', src.includes("data-path=\"主角.基础状态.职业信息.' + escapeAttr(k) + '.技能点\""));
assert('等级改动联动升级脚本补三维（applyVarEditorGrowth 已存在）', src.includes('async function applyVarEditorGrowth') && src.includes('upgradeApi.应用分配'));

console.log('\n========== ③ 见闻（动态新闻）可删除 ==========');
assert('动态新闻条目带 🗑 删除', src.includes("data-del-path=\"世界.世界见闻.动态新闻.' + escapeAttr(k) + '\"") && src.includes('title="删除该见闻"'));
assert('删除走全局修改器委托（立即写回+热加载）', src.includes("$('.jrpg-status-wrapper').on('click', '.jrpg-del-tag'"));

console.log('\n========== ④ 同伴面板同步（一致性） ==========');
assert('同伴 · 未分配属性点 可编辑', src.includes("data-path=\"同伴.' + escapeAttr(compName) + '.基础属性.未分配点数\""));
assert('同伴 · 待分配职业等级 可编辑', src.includes("data-path=\"同伴.' + escapeAttr(compName) + '.基础状态.待分配职业等级\""));

console.log('\n========== 编辑机制保障（修改模式门控 + 数值化） ==========');
assert('jrpg-edit-val 点击转输入框（委托，动态元素可用）', src.includes("$('.jrpg-status-wrapper').on('click', '.jrpg-edit-val', function ()"));
assert('仅在修改模式生效（editMode 门控）', src.includes("if (!editMode) return;") && src.includes("toggleClass('edit-mode', editMode)"));
assert('输入数字自动转 Number', src.includes("if (!isNaN(raw) && raw.trim() !== '') { finalVal = Number(raw); }"));
assert('修改后自动写回并热加载', src.includes('await Mvu.replaceMvuData(mvuData, { type: \'message\', message_id: \'latest\' });') && src.includes('populateCharacterData();'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
