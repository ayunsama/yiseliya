import _ from 'lodash';
import { z } from 'zod';

// ---- 模拟酒馆全局：prefault ≈ default ----
z.ZodType.prototype.prefault = function (def) { return this.default(def); };

const isPlainObject = v => !!v && 'object' === typeof v && !Array.isArray(v);

// ---- 复刻「变量结构脚本」中的宽松逻辑 ----
const 宽松效果条 = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return val;
    if ('string' === typeof val) return val.trim() ? { 效果: val.trim() } : {};
    if (Array.isArray(val)) {
      const out = {};
      val.forEach((item, idx) => {
        if ('string' === typeof item && item.trim()) out[`条目${idx + 1}`] = item.trim();
        else if (isPlainObject(item)) Object.assign(out, item);
      });
      return out;
    }
    if (isPlainObject(val)) return _.mapValues(val, v => 'string' === typeof v ? v : String(v));
    return val;
  },
  z.record(z.string(), z.string())
).default({});

const 词条与机制 = z.preprocess(
  (val) => {
    if (!isPlainObject(val)) return val;
    const out = { ...val };
    if (out.词条 !== undefined) {
      if (out.词条效果 === undefined) out.词条效果 = out.词条;
      delete out.词条;
    }
    return out;
  },
  z.object({
    词条效果: 宽松效果条,
    特殊机制: 宽松效果条,
    情境效果: 宽松效果条
  }).default({})
).default({});

const cases = [
  {
    name: '原始失败输入（词条数组 + 特殊机制字符串）',
    input: {
      词条: ['水系术式检定+2', '水系魔法伤害额外+1d6'],
      特殊机制: '潮汐稳定：施展高压水系术式时，免疫魔力过载导致的法杖耐久度损耗。'
    }
  },
  {
    name: '标准写法（词条效果 record）',
    input: {
      词条效果: { 水系术式检定: '+2', 水系魔法伤害: '额外+1d6' },
      特殊机制: { 潮汐稳定: '施展高压水系术式时，免疫魔力过载导致的法杖耐久度损耗。' }
    }
  },
  {
    name: '词条为单条字符串',
    input: { 词条: '锋利' }
  },
  {
    name: '空对象',
    input: {}
  },
  {
    name: '词条为 record 对象（不写词条效果）',
    input: { 词条: { 水系术式检定: '+2' } }
  }
];

let allPass = true;
for (const c of cases) {
  try {
    const r = 词条与机制.parse(c.input);
    console.log(`✅ ${c.name}\n   → ${JSON.stringify(r)}`);
  } catch (e) {
    allPass = false;
    console.log(`❌ ${c.name}\n   → ${e.message}`);
  }
}
console.log(allPass ? '\n全部通过' : '\n存在失败');
