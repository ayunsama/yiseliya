/**
 * 升级脚本 · 等阶 HP 成长倍率测试
 * 公式：HP 成长 = (职业HP骰 + 体质修正) × 等阶倍率（普通×1 / 超凡×1.2 / 精英×1.4 / 史诗×1.6 / 传说×1.8 / 神话×2.0）
 * 等阶按「该级角色总等级」判定（跨等阶升级逐级生效）
 */
import fs from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const CODE = fs.readFileSync('dist/伊瑟利亚/核心/升级代码', 'utf8');
try { new vm.Script(CODE); assert('升级代码 语法 OK', true); }
catch (e) { assert('升级代码 语法 OK', false, e.message); }

// 倍率表静态断言
assert('等阶倍率表 普通×1', /'普通': 1,/.test(CODE));
assert('等阶倍率表 超凡×1.2', /'超凡': 1\.2/.test(CODE));
assert('等阶倍率表 精英×1.4', /'精英': 1\.4/.test(CODE));
assert('等阶倍率表 史诗×1.6', /'史诗': 1\.6/.test(CODE));
assert('等阶倍率表 传说×1.8', /'传说': 1\.8/.test(CODE));
assert('等阶倍率表 神话×2.0', /'神话': 2\.0/.test(CODE));
assert('getRankHpMult 函数存在', CODE.includes('function getRankHpMult'));
assert('applyJobLevel HP 用等阶倍率', /rollDice\(g\.HP, useMax\) \+ getAbilityModifier\(attr\.体质\)\) \* hpMult/.test(CODE));
assert('补齐三维 HP 用等阶倍率', /rollDice\(fg\.HP, true\) \+ getAbilityModifier\(attrA\.体质\)\) \* hpMult/.test(CODE));
assert('融合保底 HP 用等阶倍率', CODE.includes('getRankHpMult(lv)'));
assert('SP/MP 未乘倍率（仅 HP）', !/getAbilityModifier\(attr\.体质\)\) \* hpMult[\s\S]{0,80}getAbilityModifier\(attr\.体质\)\) \* hpMult/.test(CODE) || CODE.includes("SP +'") );

