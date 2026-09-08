/**
 * 纪元触发器（大历史时钟）· EJS 校验 + 渲染行为测试
 * 1. 结构：<% %> 配对 / JS 语法
 * 2. 内容：奥尔德南帝国主线、四档动态剧情、{{getvar}} DLC 占位保留、无 IF/DLC 内嵌内容
 * 3. 渲染：1497年 1月（暴风雨前夜）/3月（王冠坠地）/9月（帝国压境）/内战结束（尘埃落定）/1498（战火之年）
 *          按紧张度等级输出对应档位（暗流/动荡/危机/决战/平静）
 */
import fs from 'node:fs';

const tpl = fs.readFileSync('dist/伊瑟利亚/核心/纪元触发器', 'utf8');
let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

// ---- mini EJS 渲染器 ----
function renderEjs(src, stat_data) {
  const segs = [], codes = [];
  const re = /<%([\s\S]*?)%>/g;
  let last = 0, m;
  while ((m = re.exec(src))) { segs.push(src.slice(last, m.index)); codes.push(m[1]); last = re.lastIndex; }
  segs.push(src.slice(last));
  let js = '';
  for (let i = 0; i < segs.length; i++) {
    js += 'out.push(' + JSON.stringify(segs[i]) + ');\n';
    if (i < codes.length) {
      const c = codes[i];
      if (c[0] === '=') js += 'out.push(String(' + c.slice(1).trim() + '));\n';
      else js += c;
    }
  }
  const fn = new Function('stat_data', '_', 'const out=[];\n' + js + '\nreturn out.join("");');
  const _ = { get: (o, p, d) => String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) === undefined ? d : String(p).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o) };
  return fn(stat_data, _);
}

console.log('========== ① 结构 ==========');
assert('<% 与 %> 配对', (tpl.match(/<%[^=]/g) || []).length + (tpl.match(/<%=/g) || []).length === (tpl.match(/%>/g) || []).length);
assert('含 <%= %> 输出与 <% %> 控制流', tpl.includes('<天 圣光历') || tpl.includes('圣光历<%= _y %>'));
checkJsSyntax();

function checkJsSyntax() {
  try {
    const segs = [], codes = [];
    const re = /<%([\s\S]*?)%>/g; let last = 0, m;
    while ((m = re.exec(tpl))) { segs.push(tpl.slice(last, m.index)); codes.push(m[1]); last = re.lastIndex; }
    const js = codes.filter(c => c[0] !== '=').join('\n');
    new Function('stat_data', '_', js);
    assert('EJS 内 JS 语法 OK', true);
  } catch (e) { assert('EJS 内 JS 语法 OK', false, e.message); }
}

console.log('\n========== ② 内容 ==========');
assert('主线势力：奥尔德南帝国', tpl.includes('奥尔德南帝国'));
assert('国王线：爱德华/王选/格伦茨堡', tpl.includes('爱德华国王') && tpl.includes('王选') && tpl.includes('格伦茨堡'));
assert('魔王：奥姆尼斯四阶（潜伏/夺权/执棋/终局）', tpl.includes('奥姆尼斯') && tpl.includes('潜伏阶') && tpl.includes('夺权阶') && tpl.includes('执棋阶') && tpl.includes('终局阶'));
assert('四档全文已拆分删除（无 <动态剧情> 大块/无整段烈度快照）', !tpl.includes('<动态剧情>') && !tpl.includes('烈度快照·') && (tpl.match(/动态剧情/g) || []).length === 0);
assert('拆分吸收：王选四王储（亨利/理查德/伊丽莎白/爱丽丝）', ['亨利', '理查德', '伊丽莎白', '爱丽丝'].every(s => tpl.includes(s)));
assert('拆分吸收：战争临界细节（圣殿骑士团/时钟塔使者/拂晓余烬叛变）', tpl.includes('圣殿骑士团') && tpl.includes('时钟塔首席执政向三国各派一名使者') && tpl.includes('拂晓余烬小队接到深渊指令'));
assert('拆分吸收：殖民暴行（帝国堡/新梅萨利亚/强劳役）', tpl.includes('帝国堡') && tpl.includes('新梅萨利亚') && tpl.includes('强制劳役'));
assert('拆分吸收：魔王暗子（拂晓余烬×5 潜伏）', tpl.includes('拂晓余烬小队（五人）'));
assert('不再使用"动态剧情·X:"分档标题（防紧张度脚本 getDynText 误读）', !/动态剧情\s*[·:：]?\s*(平静期|暗流期|动荡期|危机期|决战期)\s*[:：]/.test(tpl));
assert('亚人诸国六国齐备', ['多尔海姆', '希尔凡蒂尔', '乌尔加特', '艾瑟尔邦联', '涅瑞廷', '尼弗海姆'].every(s => tpl.includes(s)));
assert('新大陆（乌尔坎/希索拉尼/恩巴拉）', tpl.includes('乌尔坎') && tpl.includes('希索拉尼') && tpl.includes('恩巴拉'));
assert('DLC 占位保留（{{getvar}} 原样，不内嵌 DLC 内容）', tpl.includes('{{getvar::大炎王朝DLC危机期}}') && tpl.includes('{{getvar::大炎王朝DLC决战期}}') && !tpl.includes('大炎龙朝·入侵'));
assert('IF 线（终焉纪元/神圣渊印）实质内容不内嵌', !tpl.includes('压迫指数') && !tpl.includes('深渊教廷') && !tpl.includes('终焉纪元IF线'));
const tensionSrc = fs.readFileSync('dist/伊瑟利亚/核心/紧张度', 'utf8');
assert('紧张度脚本 getDynText 方式3 跳过纪元触发器条目（防 EJS 源码误注入）', tensionSrc.includes("includes('纪元触发器') continue;") || tensionSrc.includes("String(e?.name || '').includes('纪元触发器')"));

