/**
 * 契约兽成长冒烟测试（vm-stub 加载 dist/伊瑟利亚/升级代码）
 * 覆盖：
 *  A. 职业「巨龙」3→4（跨关键等级4）：HP 骰×2、无技能点
 *  B. 未知职业（不在 职业每级成长 表）：走通用「契约兽」兜底成长
 *  C. 自动经验升级（与角色同款）：总等级4 关键等级给 +2 属性点
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CODE = fs.readFileSync(path.join(ROOT, 'dist/伊瑟利亚/升级代码'), 'utf8');

const events = {};
let initPromise = null;

const _ = {
  get: (obj, p, def) => {
    const parts = String(p).split('.');
    let cur = obj;
    for (const k of parts) { if (cur == null) return def; cur = cur[k]; }
    return cur === undefined ? def : cur;
  }
};

const sandbox = {
  _,
  Mvu: { events: { VARIABLE_UPDATE_ENDED: 'VARIABLE_UPDATE_ENDED' } },
  eventOn: (name, handler) => { (events[name] = events[name] || []).push(handler); },
  $: (fn) => { initPromise = fn(); },
  toastr: { error: m => console.log('[toastr.error]', m), success: () => {} },
  updateVariablesWith: () => {},
  window: {},
  console,
  Math,
  prompt: () => null,
  waitGlobalInitialized: async () => {},
  getScriptButtons: () => [],
  replaceScriptButtons: () => {},
  getButtonEvent: (n) => 'btn_' + n,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// 固定随机：d12→7, d10→6, d8→5, d6→4
const origRandom = Math.random;
Math.random = () => 0.5;

function makeContract(level, jobName, opts = {}) {
  const attr = opts.attr || { 力量: 18, 敏捷: 10, 体质: 16, 智力: 10, 感知: 12, 魅力: 10 };
  return {
    名字: opts.name || '冰霜巨龙', 种族: opts.种族 || '冰霜巨龙', 职业: jobName,
    等阶: '普通', 体型: '巨型', 元素属性: '冰', 羁绊: 65, 外貌: '覆盖冰晶的巨龙',
    契约主: '主角', 防御值: 15, 移动速度: 40, 先攻修正: 2,
    攻击: [{ 名称: '寒冰爪击', 类型: '近战', 命中: 6, 伤害: '2d6+3' }],
    能力: [{ 名称: '冰甲', 描述: '受到物理伤害-2' }],
    吐息: { 名称: '冰霜吐息', 元素: '冰', 伤害骰: '8d6', 范围: '锥形30尺', 冷却: '3轮' },
    弱点: '火焰', 抗性: '冰霜', 免疫: '冰冻', 状态: '健康', 性格: '高傲',
    所属势力: '极北龙族', 背景故事: '守护冰原的古龙。',
    基础属性: Object.assign({ 未分配点数: 0 }, attr),
    基础状态: {
      HP: { 当前: opts.hp || 100, 最大: opts.hp || 100 },
      MP: { 当前: opts.mp || 50, 最大: opts.mp || 50 },
      SP: { 当前: opts.sp || 30, 最大: opts.sp || 30 },
      经验值: { 当前: opts.expCur || 0, 升级所需: opts.expReq || 200 },
      职业信息: { [jobName]: { 等级: level, 技能点: 0 } },
      总等级: level, 待分配职业等级: opts.pending || 0
    }
  };
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗ FAIL:', msg); }
}

(async () => {
  vm.runInContext(CODE, sandbox);
  await initPromise;
  console.log('脚本已加载，注册事件:', Object.keys(events).join(', '));
  const fire = (name, ...args) => (events[name] || []).forEach(h => h(...args));

  // ============ A. 巨龙 3→4 跨关键等级：HP×2、无技能点 ============
  console.log('\n[A] 契约兽·冰霜巨龙 职业「巨龙」3→4（关键等级4，HP骰×2）');
  {
    const prev = makeContract(3, '巨龙');
    const curr = makeContract(4, '巨龙');
    fire('VARIABLE_UPDATE_ENDED', { stat_data: { 契约兽: { 冰霜巨龙: curr } } }, { stat_data: { 契约兽: { 冰霜巨龙: prev } } });
    const c = curr;
    // d12×2=14 + 体质mod(16→+3) = 17
    assert(c.基础状态.HP.最大 === 117, `HP.最大 = 100 + (d12×2 + 3) = 117，实际 ${c.基础状态.HP.最大}`);
    assert(c.基础状态.SP.最大 === 39, `SP.最大 = 30 + (d10 + 3) = 39，实际 ${c.基础状态.SP.最大}`);
    assert(c.基础状态.MP.最大 === 55, `MP.最大 = 50 + (d8 + 0) = 55，实际 ${c.基础状态.MP.最大}`);
    assert(c.基础状态.职业信息['巨龙'].技能点 === 0, `技能点应保持 0（兽类无技能点），实际 ${c.基础状态.职业信息['巨龙'].技能点}`);
    assert(c.基础状态.总等级 === 4, `总等级 = 4，实际 ${c.基础状态.总等级}`);
    assert(c.等阶 === '普通', `等阶 = 普通（Lv4），实际 ${c.等阶}`);
  }

  // ============ B. 未知职业兜底成长 ============
  console.log('\n[B] 契约兽·小兽 未知职业 1→2（走通用「契约兽」兜底 d8/d6/d6）');
  {
    const prev = makeContract(1, '未知', { hp: 50, mp: 20, sp: 10, attr: { 力量: 12, 敏捷: 12, 体质: 10, 智力: 10, 感知: 12, 魅力: 8 } });
    const curr = makeContract(2, '未知', { hp: 50, mp: 20, sp: 10, attr: { 力量: 12, 敏捷: 12, 体质: 10, 智力: 10, 感知: 12, 魅力: 8 } });
    fire('VARIABLE_UPDATE_ENDED', { stat_data: { 契约兽: { 小兽: curr } } }, { stat_data: { 契约兽: { 小兽: prev } } });
    const c = curr;
    assert(c.基础状态.HP.最大 === 55, `HP.最大 = 50 + d8(5) + mod(体质10→0) = 55，实际 ${c.基础状态.HP.最大}`);
    assert(c.基础状态.MP.最大 === 24, `MP.最大 = 20 + d6(4) = 24，实际 ${c.基础状态.MP.最大}`);
    assert(c.基础状态.SP.最大 === 14, `SP.最大 = 10 + d6(4) = 14，实际 ${c.基础状态.SP.最大}`);
    assert(c.基础状态.职业信息['未知'].技能点 === 0, `未知职业技能点应保持 0，实际 ${c.基础状态.职业信息['未知'].技能点}`);
    assert(c.基础状态.总等级 === 2, `总等级 = 2，实际 ${c.基础状态.总等级}`);
  }

  // ============ C. 自动经验升级（与角色同款，关键等级4给+2属性点） ============
  console.log('\n[C] 契约兽 自动经验升级：总等级 3→4（关键等级，属性点+2）');
  {
    const expReq = Math.floor(200 * Math.pow(1.35, 2)); // Lv3 所需
    const st = makeContract(3, '巨龙', { expCur: 500, expReq });
    const before = JSON.parse(JSON.stringify(st));
    fire('VARIABLE_UPDATE_ENDED', { stat_data: { 契约兽: { 冰霜巨龙: st } } }, { stat_data: { 契约兽: { 冰霜巨龙: before } } });
    assert(st.基础状态.总等级 === 4, `自动升级后总等级 = 4，实际 ${st.基础状态.总等级}`);
    assert(st.基础状态.待分配职业等级 === 1, `待分配职业等级 +1 = 1，实际 ${st.基础状态.待分配职业等级}`);
    assert(st.基础属性.未分配点数 === 2, `关键等级4 属性点 +2，实际 ${st.基础属性.未分配点数}`);
    assert(st.基础状态.经验值.当前 === 500 - expReq, `经验扣除后剩余 = ${500 - expReq}，实际 ${st.基础状态.经验值.当前}`);
    assert(st.基础状态.经验值.升级所需 === Math.floor(200 * Math.pow(1.35, 3)), `下一级所需经验 = ${Math.floor(200 * Math.pow(1.35, 3))}，实际 ${st.基础状态.经验值.升级所需}`);
  }

  // ============ D. 职业宽松匹配 + 兜底 ============
  console.log('\n[D] 契约兽职业宽松匹配：冰霜巨龙→巨龙 / 风狼→魔兽 / 远古灵木→古树 / 山岭巨人→兜底');
  {
    // D1 冰霜巨龙（写种族名）→ 巨龙 d12，跨关键等级4 HP×2
    const p1 = makeContract(3, '冰霜巨龙');
    const c1 = makeContract(4, '冰霜巨龙');
    fire('VARIABLE_UPDATE_ENDED', { stat_data: { 契约兽: { 冰霜巨龙: c1 } } }, { stat_data: { 契约兽: { 冰霜巨龙: p1 } } });
    assert(c1.基础状态.HP.最大 === 117, `[冰霜巨龙] 匹配「巨龙」成长：HP = 100 + (d12×2+3) = 117，实际 ${c1.基础状态.HP.最大}`);
    assert(c1.基础状态.职业信息['冰霜巨龙'].技能点 === 0, `[冰霜巨龙] 技能点 0，实际 ${c1.基础状态.职业信息['冰霜巨龙'].技能点}`);

    // D2 风狼 → 魔兽 d8/d6/d6
    const a2 = { 力量: 12, 敏捷: 14, 体质: 10, 智力: 10, 感知: 12, 魅力: 8 };
    const p2 = makeContract(1, '风狼', { hp: 50, mp: 20, sp: 10, attr: a2 });
    const c2 = makeContract(2, '风狼', { hp: 50, mp: 20, sp: 10, attr: a2 });
    fire('VARIABLE_UPDATE_ENDED', { stat_data: { 契约兽: { 风狼: c2 } } }, { stat_data: { 契约兽: { 风狼: p2 } } });
    assert(c2.基础状态.HP.最大 === 55, `[风狼] 匹配「魔兽」成长：HP = 50 + d8(5) = 55，实际 ${c2.基础状态.HP.最大}`);
    assert(c2.基础状态.MP.最大 === 24 && c2.基础状态.SP.最大 === 14, `[风狼] MP/SP = 24/14，实际 ${c2.基础状态.MP.最大}/${c2.基础状态.SP.最大}`);

    // D3 远古灵木 → 古树 d12/d10（无SP成长）
    const a3 = { 力量: 14, 敏捷: 8, 体质: 12, 智力: 10, 感知: 14, 魅力: 6 };
    const p3 = makeContract(1, '远古灵木', { hp: 60, mp: 30, sp: 30, attr: a3 });
    const c3 = makeContract(2, '远古灵木', { hp: 60, mp: 30, sp: 30, attr: a3 });
    fire('VARIABLE_UPDATE_ENDED', { stat_data: { 契约兽: { 远古灵木: c3 } } }, { stat_data: { 契约兽: { 远古灵木: p3 } } });
    assert(c3.基础状态.HP.最大 === 68, `[远古灵木] 匹配「古树」成长：HP = 60 + (d12 + 体质mod+1) = 68，实际 ${c3.基础状态.HP.最大}`);
    assert(c3.基础状态.MP.最大 === 36, `[远古灵木] MP = 30 + d10(6) = 36，实际 ${c3.基础状态.MP.最大}`);
    assert(c3.基础状态.SP.最大 === 30, `[远古灵木] 古树无SP成长，SP 保持 30，实际 ${c3.基础状态.SP.最大}`);

    // D4 山岭巨人（无关键字命中）→ 通用契约兽兜底 d8/d6/d6
    const a4 = { 力量: 18, 敏捷: 6, 体质: 14, 智力: 6, 感知: 10, 魅力: 6 };
    const p4 = makeContract(1, '山岭巨人', { hp: 50, mp: 20, sp: 10, attr: a4 });
    const c4 = makeContract(2, '山岭巨人', { hp: 50, mp: 20, sp: 10, attr: a4 });
    fire('VARIABLE_UPDATE_ENDED', { stat_data: { 契约兽: { 山岭巨人: c4 } } }, { stat_data: { 契约兽: { 山岭巨人: p4 } } });
    assert(c4.基础状态.HP.最大 === 57, `[山岭巨人] 兜底成长：HP = 50 + (d8 + 体质mod+2) = 57，实际 ${c4.基础状态.HP.最大}`);
    assert(c4.基础状态.MP.最大 === 22 && c4.基础状态.SP.最大 === 16, `[山岭巨人] MP/SP = 22/16（智力6→修正-2，MP=4-2=2，SP=4+体质mod2=6），实际 ${c4.基础状态.MP.最大}/${c4.基础状态.SP.最大}`);
    assert(c4.基础状态.职业信息['山岭巨人'].技能点 === 0, `[山岭巨人] 技能点 0，实际 ${c4.基础状态.职业信息['山岭巨人'].技能点}`);
  }

  Math.random = origRandom;
  console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); Math.random = origRandom; process.exit(2); });
