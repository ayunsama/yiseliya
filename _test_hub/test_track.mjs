/**
 * 追踪记录 · 记录展示引擎 行为验证（v3：MVU 规则写入 → 状态栏只读显示 世界.追踪记录）
 * + 硬拦截守卫：只放行 insert，replace/remove/add/move 丢弃
 * 提取状态栏真实 readTrack/renderTrackTab/lastTrackMoney/filterTrackRecordCommands 逻辑，stub 环境后跑。
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1].split('\r\n').join('\n');
// 提取 追踪记录守卫（含 pathToSegments 定义段）
const guardStart = src.indexOf('        function filterTrackRecordCommands');
const guardEnd = src.indexOf('        // ============================================================\n        //  同伴母路径锁定');
const pathSegSrc = src.slice(src.indexOf('        function pathToSegments'), src.indexOf('        function filterExperienceConfirmCommands'));
const guardJs = pathSegSrc + '\n' + src.slice(guardStart, guardEnd);
const start = src.indexOf('            function readTrack()');
const end = src.indexOf('            $(\'.jrpg-status-wrapper\').on(\'click\', \'#btn-clear-track\'');
const js = src.slice(start, end);

// ---- stubs ----
let worldData = { 追踪记录: {} };
let money = 100;
globalThis.Mvu = {
  getMvuData: () => ({ stat_data: { $flags: {}, 世界: worldData, 主角: { 资产与能力: { 货币: money } } } }),
  replaceMvuData: async (d) => { worldData = d.stat_data.世界 || { 追踪记录: {} }; },
};
globalThis.$ = () => ({ on: () => {} });
globalThis.eventOn = () => {};
globalThis.toastr = { success: () => {}, info: () => {}, warning: () => {}, error: () => {}, count: 0 };
globalThis.toastr.warning = () => { globalThis.toastr.count++; };
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
globalThis.escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
globalThis.confirm = () => true;
globalThis.alert = () => {};

const fn = new Function(
  'Mvu', '$', 'eventOn', 'toastr', 'window', 'escapeAttr', 'confirm', 'alert',
  js + '; return { readTrack, lastTrackMoney };'
);
const api = fn(globalThis.Mvu, globalThis.$, globalThis.eventOn, globalThis.toastr, globalThis.window, globalThis.escapeAttr, globalThis.confirm, globalThis.alert);

const guardFn = new Function('toastr', guardJs + '; return { filterTrackRecordCommands };');
const guardApi = guardFn(globalThis.toastr);

let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); }
}

console.log('========== 读取 世界.追踪记录（AI 按 MVU 规则 insert） ==========');
// 模拟 AI 用 JSONPatch insert 了两条（框架已写入 stat_data）
worldData.追踪记录 = {
  '20260827-1432-01': { 时间: '第3天 上午', 类型: '金盾入账', 金额: 50, 物品: '', 数量: 0, 余额: 150, 说明: '完成委托报酬' },
  '20260827-1433-01': { 时间: '第3天 上午', 类型: '购买物品', 金额: -10, 物品: '治疗药水', 数量: 2, 余额: 140, 说明: '红狮商会' }
};
const arr = api.readTrack();
assert('读出 2 条', arr.length === 2, '实际 ' + arr.length);
assert('第1条 金额=50 余额=150', arr[0].金额 === 50 && arr[0].余额 === 150, JSON.stringify(arr[0]));
assert('第2条 物品=治疗药水 数量=2 金额=-10', arr[1].金额 === -10 && arr[1].数量 === 2 && arr[1].物品 === '治疗药水', JSON.stringify(arr[1]));

console.log('\n========== 空容器/无容器 → 空数组 ==========');
worldData = { 追踪记录: {} };
assert('空容器 → 0 条', api.readTrack().length === 0);
worldData = {};
assert('无世界.追踪记录 → 0 条（不抛错）', api.readTrack().length === 0);

console.log('\n========== 货币一键修正取值（最后一条余额≥0） ==========');
worldData.追踪记录 = {
  'a': { 类型: '金盾入账', 金额: 15, 余额: 5, 说明: '' },
  'b': { 类型: '金盾支出', 金额: -5, 余额: 30, 说明: '' },
  'c': { 类型: '物品获得', 金额: 0, 数量: 1, 余额: -1, 物品: '铁剑', 说明: '' }
};
assert('lastTrackMoney = 30（跳过余额-1）', api.lastTrackMoney() === 30, '实际 ' + api.lastTrackMoney());

console.log('\n========== 非法条目字段缺失 → 容错 ==========');
worldData.追踪记录 = { 'x': { 类型: '金盾入账' } };
const r = api.readTrack();
assert('仅类型时读出1条且金额=0', r.length === 1 && r[0].金额 === 0 && r[0].余额 === -1, JSON.stringify(r));

console.log('\n========== 硬拦截守卫：只放行 insert 单条 ==========');
function cmd(type, ...args) { return { type, args }; }
// 放行场景
let cmds = [cmd('insert', '/世界/追踪记录/20260827-1432-01', { 时间: '第3天', 类型: '金盾入账', 金额: 50, 余额: 150, 说明: 'x' })];
guardApi.filterTrackRecordCommands(cmds);
assert('insert 单条 放行', cmds.length === 1, '实际 ' + cmds.length);
// 拦截场景
cmds = [
  cmd('replace', '/世界/追踪记录/', { 'a': { 类型: 'x' } }),          // 整容器 replace
  cmd('remove', '/世界/追踪记录/20260827-1432-01'),                    // 删单条
  cmd('add', '/世界/追踪记录', 1),                                      // 容器 add
  cmd('insert', '/世界/追踪记录/20260827-1432-01/x', 5),               // 嵌套改子字段
  cmd('replace', '/主角/基础状态/HP/当前', 10)                            // 非追踪记录不受影响（对照）
];
guardApi.filterTrackRecordCommands(cmds);
assert('整容器 replace 被拦', cmds.length === 1 && cmds[0].type === 'replace' && cmds[0].args[0] === '/主角/基础状态/HP/当前', JSON.stringify(cmds));
// move 目标指向追踪记录也拦
cmds = [cmd('move', '/世界/动态新闻/x', '/世界/追踪记录/20260827-01')];
guardApi.filterTrackRecordCommands(cmds);
assert('move 到追踪记录 被拦', cmds.length === 0, JSON.stringify(cmds));
// 命中拦截触发 toastr 提示
assert('拦截时 toastr.warning 被调用', globalThis.toastr.count >= 1, '实际 ' + globalThis.toastr.count);

console.log('\n========== 经验获取条目（金额=EXP增量，非金盾） ==========');
worldData.追踪记录 = {
  'e1': { 时间: '第3天 下午', 类型: '经验获取', 金额: 120, 物品: '', 数量: 0, 余额: -1, 说明: '讨伐魔物·经验结算' },
  'e2': { 时间: '第3天 下午', 类型: '购买物品', 金额: -10, 物品: '治疗药水', 数量: 2, 余额: 140, 说明: '红狮商会' },
  'e3': { 时间: '第3天 晚上', 类型: '经验获取', 金额: 60, 物品: '', 数量: 0, 余额: 200, 说明: '谜题解密（误填余额应被跳过）' }
};
const expArr = api.readTrack();
assert('readTrack 读出 3 条（含 2 条经验获取）', expArr.length === 3 && expArr[0].类型 === '经验获取' && expArr[0].金额 === 120, JSON.stringify(expArr.map(e => [e.类型, e.金额])));
assert('lastTrackMoney = 140（最后一条金盾余额；经验条目即使误填 200 也被跳过）', api.lastTrackMoney() === 140, '实际 ' + api.lastTrackMoney());

console.log('\n========== 静态：经验获取词段齐备（规则/结构/状态栏/输出） ==========');
const rules = fs.readFileSync('dist/伊瑟利亚/核心/变量更新规则', 'utf8');
const schema = fs.readFileSync('dist/伊瑟利亚/核心/变量结构脚本', 'utf8');
const expRules = fs.readFileSync('dist/伊瑟利亚/经验获取规则', 'utf8');
const stateOut = fs.readFileSync('dist/伊瑟利亚/状态变量输出', 'utf8');
assert('变量更新规则·操作示例含「经验获取」词段', rules.includes('经验获取: { "op": "insert"') && rules.includes('"类型": "经验获取"') && rules.includes('"余额": -1'));
assert('变量更新规则·金额/余额说明含经验语义', rules.includes('经验增量') && rules.includes('恒填 -1'));
assert('变量结构·追踪记录条注释含经验语义', schema.includes('类型=「经验获取」') && schema.includes('经验增量（非金盾）'));
assert('经验获取规则·结算模板含流水账联动', expRules.includes('流水账: 每次经验结算后') && expRules.includes('insert 一条「经验获取」流水'));
assert('状态栏·经验获取按 EXP 展示（非金盾）', src.includes("e.类型 === '经验获取'") && src.includes('EXP</b>'));
assert('状态栏·货币一键修正跳过经验条目', src.includes("e.类型 !== '经验获取'"));
assert('状态变量输出·经验获取金额标 EXP（其余=铜盾）', stateOut.includes("te.类型 === '经验获取' ? 'EXP' : '铜盾'") && stateOut.includes("te.余额 + '铜盾'"));
assert('状态变量输出·标题体现经验流水', stateOut.includes('经济/物品/经验流水'));

console.log('\n========== 货币单位规范（铜盾：1金盾=1000铜盾、1银盾=100铜盾） ==========');
assert('规则明确金额/余额单位=铜盾', rules.includes('**铜盾**（1金盾=1000铜盾，1银盾=100铜盾') && rules.includes('报酬5银盾=金额500') && rules.includes('单位同为铜盾'));
assert('规则示例按铜盾校准（500=5银盾入账 / 余额1500）', rules.includes('"金额": 500') && rules.includes('"余额": 1500') && rules.includes('5银盾入账') && rules.includes('"金额": -150'));
const fcStart = src.indexOf('        function formatCurrency(');
const fcSrc = src.slice(fcStart, src.indexOf('        function getQuestStatusClass('));
const fcApi = new Function(fcSrc + '; return { formatCurrency };')();
assert('formatCurrency 切片成功', fcSrc.length > 150);
assert('500铜盾 → 5银盾（收入500不再显示为500金盾）', fcApi.formatCurrency(500) === '5银盾', '实际 ' + fcApi.formatCurrency(500));
assert('1500铜盾 → 1金盾 5银盾', fcApi.formatCurrency(1500) === '1金盾 5银盾', '实际 ' + fcApi.formatCurrency(1500));
assert('1234铜盾 → 1金盾 2银盾 34铜盾', fcApi.formatCurrency(1234) === '1金盾 2银盾 34铜盾', '实际 ' + fcApi.formatCurrency(1234));
assert('0 → 0 铜盾', fcApi.formatCurrency(0) === '0 铜盾', '实际 ' + fcApi.formatCurrency(0));
assert('1000铜盾 → 1金盾', fcApi.formatCurrency(1000) === '1金盾', '实际 ' + fcApi.formatCurrency(1000));
assert('状态栏流水金额用 formatCurrency 分级显示', src.includes("formatCurrency(Math.abs(e.金额))"));
assert('状态栏货币对比行用 formatCurrency（货币/流水余额同单位）', src.includes('formatCurrency(curMoney)') && src.includes('formatCurrency(lastMoney)'));
const homeSrc2 = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
assert('首页资金按铜盾写入（10银盾→1000铜盾）', homeSrc2.includes('stat.主角.资产与能力.货币 = myMoney * 100;'));
const pb4 = fs.readFileSync('dist/伊瑟利亚/开场白4', 'utf8');
assert('开场白4 的45银盾→4500铜盾（与叙事一致）', pb4.includes('货币: 4500'));

console.log('\n========== 静态：replaceMvuData 返回 undefined 的防御（同步框架兼容） ==========');
// MagVarUpdate 部分环境实现为同步应用并返回 undefined：await 无害，但 .then/.catch 链会崩
// （用户报错：Cannot read properties of undefined (reading 'then')）
const thenChains = (src.match(/Mvu\.replaceMvuData\([^)]*\)\.(then|catch)/g) || []).length;
assert('状态栏无裸 replaceMvuData(...).then/.catch 链', thenChains === 0, '残留 ' + thenChains + ' 处');
const safeChains = (src.match(/Promise\.resolve\(Mvu\.replaceMvuData\([^)]*\)\)\.then/g) || []).length;
assert('状态栏 4 处链点已用 Promise.resolve 包装', safeChains === 4, '实际 ' + safeChains);
const homeSrc = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
assert('首页 .catch 链也已包装', homeSrc.includes('Promise.resolve(Mvu.replaceMvuData(mvuData, scope)).catch'));
assert('全仓库无裸链（含首页）', (homeSrc.match(/Mvu\.replaceMvuData\([^)]*\)\.(then|catch)/g) || []).length === 0);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
