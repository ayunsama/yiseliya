import fs from 'node:fs';
import vm from 'node:vm';
let ok = true;
function chk(label, cond, extra) { console.log((cond ? '✅ ' : '❌ ') + label + (extra ? ' ' + extra : '')); if (!cond) ok = false; }

const up = fs.readFileSync('dist/伊瑟利亚/核心/升级代码', 'utf8');
chk('公式为三次加速多项式', up.includes('return Math.floor(200 + 60 * n + 18 * n * n + 6 * n * n * n);'));
chk('无 1.35 残留（升级代码）', !up.includes('Math.pow(1.35'));
chk('无 1.35 倍递增 文案残留', !up.includes('1.35 倍递增'));

// 公式行为验证：Lv1→2=200, Lv10→11=6572, Lv20→21=48992, Lv25→26=94952
function cubic(lv) { const n = lv - 1; return Math.floor(200 + 60 * n + 18 * n * n + 6 * n * n * n); }
chk('Lv1→2 = 200', cubic(1) === 200, '实际 ' + cubic(1));
chk('Lv10→11 = 6572', cubic(10) === 6572, '实际 ' + cubic(10));
chk('Lv20→21 = 48992', cubic(20) === 48992, '实际 ' + cubic(20));
chk('Lv25→26 = 94952', cubic(25) === 94952, '实际 ' + cubic(25));

const rule = fs.readFileSync('dist/伊瑟利亚/经验获取规则', 'utf8');
chk('规则表含三次加速说明', rule.includes('三次加速'));
chk('规则表 Lv10→11: 6572', rule.includes('Lv10→11: 6572'));
chk('规则表 Lv24→25: 84104', rule.includes('Lv24→25: 84104'));
chk('规则表无 1.35 字眼', !rule.includes('1.35'));

// 升级代码语法
try { new vm.Script(up); chk('升级代码语法 OK', true); }
catch (e) { chk('升级代码语法 OK', false, e.message); }

process.exit(ok ? 0 : 1);
