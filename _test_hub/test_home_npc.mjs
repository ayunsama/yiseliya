/**
 * 首页代码 · 伙伴系统改造测试
 * 1. 预设卡「编辑姓名/种族/职业/背景描述」功能已删除（edit-zone 块/读取逻辑/expanded 全清除）
 * 2. 勾选仅招募：toggleNpcEdit 只切 checked 高亮；提交从 npcDetails 读取
 * 3. AI 生成伙伴：生成框 UI + generateNpcWithAI + normalizeAiNpc（结构对齐 stat_data.同伴）
 * 4. 职业等级与总等级对齐（写 npc.level 而非 1）
 */
import fs from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const src = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('✗ 未找到 script'); process.exit(1); }
const script = m[1];
try { new vm.Script(script); assert('首页代码 script 语法 OK', true); }
catch (e) { console.log('✗ 语法错误: ' + e.message); process.exit(1); }

console.log('===== ① 编辑功能已删除 =====');
assert('HTML 无 npc-edit-zone 编辑块', !/<div class="jrpg-npc-edit-zone">/.test(src));
assert('无 npc-edit-name 残留（DOM/读取逻辑）', !script.includes('npc-edit-name') && !src.includes('npc-edit-name'));
assert('无 expanded 类残留', !script.includes('expanded'));
assert('标题不再提「可编辑」', src.includes('(勾选即可招募入队，点卡片可查看详细数值)'));
assert('toggleNpcEdit 只切 checked 高亮', /function toggleNpcEdit[\s\S]*?classList\.add\('checked'\)/.test(script));
assert('CSS 有勾选高亮', src.includes('.jrpg-npc-card.checked'));

console.log('\n===== ② 提交读取改 npcDetails =====');
assert('提交不再读 editZone（null 保护）', script.includes("if (!detailData || !detailData.name) return;"));
assert('姓名/种族/身份/背景取自 npcDetails', script.includes('var npcName = detailData.name ||') && script.includes('var npcRace = detailData.race ||') && script.includes('var npcClass = detailData.identity ||') && script.includes('var npcDesc = detailData.background ||'));

console.log('\n===== ③ AI 生成伙伴 UI/JS =====');
assert('生成输入框 npc-ai-prompt 存在', src.includes('id="npc-ai-prompt"'));
assert('生成按钮绑定 generateNpcWithAI', src.includes('onclick="generateNpcWithAI()"'));
assert('generateNpcWithAI 函数存在', script.includes('function generateNpcWithAI()'));
assert('normalizeAiNpc 函数存在', script.includes('function normalizeAiNpc(raw)'));
assert('window 导出 generateNpcWithAI', script.includes('window.generateNpcWithAI = generateNpcWithAI;'));
assert('提示词声明对齐 stat_data.同伴 变量结构', script.includes('与 stat_data.同伴 变量结构严格一致'));
assert('提示词要求只输出一个 JSON 对象', script.includes('只输出一个 JSON 对象'));
assert('提示词列出职业白名单', script.includes('className(职业，必须是本世界职业名'));
assert('提示词约束六维区间 8~20', script.includes('整数 8~20，与等阶匹配'));
assert('提示词等阶-等级匹配表', script.includes('普通1-4/超凡5-8/精英9-12/史诗13-16/传说17-20'));
assert('技能描述禁百分比', script.includes('禁止百分比与超模'));
assert('正常化含出生年月日 birth', script.includes('birth: raw.birth || raw.出生年月日 ||'));
assert('正常化宽松读取六维（中英键）', script.includes('function pickStat(stats'));
assert('落格路径注释 customNpcs → stat_data.同伴', script.includes('customNpcs → submitCC 写 stat_data.同伴'));

