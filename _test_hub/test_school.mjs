/**
 * ⑦ 元素法师·点号流派 识别 + 归一化兼容 行为验证
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const ssrc = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const jef = ssrc.slice(ssrc.indexOf('        function jobElemFilter'), ssrc.indexOf('        function jobSkillAllowed'));
const sjb = ssrc.slice(ssrc.indexOf('        function officialJobBase'), ssrc.indexOf('        // 是否官方职业'));
const up = fs.readFileSync('dist/伊瑟利亚/核心/升级代码', 'utf8');
const nj = up.slice(up.indexOf('  function normalizeJobName'), up.indexOf('  // ---- 成长表查表'));
const hj = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const njg = hj.slice(hj.indexOf('        function normalizeJobNameForGrowth'), hj.indexOf('        async function writeClassToVars'));

const fn = new Function(jef + sjb + nj + njg + '; return { jobElemFilter, officialJobBase, normalizeJobName, normalizeJobNameForGrowth };');
const api = fn();

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

console.log('========== jobElemFilter（状态栏技能树流派识别） ==========');
let r = api.jobElemFilter('元素法师·水');
assert('元素法师·水 → base=元素法师, elements=[水]', r.base === '元素法师' && r.elements.join(',') === '水', JSON.stringify(r));
r = api.jobElemFilter('元素法师·水·火');
assert('元素法师·水·火 → elements=[水,火]', r.elements.join(',') === '水,火', JSON.stringify(r));
r = api.jobElemFilter('元素法师');
assert('元素法师（无后缀）→ elements=null（可学全部）', r.elements === null, JSON.stringify(r));
r = api.jobElemFilter('元素法师（水、火）');
assert('旧括号格式仍兼容 → elements=[水,火]', r.elements.join(',') === '水,火', JSON.stringify(r));
r = api.jobElemFilter('狂战士·狂暴');
assert('非元素家族带·职业名不误解析 → elements=null', r.elements === null && r.base === '狂战士·狂暴', JSON.stringify(r));

console.log('\n========== 归一化（职业成长/官方判定） ==========');
assert('normalizeJobName(元素法师·水) → 元素法师', api.normalizeJobName('元素法师·水') === '元素法师', api.normalizeJobName('元素法师·水'));
assert('normalizeJobNameForGrowth(元素法师·水·火) → 元素法师', api.normalizeJobNameForGrowth('元素法师·水·火') === '元素法师', api.normalizeJobNameForGrowth('元素法师·水·火'));
assert('officialJobBase(元素法师·水) → 元素法师', api.officialJobBase('元素法师·水') === '元素法师', api.officialJobBase('元素法师·水'));
assert('normalizeJobName(战士(乌尔坎)) 半角括号不变体由变体兜底（回归不变）', api.normalizeJobName('战士(乌尔坎)') === '战士(乌尔坎)', api.normalizeJobName('战士(乌尔坎)'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
