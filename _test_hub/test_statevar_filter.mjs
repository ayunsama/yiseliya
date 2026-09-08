/**
 * 状态变量输出 过滤 验证：
 *   见闻（动态新闻）→ 仅最新5条 + 逾期（是否过期==='是'）屏蔽
 *   任务 → 已完成/已交付 直接清除（不进入上下文）
 *   紧张度脚本：新闻注入 5条+逾期屏蔽 已同步
 */
import fs from 'node:fs';

const stateOut = fs.readFileSync('dist/伊瑟利亚/状态变量输出', 'utf8');
let pass = 0, fail = 0;
function assert(n, c, e = '') { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + ' ' + e); } }

// mini-EJS
function renderEjs(src, V) {
  const segs = [], codes = [];
  const re = /<%([\s\S]*?)%>/g; let last = 0, m;
  while ((m = re.exec(src))) { segs.push(src.slice(last, m.index)); codes.push(m[1]); last = re.lastIndex; }
  segs.push(src.slice(last));
  let js = '';
  for (let i = 0; i < segs.length; i++) {
    js += 'out.push(' + JSON.stringify(segs[i]) + ');\n';
    if (i < codes.length) { const c = codes[i]; if (c[0] === '=') js += 'out.push(String(' + c.slice(1).trim() + '));\n'; else js += c; }
  }
  const fn = new Function('V', 'const out=[]; var print=function(s){ out.push(s); };\n' + js + '\nreturn out.join("");');
  return fn(V);
}
// 提取「动态新闻」段（102 行锚 到 该段 % 结束）与「任务」段
function sliceSeg(from, to) {
  const s = stateOut.indexOf(from); if (s < 0) return '';
  const e = stateOut.indexOf(to, s); return stateOut.slice(s, e < 0 ? stateOut.length : e);
}
const newsSeg = sliceSeg('  动态新闻:', '主角:');
const taskSeg = sliceSeg('  任务:', '同伴:');

console.log('========== 见闻：最新5条 + 逾期屏蔽 ==========');
const newsMap = {
  '新闻1': { 内容: 'A', 日期: '1日', 重要性: '普通' }, '新闻2': { 内容: 'B', 日期: '2日', 重要性: '普通' },
  '新闻3': { 内容: 'C', 日期: '3日', 重要性: '普通' }, '新闻4': { 内容: 'D', 日期: '4日', 重要性: '普通' },
  '新闻5': { 内容: 'E', 日期: '5日', 重要性: '普通' }, '新闻6': { 内容: 'F', 日期: '6日', 重要性: '普通' },
  '过期新闻': { 内容: 'OLD', 日期: '0日', 重要性: '普通', 是否过期: '是' }
};
let out = renderEjs(newsSeg, { 世界: { 世界见闻: { 动态新闻: newsMap } } });
assert('只输出最新5条（新闻2~6）', !out.includes('新闻1') && out.includes('新闻2') && out.includes('新闻6'));
assert('逾期新闻被屏蔽（无「过期新闻」「已过期」字样）', !out.includes('过期新闻') && !out.includes('已过期'));
out = renderEjs(newsSeg, { 世界: { 世界见闻: { 动态新闻: {} } } });
assert('空新闻 → 暂无', out.includes('暂无'));

console.log('\n========== 任务：已完成清除 ==========');
const quests = {
  '主线讨伐': { 状态: '进行中', 等级: '普通', 内容: '清剿哥布林' },
  '已完成委托': { 状态: '已完成' },
  '护送商队': { 状态: '进行中' },
  '已交付任务': { 状态: '已交付' }
};
out = renderEjs(taskSeg, { 主角: { 任务: quests } });
assert('已完成/已交付清除，仅剩2条进行中', out.includes('主线讨伐') && out.includes('护送商队') && !out.includes('已完成委托') && !out.includes('已交付任务'));
out = renderEjs(taskSeg, { 主角: { 任务: {} } });
assert('空任务 → 无', out.includes('无'));

console.log('\n========== 紧张度脚本注入同步 ==========');
const tension = fs.readFileSync('dist/伊瑟利亚/核心/紧张度', 'utf8');
assert('新闻注入 仅最新5条（slice(-5)）+ 逾期屏蔽', tension.includes("n.是否过期 !== '是'") && tension.includes('d.news.length > 5') && tension.includes('d.news.slice(-5)'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