console.log('\n========== ③ 渲染行为（年份 × 紧张度） ==========');
function stat(y, mo, tier, news, loc, legends) {
  return { 世界: { 日期: `圣光历${y}年${mo}月`, 当前位置: loc || '', 当前地点: loc || '', 世界见闻: { 动态新闻: news || {} }, 四传奇觉醒: legends || {} }, $flags: { 紧张度: { 当前值: 35, 等级: tier } } };
}
let out;
out = renderEjs(tpl, stat(1497, 1, '平静期'));
assert('1497-01 平静期 → 暴风雨前夜 + 各方态势·低烈度', out.includes('暴风雨前夜') && out.includes('各方态势（烈度调制 · 低烈度') && !out.includes('大时钟·王冠坠地'), out.slice(0, 80));
out = renderEjs(tpl, stat(1497, 1, '暗流期'));
assert('1497-01 暗流期 → 低烈度 + 魔王潜伏阶（暗子/殖民暴行在低烈度行）', out.includes('暴风雨前夜') && out.includes('潜伏阶') && out.includes('拂晓余烬小队（五人）') && out.includes('强制劳役'), out.slice(0, 60));
out = renderEjs(tpl, stat(1497, 3, '动荡期'));
assert('1497-03 动荡期 → 王冠坠地 + 王选/四王储详情', out.includes('大时钟·王冠坠地') && out.includes('王选局势（四王储）') && out.includes('亨利（王室正统派）') && out.includes('理查德'), out.slice(0, 60));
out = renderEjs(tpl, stat(1497, 3, '暗流期'));
assert('1497-03（低紧张度）→ 王冠坠地（大时钟由日期主导，内容随紧张度档）', out.includes('王冠坠地'));
out = renderEjs(tpl, stat(1497, 9, '危机期'));
assert('1497-09 内战未结束 + 危机期 → 帝国压境（含入侵反应，无决战级背刺）', out.includes('大时钟·帝国压境') && out.includes('圣殿骑士团已开拔') && !out.includes('拂晓余烬小队接到深渊指令'), out.slice(0, 60));
out = renderEjs(tpl, stat(1500, 2, '决战期'));
assert('1500 魔王降世 → 决战降临·第一波打击（拂晓余烬背刺/魔潮前锋艾瑟尔/渊蚀翼兽/兽人南下）', out.includes('决战降临·第一波打击') && out.includes('拂晓余烬小队接到深渊指令') && out.includes('魔潮前锋抵达艾瑟尔') && out.includes('渊蚀翼兽群开始攻击浮岛群') && out.includes('乌尔加特为血祭开始南下侵掠帝国'));
out = renderEjs(tpl, stat(1497, 9, '危机期', { '新王登基': { 内容: '理查德登基为王，内战结束' } }));
assert('1497-09 内战结束 → 大时钟·王座尘埃落定（不触发大时钟·帝国压境分支）', out.includes('大时钟·王座尘埃落定') && !out.includes('大时钟·帝国压境'), out.slice(0, 80));
out = renderEjs(tpl, stat(1498, 4, '决战期'));
assert('1498 决战期 → 大时钟·战火之年（魔王=执棋阶，各方=极烈度）', out.includes('大时钟·战火之年') && out.includes('魔王·奥姆尼斯动向（执棋阶）') && out.includes('各方态势（烈度调制 · 极烈度'), out.slice(0, 60));
out = renderEjs(tpl, stat(1500, 1, '决战期'));
assert('1500 → 魔王降世（时间轴终止段）', out.includes('魔王降世') && out.includes('倒计时'), out.slice(0, 60));
out = renderEjs(tpl, stat(1496, 12, '平静期'));
assert('1496 → 前史段', out.includes('前史'), out.slice(0, 60));

