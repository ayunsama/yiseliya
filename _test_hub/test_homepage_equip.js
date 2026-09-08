/**
 * 校验 首页代码 语法 + 验证 describeEquipEntry 详细装备输出
 */
const fs = require('fs');
const vm = require('vm');

const file = 'dist/变量结构与状态栏代码/首页代码';
const raw = fs.readFileSync(file, 'utf8');
// 去掉开头可能的 ```html 前缀
const content = raw.replace(/^```html\s*/i, '');

// ---- 1) 语法校验：所有 <script>...</script> ----
const scripts = content.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g) || [];
let syntaxOk = true;
if (!scripts.length) { console.log('❌ 未找到 <script> 标签'); process.exit(1); }
scripts.forEach(function (s, i) {
  const body = s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  try { new vm.Script(body); console.log('✅ script#' + (i + 1) + ' 语法 OK (' + body.length + ' chars)'); }
  catch (e) { console.error('❌ script#' + (i + 1) + ' 语法错误:', e.message); syntaxOk = false; }
});
if (!syntaxOk) process.exit(1);

// ---- 2) 提取 describeEquipEntry 函数源码并单测 ----
function extractFunction(src, fnName) {
  const start = src.indexOf('function ' + fnName + '(');
  if (start === -1) return null;
  let i = src.indexOf('{', start);
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, j + 1);
}
const fnSrc = extractFunction(content, 'describeEquipEntry');
if (!fnSrc) { console.error('❌ 未找到 describeEquipEntry 函数'); process.exit(1); }
// 用 Function 构造器在独立作用域执行（函数体内只用 entry/name）
const describeEquipEntry = new Function('return ' + fnSrc)();

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name, extra ? JSON.stringify(extra) : ''); }
}

// 冒险者行囊（杂项：无 stats 明细，有 use）
{
  const out = describeEquipEntry({
    count: 1,
    item: {
      rank: '普通', slot: '无', cat: '一般物品',
      stats: {},
      use: { 使用条件: '-', 具体效果或用途: { 容纳: '含睡袋、干粮(3日份)、水袋、燧石' } },
      desc: '冒险者标准配置'
    }
  }, '冒险者行囊');
  console.log('  →', out);
  check('含名称×数量', out.indexOf('冒险者行囊×1') !== -1);
  check('含品阶+类别（无装备位被过滤）', out.indexOf('普通·一般物品') !== -1 && out.indexOf('·无·') === -1);
  check('含使用效果', out.indexOf('使用[容纳:含睡袋') !== -1);
  check('含描述', out.indexOf('——冒险者标准配置') !== -1);
}

// 精钢长剑（武器：stats + affixes）
{
  const out = describeEquipEntry({
    count: 2,
    item: {
      rank: '精良', slot: '主手', cat: '武器',
      stats: { 攻击力: '1d8+1', 攻击类型: '挥砍', 材质: '精钢', 主属性: '力量' },
      affixes: { 词条效果: { 平衡: '攻击检定+1' }, 特殊机制: {}, 情境效果: {} },
      use: {},
      desc: '制式帝国步兵剑，平衡性好'
    }
  }, '精钢长剑');
  console.log('  →', out);
  check('含品阶·装备位·类别', out.indexOf('精良·主手·武器') !== -1);
  check('含攻击属性', out.indexOf('攻击力:1d8+1') !== -1 && out.indexOf('攻击类型:挥砍') !== -1);
  check('含词条效果', out.indexOf('效果[平衡:攻击检定+1]') !== -1);
  check('含描述', out.indexOf('——制式帝国步兵剑') !== -1);
}

// 旧格式兜底（无 item 字段）
{
  const out = describeEquipEntry({ count: 3 }, '旧物品');
  console.log('  →', out);
  check('旧格式兜底输出名称×数量', out === '旧物品×3');
}

console.log('\n===== 结果: ' + pass + ' 通过, ' + fail + ' 失败 =====');
process.exit(fail ? 1 : 0);
