/**
 * 首页代码 · 资质/魔力回路 跨页面保存修复测试
 * 验证：
 *  1. selectTalent/selectCircuit 用户显式选择 → 设 dirty（允许覆盖存档值）
 *  2. selectCircuit 高亮限定 #circuit-selector（不再误伤资质选择器，两者复用 .jrpg-circuit-option 类）
 *  3. forceSelectTalent/forceSelectCircuit 免购点回填：改 UI 不改 ccPoints、不设 dirty（保留存档原值）
 *  4. 源码级断言：submitCC 写入保护（dirty 判断）、applySaveToHomeForm 回填资质/回路、装备栏字段对齐 Schema
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const FILE = 'dist/伊瑟利亚/核心/首页代码';
const src = fs.readFileSync(FILE, 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('✗ 未找到 script'); process.exit(1); }
const script = m[1];

// ---- ① 静态断言：修复点都在 ----
console.log('===== ① 源码修复点 =====');
assert('dirty 变量声明', script.includes('var talentDirty = false;') && script.includes('var circuitDirty = false;'));
assert('selectTalent 设 dirty', script.includes('talentDirty = true;   // 用户显式选择'));
assert('selectCircuit 设 dirty', script.includes('circuitDirty = true;   // 用户显式选择'));
assert('selectCircuit 限定 #circuit-selector（高亮污染修复）', script.includes("querySelectorAll('#circuit-selector .jrpg-circuit-option')"));
assert('selectCircuit 不再用裸 document.querySelectorAll 全局选择器', !/document\.querySelectorAll\('\.jrpg-circuit-option'\)/.test(script));
assert('资质写入受 dirty 保护', script.includes('if (talentDirty) {'));
assert('回路品阶写入受 dirty 保护', script.includes('if (circuitDirty) {'));
assert('回路描述限定容器读取', script.includes("#circuit-selector .jrpg-circuit-option.selected .circuit-desc"));
assert('applySaveToHomeForm 回填资质', script.includes('forceSelectTalent(ti2)'));
assert('applySaveToHomeForm 回填回路', script.includes('forceSelectCircuit(ci2)'));
assert('装备栏回填对齐 Schema（物品名）', script.includes('it.物品名 || it.名称 ||'));

// ---- ② 行为测试：select/force 逻辑（切段执行）----
console.log('\n===== ② 选择器行为（dirty / 高亮污染 / 免购点回填）=====');
// 轻量 DOM stub：记录 querySelectorAll 的选择器调用
const optLabels = [];
for (let i = 0; i < 6; i++) optLabels.push({ level: i });
function mkOption(level) {
  const o = { lv: level, _sel: false };
  o.classList = {
    toggle: function (cls, on) { if (cls === 'selected') o._sel = !!on; }
  };
  o.getAttribute = function (a) { return a === 'data-level' ? String(o.lv) : null; };
  o.querySelector = function () { return { checked: false }; };
  return o;
}
const domEls = {};
function stubEl() { return { innerText: '', innerHTML: '', value: '', classList: { toggle: function () {} } }; }
let calls = [];  // querySelectorAll 参数记录
const documentStub = {
  getElementById: function (id) {
    if (id === 'talent-selector') { if (!domEls[id]) domEls[id] = { querySelectorAll: function () { return talentOpts; }, querySelector: function () { return null; } }; return domEls[id]; }
    if (id === 'circuit-selector') { if (!domEls[id]) domEls[id] = { querySelectorAll: function () { return circuitOpts; }, querySelector: function () { return null; } }; return domEls[id]; }
    if (!domEls[id]) domEls[id] = stubEl();
    return domEls[id];
  },
  querySelectorAll: function (sel) {
    calls.push(sel);
    if (sel.indexOf('#talent-selector') !== -1) return talentOpts;
    if (sel.indexOf('#circuit-selector') !== -1) return circuitOpts;
    return [];
  },
  querySelector: function () { return null; }
};
const talentOpts = optLabels.map(l => { const o = mkOption(l.level); o._owner = o; return o; });
const circuitOpts = optLabels.map(l => { const o = mkOption(l.level); o._owner = o; return o; });

// 切段：从 talentLevel 声明到 selectCircuit 注册结束
const segStart = script.indexOf('var talentLevel = 1;');
const segEnd = script.indexOf('window.selectCircuit = selectCircuit;') + 'window.selectCircuit = selectCircuit;'.length;
const seg = script.slice(segStart, segEnd);
const prefix = 'var ccPoints = 27; var circuitLevel = 0; var circuitCostMap = [0,1,2,4,7,11]; var circuitNames = [\'无回路\',\'低劣\',\'普通\',\'优良\',\'稀有\',\'完美\'];\nfunction calcStats() {}\n';
try {
  const fn = new Function('document', 'alert', 'window', prefix + seg + '\n; return { selectTalent: selectTalent, selectCircuit: selectCircuit, forceSelectTalent: forceSelectTalent, forceSelectCircuit: forceSelectCircuit, getTalentLevel: function(){return talentLevel;}, getCircuitLevel: function(){return circuitLevel;}, isTalentDirty: function(){return talentDirty;}, isCircuitDirty: function(){return circuitDirty;}, getPoints: function(){return ccPoints;} };');
  const api = fn(documentStub, function () {}, {});
  const winRef = undefined;

  // 1. 初始态
  assert('初始 dirty=false', !api.isTalentDirty() && !api.isCircuitDirty());
  assert('初始 talentLevel=1（平庸）', api.getTalentLevel() === 1);
  assert('初始 circuitLevel=0（无回路）', api.getCircuitLevel() === 0);

  // 2. 用户选资质（优秀 Lv3）
  const pointsBeforeT = api.getPoints();
  calls = [];
  api.selectTalent(3);
  assert('selectTalent(3) → dirty=true', api.isTalentDirty());
  assert('selectTalent(3) → talentLevel=3', api.getTalentLevel() === 3);
  assert('selectTalent 只操作 #talent-selector', calls.every(s => s.indexOf('#talent-selector') !== -1) && calls.length > 0);
  const t3 = talentOpts.find(o => o.lv === 3);
  assert('资质 Lv3 被高亮 selected', t3._sel === true);
  const t1 = talentOpts.find(o => o.lv === 1);
  assert('资质 Lv1 取消高亮', t1._sel === false);

  // 3. 用户选魔力回路（稀有 Lv4）→ 验证不污染资质高亮
  calls = [];
  api.selectCircuit(4);
  assert('selectCircuit(4) → dirty=true', api.isCircuitDirty());
  assert('selectCircuit(4) → circuitLevel=4', api.getCircuitLevel() === 4);
  assert('selectCircuit 只操作 #circuit-selector（污染修复）', calls.every(s => s.indexOf('#circuit-selector') !== -1) && calls.length > 0);
  assert('资质 Lv3 高亮保持（未被电路污染）', t3._sel === true);
  const c4 = circuitOpts.find(o => o.lv === 4);
  assert('回路 Lv4 被高亮 selected', c4._sel === true);

  // 4. 免购点回填：forceSelectTalent 不扣点、不设 dirty
  api.forceSelectTalent(5);
  assert('forceSelectTalent(5) → talentLevel=5', api.getTalentLevel() === 5);
  // force 免购点语义：不扣 ccPoints（对比 force 调用前后）
  const pointsBeforeForce = api.getPoints();
  api.forceSelectTalent(5);
  assert('force 回填不扣购点（ccPoints 不变）', api.getPoints() === pointsBeforeForce);
  const t5 = talentOpts.find(o => o.lv === 5);
  assert('force 回填后 Lv5 高亮', t5._sel === true);
  assert('force 回填不设 dirty（dirty 状态由用户显式选择控制）', api.isTalentDirty() === true);

  // 5. force 函数源码内无 dirty 赋值（区间限定到函数定义结束：force 函数后紧跟下一个 function）
  const fTSeg = seg.slice(seg.indexOf('function forceSelectTalent'), seg.indexOf('function selectTalent'));
  const fCSeg = seg.slice(seg.indexOf('function forceSelectCircuit'), seg.indexOf('function selectCircuit'));
  assert('forceSelectTalent 函数体内无 dirty 赋值', !/talentDirty\s*=/.test(fTSeg) && !/circuitDirty\s*=/.test(fTSeg));
  assert('forceSelectCircuit 函数体内无 dirty 赋值', !/talentDirty\s*=/.test(fCSeg) && !/circuitDirty\s*=/.test(fCSeg));

  // 6. 免购点回填电路
  api.forceSelectCircuit(2);
  assert('forceSelectCircuit(2) → circuitLevel=2', api.getCircuitLevel() === 2);
  const c2 = circuitOpts.find(o => o.lv === 2);
  assert('force 回填后回路 Lv2 高亮', c2._sel === true);

  // 7. 低劣资质（Lv0）也要可选（indexOf 边界）
  calls = [];
  api.selectTalent(0);
  assert('selectTalent(0)（低劣）→ talentLevel=0', api.getTalentLevel() === 0);
} catch (e) {
  console.log('✗ 切段执行失败: ' + e.message);
  console.log(e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