console.log('\n===== ④ 职业等级与总等级对齐 =====');
assert('职业信息等级 = npc.level（不再固定 1）', /职业信息\[npc\.className\] = \{ 等级: npcJobLv,/.test(script) && script.includes('var npcJobLv = Math.max(1, parseInt(npc.level, 10) || 1);'));

console.log('\n===== ⑤ normalizeAiNpc 行为（切段 vm 单测）=====');
// 只切取 自定义NPC 相关纯函数段（避开顶层 IIFE 依赖的环境），prepend 依赖变量
const segStart2 = script.indexOf('function findCharOutOfString');
const segEnd2 = script.indexOf('function generateNpcWithAI()');
if (segStart2 < 0 || segEnd2 < 0) { console.log('✗ 切段失败'); process.exit(1); }
const seg2 = script.slice(segStart2, segEnd2);
try {
  const fn2 = new Function('var customNpcIdCounter = 0;\n' + seg2 + '\n; return { normalizeAiNpc: normalizeAiNpc, parseAiNpcJson: parseAiNpcJson };');
  const api2 = fn2();
  const normalizeAiNpc = api2.normalizeAiNpc;
  const parseAiNpcJson = api2.parseAiNpcJson;
  assert('normalizeAiNpc 可用', typeof normalizeAiNpc === 'function');
  assert('parseAiNpcJson 可用', typeof parseAiNpcJson === 'function');

// 中文键 + 等阶推断
let n = normalizeAiNpc({ 姓名: '焰舞', 种族: '龙裔', 职业: '战士', 等级: 13, 属性: { 力量: 19, 敏捷: 12 }, 好感度: 70 });
assert('中文键映射 name/race/className', n.name === '焰舞' && n.race === '龙裔' && n.className === '战士');
assert('等级 13 → 等阶 史诗（自动推断）', n.rank === '史诗', '实际 ' + n.rank);
assert('六维缺省补 8，给定保留', n.stats.力量 === 19 && n.stats.敏捷 === 12 && n.stats.体质 === 8 && n.stats.智力 === 8);
assert('好感度 70 保留', n.favor === 70);

// 英文键 + 显式等阶
n = normalizeAiNpc({ name: 'Aria', className: '魔剑士', rank: '传说', level: 18, stats: { str: 22, dex: 18, con: 16, int: 18, wis: 12, cha: 16 }, favor: -5 });
assert('英文键 str/dex 映射', n.stats.力量 === 22 && n.stats.敏捷 === 18);
assert('favor 越界钳制 0~100', n.favor === 0);
assert('显式传说保留', n.rank === '传说');

// skills/items 数组归一化 + 空安全
n = normalizeAiNpc({ name: 'X', className: 'Y', skills: [{ name: '斩', desc: 'SP2' }, { 名称: '跳', 描述: '敏捷检定+2' }], items: 'bad' });
assert('skills 中英键归一且过滤空名', n.skills.length === 2 && n.skills[1].name === '跳' && n.skills[1].desc === '敏捷检定+2');
assert('items 非数组容错为空', Array.isArray(n.items) && n.items.length === 0);

// 空/畸形输入不炸
n = normalizeAiNpc(null);
assert('null 输入不炸（全部默认）', n && n.name === '' && n.stats.力量 === 8 && n.rank === '普通');

console.log('\n===== ⑥ parseAiNpcJson 行为（对象+内层数组修复回归）=====');
// 核心回归：对象内含 skills/items 内层数组（旧 extractJsonArray 会错解析）
const OBJ_WITH_ARRAYS = '{ "name": "焰舞", "race": "龙裔", "className": "战士", "stats": { "力量": 19 }, "skills": [ { "name": "龙焰", "desc": "消耗SP3" } ], "items": [] }';
assert('对象含内层数组 → 正确解析', parseAiNpcJson(OBJ_WITH_ARRAYS).name === '焰舞' && parseAiNpcJson(OBJ_WITH_ARRAYS).skills.length === 1);
// 带围栏
assert('```json 围栏剥离', parseAiNpcJson('```json\n' + OBJ_WITH_ARRAYS + '\n```').name === '焰舞');
// 前后杂文
assert('前后杂文容忍（从首个 { 截取）', parseAiNpcJson('好的，这是生成结果：\n' + OBJ_WITH_ARRAYS + '\n希望你喜欢！').className === '战士');
// 字符串内含 { } [ ] 与转义引号
const TRICKY = '{ "name": "A", "desc": "含花括号 { } 与方括号 [ ] 与转义引号\\"文字", "skills": [] }';
assert('字符串内特殊字符不干扰配对', parseAiNpcJson(TRICKY).desc.indexOf('花括号') !== -1);
// 空/非 JSON → 抛错
let threw = false; try { parseAiNpcJson('完全没有JSON'); } catch (e) { threw = true; }
assert('无 { → 抛错', threw);
threw = false; try { parseAiNpcJson('{ "a": 1'); } catch (e) { threw = true; }
assert('括号未闭合 → 抛错', threw);
} catch (e) {
  console.log('✗ 切段执行失败: ' + e.message);
  process.exit(1);
}

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
