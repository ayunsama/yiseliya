// 伊瑟利亚世界书 · 史诗级NPC奥义测试
// 验证 [奥义获取] 设定落地：29个史诗级NPC战斗数据含独立「奥义」区块，非史诗角色不误插
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'dist/伊瑟利亚/核心/伊瑟利亚.json');

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); }
}

console.log('===== 伊瑟利亚世界书 · 史诗级NPC奥义测试 =====');

const raw = fs.readFileSync(FILE, 'utf8');
let json;
try { json = JSON.parse(raw); } catch (e) { console.log('✗ JSON 解析失败: ' + e.message); process.exit(1); }

// 1. JSON 合法 + 条目数
assert('JSON 合法可解析', true);
const n = Object.keys(json.entries).length;
assert('条目数 = 319', n === 319, '实际 ' + n);

// 2. 奥义 EJS 条目仍存在
const ougiEjs = Object.values(json.entries).find(e => (e.comment || '').includes('[奥义获取]'));
assert('[奥义获取] EJS 条目存在', !!ougiEjs);
assert('[奥义获取] 条目启用(constant)', ougiEjs && ougiEjs.constant === true && ougiEjs.disable === false);

// 3. 史诗NPC清单（uid → 角色数）
const EXPECT = {
  25: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1,
  144: 2, 165: 1, 167: 1, 169: 1, 182: 5,
  234: 1, 235: 1, 236: 1, 118139: 1, 416393: 1, 452363: 1, 463136: 1,
  535890: 1, 631486: 1, 755787: 1, 863368: 1, 930922: 1
};
let total = 0;
for (const [uid, cnt] of Object.entries(EXPECT)) {
  const c = json.entries[uid].content;
  const got = (c.match(/^(\s*)奥义:\s*$/gm) || []).length;
  total += got;
  assert(`uid=${uid} 奥义区块 ×${cnt}`, got === cnt, '实际 ' + got);
  // 格式：每个奥义条目以「奥义·」开头且含消耗与限制
  const lines = c.split('\n').filter(l => /^\s+- 奥义·/.test(l));
  assert(`uid=${uid} 奥义条目格式（奥义·前缀）`, lines.length === cnt, '实际 ' + lines.length);
  const bad = lines.filter(l => !/消耗/.test(l) || !/(每场战斗限|每日限|每周限|每月限|一生仅)/.test(l));
  assert(`uid=${uid} 奥义含消耗+使用限制`, bad.length === 0, bad.length + ' 条缺项');
}
assert('奥义总数 = 29', total === 29, '实际 ' + total);

// 4. 传说阶段（命格后）不误插：四传奇候选
for (const [uid, marker] of [[25, 'const _艾莉卡命格后'], [535890, 'const _莉莉丝命格后'], [631486, 'const _伊利亚命格后'], [755787, 'const _科里维坦命格后']]) {
  const c = json.entries[uid].content;
  const i = c.indexOf(marker);
  assert(`${marker.replace('const _', '').replace('命格后', '')} 传说阶段无奥义`, i >= 0 && !c.slice(i).includes('奥义:'));
}

// 5. 大炎王朝精英皇子（赤瑜/赤璟/赤珩）不误插
{
  const c = json.entries['144'].content;
  for (const name of ['太子·赤瑜', '二皇子·赤璟', '三皇子·赤珩']) {
    const i = c.indexOf(name);
    const iEnd = c.indexOf('</', i);
    const seg = c.slice(i, iEnd);
    assert(`${name}（精英）无奥义`, !/^\s*奥义:\s*$/m.test(seg));
  }
}

// 6. 魔王/迷宫条目不含奥义（uid=24 魔王奥姆尼斯·神话级）
{
  const c = json.entries['24'].content;
  assert('魔王奥姆尼斯（神话）无奥义区块', !/^(\s*)奥义:\s*$/m.test(c));
}

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
