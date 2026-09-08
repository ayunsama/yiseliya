/**
 * 奥义/权能 变量层贯通测试
 * 验证：变量结构脚本（Schema）与 状态变量输出 与 变量更新规则
 *   1. Schema：主角/同伴 均含 权能+奥义 字段（同伴为顶层扁平）
 *   2. 状态变量输出：主角奥义段、同伴权能读顶层（修正旧嵌套路径）、同伴奥义段
 *   3. 状态变量输出 mini-EJS 实跑：主角有权能/奥义 → 输出；同伴有权能/奥义 → 输出
 *   4. 变量更新规则：主角奥义 type 说明 + 同伴 type/字段说明 含 权能/奥义
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const SCHEMA = 'dist/伊瑟利亚/核心/变量结构脚本';
const STATE = 'dist/伊瑟利亚/状态变量输出';
const RULES = 'dist/伊瑟利亚/核心/变量更新规则';

const schema = fs.readFileSync(SCHEMA, 'utf8');
const stateOut = fs.readFileSync(STATE, 'utf8');
const rules = fs.readFileSync(RULES, 'utf8');

console.log('===== ① 变量结构脚本（Schema）=====');
// 主角：资产与能力 内 权能+奥义
assert('主角 资产与能力 含 权能', /^\s*权能: z\.record\(z\.string\(\)\.describe\('权能名'\), z\.object\(\{ 描述: str\(''\) \}\)\.prefault\(\{\}\)\)\.prefault\(\{\}\),?$/m.test(schema));
assert('主角 资产与能力 含 奥义（描述/消耗SP/消耗MP）', schema.includes("奥义: z.record(z.string().describe('奥义名'), z.object({ 描述: str(''), 消耗SP: safeNum(0), 消耗MP: safeNum(0) })"));
// 同伴：顶层扁平 权能+奥义
assert('同伴 顶层 含 权能', schema.includes("权能: z.record(z.string().describe('权能名'), z.object({ 描述: str('') }).prefault({})).prefault({}),"));
assert('同伴 顶层 含 奥义', schema.includes("奥义: z.record(z.string().describe('奥义名'), z.object({ 描述: str(''), 消耗SP: safeNum(0), 消耗MP: safeNum(0) })"));
// 同伴 schema 内不能有嵌套 资产与能力 字段键（防写错；注释提及不影响）
const compSeg = schema.slice(schema.indexOf('同伴: z.record'), schema.indexOf('召唤物:'));
assert('同伴块内 无嵌套 资产与能力 字段键（扁平）', !/资产与能力:/.test(compSeg));

console.log('\n===== ② 状态变量输出（静态断言）=====');
assert('主角段 奥义输出（读 资产与能力?.奥义）', stateOut.includes('const ougis = V.主角.资产与能力?.奥义 || {};'));
assert('主角段 奥义输出 含消耗SP/MP', stateOut.includes('od.消耗SP ? `（消耗SP ${od.消耗SP}）`'));
assert('同伴段 权能读顶层（已修正旧嵌套路径）', stateOut.includes("const _cpowers = _.get(comp, '权能', {});"));
assert('同伴段 不再读 资产与能力.权能（旧错误路径已清除）', !stateOut.includes("_.get(comp, '资产与能力.权能'"));
assert('同伴段 奥义输出（读顶层 奥义）', stateOut.includes("const _cougis = _.get(comp, '奥义', {});"));

console.log('\n===== ③ 状态变量输出（mini-EJS 实跑）=====');
function renderEjs(src, V) {
  const segs = [], codes = [];
  const re = /<%([\s\S]*?)%>/g; let last = 0, m;
  while ((m = re.exec(src))) { segs.push(src.slice(last, m.index)); codes.push(m[1]); last = re.lastIndex; }
  segs.push(src.slice(last));
  let js = '';
  for (let i = 0; i < segs.length; i++) {
    js += 'out.push(' + JSON.stringify(segs[i]) + ');\n';
    if (i < codes.length) { const c = codes[i]; if (c[0] === '=') js += 'out.push(String(' + c.slice(1).trim() + '));\n'; else js += c; }
  }
  const fn = new Function('V', 'const out=[]; var print=function(s){ out.push(s); };\n' + js + '\nreturn out.join("");');
  return fn(V);
}
// 主角段（权能+奥义 区域：从「权能:」到「加护:」前）
const protSeg = stateOut.slice(stateOut.indexOf('    权能:'), stateOut.indexOf('  加护:'));
const protData = { 主角: { 资产与能力: { 权能: { '炎域权能': { 描述: '领域内火焰伤害翻倍' } }, 奥义: { '煌星一斩': { 描述: '凝聚星辉的绝杀一击', 消耗SP: 30, 消耗MP: 10 } } } } };
let protOut = renderEjs(protSeg, protData);
assert('主角 有权能+奥义 → 都输出', protOut.includes('炎域权能') && protOut.includes('煌星一斩'));
assert('主角 奥义输出 含 消耗SP/消耗MP', protOut.includes('消耗SP 30') && protOut.includes('消耗MP 10'));
protOut = renderEjs(protSeg, { 主角: { 资产与能力: {} } });
assert('主角 空 → 权能/奥义 均显示 无', (protOut.match(/无/g) || []).length >= 2);

// 同伴段：权能/奥义 输出代码（裸 JS，用 mock _/comp 执行）
const compSeg2 = stateOut.slice(stateOut.indexOf('const _cpowers'), stateOut.indexOf("  print('\\n');", stateOut.indexOf('const _cpowers')));
const _mock = { get: (obj, path, def) => { let v = obj; for (const seg of String(path).split('.')) { if (v && typeof v === 'object' && seg in v) v = v[seg]; else return def; } return v === undefined ? def : v; } };
function runCompSeg(comp) {
  const fn = new Function('_', 'comp', 'const out=[]; var print=function(s){ out.push(s); };\n' + compSeg2 + '\nreturn out.join("");');
  return fn(_mock, comp);
}
let compOut = runCompSeg({ 权能: { '静默权能': { 描述: 'x' } }, 奥义: { '苍炎绝唱': { 描述: 'y', 消耗SP: 40, 消耗MP: 20 } } });
assert('同伴 有权能+奥义 → 都输出（顶层路径）', compOut.includes('静默权能') && compOut.includes('苍炎绝唱'));
assert('同伴 奥义输出 含 消耗SP/消耗MP', compOut.includes('消耗SP 40') && compOut.includes('消耗MP 20'));
compOut = runCompSeg({});
assert('同伴 空 → 不输出 权能/奥义 段', !compOut.includes('权能:') && !compOut.includes('奥义:'));

console.log('\n===== ④ 变量更新规则 =====');
assert('主角 奥义 type 说明', /奥义:\r?\n\s*type: "\{ \[奥义名: string\]: \{ 描述: string, 消耗SP: number, 消耗MP: number \} \}"/.test(rules));
assert('主角 奥义 路径说明（主角/资产与能力/奥义）', rules.includes('/主角/资产与能力/奥义/{奥义名}'));
assert('主角 奥义 同伴路径说明（顶层扁平）', rules.includes('/同伴/{名字}/奥义/{奥义名}'));
assert('同伴 type 含 权能/奥义', rules.includes('技能: object, 物品栏: object, 权能: object, 奥义: object'));
assert('同伴 字段说明 含 权能（顶层扁平）', rules.includes('同伴权能为顶层扁平字段'));
assert('同伴 字段说明 含 奥义', rules.includes('同伴奥义为顶层扁平字段'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
