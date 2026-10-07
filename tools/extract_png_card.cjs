/* 从 PNG 角色卡提取内嵌元数据（chara/ccv3 chunk → base64 → JSON）
 * 用法: node tools/extract_png_card.cjs <png路径> <输出目录>
 * 输出:
 *   <输出目录>/角色卡快照/伊瑟利亚大陆<版本>.json   卡片 data 全量（世界书+正则+脚本）
 *   <输出目录>/核心/伊瑟利亚.json                    由 character_book 重建的世界书（tavern 导入格式）
 *   <输出目录>/正则快照/3.6/<scriptName>.json        每个正则一个文件
 *   <输出目录>/脚本快照/3.6/<名称>.js                每个酒馆助手脚本一个文件
 * 并向 stdout 打印清单摘要。
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pngPath = process.argv[2];
const outDir = process.argv[3];
if (!pngPath || !outDir) { console.error('用法: node tools/extract_png_card.cjs <png> <输出目录>'); process.exit(1); }

const buf = fs.readFileSync(pngPath);
let off = 8, chunks = {};
while (off + 8 <= buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
    const data = buf.slice(off + 8, off + 8 + len);
    const nul = data.indexOf(0);
    const keyword = data.toString('latin1', 0, nul);
    let text;
    if (type === 'tEXt') text = data.slice(nul + 1).toString('latin1');
    else if (type === 'zTXt') text = zlib.inflateSync(data.slice(nul + 2)).toString('latin1');
    else {
      // iTXt: keyword\0压缩flag\0压缩方法\0语言\0翻译\0text
      let p = nul + 1, parts = [];
      for (let i = 0; i < 4 && p < data.length; i++) { const e = data.indexOf(0, p); parts.push(e); p = e + 1; }
      const flag = data[nul + 1];
      const body = data.slice(p);
      text = flag === 1 ? zlib.inflateSync(body).toString('utf8') : body.toString('utf8');
    }
    chunks[keyword] = text;
  }
  off += 12 + len;
  if (type === 'IEND') break;
}

const b64 = chunks.chara || chunks.ccv3;
if (!b64) { console.error('未找到 chara/ccv3 chunk'); process.exit(1); }
const card = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
const d = card.data || card;
const version = d.character_version || card.character_version || 'unknown';
const cardName = (d.name || card.name || 'card').replace(/[\\/:*?"<>|]/g, '_');

console.log('卡名: ' + d.name + ' | 版本: ' + version + ' | spec: ' + (card.spec || '-') );
console.log('数据体积: ' + Buffer.byteLength(JSON.stringify(card)) + ' B');

// ---------- 1) 全量快照 ----------
const snapDir = path.join(outDir, '角色卡快照');
fs.mkdirSync(snapDir, { recursive: true });
const snapFile = path.join(snapDir, cardName + '.json');
fs.writeFileSync(snapFile, JSON.stringify(card));
console.log('快照: ' + snapFile);

// ---------- 2) 世界书重建（tavern 世界信息导入格式） ----------
const book = d.character_book || {};
const entriesArr = Array.isArray(book.entries) ? book.entries : [];
// 以旧世界书文件为格式参照：{ entries: { "<uid>": {...ST字段...} } }
function stEntry(e, idx) {
  const ext = e.extensions || {};
  // 卡内 V3 条目的 extensions 常保存原始 ST 字段；优先取，缺省回退 V3 标准字段
  const pos = ext.position !== undefined ? ext.position : (e.position === 'before_char' ? 0 : 1);
  return {
    uid: ext.uid !== undefined ? ext.uid : idx,
    key: e.keys || e.key || [],
    keysecondary: e.secondary_keys || e.keysecondary || [],
    comment: e.name || e.comment || '',
    content: e.content || '',
    constant: !!e.constant,
    vectorized: !!ext.vectorized,
    selective: ((e.secondary_keys || []).length > 0),
    selectiveLogic: ext.selectiveLogic !== undefined ? ext.selectiveLogic : 0,
    addMemo: !!ext.addMemo,
    order: ext.order !== undefined ? ext.order : (e.insertion_order !== undefined ? e.insertion_order : 100),
    position: pos,
    disable: !(e.enabled !== undefined ? e.enabled : true),
    excludeRecursion: !!ext.excludeRecursion,
    preventRecursion: !!ext.preventRecursion,
    delayUntilRecursion: ext.delayUntilRecursion !== undefined ? ext.delayUntilRecursion : false,
    probability: ext.probability !== undefined ? ext.probability : (e.probability !== undefined ? e.probability : 100),
    useProbability: !!ext.useProbability,
    depth: ext.depth !== undefined ? ext.depth : (e.depth !== undefined ? e.depth : 4),
    group: ext.group || '',
    groupOverride: !!ext.groupOverride,
    groupWeight: ext.groupWeight !== undefined ? ext.groupWeight : 100,
    scanDepth: ext.scanDepth !== undefined ? ext.scanDepth : null,
    caseSensitive: !!ext.caseSensitive,
    matchWholeWords: ext.matchWholeWords !== undefined ? ext.matchWholeWords : null,
    useGroupScoring: ext.useGroupScoring !== undefined ? ext.useGroupScoring : null,
    automationId: ext.automationId || '',
    role: ext.role !== undefined ? ext.role : (e.role !== undefined ? e.role : 0),
    sticky: ext.sticky || 0,
    cooldown: ext.cooldown || 0,
    delay: ext.delay || 0,
    displayIndex: ext.displayIndex !== undefined ? ext.displayIndex : idx
  };
}
const stBook = { entries: {} };
entriesArr.forEach((e, i) => { const se = stEntry(e, i); stBook.entries[String(se.uid)] = se; });
const bookFile = path.join(outDir, '核心', '伊瑟利亚.json');
fs.mkdirSync(path.dirname(bookFile), { recursive: true });
fs.writeFileSync(bookFile, JSON.stringify(stBook));
console.log('世界书重建: ' + bookFile + '（' + entriesArr.length + ' 条）');

// ---------- 3) 正则快照 ----------
const regexes = (d.extensions && d.extensions.regex_scripts) || [];
const reDir = path.join(outDir, '正则快照', version);
fs.mkdirSync(reDir, { recursive: true });
regexes.forEach((r, i) => {
  const nm = String(r.scriptName || ('regex_' + i)).replace(/[\\/:*?"<>|]/g, '_');
  fs.writeFileSync(path.join(reDir, nm + '.json'), JSON.stringify(r, null, 1));
});
console.log('正则快照: ' + regexes.length + ' 个 → ' + reDir);

// ---------- 4) 脚本快照 ----------
const thScripts = (d.extensions && d.extensions.tavern_helper && d.extensions.tavern_helper.scripts) || [];
const scDir = path.join(outDir, '脚本快照', version);
fs.mkdirSync(scDir, { recursive: true });
thScripts.forEach((s, i) => {
  const nm = String(s.name || ('script_' + i)).replace(/[\\/:*?"<>|]/g, '_');
  const content = s.content || '';
  const ext = content.includes('<') && content.includes('html') && content.length > 5000 && !s.content.trim().startsWith('/*') && !s.content.trim().startsWith('//') ? '.html' : '.js';
  fs.writeFileSync(path.join(scDir, nm + ext), content);
});
console.log('脚本快照: ' + thScripts.length + ' 个 → ' + scDir);

// ---------- 5) 清单摘要 ----------
console.log('\n===== 世界书条目摘要（constant/disabled 标记, 前40条按长度） =====');
entriesArr
  .map((e, i) => ({ i, n: e.name || e.comment || '', c: !!e.constant, dis: !(e.enabled !== undefined ? e.enabled : true), len: (e.content || '').length }))
  .sort((a, b) => b.len - a.len)
  .slice(0, 40)
  .forEach(x => console.log('  #' + x.i + ' ' + (x.c ? '[常驻]' : '') + (x.dis ? '[禁用]' : '') + ' ' + x.n + ' (' + x.len + '字)'));
console.log('\n===== 脚本清单 =====');
thScripts.forEach(s => console.log('  ' + s.name + ' (' + (s.content || '').length + '字)'));
console.log('\n===== 正则清单 =====');
regexes.forEach(r => console.log('  ' + r.scriptName + ' (' + (r.replaceString || '').length + '字)'));
