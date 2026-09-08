/**
 * 复现「状态栏升级分配 → applyAllocation 补齐三维/技能点」问题
 * 场景：融合职业+1 / 普通职业+1 / 同伴+1
 * 桩 Mvu(eventOn/$)，直接调用 window.升级脚本.应用分配
 */
const fs = require('fs');
const vm = require('vm');

const SCRIPT_PATH = 'G:/酒馆/tavern_helper_template-main/dist/变量结构与状态栏代码/升级代码';
const code = fs.readFileSync(SCRIPT_PATH, 'utf8');

function cloneDeep(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function get(o, p, d) { if (o == null) return d; const ks = String(p).split('.'); let v = o; for (const k of ks) { if (v == null) return d; v = v[k]; } return v === undefined ? d : v; }
const _ = { cloneDeep, get };

const toastr = { success() {}, error(msg) { console.error('[toastr.error]', msg); }, warning() {} };

const Mvu = {
  events: { VARIABLE_UPDATE_ENDED: 'mag_variable_update_ended' },
  _data: null,
  getMvuData() { return this._data; },
  replaceMvuData(d) { this._data = d; return Promise.resolve(); }
};

const win = { toastr };
win.parent = win;
win.top = win;

const sandbox = {
  _,
  Mvu,
  eventOn: () => {},
  $: (fn) => fn(),
  waitGlobalInitialized: () => Promise.resolve(),
  getScriptButtons: () => [],
  replaceScriptButtons: () => {},
  getButtonEvent: () => '',
  toastr,
  console,
  window: win,
  prompt: () => null
};
win.window = win;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const api = win.升级脚本;
if (!api || typeof api.应用分配 !== 'function') { console.error('未拿到 升级脚本.应用分配'); process.exit(1); }

function makeActor(jobs) {
  return {
    等阶: '普通',
    基础属性: { 力量: 14, 敏捷: 12, 体质: 14, 智力: 14, 感知: 12, 魅力: 10, 未分配点数: 0 },
    基础状态: {
      HP: { 当前: 30, 最大: 30 },
      MP: { 当前: 20, 最大: 20 },
      SP: { 当前: 10, 最大: 10 },
      自身状态: {},
      经验值: { 当前: 0, 升级所需: 200 },
      职业信息: jobs,
      总等级: 4,
      待分配职业等级: 1,
      冒险者等级: 'F'
    }
  };
}

// 模拟 confirmAlloc：把目标职业 +d 级写入 stat_data，并扣 待分配职业等级
function simulateConfirmAlloc(stat, target, jobName, d) {
  const actor = target === '主角' ? stat.主角 : stat.同伴[target];
  const jobInfo = actor.基础状态.职业信息;
  if (!jobInfo[jobName]) jobInfo[jobName] = { 等级: 0, 技能点: 0 };
  jobInfo[jobName].等级 = Math.max(1, (parseInt(jobInfo[jobName].等级, 10) || 1) + d);
  actor.基础状态.待分配职业等级 = (parseInt(actor.基础状态.待分配职业等级, 10) || 0) - d;
  return { jobs: { [jobName]: d }, attr: {} };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name, extra ? JSON.stringify(extra) : ''); }
}

