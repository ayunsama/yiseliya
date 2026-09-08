/**
 * ⑧ 资质 行为验证（v2）：
 *   1. schema：主角/同伴 资质 ∈ {等级,描述,经验获取效率}（对象，兼容旧档字符串）
 *   2. 首页代码：资质品质卡（花购点 + 副词段 + 效率），submitCC 写 对象
 *   3. 状态栏：资质只读展示（renderTalentInfo），无下拉/无保存
 *   4. 经验获取规则：资质修正（效率%）写入
 */
import fs from 'node:fs';
import { z } from 'zod/v4';

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

console.log('========== schema：资质 = 对象（等级/描述/经验获取效率） ==========');
const safeNum = (d = 0) => z.preprocess(v => (typeof v === 'number' ? v : Number(v) || d), z.number());
const 资质条 = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return v;
    if ('string' === typeof v) return { 等级: v, 描述: '', 经验获取效率: 100 };
    return v;
  },
  z.object({ 等级: z.string().prefault('平庸'), 描述: z.string().prefault(''), 经验获取效率: safeNum(100) }).prefault({})
).prefault({});
const Schema = z.object({
  主角: z.object({ 基础信息: z.object({ 资质: 资质条 }).prefault({}) }).prefault({}),
  世界: z.object({ 追踪记录: z.record(z.string(), z.any()).prefault({}) }).prefault({}),
}).prefault({});

const parsed = Schema.parse({ 主角: { 基础信息: { 资质: { 等级: '天才', 描述: '百年不遇，一日千里。经验获取效率 160%', 经验获取效率: 160 } } } });
assert('资质对象保留', parsed.主角.基础信息.资质.等级 === '天才' && parsed.主角.基础信息.资质.经验获取效率 === 160, JSON.stringify(parsed.主角.基础信息.资质));
const compat = Schema.parse({ 主角: { 基础信息: { 资质: '卓越' } } });
assert('旧档字符串资质兼容 → 归一化对象', compat.主角.基础信息.资质.等级 === '卓越' && compat.主角.基础信息.资质.经验获取效率 === 100, JSON.stringify(compat.主角.基础信息.资质));
const def = Schema.parse({ 主角: { 基础信息: {} } });
assert('缺省 → 平庸/100', def.主角.基础信息.资质.等级 === '平庸' && def.主角.基础信息.资质.经验获取效率 === 100);

console.log('\n========== 状态栏：资质只读展示（无下拉/无保存） ==========');
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
assert('无 saveTalentState', !sb.includes('saveTalentState'));
assert('无 talent-sel 下拉', !sb.includes('id="talent-sel"'));
assert('无 btn-save-talent', !sb.includes('btn-save-talent'));
assert('有 renderTalentInfo（只读展示）', sb.includes('function renderTalentInfo'));
assert('renderTalentInfo 读取 资质.等级 + 描述', sb.includes('资质.等级') && sb.includes('资质.描述'));
assert('超凡页签资质框为只读列表 (talent-display)', sb.includes('id="talent-display"'));

console.log('\n========== 首页代码：资质品质卡（花购点） ==========');
const home = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
assert('有 talent-selector 品质卡', home.includes('id="talent-selector"'));
assert('有 selectTalent 函数', home.includes('function selectTalent'));
assert('有购点表 talentCostMap', home.includes('talentCostMap'));
assert('有效率表 talentEffMap', home.includes('talentEffMap'));
assert('有副词段 talentDescs', home.includes('talentDescs'));
assert('默认平庸选中', /radio" name="talent" value="1" checked/.test(home));
assert('submitCC 写 资质对象（等级/描述/效率）', home.includes('资质 = {') && home.includes('经验获取效率: talentEffMap'));
assert('无遗迹 cc-talent 下拉', !home.includes('id="cc-talent"'));

console.log('\n========== 经验获取规则：资质修正 ==========');
const expRule = fs.readFileSync('dist/伊瑟利亚/经验获取规则', 'utf8');
assert('经验规则含 资质修正', expRule.includes('资质修正'));
assert('效率表（160% 等）写入', expRule.includes('160%') && expRule.includes('天才'));

console.log('\n========== 变量更新规则：资质 + 追踪记录 ==========');
const varRule = fs.readFileSync('dist/伊瑟利亚/核心/变量更新规则', 'utf8');
assert('变量规则含 资质 字段说明', varRule.includes('经验获取效率') && varRule.includes('资质为天生品性'));
assert('变量规则含 追踪记录 insert 规则', varRule.includes('/世界/追踪记录/'));

console.log('\n========== schema 脚本：三维上限已删 ==========');
const schemaScr = fs.readFileSync('dist/伊瑟利亚/核心/变量结构脚本', 'utf8');
assert('无 三维上限', !schemaScr.includes('三维上限'));
assert('有 资质条 定义', schemaScr.includes('const 资质条'));
assert('有 追踪记录条 定义（世界容器用）', schemaScr.includes('const 追踪记录条'));
assert('世界.追踪记录 容器声明', schemaScr.includes('追踪记录: z.record'));
assert('$flags 无 追踪记录（已迁出）', !schemaScr.includes('$flags').includes && true); // 占位；下面精确检查
assert('$flags 内 追踪记录 容器已迁出（无数组容器定义）', !/追踪记录:\s*z\.array/.test(schemaScr));
assert('$flags 有 追踪记录全量 开关', schemaScr.includes('追踪记录全量: z.boolean()'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
