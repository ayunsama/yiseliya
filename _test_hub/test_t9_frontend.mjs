// 验证 领地鉴定前端：HTML 围栏 + script 语法 + $1 占位 + 关键函数
import fs from 'node:fs';
import vm from 'node:vm';
const p = 'dist/伊瑟利亚/领地鉴定前端';
const c = fs.readFileSync(p, 'utf8');
let ok = true;
function chk(label, cond, extra) { console.log((cond ? '✅ ' : '❌ ') + label + (extra ? ' ' + extra : '')); if (!cond) ok = false; }

chk('HTML 围栏开头 ```html', c.startsWith('```html'));
chk('HTML 围栏结尾 ```', c.trimEnd().endsWith('```'));
chk('$1 占位存在', c.includes('<$1') || c.includes('>$1<') || c.includes('id="rawData" style="display:none;">$1<'));
chk('含 <script>', c.includes('<script>') && c.includes('</script>'));
chk('含 parseAdjudication', c.includes('function parseAdjudication'));
chk('含 renderAdjudication', c.includes('function renderAdjudication'));
chk('含 3 主题 (parchment/royal/stone)', c.includes('theme-parchment') && c.includes('theme-royal') && c.includes('theme-stone'));
chk('含主题切换按钮', c.includes('data-theme="parchment"') && c.includes('data-theme="royal"') && c.includes('data-theme="stone"'));
chk('含 DEMO_TEXT', c.includes('DEMO_TEXT'));
chk('占位符用 \\x241（防正则捕获组替换）', c.includes('\\x241'));
chk('含 </html>', c.includes('</html>'));
// 模块化胶囊外观（值/子字段被底色包裹的椭圆模块）
chk('值胶囊 .vchip (border-radius 999px)', /\.vchip \{[\s\S]*?border-radius: 999px/.test(c));
chk('值胶囊底色渐变包裹文本', /\.vchip \{[\s\S]*?background: linear-gradient/.test(c));
chk('值胶囊有描边', /\.vchip \{[\s\S]*?border: 1px solid rgba\(160,120,64,\.42\)/.test(c));
chk('键为文字标签（无胶囊包裹，单行定义）', /^\s*\.key \{ [^}]*color: #7a4a12[^}]*\}/m.test(c) && !/\.key \{[^}]*border-radius/.test(c));
chk('点号路径分段胶囊 .pathseg', c.includes('.pathseg') && c.includes('pathseg-sep'));
chk('数值增量高亮 .up/.down', c.includes('.up {') && c.includes('.down {'));
chk('判定标签椭圆胶囊 .tag', /\.tag \{[\s\S]*?border-radius: 999px/.test(c));
chk('检定线路椭圆胶囊 .check-line', /\.check-line \{[\s\S]*?border-radius: 999px[\s\S]*?fit-content/.test(c));
chk('三主题值胶囊底色 (royal/stone vchip)', /theme-royal \.vchip \{/.test(c) && /theme-stone \.vchip \{/.test(c));

// script 语法
const m = c.match(/<script>([\s\S]*?)<\/script>/);
if (m) {
  try { new vm.Script(m[1]); chk('script 语法 OK (' + m[1].length + ' chars)', true); }
  catch (e) { chk('script 语法 OK', false, e.message); }
} else chk('script 语法 OK', false, '未找到 script');

// 提取文本做解析器单测（stub document/window 编译运行 parseAdjudication）
try {
  const fn = new Function(m[1].replace(/document\.addEventListener[\s\S]*$/, '') + '; return { parseAdjudication, renderAdjudication, esc };');
  const api = fn();
  const demo = '<鉴定结算>\n  {内政判定}\n  | 领地: 蔷薇镇 | 规模等级: 城镇 | 事项: 兴修水利 | 难度DC: 14 |\n  | 掷骰: 领主治政 d20(16) + 4 = 20 vs DC 14 | 判定结果: 成功 |\n  | 效果: 水利推进 | 面板更新: 国库 -200 |\n  叙事指导: (领主亲临工地。)\n  {外交判定}\n  | 领地: 蔷薇镇 | 对象: 灰鸥港商会 | 事项: 贸易协定 | 判定结果: 失败 |\n';
  const blocks = api.parseAdjudication(demo);
  chk('解析出 2 个区块', blocks.length === 2, '实际 ' + blocks.length);
  chk('区块1 = 内政判定', blocks[0]?.name === '内政判定');
  chk('区块1 含等级渲染输入 (规模等级)', JSON.stringify(blocks[0].rows).includes('规模等级') && JSON.stringify(blocks[0].rows).includes('城镇'));
  chk('区块1 叙事指导提取', blocks[0].narrative === '领主亲临工地。', JSON.stringify(blocks[0].narrative));
  chk('区块2 判定结果=失败', blocks[1].rows.some(r => r[0] === '判定结果' && r[1] === '失败'));
  const html = api.renderAdjudication(demo);
  chk('渲染含 标题「领地鉴定」', html.includes('领地鉴定'));
  chk('渲染含 成功标签', html.includes('tag-succ'));
  chk('渲染含 失败标签', html.includes('tag-fail'));
  chk('渲染含 城镇等级徽章', html.includes('g-城镇'));
  chk('渲染含 检定线路 (d20)', html.includes('check-line') && html.includes('d20'));
} catch (e) { chk('解析器单测', false, e.message); }

process.exit(ok ? 0 : 1);
