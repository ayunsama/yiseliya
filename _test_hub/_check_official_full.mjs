import fs from 'node:fs';
import vm from 'node:vm';
let ok = true;
function chk(label, cond, extra) { console.log((cond ? '✅ ' : '❌ ') + label + (extra ? ' ' + extra : '')); if (!cond) ok = false; }

// ── ① isOfficialJob 行为测试（提取真实函数） ──
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const offStart = src.indexOf('        var OFFICIAL_JOB_NAMES = [');
const offEnd = src.indexOf('        // 收集所有角色');
const offJs = src.slice(offStart, offEnd);
// 提取官方判定 + officialJobBase + isOfficialJob（含 dbSkills 合并逻辑，dbSkills 未定义时用空对象）
const fn = new Function(offJs.replace(/if \(typeof dbSkills === 'object'[\s\S]*?}\);\s*\);\s*\(\);/g, '') + '; return { isOfficialJob, officialJobBase };');
const api = fn();
chk('「龙战士」人形 → 自创职业（非官方）', api.isOfficialJob('龙战士', false) === false, '实际 ' + api.isOfficialJob('龙战士', false));
chk('「战士」人形 → 官方', api.isOfficialJob('战士', false) === true);
chk('「元素法师·水」→ 官方（流派剥离）', api.isOfficialJob('元素法师·水', false) === true);
chk('「冰霜巨龙」契约兽 → 官方（近似匹配，isBeast=true）', api.isOfficialJob('冰霜巨龙', true) === true);
chk('「冰霜巨龙」人形 → 自创职业（isBeast=false）', api.isOfficialJob('冰霜巨龙', false) === false);
chk('「树语者」人形 → 自创职业', api.isOfficialJob('树语者', false) === false);
chk('「风狼」契约兽 → 官方', api.isOfficialJob('风狼', true) === true);

// ── ② schema 追踪记录全量 ──
const schema = fs.readFileSync('dist/伊瑟利亚/核心/变量结构脚本', 'utf8');
chk('schema 含 追踪记录全量', schema.includes('追踪记录全量: z.boolean()'));
chk('schema 无 三维上限', !schema.includes('三维上限'));

// ── ③ 状态栏开关 ──
chk('状态栏含 btn-track-full', sb.includes('btn-track-full'));
chk('状态栏含 readTrackFullFlag', sb.includes('function readTrackFullFlag'));
chk('状态栏点击切换写 追踪记录全量', sb.includes('追踪记录全量 = !'));
chk('isOfficialJob 含 isBeast 参数', sb.includes('function isOfficialJob(jobName, isBeast)'));

// ── ④ 状态变量输出 EJS ──
const sv = fs.readFileSync('dist/伊瑟利亚/状态变量输出', 'utf8');
chk('EJS 含 全量标志读取', sv.includes('V.$flags?.追踪记录全量'));
chk('EJS 标题动态（全量/最近5条）', sv.includes('·全量') && sv.includes('·最近5条'));
chk('EJS 按开关 slice', sv.includes('_fullFlag ? tkeys : tkeys.slice(0, 5)'));
chk('EJS V 读取 $flags', sv.includes("$flags: getvar('stat_data.$flags'"));
chk('<% %> 配对', (sv.match(/<%/g) || []).length === (sv.match(/%>/g) || []).length);

process.exit(ok ? 0 : 1);
