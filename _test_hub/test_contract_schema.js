// 验证 变量结构脚本 中「契约兽」的 typed schema
// 用真实 zod 4 + lodash 加载 Schema，检查 loadAsContract 写入结构与 prefault 兜底
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zod = require('zod');
const lodash = require('lodash');

const ROOT = path.resolve(__dirname, '..');
let src = fs.readFileSync(path.join(ROOT, 'dist/伊瑟利亚/变量结构脚本'), 'utf8');

// 去掉 import 行 与 结尾的注册包裹，保留 Schema 定义
src = src.replace(/^import.*$/gm, '');
src = src.replace(/\$\(\(\) => \{\s*registerMvuSchema\(Schema\);\s*\}\);\s*$/, '');
src += '\n;globalThis.Schema = Schema;';

const sandbox = { z: zod, _: lodash, registerMvuSchema: () => {}, console, $: () => {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const Schema = sandbox.Schema;
if (!Schema) { console.error('Schema 未导出'); process.exit(2); }

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗ FAIL:', msg); }
}

console.log('[A] loadAsContract 完整结构（古卷一键写入的形态）');
const full = Schema.parse({ 契约兽: { 冰霜巨龙: {
  种族: '冰霜巨龙', 职业: '巨龙', 契约主: '主角', 等阶: '精英', 等级: 7,
  体型: '巨型', 元素属性: '冰', 羁绊: 65, 防御值: 16, 移动速度: 40, 先攻修正: 2,
  外貌: '覆盖冰晶的巨龙', 性格: '高傲', 所属势力: '极北龙族', 背景故事: '守护冰原千年的古龙。', 状态: '健康',
  基础属性: { 力量: 18, 敏捷: 10, 体质: 16, 智力: 10, 感知: 12, 魅力: 10, 未分配点数: 0 },
  基础状态: {
    HP: { 当前: 120, 最大: 140 }, MP: { 当前: 60, 最大: 80 }, SP: { 当前: 40, 最大: 50 },
    经验值: { 当前: 0, 升级所需: 200 },
    职业信息: { 巨龙: { 等级: 7, 技能点: 0, grantedLv: 7, grantedSp: 0 } },
    总等级: 7, 待分配职业等级: 0
  },
  攻击: [{ 名称: '寒冰爪击', 类型: '近战', 命中: 6, 伤害: '2d6+3', 特效: '附带冰冻' }],
  能力: [{ 名称: '冰甲', 描述: '受到物理伤害-2' }],
  吐息: { 名称: '冰霜吐息', 元素: '冰', 伤害骰: '8d6', 范围: '锥形30尺', 冷却: '3轮' },
  弱点: '火焰', 抗性: '冰霜', 免疫: '冰冻'
} } });
const b = full.契约兽['冰霜巨龙'];
assert(b && b.种族 === '冰霜巨龙' && b.职业 === '巨龙', `种族/职业: ${b && b.种族}/${b && b.职业}`);
assert(b.契约主 === '主角' && b.等阶 === '精英' && b.等级 === 7, `契约主/等阶/等级: ${b.契约主}/${b.等阶}/${b.等级}`);
assert(b.元素属性 === '冰' && b.体型 === '巨型' && b.羁绊 === 65, `元素/体型/羁绊: ${b.元素属性}/${b.体型}/${b.羁绊}`);
assert(b.基础状态.职业信息['巨龙'] && b.基础状态.职业信息['巨龙'].等级 === 7, `职业信息.巨龙.等级=7`);
assert(b.基础状态.职业信息['巨龙'].grantedLv === 7 && b.基础状态.职业信息['巨龙'].grantedSp === 0, `职业信息追踪字段保留 (grantedLv=${b.基础状态.职业信息['巨龙'].grantedLv})`);
assert(b.基础状态.HP.最大 === 140 && b.基础状态.总等级 === 7, `HP.最大/总等级: ${b.基础状态.HP.最大}/${b.基础状态.总等级}`);
assert(Array.isArray(b.攻击) && b.攻击.length === 1 && b.攻击[0].名称 === '寒冰爪击', `攻击数组保留 (${b.攻击.length})`);
assert(Array.isArray(b.能力) && b.能力.length === 1 && b.能力[0].名称 === '冰甲', `能力数组保留 (${b.能力.length})`);
assert(b.吐息 && b.吐息.名称 === '冰霜吐息' && b.吐息.伤害骰 === '8d6', `吐息保留: ${b.吐息 && b.吐息.名称}`);
assert(b.弱点 === '火焰' && b.抗性 === '冰霜' && b.免疫 === '冰冻', `弱点/抗性/免疫`);
assert(b.状态 === '健康' && b.基础属性.力量 === 18, `状态/基础属性保留`);

console.log('\n[B] 缺省字段 prefault 兜底（只有 职业/种族/等级 的最小写入）');
const mini = Schema.parse({ 契约兽: { 小兽: { 种族: '风狼', 职业: '魔兽', 等级: 1 } } });
const m = mini.契约兽['小兽'];
assert(m.羁绊 === 0 && m.体型 === '中型' && m.元素属性 === '无' && m.等阶 === '普通', `默认值: 羁绊=${m.羁绊} 体型=${m.体型} 元素=${m.元素属性} 等阶=${m.等阶}`);
assert(Array.isArray(m.攻击) && m.攻击.length === 0 && Array.isArray(m.能力) && m.能力.length === 0, `攻击/能力 缺省为空数组`);
assert(m.吐息 === null, `吐息 缺省为 null`);
assert(m.基础状态 && m.基础状态.职业信息 && Object.keys(m.基础状态.职业信息).length === 0, `职业信息 缺省为空对象`);
assert(m.基础状态.经验值.升级所需 === 100 && m.基础状态.总等级 === 1, `经验值.升级所需默认100 / 总等级1`);
assert(m.基础属性.力量 === 10 && m.基础属性.未分配点数 === 0, `基础属性 缺省10/0`);
assert(m.状态 === '' && m.外貌 === '', `状态/外貌 缺省空串`);

console.log('\n[C] 升级脚本写入兼容：等级 7→8 后重新校验不丢字段');
const updated = JSON.parse(JSON.stringify(full));
updated.契约兽['冰霜巨龙'].基础状态.职业信息['巨龙'].等级 = 8;
updated.契约兽['冰霜巨龙'].基础状态.总等级 = 8;
updated.契约兽['冰霜巨龙'].等阶 = '超凡';
const c = Schema.parse(updated).契约兽['冰霜巨龙'];
assert(c.基础状态.职业信息['巨龙'].等级 === 8, `升级后等级=8: ${c.基础状态.职业信息['巨龙'].等级}`);
assert(c.基础状态.总等级 === 8 && c.等阶 === '超凡', `总等级/等阶: ${c.基础状态.总等级}/${c.等阶}`);
assert(c.羁绊 === 65 && c.吐息.名称 === '冰霜吐息' && c.攻击.length === 1, `升级后其余字段保留`);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
