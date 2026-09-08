/**
 * 出生年月日 → 年龄自动计算 全链路：
 *   结构字段（主要NPC/同伴）· 状态栏 calcActorAge/parseEraDate 运行时计算 ·
 *   只读守卫（年龄/出生年月日 禁写）· 状态变量输出 eraAge+输出 · 规则条款
 */
import fs from 'node:fs';

const schema = fs.readFileSync('dist/伊瑟利亚/核心/变量结构脚本', 'utf8');
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const stateOut = fs.readFileSync('dist/伊瑟利亚/状态变量输出', 'utf8');
const rules = fs.readFileSync('dist/伊瑟利亚/核心/变量更新规则', 'utf8');
const home = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');

let pass = 0, fail = 0;
function assert(n, c, e = '') { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + ' ' + e); } }

console.log('========== ① 结构字段 ==========');
assert('主要NPC/同伴 条含 出生年月日 字段', schema.includes('出生年月日: str(\'\')') && (schema.match(/出生年月日: str\(''\)/g) || []).length >= 2, 'x' + (schema.match(/出生年月日: str\(''\)/g) || []).length);
assert('年龄字段注释=脚本派生（兼容旧数据）', schema.includes('兼容旧数据（脚本派生：有出生年月日时忽略此字段'));

console.log('\n========== ② 状态栏 calcActorAge 运行时（生日前后自动加减岁） ==========');
const ageStart = src.indexOf('        function parseEraDate(');
const ageEnd = src.indexOf('        function relmapDetailHtml(');
const ageSrc = src.slice(ageStart, ageEnd);
assert('切片成功（parseEraDate/calcActorAge）', ageSrc.length > 400);
const ageApi = new Function('_', 'getAllVariables', ageSrc + '; return { parseEraDate, calcActorAge };')(
  { get: (o, p, d) => String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) === undefined ? d : String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) },
  () => ({ stat_data: { 世界: { 日期: '圣光历1497年2月1日' } } })
);
assert('1467-03-01生，1497-02-01 → 29岁（未过生日）', ageApi.calcActorAge({ 出生年月日: '圣光历1467年3月1日' }) === 29, 'got ' + ageApi.calcActorAge({ 出生年月日: '圣光历1467年3月1日' }));
const ageApi2 = new Function('_', 'getAllVariables', ageSrc + '; return { parseEraDate, calcActorAge };')(
  { get: (o, p, d) => String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) === undefined ? d : String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) },
  () => ({ stat_data: { 世界: { 日期: '圣光历1497年3月1日' } } })
);
assert('1467-03-01生，1497-03-01 → 30岁（当天满生日）', ageApi2.calcActorAge({ 出生年月日: '圣光历1467年3月1日' }) === 30, 'got ' + ageApi2.calcActorAge({ 出生年月日: '圣光历1467年3月1日' }));
const ageApi3 = new Function('_', 'getAllVariables', ageSrc + '; return { parseEraDate, calcActorAge };')(
  { get: (o, p, d) => String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) === undefined ? d : String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) },
  () => ({ stat_data: { 世界: { 日期: '圣光历1497年3月2日' } } })
);
assert('1467-03-01生，1497-03-02 → 30岁（已过生日）', ageApi3.calcActorAge({ 出生年月日: '圣光历1467年3月1日' }) === 30);
assert('无出生年月日 → 回退 年龄 字段', ageApi.calcActorAge({ 年龄: 42 }) === 42 && ageApi.calcActorAge({}) === null);
assert('解析兼容 1467-03-01 格式', ageApi.parseEraDate('1467-03-01').y === 1467 && ageApi.parseEraDate('1467/3/1').mo === 3);

