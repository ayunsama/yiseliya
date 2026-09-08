// 领地鉴定前端 · 端到端：完整 AI 输出（含全部7种判定类型 + 叙事指导）→ 渲染
import fs from 'node:fs';
import vm from 'node:vm';

const c = fs.readFileSync('dist/伊瑟利亚/领地鉴定前端', 'utf8');
const m = c.match(/<script>([\s\S]*?)<\/script>/);
const src = m[1];

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

const fn = new Function(src.replace(/document\.addEventListener[\s\S]*$/, '') + '; return { parseAdjudication, renderAdjudication };');
const api = fn();

const FULL = '<鉴定结算>\n' +
  '  {内政判定}\n  | 领地: 蔷薇镇 | 规模等级: 国家 | 变种: 农耕村 | 事项: 税收改革 | 难度DC: 15 | 掷骰: 领主治政 d20(20) + 5 = 25 vs DC 15 | 判定结果: 大成功 | 效果: 财政大幅改善 | 面板更新: 经济.国库 +8000 → 满意度 +10 |\n' +
  '  叙事指导: (大臣稽首，账房连夜核算，国库充盈。)\n' +
  '  {外交判定}\n  | 领地: 蔷薇镇 | 对象: 灰鸥港商会 | 事项: 联姻 | 难度DC: 12 | 掷骰: 领地使节 d20(06) + 3 = 09 vs DC 12 | 判定结果: 失败 | 效果: 联姻搁置 |\n' +
  '  {军事判定}\n  | 领地: 蔷薇镇 | 事项: 征兵动员 | 难度DC: 14 | 掷骰: 主帅 d20(11) + 4 = 15 vs DC 14 | 判定结果: 成功 | 效果: 征兵达标 |\n' +
  '  {政治判定}\n  | 领地: 蔷薇镇 | 事项: 议会提案 | 难度DC: 12 | 判定结果: 成功 | 效果: 提案通过 |\n' +
  '  {经济判定}\n  | 领地: 蔷薇镇 | 事项: 年度结算 | 难度DC: 10 | 判定结果: 成功 | 效果: 盈余 |\n' +
  '  {科技判定}\n  | 领地: 蔷薇镇 | 事项: 研发突破 | 难度DC: 15 | 判定结果: 失败 | 效果: 项目停滞 |\n' +
  '  {建筑判定}\n  | 领地: 蔷薇镇 | 事项: 新建钟楼 | 难度DC: 12 | 判定结果: 成功 | 效果: 建成 |\n' +
  '</鉴定结算>\n';

const blocks = api.parseAdjudication(FULL);
assert('解析 7 个区块', blocks.length === 7, '实际 ' + blocks.length);
const names = blocks.map(b => b.name);
assert('全部判定类型识别', ['内政判定','外交判定','军事判定','政治判定','经济判定','科技判定','建筑判定'].every(n => names.includes(n)), JSON.stringify(names));

const html = api.renderAdjudication(FULL);
assert('标题渲染', html.includes('领地鉴定'));
assert('大成功标签 (tag-crit)', html.includes('tag-crit'));
assert('成功标签 (tag-succ)', html.includes('tag-succ'));
assert('失败标签 (tag-fail)', html.includes('tag-fail'));
assert('国家等级徽章 (g-国家)', html.includes('g-国家'));
assert('检定线路 d20 渲染', (html.match(/check-line/g) || []).length >= 2, '实际 ' + (html.match(/check-line/g) || []).length);
assert('7 个区块标题渲染', (html.match(/phase-title/g) || []).length === 7, '实际 ' + (html.match(/phase-title/g) || []).length);
assert('叙事指导渲染', html.includes('narrative') && html.includes('账房连夜核算'));
assert('卷尾徽章 领', html.includes('foot-seal') && html.includes('领'));

// ===== 智能值渲染：点号路径分段 + 数值增量高亮 =====
const SMART = '<鉴定结算>\n  {内政判定}\n  | 领地: 落日哨所 | 面板更新: 世界设定.落日哨所.详细说明 更新；格里高利好感度 +5；经济.国库 -200 |\n  | 效果: 治理推进 | 判定结果: 成功 |\n  {外交判定}\n  | 领地: 落日哨所 | 对象: 灰鸥港 | 判定结果: 失败 |\n</鉴定结算>\n';
const html2 = api.renderAdjudication(SMART);
assert('点号路径拆段 (世界设定/落日哨所/详细说明 三段 pathseg)', (html2.match(/pathseg/g) || []).length >= 3, 'pathseg 数 ' + (html2.match(/pathseg/g) || []).length);
assert('路径段间 · 分隔 (pathseg-sep)', (html2.match(/pathseg-sep/g) || []).length >= 2, '实际 ' + (html2.match(/pathseg-sep/g) || []).length);
assert('数值增量高亮 +5 (up)', html2.includes('class="up"') && /up">\+5</.test(html2));
assert('数值增量高亮 -200 (down)', html2.includes('class="down"') && /down">-200</.test(html2));
assert('值包裹 vchip 胶囊', html2.includes('vchip'));
assert('效果长文本用 vtxt 软框', html2.includes('vtxt'));
assert('键为文字标签（渲染无 key: 冒号样式，键色点存在）', html2.includes('key '));

// 空/异常输入容错
assert('空文本 → 错误提示', api.renderAdjudication('').includes('err-msg') || api.renderAdjudication('').includes('※'));
assert('无鉴定标签文本 → 错误提示', api.renderAdjudication('普通叙事').includes('※'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
