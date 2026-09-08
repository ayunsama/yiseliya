/**
 * 验证：技能树页签（renderSkillTree）能渲染融合职业技能树
 * 用 DOM 桩加载整个 状态栏 内嵌脚本，直接调用 renderSkillTree()
 * 场景：融合职业「混沌术士」（$customSkillTrees[混沌术士]['职业融合'].skills）+ 普通职业「战士」
 */
const fs = require('fs');
const vm = require('vm');

// ---- 读 状态栏 内嵌 script ----
const raw = fs.readFileSync('dist/变量结构与状态栏代码/状态栏', 'utf8');
const m = raw.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到内嵌 script'); process.exit(1); }
const code = m[1];

// ---- 简化 lodash ----
function get(o, p, d) {
  if (o == null) return d;
  let v = o;
  const ks = Array.isArray(p) ? p : String(p).split('.');
  for (const k of ks) { if (v == null) return d; v = v[k]; }
  return v === undefined ? d : v;
}
const _ = {
  get,
  set(o, p, v) { const ks = Array.isArray(p) ? p : String(p).split('.'); let t = o; for (let i = 0; i < ks.length - 1; i++) { if (t[ks[i]] == null) t[ks[i]] = {}; t = t[ks[i]]; } t[ks[ks.length - 1]] = v; },
  omit(o, keys) { const r = {}; for (const k in o) { if (keys.indexOf(k) === -1) r[k] = o[k]; } return r; },
  extend(...args) { return Object.assign({}, ...args); },
  cloneDeep(o) { return JSON.parse(JSON.stringify(o)); },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
};

// ---- 桩全局 ----
let capturedHtml = '';
const fakeJq = {
  length: 1,
  html(h) { if (h !== undefined) capturedHtml = h; return this; },
  text() { return this; }, css() { return this; }, attr() { return this; },
  val(v) { return v === undefined ? '' : this; }, on() { return this; },
  show() { return this; }, hide() { return this; }, find() { return this; },
  closest() { return this; }, data() { return undefined; }, prop() { return this; },
  addClass() { return this; }, removeClass() { return this; }, slideToggle() { return this; },
  each() { return this; }
};
const $ = function () { return fakeJq; };

const getAllVariables = () => ({
  stat_data: {
    主角: {
      基础状态: {
        职业信息: {
          '混沌术士': { 等级: 4, 技能点: 10 },
          '战士': { 等级: 2, 技能点: 4 }
        }
      },
      资产与能力: { 角色技能: {}, 魔法栏: {}, 神术栏: {} }
    },
    $customSkillTrees: {
      '混沌术士': {
        '职业融合': {
          level: 4,
          fusedFrom: ['符文师', '元素法师'],
          skills: [
            { n: '融合火刃', type: '技能', c: 2, lvl: 1, d: '火属性斩击' },
            { n: '融合奥术球', type: '魔法', c: 3, lvl: 3, d: 'MP3 | 奥术能量球' },
            { n: '融合圣咏', type: '神术', c: 2, lvl: 2, d: 'MP2 | 圣光咏唱' }
          ]
        }
      }
    }
  }
});

const win = { toastr: { success() {}, error() {}, warning() {} } };
win.parent = win; win.top = win;

const sandbox = {
  _,
  $,
  getAllVariables,
  Mvu: { events: { VARIABLE_UPDATE_ENDED: 'mag_variable_update_ended' } },
  eventOn: () => {}, waitGlobalInitialized: () => Promise.resolve(),
  getScriptButtons: () => [], replaceScriptButtons: () => {}, getButtonEvent: () => '',
  injectPrompts: () => {}, createChatMessages: () => Promise.resolve(),
  toastr: win.toastr, window: win, console,
  errorCatched: (fn) => fn,
  prompt: () => null, confirm: () => true
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name, extra ? JSON.stringify(extra) : ''); }
}

// 调用 renderSkillTree
capturedHtml = '';
sandbox.renderSkillTree();

check('渲染了融合职业「混沌术士」', capturedHtml.indexOf('混沌术士') !== -1);
check('含「🔀 融合技能树」标记', capturedHtml.indexOf('🔀 融合技能树') !== -1);
check('含融合技能「融合火刃」', capturedHtml.indexOf('融合火刃') !== -1);
check('含融合技能「融合奥术球」', capturedHtml.indexOf('融合奥术球') !== -1);
check('含融合技能「融合圣咏」', capturedHtml.indexOf('融合圣咏') !== -1);
check('融合魔法 type=魔法', capturedHtml.indexOf('[魔法]') !== -1);
check('融合神术 type=神术', capturedHtml.indexOf('[神术]') !== -1);
check('融合技能学习按钮用 jrpg-vs-learn', /class="jrpg-btn-sm jrpg-vs-learn" data-job="混沌术士" data-skill="融合火刃"/.test(capturedHtml));
check('普通职业「战士」仍渲染', capturedHtml.indexOf('⚔️ 战士') !== -1);
check('战士技能「武器专精」仍渲染', capturedHtml.indexOf('武器专精') !== -1);
check('战士技能按钮用 jrpg-st-learn', /class="jrpg-btn-sm jrpg-st-learn" data-job="战士"/.test(capturedHtml));
check('含需融合等级标记', capturedHtml.indexOf('[需融合 Lv.') !== -1);

// ---- 调试：打印 融合圣咏 附近片段 ----
const si = capturedHtml.indexOf('融合圣咏');
console.log('--- 融合圣咏 index:', si);
if (si !== -1) console.log(capturedHtml.slice(Math.max(0, si - 120), si + 200));
console.log('--- [神术] index:', capturedHtml.indexOf('[神术]'), '| [魔法] index:', capturedHtml.indexOf('[魔法]'), '| 技能 type 出现次数: 技能=', (capturedHtml.match(/\[技能\]/g) || []).length, '魔法=', (capturedHtml.match(/\[魔法\]/g) || []).length, '神术=', (capturedHtml.match(/\[神术\]/g) || []).length);

console.log('\n===== 结果: ' + pass + ' 通过, ' + fail + ' 失败 =====');
process.exit(fail ? 1 : 0);