console.log('\n========== ③ 只读守卫（年龄/出生年月日 禁写） ==========');
assert('守卫函数存在', src.includes('function filterImmutableNpcFields') && src.includes('出生年月日一经确定不改'));
assert('已挂接 COMMAND_PARSED', src.includes('eventOn(Mvu.events.COMMAND_PARSED, filterImmutableNpcFields);'));
const guardStart = src.indexOf('        function filterImmutableNpcFields');
const pathStart = src.indexOf('        function pathToSegments(');
const pathEnd = src.indexOf('        function filterExperienceConfirmCommands');
const guardJs = src.slice(guardStart, pathStart) + '\n' + src.slice(pathStart, pathEnd);
const toastrStub = { warn: 0, infoC: 0, warning: () => { toastrStub.warn++; }, info: () => { toastrStub.infoC++; } };
const lodashStub = { get: (o, p, d) => { const ks = String(p).split('.'); let c = o; for (const k of ks) { if (c == null) return d; c = c[k]; } return c === undefined ? d : c; } };
const guardApi = new Function('toastr', 'Mvu', '_', guardJs + '; return { filterImmutableNpcFields };')(toastrStub, {
  getMvuData: () => ({ stat_data: { 世界: { 日期: '圣光历1497年3月2日' }, 主要NPC: { '亚伦·伍德': { 出生年月日: '圣光历1467年3月1日' } }, 同伴: { '莉娜': {}, '旧角色': {} } } })
}, lodashStub);
// 情况A1：已有出生年月日 → 年龄改写被拦
let cmds = [{ type: 'replace', args: ['/主要NPC/亚伦·伍德/年龄', 31] }];
guardApi.filterImmutableNpcFields(cmds);
assert('已有出生年月日 → 年龄改写被拦截', cmds.length === 0, JSON.stringify(cmds));
// 情况A2：无出生年月日 → 写年龄自动换算为出生年月日（1497-03-02 倒扣30 → 1467-03-02）
cmds = [{ type: 'replace', args: ['/同伴/旧角色/年龄', 30] }];
toastrStub.infoC = 0;
guardApi.filterImmutableNpcFields(cmds);
assert('无出生年月日写年龄 → 命令转换为 写入出生年月日（1467-03-02）', cmds.length === 1 && cmds[0].args[0] === '同伴.旧角色.出生年月日' && cmds[0].args[1] === '圣光历1467年3月2日', JSON.stringify(cmds[0] && cmds[0].args));
assert('情况A 触发 toastr.info（玩家可见自动换算）', toastrStub.infoC > 0);
// 情况B：insert 整条新角色带年龄 → value 自动补出生年月日、去掉年龄
cmds = [{ type: 'insert', args: ['/同伴/新人', { 好感度: 50, 年龄: 25 }] }];
toastrStub.infoC = 0;
guardApi.filterImmutableNpcFields(cmds);
assert('insert 整条含年龄 → 自动注入出生年月日并删除年龄字段', cmds[0].args[1].出生年月日 === '圣光历1472年3月2日' && cmds[0].args[1].年龄 === undefined, JSON.stringify(cmds[0].args[1]));
assert('情况B 触发 toastr.info（玩家可见自动换算）', toastrStub.infoC > 0);
// 情况C：出生年月日 首次 insert 放行；改写/删除 拦
cmds = [{ type: 'insert', args: ['/同伴/莉娜/出生年月日', '圣光历1470年1月1日'] }];
guardApi.filterImmutableNpcFields(cmds);
assert('出生年月日 首次 insert 放行', cmds.length === 1, JSON.stringify(cmds));
cmds = [{ type: 'replace', args: ['/同伴/莉娜/出生年月日', 'x'] }];
guardApi.filterImmutableNpcFields(cmds);
assert('出生年月日 改写被拦截', cmds.length === 0, JSON.stringify(cmds));
cmds = [{ type: 'replace', args: ['/主要NPC/亚伦·伍德/好感度', 40] }];
guardApi.filterImmutableNpcFields(cmds);
assert('无关字段（好感度）放行', cmds.length === 1);

console.log('\n========== ④ 状态变量输出 eraAge + 输出 ==========');
assert('EJS 含 eraAge 计算函数（_eraDate/eraAge）', stateOut.includes('function eraAge(birthStr, nowStr)') && stateOut.includes('function _eraDate(s)'));
assert('主要NPC/同伴 段输出 出生年月日+自动年龄（含禁改提示）', stateOut.includes('出生年月日: ${d.出生年月日}') || stateOut.includes('（出生:${d.出生年月日}）') || stateOut.includes('出生年月日: ${comp.出生年月日}') || stateOut.includes('按当前日期自动计算，禁止手动改写'));

console.log('\n========== ⑤ 规则与首页 ==========');
assert('规则·主要NPC 出生年月日条款（收录必填+禁改年龄）', rules.includes('出生年月日·收录必填') && rules.includes('禁止填写/改写「年龄」字段'));
assert('规则·主要NPC type 含 出生年月日（不再要求写年龄）', rules.includes('心里话: string, 出生年月日: string, 身份: string'));
assert('规则·认识新NPC 示例为全词条+出生年月日（不写年龄）', rules.includes('认识新NPC（全词条，出生年月日必填、不写年龄）') && rules.includes('"出生年月日": "圣光历1479年3月14日"') && rules.includes('/主要NPC/黛芙妮·维恩'));
assert('规则·新同伴入队示例含出生年月日', rules.includes('新同伴入队（出生年月日必填，不写年龄）') && rules.includes('"出生年月日": "圣光历1478年11月2日"'));
assert('首页·写入支持 npc.birth', home.includes('出生年月日: npc.birth || \'\''));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
