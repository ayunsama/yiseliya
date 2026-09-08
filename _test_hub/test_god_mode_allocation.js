/**
 * 端到端验证：全局修改器（上帝模式）保存时 diff 职业等级 → 升级脚本补齐三维/技能点
 * 流程：打开修改器(存 original) → 上帝模式把 战士 Lv2 改成 Lv3 → 保存(写回 + applyVarEditorGrowth)
 * 从状态栏逻辑复制 diffActorGrowth / applyVarEditorGrowth（保持与状态栏一致）
 */
const fs = require('fs');
const vm = require('vm');

// ---- 加载升级代码脚本，拿到 window.升级脚本 ----
function cloneDeep(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function get(o, p, d) { if (o == null) return d; const ks = String(p).split('.'); let v = o; for (const k of ks) { if (v == null) return d; v = v[k]; } return v === undefined ? d : v; }
const _ = { cloneDeep, get };
const toastr = { success() { console.log('  [toastr]', 'success'); }, error(m) { console.log('  [toastr.error]', m); }, warning() {} };
const Mvu = {
  events: { VARIABLE_UPDATE_ENDED: 'mag_variable_update_ended' },
  _data: null,
  getMvuData() { return this._data; },
  replaceMvuData(d) { this._data = d; return Promise.resolve(); }
};
const win = { toastr };
win.parent = win; win.top = win;
global.window = win; // 让 node 全局的 applyVarEditorGrowth 也能取到 window.升级脚本
const sandbox = {
  _, Mvu, eventOn: () => {}, $: (fn) => fn(), waitGlobalInitialized: () => Promise.resolve(),
  getScriptButtons: () => [], replaceScriptButtons: () => {}, getButtonEvent: () => '',
  toastr, console, window: win, prompt: () => null
};
win.window = win;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('dist/变量结构与状态栏代码/升级代码', 'utf8'), sandbox);
const upgradeApi = win.升级脚本;
if (!upgradeApi || typeof upgradeApi.应用分配 !== 'function') { console.error('未拿到 升级脚本.应用分配'); process.exit(1); }

// ---- 从状态栏复制的 diff / applyVarEditorGrowth（与状态栏逻辑一致） ----
function diffActorGrowth(oldA, newA) {
  var jobs = {}, attr = {};
  var oj = (oldA && oldA.基础状态 && oldA.基础状态.职业信息) || {};
  var nj = (newA && newA.基础状态 && newA.基础状态.职业信息) || {};
  Object.keys(nj).forEach(function(k) {
    var nl = parseInt(nj[k] && nj[k].等级, 10) || 0;
    var ol = parseInt((oj[k] && oj[k].等级), 10) || 0;
    var d = nl - ol;
    if (d > 0) jobs[k] = d;
  });
  var oa = (oldA && oldA.基础属性) || {};
  var na = (newA && newA.基础属性) || {};
  ['力量', '敏捷', '体质', '智力', '感知', '魅力'].forEach(function(a) {
    var d = (parseInt(na[a], 10) || 0) - (parseInt(oa[a], 10) || 0);
    if (d !== 0) attr[a] = d;
  });
  return { jobs: jobs, attr: attr };
}
async function applyVarEditorGrowth(original, edited) {
  if (!original || !edited) return;
  var upgradeApi2 = (typeof window !== 'undefined' && window.升级脚本) || (window.parent && window.parent.升级脚本);
  if (!upgradeApi2 || typeof upgradeApi2.应用分配 !== 'function') { console.error('未找到升级脚本'); return; }
  var growth = {};
  if (original.主角 && edited.主角) {
    var d = diffActorGrowth(original.主角, edited.主角);
    if (Object.keys(d.jobs).length || Object.keys(d.attr).length) growth['主角'] = d;
  }
  var compsO = original.同伴 || {}, compsN = edited.同伴 || {};
  Object.keys(compsN).forEach(function(name) {
    if (!compsO[name]) return;
    var d = diffActorGrowth(compsO[name], compsN[name]);
    if (Object.keys(d.jobs).length || Object.keys(d.attr).length) growth[name] = d;
  });
  var targets = Object.keys(growth);
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    await upgradeApi2.应用分配({ target: t, jobs: growth[t].jobs, attr: growth[t].attr });
  }
  return targets;
}

function makeActor(jobs) {
  return {
    等阶: '普通',
    基础属性: { 力量: 14, 敏捷: 12, 体质: 14, 智力: 14, 感知: 12, 魅力: 10, 未分配点数: 0 },
    基础状态: {
      HP: { 当前: 30, 最大: 30 }, MP: { 当前: 20, 最大: 20 }, SP: { 当前: 10, 最大: 10 },
      自身状态: {}, 经验值: { 当前: 0, 升级所需: 200 },
      职业信息: jobs, 总等级: 2, 待分配职业等级: 0, 冒险者等级: 'F'
    }
  };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name, extra ? JSON.stringify(extra) : ''); }
}