console.log('\n========== ④ 事件轴状态机（时间线主导 + 条件事件） ==========');
assert('配置表 _EVENTS 齐备（6 条主线事件）', (tpl.match(/码: 1\d{5}/g) || []).length >= 6);
out = renderEjs(tpl, stat(1497, 1, '暗流期'));
assert('1497-01 → 预告含 3 月驾崩（预计2个月后）', out.includes('未来预告') && out.includes('爱德华国王驾崩') && out.includes('预计 2 个月后'), out.slice(0, 200));
out = renderEjs(tpl, stat(1497, 4, '动荡期'));
assert('1497-04 → 当前进行=驾崩/王选僵持（未归档）', out.includes('当前进行事件') && out.includes('王选僵持，王国濒临内战') && out.includes('爱德华国王驾崩'));
assert('1497-04 → 预告含 9月 帝国入侵（预计5个月后）', out.includes('奥尔德南帝国大举入侵') && out.includes('预计 5 个月后'), out.slice(0, 200));
out = renderEjs(tpl, stat(1497, 10, '危机期'));
assert('1497-10 → 帝国入侵已归档（大事记）+ 乌尔坎全面对抗预告', out.includes('纪元大事记') && out.includes('奥尔德南帝国大举入侵') && out.includes('乌尔坎殖民全面对抗') && out.includes('预计 3 个月后'), out.slice(0, 240));
out = renderEjs(tpl, stat(1497, 9, '危机期', { '新王登基': { 内容: '理查德登基为王，内战结束' } }));
assert('1497-09 内战结束 → 入侵"未发生"归档 + 不入当前事件', out.includes('未发生：王选已定') && !out.includes('※ 帝国兵临西境'));
out = renderEjs(tpl, stat(1501, 3, '决战期'));
assert('1501 → 魔王降世进行（持续999月）', out.includes('当前进行事件') && out.includes('魔王·奥姆尼斯降世') && out.includes('魔潮渡海'));

console.log('\n========== ⑤ 魔王动向栏（时间线推进阶段） ==========');
out = renderEjs(tpl, stat(1497, 1, '暗流期'));
assert('1497-01 → 潜伏阶（商会情报官）', out.includes('魔王·奥姆尼斯动向（潜伏阶）') && out.includes('万路商会'));
out = renderEjs(tpl, stat(1497, 4, '动荡期'));
assert('1497-04 驾崩后 → 夺权阶（枢密院副相）', out.includes('魔王·奥姆尼斯动向（夺权阶）') && out.includes('枢密院副相'));
out = renderEjs(tpl, stat(1497, 11, '危机期'));
assert('1497-11 → 执棋阶（帝国军务大臣）', out.includes('魔王·奥姆尼斯动向（执棋阶）') && out.includes('军务大臣'));
out = renderEjs(tpl, stat(1500, 2, '决战期'));
assert('1500-02 → 终局阶（空间通道）', out.includes('魔王·奥姆尼斯动向（终局阶）') && out.includes('空间通道'));
out = renderEjs(tpl, stat(1497, 1, '暗流期'));
assert('魔王行为随烈度（低烈度=截留密函）', out.includes('截留篡改帝国与王国边境密函'), out.slice(0, 60));