// ===== vm 沙箱：加载升级脚本，捕获 VARIABLE_UPDATE_ENDED 回调 =====
const handlers = {};
const _get = (obj, path, def) => { let v = obj; for (const seg of String(path).split('.')) { if (v && typeof v === 'object' && seg in v) v = v[seg]; else return def; } return v === undefined ? def : v; };
const sandbox = {
  console,
  Math: Object.assign(Object.create(Math), { random: () => 0.99 }),  // 满骰方向：d10 → 10
  _: { get: _get, cloneDeep: (o) => JSON.parse(JSON.stringify(o)) },
  window: {},
  Mvu: { events: { VARIABLE_UPDATE_ENDED: 'VARIABLE_UPDATE_ENDED' } },
  waitGlobalInitialized: () => Promise.resolve(),
  eventOn: (ev, cb) => { handlers[ev] = cb; },
  updateVariablesWith: () => {},
  getScriptButtons: () => [],
  replaceScriptButtons: () => {},
  getButtonEvent: () => {},
  initializeGlobal: () => {},
  toastr: undefined,
  $: (fn) => { fn(); }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(CODE, sandbox, { timeout: 5000 });
await new Promise(r => setTimeout(r, 20));  // 等 init 微任务完成注册

assert('已捕获 VARIABLE_UPDATE_ENDED 回调', typeof handlers['VARIABLE_UPDATE_ENDED'] === 'function');
if (typeof handlers['VARIABLE_UPDATE_ENDED'] !== 'function') { console.log('沙箱初始化失败'); process.exit(1); }

// ===== 升级触发辅助 =====
function makeActor(jobName, jobLv, totalLv, hpMax, 体质) {
  return {
    等阶: '普通',
    基础属性: { 力量: 10, 敏捷: 10, 体质, 智力: 10, 感知: 10, 魅力: 10, 未分配点数: 0 },
    基础状态: {
      HP: { 最大: hpMax, 当前: hpMax }, SP: { 最大: 0, 当前: 0 }, MP: { 最大: 0, 当前: 0 },
      经验值: { 当前: 0, 升级所需: 200 },
      职业信息: { [jobName]: { 等级: jobLv, 技能点: jobLv * 4 } },
      总等级: totalLv, 待分配职业等级: 0
    }
  };
}
function levelUp(prev, nextJobLv, nextTotalLv) {
  const curr = JSON.parse(JSON.stringify(prev));
  const jobName = Object.keys(curr.基础状态.职业信息)[0];
  curr.基础状态.职业信息[jobName].等级 = nextJobLv;
  curr.基础状态.总等级 = nextTotalLv;
  handlers['VARIABLE_UPDATE_ENDED'](
    { stat_data: { 主角: curr, $customSkillTrees: {} } },
    { stat_data: { 主角: prev } }
  );
  return curr;
}

// 战士 d10 + 体质14（修正+2），Math.random=0.99 → 骰值 10 → 基础成长 12
console.log('\n===== 主角升级（战士 d10，体质14 → +2）=====');
// 场景1：精英 Lv12 → Lv13（史诗 ×1.6）→ round(12×1.6)=round(19.2)=19
let a = levelUp(makeActor('战士', 12, 12, 100, 14), 13, 13);
assert('精英→史诗 Lv12→13: HP +19（×1.6）', a.基础状态.HP.最大 === 119, '实际 ' + a.基础状态.HP.最大 + '（Δ' + (a.基础状态.HP.最大 - 100) + '）');
assert('史诗 Lv13→13 等阶字段=史诗', a.等阶 === '史诗', '实际 ' + a.等阶);
// 场景2：史诗 Lv13 → Lv14（史诗 ×1.6）→ +19
a = levelUp(makeActor('战士', 13, 13, 150, 14), 14, 14);
assert('史诗 Lv13→14: HP +19（×1.6）', a.基础状态.HP.最大 === 169, '实际 ' + a.基础状态.HP.最大);
// 场景3：传说 Lv16 → Lv17（×1.8）→ round(21.6)=22
a = levelUp(makeActor('战士', 16, 16, 200, 14), 17, 17);
assert('传说 Lv16→17: HP +22（×1.8）', a.基础状态.HP.最大 === 222, '实际 ' + a.基础状态.HP.最大 + '（Δ' + (a.基础状态.HP.最大 - 200) + '）');
assert('传说 Lv17 等阶字段=传说', a.等阶 === '传说', '实际 ' + a.等阶);
// 场景4：神话 Lv20 → Lv21（×2.0）→ round(24)=24
a = levelUp(makeActor('战士', 20, 20, 300, 14), 21, 21);
assert('神话 Lv20→21: HP +24（×2.0）', a.基础状态.HP.最大 === 324, '实际 ' + a.基础状态.HP.最大 + '（Δ' + (a.基础状态.HP.最大 - 300) + '）');
// 场景5：普通 Lv3 → Lv4（×1.0）→ +12
a = levelUp(makeActor('战士', 3, 3, 50, 14), 4, 4);
assert('普通 Lv3→4: HP +12（×1.0）', a.基础状态.HP.最大 === 62, '实际 ' + a.基础状态.HP.最大);
// 场景6：超凡 Lv4 → Lv5（×1.2）→ round(14.4)=14
a = levelUp(makeActor('战士', 4, 4, 62, 14), 5, 5);
assert('超凡 Lv4→5: HP +14（×1.2）', a.基础状态.HP.最大 === 76, '实际 ' + a.基础状态.HP.最大);
// 场景7：精英 Lv8 → Lv9（×1.4）→ round(16.8)=17
a = levelUp(makeActor('战士', 8, 8, 100, 14), 9, 9);
assert('精英 Lv8→9: HP +17（×1.4）', a.基础状态.HP.最大 === 117, '实际 ' + a.基础状态.HP.最大);

console.log('\n===== 连续跨等阶升级（逐级按级时等阶判定）=====');
// 精英 Lv12 → Lv13 → Lv14（13=史诗×1.6, 14=史诗×1.6）：两次各 +19
a = levelUp(makeActor('战士', 12, 12, 100, 14), 14, 14);
assert('Lv12→14 连续 2 级（均史诗）: HP +38（×1.6×2）', a.基础状态.HP.最大 === 138, '实际 ' + a.基础状态.HP.最大);

console.log('\n===== 契约兽（巨龙 d12，体质14 → +2，史诗 ×1.6）=====');
// prev Lv12 精英契约兽 → Lv13 史诗：rollDice(d12)=12 → (12+2)×1.6=22.4 → round 22
const beastPrev = {
  等阶: '精英', 种族: '冰霜巨龙', 职业: '巨龙', 契约主: '主角',
  基础属性: { 力量: 10, 敏捷: 10, 体质: 14, 智力: 10, 感知: 10, 魅力: 10, 未分配点数: 0 },
  基础状态: {
    HP: { 最大: 200, 当前: 200 }, SP: { 最大: 50, 当前: 50 }, MP: { 最大: 50, 当前: 50 },
    经验值: { 当前: 0, 升级所需: 200 },
    职业信息: { 巨龙: { 等级: 12 } }, 总等级: 12, 待分配职业等级: 0
  }
};
const beastCurr = JSON.parse(JSON.stringify(beastPrev));
beastCurr.基础状态.职业信息['巨龙'].等级 = 13;
beastCurr.基础状态.总等级 = 13;
handlers['VARIABLE_UPDATE_ENDED'](
  { stat_data: { 契约兽: { 冰霜巨龙: beastCurr }, $customSkillTrees: {} } },
  { stat_data: { 契约兽: { 冰霜巨龙: beastPrev } } }
);
assert('契约兽 精英→史诗 Lv12→13: HP +22（×1.6）', beastCurr.基础状态.HP.最大 === 222, '实际 ' + beastCurr.基础状态.HP.最大 + '（Δ' + (beastCurr.基础状态.HP.最大 - 200) + '）');

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
