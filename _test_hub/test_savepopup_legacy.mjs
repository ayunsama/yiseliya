// 验证 首页代码 主角数据存档（多存档点 + 弹窗概览 + 兼容旧单存档）
// 用 vm.Script 在沙箱里定义 async 函数，校验：保存入列表 / 概览 / 兼容旧档 / 上限30份 / 导入落盘
import fs from 'node:fs';
import vm from 'node:vm';

const home = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const scriptSrc = home.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

function grab(name, endMarker) {
  let i = scriptSrc.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('未找到函数: ' + name);
  // 若前面是 async，把起点前移让它成为 async function
  if (i >= 6 && scriptSrc.slice(i-6, i) === 'async ') i -= 6;
  let j;
  if (endMarker) {
    j = scriptSrc.indexOf(endMarker, i);
  } else {
    // 找下一个「顶层函数」（8空格 + function/async function）
    const re = /\n {8}(?:async )?function /g;
    re.lastIndex = i + 10;
    const m = re.exec(scriptSrc);
    j = m ? m.index : scriptSrc.length;
  }
  return scriptSrc.slice(i, j > i ? j : scriptSrc.length);
}

const code = [
  'var SAVE_KEY_LIST="伊瑟利亚主角存档列表"; var SAVE_KEY_LEGACY="伊瑟利亚主角存档";',
  'var baseAttrs={str:8,dex:8,con:8,int:8,wis:8,cha:8}, ccPoints=20;',
  'function getCost(v){ if(v<=13)return v-8; return 5+(v-13)*2+Math.max(0,v-15); }',
  'function updateClass(){} function calcStats(){} function updateRaceBonus(){} function checkFaithAndRace(){}',
  'var RACE_MODS={};',
  'function applySaveToHomeForm(){ /* 首页表单回填依赖 DOM，此处在导入链路中仅需存在 */ }',
  'function showHomeConfirm(){ return Promise.resolve(true); }',
  'function resolveHomeConfirm(){ }',
  grab('protagonistDeepClone'),
  grab('readProtagonistData', '\n        // 从角色卡变量读取存档点列表'),
  grab('getSaveList', '\n        // 提取一份主角数据的'),
  grab('protagonistSummary'),
  grab('saveProtagonistData'),
  grab('applySaveToProtagonist'),
  grab('importSaveById'),
  grab('deleteSaveById'),
  grab('openSaveListPopup'),
  grab('closeSaveListPopup'),
  grab('renderSaveList'),
  grab('loadProtagonistData'),
  '\nthis.__api = { getSaveList, saveProtagonistData, protagonistSummary, applySaveToProtagonist, loadProtagonistData, importSaveById, deleteSaveById };',
].join('\n');

// 沙箱
const store = { charVars: {} };
function getVariables(opts) { return store.charVars; }
function replaceVariables(v, opts) { store.charVars = v; }
const toasts = [];
const windowObj = { toastr: { success: m => toasts.push('success:'+m), error: m => toasts.push('error:'+m) }, confirm: () => true };
let currentProto = { 基础信息:{姓名:'测试勇者',种族:'人类'}, 基础状态:{总等级:12,职业信息:{战士:{等级:8},贤者:{等级:4}}}, 等阶:'史诗' };
let appliedProto = null;
const Mvu = { getMvuData: () => ({ stat_data: { 主角: currentProto } }), replaceMvuData: async (d) => { appliedProto = d.stat_data.主角; return undefined; } };
function getAllVariables() { return { stat_data: { 主角: currentProto } }; }
function updateVariablesWith(fn) { fn(store.charVars); }
const __ = {};
__.get = (o,p) => { let c=o; for (const k of (Array.isArray(p)?p:p.split('.'))){ if(c==null)return undefined; c=c[k]; } return c; };
__.set = (o,p,v) => { const ks=Array.isArray(p)?p:p.split('.'); let c=o; for(let i=0;i<ks.length-1;i++){ if(c[ks[i]]==null)c[ks[i]]={}; c=c[ks[i]]; } c[ks[ks.length-1]]=v; return o; };
__.isPlainObject = (o) => o && typeof o==='object' && !Array.isArray(o);
__.isFunction = (f) => typeof f==='function';
__.cloneDeep = (o) => JSON.parse(JSON.stringify(o));