console.log('\n========== ⑥ 各方态势（烈度调制：紧张度=旋钮） ==========');
out = renderEjs(tpl, stat(1497, 1, '暗流期'));
assert('暗流期 → 低烈度基调 + 兽人大汗观望', out.includes('各方态势（烈度调制 · 低烈度') && out.includes('大汗观望：外部战争是别人家的事'));
out = renderEjs(tpl, stat(1497, 4, '动荡期'));
assert('动荡期 → 中烈度 + 城邦政见分裂', out.includes('各方态势（烈度调制 · 中烈度') && out.includes('扩张派vs保守派'));
out = renderEjs(tpl, stat(1497, 11, '危机期'));
assert('危机期 → 高烈度 + 精灵女王最终抉择 / 兽人劫掠', out.includes('各方态势（烈度调制 · 高烈度') && out.includes('同归于尽/开国求援') && out.includes('血月会议通过南下劫掠'));
out = renderEjs(tpl, stat(1500, 2, '决战期'));
assert('决战期 → 极烈度 + 公会最终讨伐令', out.includes('各方态势（烈度调制 · 极烈度') && out.includes('最终讨伐令'));

console.log('\n========== ⑦ 专题细述（按时间窗） ==========');
out = renderEjs(tpl, stat(1497, 8, '动荡期'));
assert('1497-08 → 精灵根冠异常（中层后撤）+ 兽人血月会议 + 城邦双线 + 莫尔加纳缓升', out.includes('渊蚀根冠') && out.includes('中层（4-6层）蚀秽树魔') && out.includes('血月会议：南下劫掠议案表决') && out.includes('城邦·双线泥潭') && out.includes('魔潮浓度缓步上行'), '片段:' + out.includes('血月会议'));
out = renderEjs(tpl, stat(1497, 11, '危机期'));
assert('1497-11 → 精灵暮影成形 + 兽人劫掠开始 + 莫尔加纳魔潮内收', out.includes('暮影成形') && out.includes('南下劫掠开始') && out.includes('魔潮内收确认'));
out = renderEjs(tpl, stat(1498, 2, '决战期'));
assert('1498-02 → 精灵污染倒灌（星辉之树裂纹）', out.includes('污染倒灌浅层') && out.includes('星辉之树主干裂纹'));

console.log('\n========== ⑧ 四传奇觉醒度（随烈度显形） ==========');
out = renderEjs(tpl, stat(1497, 1, '暗流期'));
assert('低烈度 → 四传奇仅名号流传（真身不明）', out.includes('四传奇觉醒度') && out.includes('仅名号与诗篇流传于世') && !out.includes('人选浮出'));
out = renderEjs(tpl, stat(1497, 5, '动荡期'));
assert('中烈度 → 疑似传闻（隐居学者/巨龙目击）', out.includes('疑似传闻：') && out.includes('极北冰原的巨龙目击'));
out = renderEjs(tpl, stat(1497, 11, '危机期'));
assert('高烈度 → 人选浮出（时钟塔导师/龙血仪式期）', out.includes('人选浮出：') && out.includes('龙血仪式期确认——科里维坦·库尔德'));
out = renderEjs(tpl, stat(1500, 2, '决战期'));
assert('极烈度 → 下落已明（汇合焦点）', out.includes('下落已明（四位是否汇合成为焦点）'));
out = renderEjs(tpl, stat(1497, 5, '动荡期', null, null, { '贤者': true }));
assert('已觉醒条目（四传奇觉醒.贤者=true → ★已觉醒）', out.includes('★ 已觉醒——持有者身份已定'));

console.log('\n========== ⑨ 特殊事件·遭遇判定（USER 地点 × 魔王潜伏地） ==========');
out = renderEjs(tpl, stat(1497, 5, '动荡期', null, '坎特伯里·王都'));
assert('夺权阶 + 坎特伯里 → 遭遇判定（枢密院副相/{{roll:1d100}}）', out.includes('特殊事件·遭遇判定') && out.includes('王国枢密院副相') && out.includes('{{roll:1d100}}') && out.includes('1~5：在路上'));
out = renderEjs(tpl, stat(1497, 1, '暗流期', null, '卡兰蒂亚城邦·梅萨利亚港'));
assert('潜伏阶 + 梅萨利亚 → 商会情报官判定', out.includes('万路商会跨国情报调度官') && out.includes('特殊事件·遭遇判定'));
out = renderEjs(tpl, stat(1497, 12, '危机期', null, '艾森格拉德·帝国参谋院'));
assert('执棋阶 + 艾森格拉德 → 军务大臣判定', out.includes('帝国最高议政院军务大臣') && out.includes('特殊事件·遭遇判定'));
out = renderEjs(tpl, stat(1497, 1, '暗流期', null, '黑森林·废弃猎屋'));
assert('非潜伏地（黑森林）→ 无遭遇判定段', !out.includes('特殊事件·遭遇判定'));
out = renderEjs(tpl, stat(1500, 3, '决战期', null, '坎特伯里'));
assert('终局阶 + 主大陆城市 → 撕破伪装的判定', out.includes('撕破伪装的军务大臣') && out.includes('特殊事件·遭遇判定'));

