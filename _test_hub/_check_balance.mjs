import fs from 'node:fs';
// 提取两个文件中 战士/狂战士 段的全部技能定义行，逐条对比
function extractJob(p) {
  const t = fs.readFileSync(p, 'utf8');
  const lines = t.split(/\r?\n/);
  const out = {};
  let inJob = null;
  for (const l of lines) {
    const m = l.match(/^(\s*)"([\u4e00-\u9fa5A-Za-z0-9·\[\]]+)": \[\s*$/);
    if (m && (m[2] === '战士' || m[2] === '狂战士')) { inJob = m[2]; out[inJob] = out[inJob] || []; continue; }
    if (inJob) {
      const sk = l.match(/\{ lvl: (\d+), n: "([^"]+)", c: (\d+), d: "([^"]*)" \}/);
      if (sk) out[inJob].push({ lvl: sk[1], n: sk[2], c: sk[3], d: sk[4] });
      else if (l.includes('],')) inJob = null;
    }
  }
  return out;
}
const sb = extractJob('dist/伊瑟利亚/核心/状态栏');
const home = extractJob('dist/伊瑟利亚/核心/首页代码');
let fail = 0;
for (const job of ['战士', '狂战士']) {
  console.log(job + ': 状态栏 ' + (sb[job] || []).length + ' 条 / 首页 ' + (home[job] || []).length + ' 条');
  const a = sb[job] || [], b = home[job] || [];
  if (a.length !== b.length) { console.log('❌ 条数不一致'); fail++; continue; }
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      console.log('❌ 第' + (i + 1) + '条不一致:\n  SB: ' + JSON.stringify(a[i]) + '\n  HC: ' + JSON.stringify(b[i]));
      fail++;
    }
  }
}
// 抽查三条关键改动在两边都生效
const keys = ['二次攻击', '三次攻击', '四次攻击', '武器至尊', '传说一击', '终焉之剑', '剑圣', '肉身战神'];
const all = {};
for (const job of ['战士', '狂战士']) {
  (sb[job] || []).concat(home[job] || []).forEach(s => { if (keys.includes(s.n)) all[s.n] = all[s.n] || s; });
}
for (const k of keys) {
  if (!all[k]) { console.log('❌ 未找到 ' + k); fail++; }
  else console.log('✅ ' + k + ' → ' + all[k].d.slice(0, 60));
}
console.log(fail ? '存在差异' : '✅ 一致且改动生效');
process.exit(fail ? 1 : 0);
