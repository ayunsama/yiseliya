/**
 * 契约兽端到端联调：规则文档 loadAsContract 写入的 payload → 升级脚本 handleJobUpgrade 消费
 * 链路：parseContract → loadAsContract(insertOrAssignVariables payload)
 *      → 升级代码 VARIABLE_UPDATE_ENDED 读取 stat_data.契约兽 → 等级提升触发兽类成长
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗ FAIL:', msg); }
}

// ---------- 沙箱1：规则文档 ----------
const html = fs.readFileSync(path.join(ROOT, 'dist/伊瑟利亚/NPC以及敌人相关规则'), 'utf8');
const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
let js = m[1];
const sample = `<contract_data>
[名称|冰霜巨龙]
[种族|冰霜巨龙]
[职业|巨龙]
[契约主|主角]
[等阶|精英]
[等级|7]
[体型|巨型]
[元素属性|冰]
[羁绊|65]
[HP|120|140]
[MP|60|80]
[SP|40|50]
[防御值|16]
[移动速度|40]
[先攻修正|2]
[属性|力量18|敏捷10|体质16|智力10|感知12|魅力10]
[攻击|寒冰爪击|近战|6|2d6+3|附带冰冻]
[能力|冰甲|受到物理伤害-2]
[吐息|冰霜吐息|冰|8d6|锥形30尺|3轮]
[弱点|火焰]
[抗性|冰霜]
[免疫|冰冻]
[外貌|覆盖冰晶的巨龙]
[性格|高傲]
[所属势力|极北龙族]
[背景故事|守护冰原千年的古龙。]
[状态|健康]
</contract_data>`;
const marker = 'var rawData = `$1`;';
const idx = js.indexOf(marker);
js = js.slice(0, idx) + 'var rawData = ' + JSON.stringify(sample) + ';' + js.slice(idx + marker.length);

let capturedPayload = null;
const els = {};
const document = {
  getElementById(id) { if (!els[id]) els[id] = { innerHTML: '', textContent: '', className: '', style: {}, listeners: {}, addEventListener(t, fn) { this.listeners[t] = fn; } }; return els[id]; }
};
const sandbox1 = vm.createContext({
  document,
  window: { TavernHelper: { insertOrAssignVariables(p) { capturedPayload = p; } } },
  console
});
vm.runInContext(js, sandbox1);
const c = sandbox1.parseContract(sample);
const btn = els['btn-write-contract'];
btn.listeners.click();
const beast = capturedPayload.stat_data.契约兽['冰霜巨龙'];
assert(!!beast, '规则文档 loadAsContract 写入 stat_data.契约兽.冰霜巨龙');
console.log('  … 等阶=' + beast.等阶 + ' 总等级=' + beast.基础状态.总等级 + ' 职业=' + beast.职业);

// ---------- 沙箱2：升级脚本 ----------
const CODE = fs.readFileSync(path.join(ROOT, 'dist/伊瑟利亚/升级代码'), 'utf8');
const events = {};
let initPromise = null;
const _ = { get: (o, p, d) => { let cur = o; for (const k of String(p).split('.')) { if (cur == null) return d; cur = cur[k]; } return cur === undefined ? d : cur; } };
const sandbox2 = vm.createContext({
  _,
  Mvu: { events: { VARIABLE_UPDATE_ENDED: 'VARIABLE_UPDATE_ENDED' } },
  eventOn: (n, h) => { (events[n] = events[n] || []).push(h); },
  $: (fn) => { initPromise = fn(); },
  toastr: { error: () => {}, success: () => {} },
  updateVariablesWith: () => {},
  window: {}, console, Math,
  prompt: () => null,
  waitGlobalInitialized: async () => {},
  getScriptButtons: () => [],
  replaceScriptButtons: () => {},
  getButtonEvent: (n) => 'btn_' + n
});
sandbox2.globalThis = sandbox2;
vm.createContext(sandbox2);
const origRandom = Math.random;
Math.random = () => 0.5;
(async () => {
  vm.runInContext(CODE, sandbox2);
  await initPromise;
  const handler = events['VARIABLE_UPDATE_ENDED'][0];
  const fire = (cur, before) => handler({ stat_data: { 契约兽: { 冰霜巨龙: cur } } }, { stat_data: { 契约兽: { 冰霜巨龙: before } } });

  // 首次写入（当前==变更前，同等级7）：不误成长、不报错
  const b1 = JSON.parse(JSON.stringify(beast));
  const c1 = JSON.parse(JSON.stringify(beast));
  fire(c1, b1);
  assert(c1.基础状态.总等级 === 7, `首次写入不误成长：总等级保持 ${c1.基础状态.总等级}`);
  assert(c1.基础状态.职业信息['巨龙'].技能点 === 0, `首次写入不给技能点：${c1.基础状态.职业信息['巨龙'].技能点}`);
  assert(c1.等阶 === '精英', `契约兽保留叙事等阶「精英」（不再被按等级校准）：${c1.等阶}`);

  // AI 升级 巨龙 7→8：触发兽类成长（d12，体质16→+3），无技能点
  const before = JSON.parse(JSON.stringify(beast));
  const curr = JSON.parse(JSON.stringify(beast));
  curr.基础状态.职业信息['巨龙'].等级 = 8;
  curr.基础状态.总等级 = 8;
  fire(curr, before);
  assert(curr.基础状态.总等级 === 8, `升级后总等级 = 8：${curr.基础状态.总等级}`);
  // d12(随机0.5→7)×2(关键等级8) + 体质mod(+3) = 17
  assert(curr.基础状态.HP.最大 === 140 + 17, `HP 成长 = 140 + (d12×2+3) = 157：${curr.基础状态.HP.最大}`);
  assert(curr.基础状态.职业信息['巨龙'].技能点 === 0, `升级后技能点仍为 0：${curr.基础状态.职业信息['巨龙'].技能点}`);
  assert(curr.攻击.length === 1 && curr.吐息 && curr.吐息.名称 === '冰霜吐息', `攻击/吐息等兽类字段保留`);
  assert(curr.基础属性.力量 === 18 && curr.羁绊 === 65 && curr.元素属性 === '冰', `力量/羁绊/元素 保留`);

  Math.random = origRandom;
  console.log(`\n========== 端到端结果：${pass} 通过 / ${fail} 失败 ==========`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('异常:', e); Math.random = origRandom; process.exit(2); });