console.log('\n========== ⑩ 事件收尾（动态新闻关键词 → 结束标注） ==========');
assert('事件轴配置含 结束词 字段（王选/入侵等）', tpl.includes("结束词: ['新王'") && tpl.includes("结束词: ['停战', '和谈'"));
out = renderEjs(tpl, stat(1497, 5, '动荡期'));
assert('1497-05 无结束新闻 → 驾崩仍在进行中（无已结束标注）', out.includes('▶ 爱德华国王驾崩') && !out.includes('（已结束：'));
out = renderEjs(tpl, stat(1497, 5, '动荡期', { '新王登基': { 内容: '理查德登基为王，内战结束', 重要性: '高' } }));
assert('新闻含「新王/登基」→ 王选提前收尾：离开当前进行、大事记标（已结束：新王）', !out.includes('▶ 爱德华国王驾崩') && out.includes('（已结束：新王'), out.slice(0, 120));
out = renderEjs(tpl, stat(1497, 10, '危机期', { '和谈达成': { 内容: '帝国与王国签订停战协定，双方撤军', 重要性: '高' } }));
assert('新闻含「停战」→ 帝国入侵收尾（已结束：停战）', !out.includes('▶ 奥尔德南帝国大举入侵') && out.includes('奥尔德南帝国大举入侵（已结束：停战'), out.slice(0, 150));
out = renderEjs(tpl, stat(1497, 2, '暗流期'));
assert('无结束词事件不误触（变革纪开端到期前仍在进行）', out.includes('▶ 圣光历1497年·变革纪开端') && !out.includes('（已结束：'));
out = renderEjs(tpl, stat(1501, 3, '决战期', { '魔王陨落': { 内容: '魔王奥姆尼斯被讨伐成功，空间通道关闭', 重要性: '极高' } }));
assert('新闻含「魔王+讨伐成功」→ 魔王降世收尾（已结束：讨伐成功）', !out.includes('▶ 魔王·奥姆尼斯降世') && out.includes('魔王·奥姆尼斯降世（已结束：讨伐成功'), out.slice(0, 150));
out = renderEjs(tpl, stat(1501, 3, '决战期', { '精灵捷报': { 内容: '暮影被讨伐成功，渊蚀根冠自净，星辉之树复原', 重要性: '高' } }));
assert('防误触：精灵「讨伐成功」不结束魔王事件（魔王仍在进行；精灵暮影成形收尾属合理）', out.includes('▶ 魔王·奥姆尼斯降世') && !out.includes('魔王·奥姆尼斯降世（已结束：'), out.slice(0, 120));
out = renderEjs(tpl, stat(1497, 10, '危机期', { '城邦贸易协议': { 内容: '城邦与精灵签订贸易停战协议', 重要性: '高' } }));
assert('防误触：城邦「停战/协议」不结束帝国入侵（无帝国主体词）', out.includes('▶ 奥尔德南帝国大举入侵') && !out.includes('奥尔德南帝国大举入侵（已结束：'), out.slice(0, 80));
out = renderEjs(tpl, stat(1497, 5, '动荡期', { '蓝光谷和谈': { 内容: '帝国与城邦在蓝光谷达成停火，双方撤军', 重要性: '高' } }));
assert('蓝光谷收尾需主体词：蓝光谷+停火 → 已结束（不在当前进行）', !out.includes('▶ 城邦·蓝光谷武装对峙') && out.includes('蓝光谷武装对峙（新大陆殖民摩擦升级）（已结束：停火'), out.slice(0, 150));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
