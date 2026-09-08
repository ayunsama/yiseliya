/**
 * 经验值弹窗确认 行为验证
 * 提取状态栏 filterExperienceConfirmCommands 与依赖（pathToSegments/trackPush），stub 环境跑。
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = (sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]).split('\r\n').join('\n'); // 归一化换行再提取
const pathSeg = src.slice(src.indexOf('        function pathToSegments'), src.indexOf('        function filterLockedCompanionCommands'));
const expFn = src.slice(src.indexOf('        function filterExperienceConfirmCommands'), src.indexOf('        // ============================================================\n        //  同伴母路径锁定'));

let trackStore = [];
globalThis.confirm = () => true;
let moneyLike = {}; // 记录 stat_data
globalThis.Mvu = {
  getMvuData: () => ({ stat_data: { 主角: { 基础状态: { 经验值: { 当前: 100, 升级所需: 100 } } } } }),
  replaceMvuData: async (d) => { globalThis.__newStat = d.stat_data; },
};
globalThis.toastr = { success: () => {}, warning: () => {}, info: () => {}, error: () => {} };
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
let populated = 0;
globalThis.populateCharacterData = () => { populated++; };
function trackPush(e) { trackStore.push(e); }
// 新记录形状：{ 时间, 类型, 金额, 物品, 数量, 余额, 说明 }（$flags.追踪记录 流水账）
function trackNotes(e) { return [e.类型 + ' ' + (e.金额 || 0), e.说明]; }
const fn = new Function('trackPush', pathSeg + expFn + '; return { filterExperienceConfirmCommands };');
const api = fn(trackPush);

let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); }
}
function cmdAdd(path, v) { return { type: 'add', args: [path, v] }; }
function cmdReplace(path, v) { return { type: 'replace', args: [path, v] }; }

console.log('========== 经验 +50（确认允许） ==========');
globalThis.confirm = () => true;
globalThis.__newStat = null;
let cmds = [cmdAdd('/主角/基础状态/经验值/当前', 50)];
api.filterExperienceConfirmCommands(cmds);
assert('经验命令从原流移除', cmds.length === 0, '实际 ' + cmds.length);
assert('经验已写入 stat_data（100+50=150）', globalThis.__newStat && globalThis.__newStat.主角.基础状态.经验值.当前 === 150, '实际 ' + (globalThis.__newStat?.主角?.基础状态?.经验值?.当前));
assert('记录经验获取', trackStore.length >= 1 && (trackStore[0].说明 || '').includes('经验 +50') && trackStore[0].类型 === '经验获取', JSON.stringify(trackStore));

console.log('\n========== 经验 +30（确认拒绝） ==========');
globalThis.confirm = () => false;
globalThis.__newStat = null;
trackStore = [];
cmds = [cmdAdd('/主角/基础状态/经验值/当前', 30)];
api.filterExperienceConfirmCommands(cmds);
assert('经验命令移除', cmds.length === 0);
assert('拒绝后不写入 stat_data', globalThis.__newStat === null, '实际 ' + JSON.stringify(globalThis.__newStat));
assert('无经验记录', trackStore.length === 0);

console.log('\n========== 非增量/非经验命令不受影响 ==========');
globalThis.confirm = () => true;
cmds = [cmdAdd('/主角/基础状态/经验值/当前', 20), cmdReplace('/主角/基础状态/经验值/升级所需', 500), cmdAdd('/主角/基础状态/HP/当前', 10)];
api.filterExperienceConfirmCommands(cmds);
assert('保留非经验命令（升级所需/HP）', cmds.length === 2, '实际 ' + cmds.length);
assert('影响经验命令被移除（剩2条）', cmds.every(c => !(c.args[0].includes('经验值.当前'))));

console.log('\n========== 负数/0 不拦截 ==========');
cmds = [cmdAdd('/主角/基础状态/经验值/当前', -5)];
api.filterExperienceConfirmCommands(cmds);
assert('负增不减经验不触发确认', cmds.length === 1, '实际 ' + cmds.length);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
