/**
 * 同伴装备栏 schema 显式声明 → 不被 strip 剥掉（验证 ⑤ 根因修复）
 * 用本地 zod 复刻"同伴块"的最小等价结构，对比 有/无 装备栏字段的 parse 结果。
 */
import { z } from 'zod/v4';

const str = (v = '') => z.string().prefault(v);
const safeNum = (d = 0) => z.preprocess(v => (typeof v === 'number' ? v : Number(v) || d), z.number());
const 物品条 = z.object({ 数量: safeNum(1), 描述: str('') }).prefault({});
// 装备槽位条（复刻：空对象 or 装备物品条）
const 装备槽位条 = z.union([z.strictObject({}).prefault({}), z.object({ 物品名: str(''), 数量: safeNum(1) }).prefault({})]).prefault({});

function makeSchema(withEquip) {
  return z.object({
    同伴: z.record(z.string(), z.object({
      好感度: safeNum(50),
      物品栏: z.record(z.string(), 物品条).prefault({}),
      ...(withEquip ? {
        装备栏: z.object({ 头部: 装备槽位条, 颈部: 装备槽位条, 躯干: 装备槽位条, 腿部: 装备槽位条, 双手: 装备槽位条 }).prefault({}),
      } : {}),
    }).prefault({})).prefault({}),
  }).prefault({});
}

const target = {
  同伴: {
    艾琳: {
      好感度: 70,
      物品栏: { 药水: { 数量: 2 } },
      装备栏: { 双手: { 物品名: '铁剑', 数量: 1 } },   // 若未声明，将被 strip 掉
    },
  },
};

let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); }
}

const noEquip = makeSchema(false).parse(JSON.parse(JSON.stringify(target)));
assert('【修复前】未声明的装备栏被 strip（字段存在为 false）', !('装备栏' in noEquip.同伴['艾琳']), JSON.stringify(Object.keys(noEquip.同伴['艾琳'])));

const withEquip = makeSchema(true).parse(JSON.parse(JSON.stringify(target)));
assert('【修复后】显式声明的装备栏被保留', withEquip.同伴['艾琳'].装备栏 && withEquip.同伴['艾琳'].装备栏.双手.物品名 === '铁剑', JSON.stringify(withEquip.同伴['艾琳'].装备栏));
assert('【修复后】装备栏 5 槽结构保留', ['头部','颈部','躯干','腿部','双手'].every(k => k in withEquip.同伴['艾琳'].装备栏));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