async function main() {
  // 场景1：主角 战士 Lv2 → 上帝模式改成 Lv3，保存后应补齐
  {
    console.log('\n--- 场景1：上帝模式 主角战士 Lv2→Lv3 ---');
    const original = { 主角: makeActor({ 战士: { 等级: 2, 技能点: 8 } }), 同伴: {}, $customSkillTrees: {} };
    // 打开修改器：editorDataCopy 与 editorOriginalCopy 都 = 当前
    const editorOriginalCopy = cloneDeep(original);
    const editorDataCopy = cloneDeep(original);
    // 上帝模式：改等级 2→3
    editorDataCopy.主角.基础状态.职业信息['战士'].等级 = 3;
    // 保存：写回 + applyVarEditorGrowth
    Mvu._data = { stat_data: editorDataCopy };
    const targets = await applyVarEditorGrowth(editorOriginalCopy, editorDataCopy);
    const job = editorDataCopy.主角.基础状态.职业信息['战士'];
    console.log('  触发补齐的角色:', JSON.stringify(targets));
    check('检测到主角', Array.isArray(targets) && targets.indexOf('主角') !== -1);
    check('等级=3', job.等级 === 3);
    check('技能点 8→12', job.技能点 === 12, { sp: job.技能点 });
    check('HP 最大 >30', editorDataCopy.主角.基础状态.HP.最大 > 30, { hp: editorDataCopy.主角.基础状态.HP.最大 });
    check('SP 最大 >10', editorDataCopy.主角.基础状态.SP.最大 > 10, { sp: editorDataCopy.主角.基础状态.SP.最大 });
  }

  // 场景2：上帝模式 改体质 14→16（不升等级）→ 按已获职业等级补 HP 上限
  {
    console.log('\n--- 场景2：上帝模式 主角体质 14→16 ---');
    const original = { 主角: makeActor({ 战士: { 等级: 2, 技能点: 8 } }), 同伴: {}, $customSkillTrees: {} };
    const editorOriginalCopy = cloneDeep(original);
    const editorDataCopy = cloneDeep(original);
    editorDataCopy.主角.基础属性.体质 = 16; // mod +2 → +3
    Mvu._data = { stat_data: editorDataCopy };
    const targets = await applyVarEditorGrowth(editorOriginalCopy, editorDataCopy);
    console.log('  触发补齐的角色:', JSON.stringify(targets));
    check('检测到主角', Array.isArray(targets) && targets.indexOf('主角') !== -1);
    check('体质=16', editorDataCopy.主角.基础属性.体质 === 16);
    // 体质 mod 每级 +1 × 2 级（战士有 HP 骰 + SP 骰）→ HP 和 SP 上限都应增加
    check('HP 最大 >30', editorDataCopy.主角.基础状态.HP.最大 > 30, { hp: editorDataCopy.主角.基础状态.HP.最大 });
    check('SP 最大 >10', editorDataCopy.主角.基础状态.SP.最大 > 10, { sp: editorDataCopy.主角.基础状态.SP.最大 });
  }

  // 场景3：上帝模式 改同伴 战士 Lv2→Lv3
  {
    console.log('\n--- 场景3：上帝模式 同伴莉莉丝 战士 Lv2→Lv3 ---');
    const original = { 主角: makeActor({ 战士: { 等级: 1, 技能点: 4 } }), 同伴: { 莉莉丝: makeActor({ 战士: { 等级: 2, 技能点: 8 } }) }, $customSkillTrees: {} };
    const editorOriginalCopy = cloneDeep(original);
    const editorDataCopy = cloneDeep(original);
    editorDataCopy.同伴['莉莉丝'].基础状态.职业信息['战士'].等级 = 3;
    Mvu._data = { stat_data: editorDataCopy };
    const targets = await applyVarEditorGrowth(editorOriginalCopy, editorDataCopy);
    const job = editorDataCopy.同伴['莉莉丝'].基础状态.职业信息['战士'];
    console.log('  触发补齐的角色:', JSON.stringify(targets));
    check('检测到莉莉丝', Array.isArray(targets) && targets.indexOf('莉莉丝') !== -1);
    check('等级=3', job.等级 === 3);
    check('技能点 8→12', job.技能点 === 12, { sp: job.技能点 });
    check('HP 最大 >30', editorDataCopy.同伴['莉莉丝'].基础状态.HP.最大 > 30, { hp: editorDataCopy.同伴['莉莉丝'].基础状态.HP.最大 });
  }

  // 场景4：上帝模式 只改无关字段（货币）→ 不应触发任何补齐
  {
    console.log('\n--- 场景4：上帝模式 只改货币 → 不触发 ---');
    const original = { 主角: makeActor({ 战士: { 等级: 2, 技能点: 8 } }), 同伴: {}, $customSkillTrees: {} };
    const editorOriginalCopy = cloneDeep(original);
    const editorDataCopy = cloneDeep(original);
    editorDataCopy.主角.资产与能力 = { 货币: 9999, 物品栏: {}, 装备栏: {} };
    Mvu._data = { stat_data: editorDataCopy };
    const targets = await applyVarEditorGrowth(editorOriginalCopy, editorDataCopy);
    console.log('  触发补齐的角色:', JSON.stringify(targets));
    check('不触发任何补齐', (!targets || targets.length === 0), { targets });
  }

  console.log('\n===== 结果: ' + pass + ' 通过, ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
