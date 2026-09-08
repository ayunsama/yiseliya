/**
 * ④ 技能栏自定义功能已移除 → 改为验证：
 *   1. 自定义技能弹窗/函数/按钮全部不存在
 *   2. 全局修改器（🗑 jrpg-del-tag）覆盖 角色技能/魔法栏/神术栏/同伴技能，可删除
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

console.log('========== 自定义技能功能已移除 ==========');
assert('无 customAddSkill', !src.includes('customAddSkill'));
assert('无 openCustomSkillModal', !src.includes('openCustomSkillModal'));
assert('无 #custom-skill-modal', !src.includes('custom-skill-modal'));
assert('无 btn-custom-skill', !src.includes('btn-custom-skill'));
assert('无 cs-name 弹窗输入', !src.includes('cs-name'));

console.log('\n========== 全局修改器 可删除 技能/魔法/神术 ==========');
assert('角色技能 🗑', src.includes('jrpg-del-tag" data-del-path="主角.资产与能力.角色技能.'));
assert('魔法栏 🗑', src.includes('jrpg-del-tag" data-del-path="主角.资产与能力.魔法栏.'));
assert('神术栏 🗑', src.includes('jrpg-del-tag" data-del-path="主角.资产与能力.神术栏.'));
assert('同伴技能 🗑', src.includes('data-del-path="同伴.' + "' + compName + '" + '.技能.'));  // 动态拼接处
const delHandler = src.indexOf('.jrpg-del-tag');
assert('🗑 删除事件仍在（自动写回+热加载）', delHandler > 0 && src.includes("data('del-path')"));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
