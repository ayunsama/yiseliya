/**
 * 战斗轮「力量清单」+「特别机制」装备机制 · 全链路校验
 * A 规则层：战斗协议 12条（强制引用技能/装备效果）——src + dist bundle
 * B 数据层：特别机制字段（结构）+ 输出（状态变量输出 词条/特别机制）+ 首页写入 + 状态栏显示
 * C 注入层：战斗快照文本转为"能力清单"（技能/武器/效果明细，读 stat_data）
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

const combatSrc = fs.readFileSync('src/战斗轮/combat.ts', 'utf8');
const appSrc = fs.readFileSync('src/战斗轮/App.vue', 'utf8');
const storeSrc = fs.readFileSync('src/战斗轮/store.ts', 'utf8');
const bundle = fs.readFileSync('dist/战斗轮/index.js', 'utf8');
const schema = fs.readFileSync('dist/伊瑟利亚/核心/变量结构脚本', 'utf8');
const stateOut = fs.readFileSync('dist/伊瑟利亚/状态变量输出', 'utf8');
const home = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');

console.log('========== A 规则层（强制引用力量清单） ==========');
assert('src·combat.ts 含【力量清单】12条', combatSrc.includes('12. 力量清单（强制）') && combatSrc.includes('严禁在技能与装备齐备的情况下只因省事而全程平砍'));
assert('dist·bundle 含【力量清单】条款', bundle.includes('12. 力量清单（强制）') && bundle.includes('严禁在技能与装备齐备的情况下只因省事而全程平砍'));

console.log('\n========== C 注入层（快照→能力清单明细） ==========');
assert('src·App.vue 快照文本输出技能明细（类型/MP/效果）', appSrc.includes('技能详情') && appSrc.includes('能力清单') || appSrc.includes('技能详情') && appSrc.includes('skillsTxt'));
assert('src·store.ts 快照复制 技能详情/装备详情（含特别机制）', storeSrc.includes('技能详情') && storeSrc.includes('装备详情') && storeSrc.includes('特别机制'));
assert('dist·bundle 注入"能力清单"（读 stat_data 兜底明细）', bundle.includes('能力清单:${loadout}') && bundle.includes("all2.stat_data") && bundle.includes('特别机制'));

console.log('\n========== B 数据层（特别机制全链路） ==========');
assert('结构·物品条定义含 特别机制 字段', schema.includes('特别机制: str(\'\')') && schema.includes('装备独有机制/特殊效果'));
assert('状态输出·装备行含 词条/特别机制（主角+同伴均有）', stateOut.includes('词条:${tc}') && stateOut.includes('特别机制:${eq.特别机制}') && stateOut.includes('特别机制:${ce.特别机制}'));
assert('状态输出·同伴装备行含 词条/特别机制', (stateOut.match(/特别机制:\${eq\..*}/g) || []).length >= 2 || (stateOut.match(/特别机制/g) || []).length >= 2);
assert('首页·装备写入 特别机制（从 affixes.特殊机制 提取为文本）', home.includes('特别机制: (function() {') && home.includes('affixes.特殊机制'));
assert('状态栏·装备卡显示 词条+特别机制', sb.includes('renderEquipEffects') && sb.includes('词条：') && sb.includes('特：'));
const rules = fs.readFileSync('dist/伊瑟利亚/核心/变量更新规则', 'utf8');
assert('规则·物品栏/装备栏 type 含 特别机制: string', rules.includes('附加词条: object, 特别机制: string') && rules.includes('附加词条, 特别机制, 数量'));
assert('规则·【特别机制写法】条目（战斗判定必须按它结算+力量清单引用）', rules.includes('【特别机制写法】') && rules.includes('战斗判定时必须按它结算') && rules.includes('留空字符串 ""'));
assert('规则·示例含 特别机制（怒血战斧 每击杀+1怒气）', rules.includes('特别机制": "每击杀+1怒气'));
const settle = fs.readFileSync('dist/伊瑟利亚/战斗轮结算', 'utf8');
assert('战斗结算规则·【力量清单·战斗必读】+【特别机制结算】条款（各1份）', settle.includes('【力量清单·战斗必读】') && settle.includes('【特别机制结算】（装备独有机制·战斗内必须生效）') && settle.split('【力量清单·战斗必读】').length === 2);
assert('战斗结算规则·特别机制条款含 面板效果/附加词条 全量引用与咏唱对齐', settle.includes('「面板效果」（属性面板') && settle.includes('咏唱者的法术判定引用'));
assert('战斗结算前端·咏唱特效 CSS（cast-glow/金色脉动）', settle.includes('.cast-glow {') && settle.includes('@keyframes castPulse') && settle.split('.cast-glow {').length === 2);
assert('战斗结算前端·渲染预处理包咏唱高亮（且仅1处）', (settle.split('咏唱(?:中|完成待释放|前摇|状态)').length - 1) === 1);
const scriptSrc = settle.match(/<script>([\s\S]*?)<\/script>/)[1];
try { new Function(scriptSrc); assert('战斗结算前端·script 语法 OK', true); } catch (e) { assert('战斗结算前端·script 语法 OK', false, e.message); }

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