async function main() {
  // ===== 场景1：融合职业主角 +1（名字按 A×B 拆分） =====
  {
    console.log('\n--- 场景1：融合职业「符文师×元素法师」Lv4 → +1 ---');
    const 主角 = makeActor({ '符文师×元素法师': { 等级: 4, 技能点: 10 } });
    Mvu._data = { stat_data: { 主角, 同伴: {}, $customSkillTrees: {} } };
    const delta = simulateConfirmAlloc(Mvu._data.stat_data, '主角', '符文师×元素法师', 1);
    const r = await api.应用分配({ target: '主角', jobs: delta.jobs, attr: {} });
    const job = 主角.基础状态.职业信息['符文师×元素法师'];
    console.log('  applyAllocation 返回:', r);
    check('等级=5', job.等级 === 5, { 等级: job.等级 });
    check('技能点 10→15', job.技能点 === 15, { 技能点: job.技能点 });
    check('HP 最大 >30', 主角.基础状态.HP.最大 > 30, { hp: 主角.基础状态.HP.最大 });
    check('MP 最大 >20', 主角.基础状态.MP.最大 > 20, { mp: 主角.基础状态.MP.最大 });
    check('总等级=5', 主角.基础状态.总等级 === 5, { 总等级: 主角.基础状态.总等级 });
  }

  // ===== 场景2：普通职业主角 战士+1 =====
  {
    console.log('\n--- 场景2：战士 Lv2 → +1 ---');
    const 主角 = makeActor({ 战士: { 等级: 2, 技能点: 8 } });
    Mvu._data = { stat_data: { 主角, 同伴: {}, $customSkillTrees: {} } };
    const delta = simulateConfirmAlloc(Mvu._data.stat_data, '主角', '战士', 1);
    await api.应用分配({ target: '主角', jobs: delta.jobs, attr: {} });
    const job = 主角.基础状态.职业信息['战士'];
    check('等级=3', job.等级 === 3, { 等级: job.等级 });
    check('技能点 8→12', job.技能点 === 12, { 技能点: job.技能点 });
    check('HP 最大 >30', 主角.基础状态.HP.最大 > 30, { hp: 主角.基础状态.HP.最大 });
    check('SP 最大 >10', 主角.基础状态.SP.最大 > 10, { sp: 主角.基础状态.SP.最大 });
  }

  // ===== 场景3：同伴 战士+1 =====
  {
    console.log('\n--- 场景3：同伴莉莉丝 战士 Lv2 → +1 ---');
    const 同伴 = makeActor({ 战士: { 等级: 2, 技能点: 8 } });
    Mvu._data = { stat_data: { 主角: makeActor({ 战士: { 等级: 1, 技能点: 4 } }), 同伴: { 莉莉丝: 同伴 }, $customSkillTrees: {} } };
    const delta = simulateConfirmAlloc(Mvu._data.stat_data, '莉莉丝', '战士', 1);
    await api.应用分配({ target: '莉莉丝', jobs: delta.jobs, attr: {} });
    const job = 同伴.基础状态.职业信息['战士'];
    check('等级=3', job.等级 === 3, { 等级: job.等级 });
    check('技能点 8→12', job.技能点 === 12, { 技能点: job.技能点 });
    check('HP 最大 >30', 同伴.基础状态.HP.最大 > 30, { hp: 同伴.基础状态.HP.最大 });
    check('总等级=5', 同伴.基础状态.总等级 === 5, { 总等级: 同伴.基础状态.总等级 });
  }

  // ===== 场景4：融合职业名来自 $customSkillTrees.fusedFrom =====
  {
    console.log('\n--- 场景4：自定义融合名「混沌术士」（fusedFrom 符文师+元素法师）Lv4 → +1 ---');
    const 主角 = makeActor({ 混沌术士: { 等级: 4, 技能点: 10 } });
    Mvu._data = { stat_data: { 主角, 同伴: {}, $customSkillTrees: { 混沌术士: { '职业融合': { fusedFrom: ['符文师', '元素法师'] } } } } };
    const delta = simulateConfirmAlloc(Mvu._data.stat_data, '主角', '混沌术士', 1);
    await api.应用分配({ target: '主角', jobs: delta.jobs, attr: {} });
    const job = 主角.基础状态.职业信息['混沌术士'];
    check('等级=5', job.等级 === 5, { 等级: job.等级 });
    check('技能点 10→15', job.技能点 === 15, { 技能点: job.技能点 });
    check('HP 最大 >30', 主角.基础状态.HP.最大 > 30, { hp: 主角.基础状态.HP.最大 });
    check('MP 最大 >20', 主角.基础状态.MP.最大 > 20, { mp: 主角.基础状态.MP.最大 });
  }

  console.log('\n===== 结果: ' + pass + ' 通过, ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
