import fs from 'node:fs';
const t = fs.readFileSync('dist/伊瑟利亚/状态变量输出', 'utf8');
let ok = true;
function chk(label, cond, extra) { console.log((cond ? '✅ ' : '❌ ') + label + (extra ? ' ' + extra : '')); if (!cond) ok = false; }

chk('含 资质 输出行', t.includes('资质: <%= V.主角.基础信息?.资质?.等级'));
chk('含 经验获取效率 输出', t.includes('经验获取效率: <%= V.主角.基础信息?.资质?.经验获取效率'));
chk('含 追踪记录 概要块', t.includes('追踪记录（经济/物品/经验流水'));
chk('追踪记录 读取 tlog', t.includes('const tlog = V.世界.追踪记录'));
chk('追踪记录 输出最近5条', t.includes('_fullFlag ? tkeys : tkeys.slice(0, 5)'));
chk('追踪记录 输出 余额', t.includes('→ 余额 '));
chk('无重复双份 追踪记录', (t.match(/追踪记录（经济\/物品\/经验流水/g) || []).length === 1);
chk('无重复双份 资质', (t.match(/资质: <%= V.主角.基础信息/g) || []).length === 1);
// 占位 EJS 语法粗检：<% 与 %> 配对（<%=、<%% 均以 <% 开头）
const open = (t.match(/<%/g) || []).length, close = (t.match(/%>/g) || []).length;
chk('<% %> 配对（open vs close）', open === close, open + ' vs ' + close);
// 检查 new 块里的脚本代码语法（提取 <%...%> 中纯 JS 部分做粗检——只检我们新增的两块）
const newTalentOk = /<% if \(V\.主角\.基础信息\?\.资质\?\.描述\) \{ %>/.test(t);
chk('资质 EJS 条件块结构完整', newTalentOk);
const newTrackOk = t.includes('const _show = _fullFlag ? tkeys : tkeys.slice(0, 5);');
chk('追踪记录 JS 块存在', newTrackOk);
process.exit(ok ? 0 : 1);
