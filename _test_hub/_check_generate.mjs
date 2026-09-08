import fs from 'node:fs';
const home = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
let ok = true;
function chk(label, cond, extra) { console.log((cond ? '✅ ' : '❌ ') + label + (extra ? ' ' + extra : '')); if (!cond) ok = false; }

chk('首页 generateRaw 调用 ≥3处', (home.match(/await generateRaw\(/g) || []).length >= 3, '实际 ' + (home.match(/await generateRaw\(/g) || []).length);
chk('首页无残留 await generate({', !/await generate\(\{/.test(home));
chk('首页 typeof 检查 = generateRaw', home.includes("typeof generateRaw === 'undefined'"));
chk('状态栏 generateRaw 调用 ≥3处', (sb.match(/await generateRaw\(/g) || []).length >= 3, '实际 ' + (sb.match(/await generateRaw\(/g) || []).length);
chk('状态栏无残留 await generate({', !/await generate\(\{/.test(sb));
// 抽查 overrides 清空块存在
chk('首页 overrides 清空块（至少3个）', (home.match(/world_info_before: ''/g) || []).length >= 3, '实际 ' + (home.match(/world_info_before: ''/g) || []).length);
chk('__ISURIA_NON_RP__ 标志保留（跳过世界动态注入）', home.includes('__ISURIA_NON_RP__ = true') && home.includes('__ISURIA_NON_RP__ = false'));
process.exit(ok ? 0 : 1);