const sandbox = {
  _: __, getVariables, replaceVariables, getAllVariables, updateVariablesWith, Mvu, window: windowObj,
  document: { getElementById: () => null },
  console, toastr: windowObj.toastr,
  currentProto: () => currentProto,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

let fail = 0;
function chk(name, ok, extra='') { if (ok) console.log('  ✓ ' + name); else { console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); fail++; } }

console.log('===== 主角数据存档（多存档点+弹窗） 逻辑测试 =====');
const api = sandbox.__api;

// 1. 保存入列表
store.charVars = {};
const save1 = api.saveProtagonistData(true);
chk('保存返回 true', save1 === true);
let list = api.getSaveList();
chk('保存后列表长度 1', list.length === 1, '实际 ' + list.length);
chk('列表项含数据', list[0] && list[0].数据 && list[0].数据.基础信息.姓名 === '测试勇者');

// 2. 概览
const sum1 = api.protagonistSummary(list[0].数据);
chk('概览姓名', sum1.姓名 === '测试勇者');
chk('概览等级', String(sum1.等级) === '12');
chk('概览等阶', sum1.等阶 === '史诗');
chk('概览职业含战士', /战士/.test(sum1.职业));

// 3. 兼容旧单存档
store.charVars = { 伊瑟利亚主角存档: { 基础信息:{姓名:'旧勇者'}, 基础状态:{}, 等阶:'普通' }, 伊瑟利亚主角存档时间:'2026-01-01 10:00' };
list = api.getSaveList();
chk('旧单存档转列表项', list.length === 1 && list[0]._legacy === true && list[0].数据.基础信息.姓名 === '旧勇者');

// 4. 上限30份
store.charVars = {};
for (let i=0;i<35;i++) api.saveProtagonistData(false);
list = api.getSaveList();
chk('超出30份裁剪到30', list.length === 30, '实际 ' + list.length);

// 5. 导入落盘
store.charVars = {};
api.saveProtagonistData(false);
list = api.getSaveList();
appliedProto = null;
currentProto = { 基础信息:{姓名:'当前'}, 基础状态:{}, 等阶:'普通' };
const imp = await api.applySaveToProtagonist(list[0].数据);
chk('导入返回 true', imp === true);
chk('导入写入主角', appliedProto && appliedProto.基础信息.姓名 === '测试勇者');

// 6. load 用最新
store.charVars = {};
currentProto = { 基础信息:{姓名:'旧'}, 基础状态:{}, 等阶:'普通' };
api.saveProtagonistData(false);
currentProto = { 基础信息:{姓名:'当前'}, 基础状态:{}, 等阶:'普通' };
appliedProto = null;
await api.loadProtagonistData();
chk('load 恢复最新存档', appliedProto && appliedProto.基础信息.姓名 === '旧');

// 7.（问题1回归）删除到最后一个后：legacy 不复活，列表真正为空
store.charVars = { 伊瑟利亚主角存档: { 基础信息:{姓名:'旧勇者'}, 基础状态:{}, 等阶:'普通' }, 伊瑟利亚主角存档时间:'2026-01-01 10:00' };
let l7 = api.getSaveList();
chk('旧档转成第一条 legacy', l7.length === 1 && l7[0]._legacy === true);
await api.deleteSaveById(0);   // 删除这条 legacy（列表最后一条）
store.charVars = JSON.parse(JSON.stringify(store.charVars)); // 深拷贝避免引用粘滞
l7 = api.getSaveList();
chk('删除最后一档后列表为空', l7.length === 0, '实际 ' + l7.length);
chk('legacy 字段已被清除', !('伊瑟利亚主角存档' in store.charVars), 'legacy 仍在');

console.log('\n结果: ' + (fail === 0 ? '全部通过' : fail + ' 项失败'));
process.exit(fail === 0 ? 0 : 1);
