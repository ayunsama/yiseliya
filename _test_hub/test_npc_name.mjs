/**
 * 名字段规范化守卫 测试（主要NPC/同伴/契约兽/召唤物）
 * 场景：AI 把「亚伦·伍德」写成 亚伦_伍德 / 亚伦・伍德 / 亚伦.伍德（拆段）
 *       → 自动修正路径并与现有键对齐（防同名分叉/幽灵条目）
 *       → insert 到已存在键时展开为逐字段 set（防整条覆盖丢字段）
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

const normStart = src.indexOf('        function normalizeNpcNameCommands');
const normEnd = src.indexOf('        window.normalizeNpcNameCommands = normalizeNpcNameCommands;') + '        window.normalizeNpcNameCommands = normalizeNpcNameCommands;'.length;
const pathStart = src.indexOf('        function pathToSegments(path) {');
const pathEnd = src.indexOf('        function filterExperienceConfirmCommands');
const code = src.slice(normStart, normEnd) + '\n' + src.slice(pathStart, pathEnd);

const stat = {
  主要NPC: { '亚伦·伍德': { 好感度: 40, 心里话: '旧话', 身份: '铁匠' } },
  同伴: { '莉莉丝': { 好感度: 80 } },
  契约兽: { '冰霜巨龙': { 种族: '龙' } },
  召唤物: { '焰灵': { 描述: '火焰元素' } }
};
const api = new Function('Mvu', '_', 'window', code + '; return { normalizeNpcNameCommands };')({
  getMvuData: () => ({ stat_data: JSON.parse(JSON.stringify(stat)) })
}, {
  get: (o, p, d) => String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) === undefined ? d : String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o)
}, {});

function cmd(type, ...args) { return { type, args, reason: '' }; }

console.log('========== ① 下划线变体 → 修正并命中现有键 ==========');
let cs = [cmd('replace', '/主要NPC/亚伦_伍德/好感度', -10)];
api.normalizeNpcNameCommands(cs);
assert('亚伦_伍德 → 亚伦·伍德（对齐现有键）', cs.length === 1 && cs[0].args[0] === '主要NPC.亚伦·伍德.好感度', JSON.stringify(cs));

console.log('\n========== ② 半角・ / 点号变体 → 修正 ==========');
cs = [cmd('replace', '/主要NPC/亚伦・伍德/好感度', -10)];
api.normalizeNpcNameCommands(cs);
assert('亚伦・伍德（JSONPatch 段内）→ 亚伦·伍德', cs[0].args[0] === '主要NPC.亚伦·伍德.好感度', cs[0].args[0]);
cs = [cmd('replace', '主要NPC.亚伦.伍德.好感度', -10)];
api.normalizeNpcNameCommands(cs);
assert('亚伦.伍德（MVU 点号拆段）→ 合并为 亚伦·伍德', cs[0].args[0] === '主要NPC.亚伦·伍德.好感度', cs[0].args[0]);
cs = [cmd('replace', '/主要NPC/亚伦.伍德/好感度', -10)];
api.normalizeNpcNameCommands(cs);
assert('亚伦.伍德（JSONPatch 段内点号）→ 归一为 ·', cs[0].args[0] === '主要NPC.亚伦·伍德.好感度', cs[0].args[0]);
cs = [cmd('replace', '/主要NPC/亚伦/好感度', -10)];
api.normalizeNpcNameCommands(cs);
assert('单段「亚伦」（无此键）→ 原样保留（真新角色）', cs[0].args[0] === '/主要NPC/亚伦/好感度', cs[0].args[0]);

console.log('\n========== ③ insert 到已存在键 → 展开为逐字段 set（不覆盖） ==========');
cs = [cmd('insert', '/主要NPC/亚伦_伍德', { 心里话: '新话', 年龄: 35 })];
api.normalizeNpcNameCommands(cs);
assert('原 insert 被移除', cs.every(c => !(c.type === 'insert')));
assert('展开为 2 条 set（心里话/年龄）且路径命中现有键', cs.length === 2 && cs[0].type === 'set' && cs[0].args[0] === '主要NPC.亚伦·伍德.心里话' && cs[1].args[0] === '主要NPC.亚伦·伍德.年龄', JSON.stringify(cs.map(c => [c.type, c.args])));
assert('值保留（字符串带引号/数字）', cs[0].args[1] === '"新话"' && cs[1].args[1] === '35', JSON.stringify(cs.map(c => c.args[1])));

console.log('\n========== ④ 同伴/契约兽 同步支持 ==========');
cs = [cmd('insert', '/同伴/莉莉丝', { 外貌: '银发', 好感度: 90 })];
api.normalizeNpcNameCommands(cs);
assert('同伴已存在键 insert → 展开 set', cs.length === 2 && cs[0].args[0] === '同伴.莉莉丝.外貌', JSON.stringify(cs.map(c => [c.type, c.args[0]])));
cs = [cmd('replace', '/同伴/安_洁丽卡/好感度', 60)];
api.normalizeNpcNameCommands(cs);
assert('同伴新名字 _→· 归一（不依赖现有键）', cs[0].args[0] === '同伴.安·洁丽卡.好感度', cs[0].args[0]);
cs = [cmd('replace', '/契约兽/冰霜巨龙/攻击', '爪击')];
api.normalizeNpcNameCommands(cs);
assert('契约兽 白名单字段不拆段（原样保留）', cs.length === 1 && cs[0].args[0] === '/契约兽/冰霜巨龙/攻击', cs[0].args[0]);
cs = [cmd('replace', '/召唤物/焰灵/描述', 'x')];
api.normalizeNpcNameCommands(cs);
assert('召唤物 动态字段不拆段（原样保留）', cs.length === 1 && cs[0].args[0] === '/召唤物/焰灵/描述', cs[0].args[0]);

console.log('\n========== ⑤ 无关路径 / move 目标 ==========');
cs = [cmd('replace', '/主角/基础属性/力量', 20), cmd('replace', '/主要NPC/亚伦・伍德/好感度', 0)];
api.normalizeNpcNameCommands(cs);
assert('无关路径不动（原样保留）', cs[0].args[0] === '/主角/基础属性/力量' && cs[1].args[0] === '主要NPC.亚伦·伍德.好感度', JSON.stringify(cs.map(c => c.args[0])));
cs = [cmd('move', '/主要NPC/亚伦_伍德', '/主要NPC/黑蛇')];
api.normalizeNpcNameCommands(cs);
assert('move 源路径规范化（目标未变化则保留原文）', cs[0].args[0] === '主要NPC.亚伦·伍德' && cs[0].args[1] === '/主要NPC/黑蛇', JSON.stringify(cs[0].args));
cs = [cmd('replace', '/主要NPC/亚伦·伍德/好感度', 30)];
api.normalizeNpcNameCommands(cs);
assert('正确写法原样通过（无副作用）', cs.length === 1 && cs[0].args[0] === '/主要NPC/亚伦·伍德/好感度' && cs[0].reason === '');

console.log('\n========== 静态：渲染与规则齐备 ==========');
const rules = fs.readFileSync('dist/伊瑟利亚/核心/变量更新规则', 'utf8');
const schema = fs.readFileSync('dist/伊瑟利亚/核心/变量结构脚本', 'utf8');
assert('规则·命名规范（禁止 _ / 拆段）', rules.includes('【命名规范·核心】') && rules.includes('禁止用下划线 _') && rules.includes('先查后写'));
assert('规则·同名处理（不同分组/同名分区）', rules.includes('【同名处理】') && rules.includes('全名（地区）'));
assert('规则·主要NPC 当前位置', rules.includes('当前位置（所在地）') && rules.includes('随剧情移动用 replace 更新'));
assert('结构·主要NPC/同伴/契约兽 均含 当前位置 字段', schema.includes('当前位置: str(\'\')') && (schema.match(/当前位置: str\(''\)/g) || []).length >= 3, '字段数=' + (schema.match(/当前位置: str\(''\)/g) || []).length);
assert('状态栏 COMMAND_PARSED 挂接守卫', src.includes('eventOn(Mvu.events.COMMAND_PARSED, normalizeNpcNameCommands);'));
assert('状态栏渲染·关系图位置/详情/同伴卡/契约兽卡', src.includes("v.当前位置 ? '<span class=\"dloc\"") && src.includes('📍 当前位置：') && src.includes("escapeAttr(compName) + '.当前位置\"") && src.includes("c.当前位置 ? ' · 📍 ' + safeStr(c.当前位置"));
const stateOut = fs.readFileSync('dist/伊瑟利亚/状态变量输出', 'utf8');
assert('状态变量输出·同伴/契约兽/主要NPC 三段含 当前位置', stateOut.includes("当前位置: ${comp.当前位置 || '-'}") && stateOut.includes("当前位置: ${b.当前位置 || '-'}") && stateOut.includes("line += ` | 当前位置: ${d.当前位置}`"));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
