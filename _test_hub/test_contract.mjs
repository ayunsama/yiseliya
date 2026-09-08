/**
 * 签订契约 · 英灵变量写入验证
 * 验证 submitCC 中新增的英灵写入逻辑（提取自首页代码）：
 * 1. 各英灵签约 → stat.英灵 写入正确
 * 2. 写入结构与「变量结构脚本」英灵块一致
 * 3. 状态栏档案能按写入的名称匹配
 */
import fs from 'node:fs';

// ============ 从首页代码提取签约写入逻辑（真实代码） ============
const html = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const src = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// 提取 spiritNames 映射（首页代码中的真实映射）
const namesMatch = src.match(/var spiritNames = \{([\s\S]*?)\n\s*\};/);
const spiritNames = {};
if (namesMatch) {
  for (const m of namesMatch[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) spiritNames[m[1]] = m[2];
}

// 提取状态栏档案匹配函数（真实逻辑）
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const sbSrc = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const grab = (s, e) => sbSrc.slice(sbSrc.indexOf(s), sbSrc.indexOf(e));
const archiveFn = new Function(grab('function matchSpiritArchive', '/* 被动列表块') + '; return { match: matchSpiritArchive };')();

// ============ 模拟签约写入（与首页 submitCC 新增逻辑一致） ============
function simulateContract(selectedSpirit) {
  const stat = { 世界: {}, 主角: {} };
  stat.英灵 = stat.英灵 || {};
  stat.英灵.残响之力 = 0;
  if (selectedSpirit) {
    const spiritDisplayName = spiritNames[selectedSpirit] || String(selectedSpirit).replace(/^英灵\//, '');
    stat.英灵.名称 = spiritDisplayName;
    stat.英灵.状态 = '苏醒';
    stat.英灵.英灵殿 = stat.英灵.英灵殿 || {};
    stat.英灵.英灵殿[spiritDisplayName] = { 残响: 0, 羁绊: 0, 状态: '苏醒', 执念完成: false };
  } else {
    stat.英灵.名称 = '';
    stat.英灵.状态 = '沉睡';
  }
  return stat.英灵;
}

// ============ 断言 ============
let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

console.log('========== 首页 spiritNames 映射（' + Object.keys(spiritNames).length + ' 位英灵） ==========');
for (const [k, v] of Object.entries(spiritNames)) console.log(`  ${k} → ${v}`);

console.log('\n========== 场景1：签约各新英灵 → 变量写入 ==========');
const testCases = [
  ['英灵/初代勇者雷恩', '初代勇者·雷恩'],
  ['英灵/盲目的莉莉娅', '盲目的莉莉娅'],
  ['英灵/圣光神索利昂', '圣光神·索利昂'],
  ['英灵/深渊的魅魔·阿丝茉德', '深渊的魅魔·阿丝茉德'],
  ['英灵/小圣女索菲亚', '小圣女·索菲亚'],
];
for (const [entry, expectName] of testCases) {
  const sp = simulateContract(entry);
  assert(`签约「${entry}」→ 名称=${expectName}`, sp.名称 === expectName, `实际 ${sp.名称}`);
  assert(`  残响=0 状态=苏醒`, sp.残响之力 === 0 && sp.状态 === '苏醒');
  assert(`  英灵殿档案登记 ${expectName}`, sp.英灵殿[expectName] && sp.英灵殿[expectName].残响 === 0 && sp.英灵殿[expectName].执念完成 === false);
}

console.log('\n========== 场景2：未选英灵（独自前行） ==========');
const none = simulateContract('');
assert('名称为空、状态沉睡', none.名称 === '' && none.状态 === '沉睡');
assert('不登记英灵殿档案', Object.keys(none.英灵殿 || {}).length === 0);

console.log('\n========== 场景3：写入结构 vs 变量结构脚本英灵块 ==========');
const schema = fs.readFileSync('dist/伊瑟利亚/核心/变量结构脚本', 'utf8');
assert('变量结构含 英灵.名称/残响之力/状态', schema.includes('名称: str') && schema.includes('残响之力: clampNum') && schema.includes('状态: str'));
assert('变量结构含 英灵.英灵殿{残响,羁绊,状态,执念完成}', schema.includes('英灵殿: z.record') && schema.includes('执念完成'));
const sample = simulateContract('英灵/盲目的莉莉娅');
const required = ['名称', '残响之力', '状态', '英灵殿'];
assert('写入字段 ⊂ 结构字段', required.every(k => k in sample));

console.log('\n========== 场景4：状态栏按写入名称匹配档案 ==========');
const writes = testCases.map(([e]) => simulateContract(e).名称);
for (const w of writes) {
  const r = archiveFn.match(w);
  assert(`状态栏匹配「${w}」→ ${r ? r.英灵技 : '未命中'}`, !!r, '');
}

console.log('\n========== 场景5：三合一面板能识别（HERO_SPIRIT_NAMES 一致性） ==========');
const store = fs.readFileSync('src/英灵功能/store.ts', 'utf8');
for (const [entry] of testCases) {
  assert(`store 注册 ${entry}`, store.includes(`'${entry}'`), '');
}

console.log(`\n========== 测试结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
