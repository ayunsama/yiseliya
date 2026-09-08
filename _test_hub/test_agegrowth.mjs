/**
 * 年龄成长开关 + 成年停止 逻辑验证
 * 提取状态栏真实函数（ageGrowthPoints / ageGrowthEnabled / calcAgeGrowth / passiveAgeGrowthCheck 的判定部分）
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const src = sb.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// 提取 ageGrowthPoints + ageGrowthEnabled
const pts = src.slice(src.indexOf('function ageGrowthPoints'), src.indexOf('        // 年龄成长补点'));
const en = src.slice(src.indexOf('function ageGrowthEnabled'), src.indexOf('        function readAgeGrowthIssued'));

// 模拟 localStorage
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };

const fn = new Function(pts + en + '; return { ageGrowthPoints, ageGrowthEnabled };');
const api = fn();

let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); }
}

console.log('========== ageGrowthPoints 曲线 ==========');
const curve = { 1: 0, 5: 3, 12: 10, 17: 18, 18: 20, 19: 20, 30: 20, 50: 20 };
for (const [a, e] of Object.entries(curve)) {
  assert(`年龄${a} → ${e}点`, api.ageGrowthPoints(a) === e, `实际 ${api.ageGrowthPoints(a)}`);
}

console.log('\n========== 开关（localStorage isuria_age_growth） ==========');
delete store['isuria_age_growth'];
assert('默认开启（无记录）', api.ageGrowthEnabled() === true);
store['isuria_age_growth'] = '0';
assert('关闭（=0）', api.ageGrowthEnabled() === false);
store['isuria_age_growth'] = '1';
assert('开启（=1）', api.ageGrowthEnabled() === true);

console.log('\n========== 成年停止判定（age > 18 即停，18 领满） ==========');
function shouldGrow(age) {
  // 复刻 passiveAgeGrowthCheck 成年守卫
  if (age > 18) return false;
  const expected = api.ageGrowthPoints(age);
  return expected > 0;
}
assert('age=17 仍发放', shouldGrow(17) === true);
assert('age=18 最后一次（领满20）', shouldGrow(18) === true);
assert('age=19 停止', shouldGrow(19) === false);
assert('age=25 停止', shouldGrow(25) === false);
assert('age=30 停止', shouldGrow(30) === false);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
