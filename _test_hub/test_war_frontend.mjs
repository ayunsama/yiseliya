/**
 * 战争前端 · 正文污染修复测试
 * 根因：协议用 <战争结算> 包裹，前端只匹配 <国战结算> → 误走兜底分支把整段楼层正文吞进战报。
 * 验证：
 *  1. 协议标准 <战争结算> 块 → 只渲染块内容，前后正文不污染
 *  2. 旧格式 <国战结算> 块 → 正常
 *  3. 无包裹（城战风格，含 {国战总览 行）→ 截取特征区 + 剔除散文行，正文不污染
 *  4. 完全无战争特征 → 显示未检测占位，不渲染全文
 */
import fs from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); } }

const src = fs.readFileSync('dist/伊瑟利亚/战争前端', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('✗ 未找到 script'); process.exit(1); }
try { new vm.Script(m[1]); assert('script 语法 OK', true); }
catch (e) { console.log('✗ 语法错误: ' + e.message); process.exit(1); }

// DOM mock
const els = {};
function getEl(id) { if (!els[id]) { els[id] = { innerHTML: '', innerText: '', textContent: '', value: '', style: {} }; } return els[id]; }
const ctx = {
  console,
  document: {
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: () => []
  },
  window: {},
  $: function () {},   // 不自动执行 init
  getCurrentMessageId: () => 1,
  getChatMessages: () => []
};
vm.createContext(ctx);
vm.runInContext(m[1], ctx, { timeout: 5000 });
const parseAndRender = ctx.parseAndRender;
assert('parseAndRender 可用', typeof parseAndRender === 'function');
assert('源码含 战争结算 支持', m[1].includes('<(战争结算|国战结算)>'));
assert('源码兜底不再整段渲染（含散文行过滤）', m[1].includes('纯散文叙事行') && m[1].includes('未检测到战争战报'));

// ===== 场景1：协议标准 <战争结算> 包裹 + 前后正文 =====
const WITH_WRAP = '月色下的边境一片死寂，商队在火堆旁低声交谈。\n\n' +
  '<战争结算>\n' +
  '  {国战总览 - 第3日}\n' +
  '  | 战争: 北境烽火 | 攻方: 奥尔德南帝国 | 守方: 阿尔比恩王国 |\n' +
  '  | 攻方: 兵力 12万 | 士气 78/100 | 粮草 充足 | 主帅 冯·艾森伯格 |\n' +
  '  | 守方: 兵力 8万 | 士气 60/100 | 粮草 告急 | 主帅 兰斯洛特 |\n' +
  '  | 战局: 攻方占优 | 焦点: 铁壁要塞 | 态势: 帝国大军压境，王国退守要塞 |\n' +
  '  {攻城战 - 铁壁要塞}\n' +
  '  | 事件: 攻城战 | 阶段: 攻城第2日 |\n' +
  '  | 攻方行动: 云梯架设 | 守方应对: 滚油倾泻 |\n' +
  '  | 策略: 火攻 | 策略判定: d20(16) + 3 = 19 vs DC 15 |\n' +
  '  | 判定结果: 成功 | 策略伤害: 2d6(3+4) + 2 = 9 |\n' +
  '  | 战果: 城门起火 | 损失: 攻-2000 守-9000 |\n' +
  '  | 攻方兵力: 12万 -> 11.8万 | 守方兵力: 8万 -> 7.1万 |\n' +
  '  | 转折: 火势蔓延烧毁瓮城 |\n' +
  '  {阶段结算}\n' +
  '  | 结果: 攻方破城 | 影响: 王国北境门户洞开 |\n' +
  '</战争结算>\n' +
  '\n第二天清晨，阿尔比恩的使者带着求和书策马而来。';

let el = getEl('battleContent'); el.innerHTML = '';
parseAndRender(WITH_WRAP);
let out = el.innerHTML;
assert('场景1 · <战争结算> 被提取渲染', out.includes('北境烽火') && out.includes('铁壁要塞'));
assert('场景1 · 块前正文不污染（月色下的边境…被吞）', !out.includes('月色下的边境') && !out.includes('商队在火堆旁'));
assert('场景1 · 块后正文不污染（求和书…被吞）', !out.includes('求和书') && !out.includes('策马而来'));

// ===== 场景2：旧格式 <国战结算> =====
const OLD_WRAP = '……旁白叙事文本，不应进入面板。\n<国战结算>\n{国战总览 - 第1日}\n| 战争: 旧格式战役 | 攻方: A国 | 守方: B国 |\n| 战局: 胶着 | 态势: 对峙 |\n{阶段结算}\n| 结果: 僵持 |\n</国战结算>\n后记：这场战役到此告一段落。';
el.innerHTML = '';
parseAndRender(OLD_WRAP);
out = el.innerHTML;
assert('场景2 · <国战结算> 兼容渲染', out.includes('旧格式战役'));
assert('场景2 · 正文不污染', !out.includes('旁白叙事') && !out.includes('后记'));

// ===== 场景3：无顶层包裹（城战风格，含 {国战总览 特征行）+ 前后正文 =====
const CITY_STYLE = '主角率部赶到时，城门已经燃起大火，街巷中传来喊杀声。\n' +
  '{国战总览 - 第2日}\n' +
  '| 战争: 峡谷镇攻防 | 攻方: 帝国远征军 | 守方: 峡谷镇民兵团 |\n' +
  '| 攻方: 兵力 35 | 士气 70/100 | 粮草 充足 | 主帅 维克托 |\n' +
  '| 守方: 兵力 22 | 士气 55/100 | 粮草 紧缺 | 主帅 老镇长 |\n' +
  '| 战局: 攻方占优 | 态势: 城墙东段已破 |\n' +
  '{城战结算 - 巷战}\n' +
  '| 事件: 巷战 | 阶段: 逐屋争夺 |\n' +
  '| 策略判定: d20(11) + 2 = 13 vs DC 13 | 判定结果: 成功 |\n' +
  '| 策略伤害: 2d6(5+2) = 7 | 损失: 攻-3 守-7 |\n' +
  '| 攻方兵力: 35 -> 32 | 守方兵力: 22 -> 15 |\n' +
  '{阶段结算}\n' +
  '| 结果: 守方退守镇心广场 |\n' +
  '\n战斗结束后，主角在废墟中救出了镇长的女儿，她低声啜泣着道谢。';
el.innerHTML = '';
parseAndRender(CITY_STYLE);
out = el.innerHTML;
assert('场景3 · 城战特征区被渲染', out.includes('峡谷镇攻防') && out.includes('巷战'));
assert('场景3 · 前段正文不污染（赶到时…被吞）', !out.includes('城门已经燃起大火') && !out.includes('喊杀声'));
assert('场景3 · 后段正文不污染（废墟中救出…被吞）', !out.includes('镇长的女儿') && !out.includes('啜泣'));

// ===== 场景4：完全无战争特征 → 占位，不渲染全文 =====
const PLAIN = '今天天气不错，我们去森林里打猎吧。\n猎人射出一箭，正中野鹿的咽喉。\n收获了丰盛的晚餐。';
el.innerHTML = '';
parseAndRender(PLAIN);
out = el.innerHTML;
assert('场景4 · 纯叙事文本 → 显示未检测占位', out.includes('未检测到战争战报'));
assert('场景4 · 正文未被渲染（无 narrative 内容）', !out.includes('打猎') && !out.includes('野鹿'));

// ===== 场景5：<战争结算> 开标签漏闭合（AI 失误）→ 不吞正文 =====
const UNCLOSED = '背景叙事：帝国厉兵秣马。\n<战争结算>\n{国战总览 - 第5日}\n| 战争: 断粮之战 | 攻方: A | 守方: B |\n| 战局: 胶着 | 态势: 双方粮道皆危 |\n{阶段结算}\n| 结果: 僵持 | 影响: 双方各自退兵\n然后双方各自鸣金收兵，战场归于平静。主角的冒险仍在继续。';
el.innerHTML = '';
parseAndRender(UNCLOSED);
out = el.innerHTML;
assert('场景5 · 漏闭合仍渲染特征区', out.includes('断粮之战'));
assert('场景5 · 尾部正文不污染', !out.includes('主角的冒险仍在继续'));
assert('场景5 · 头部正文不污染', !out.includes('帝国厉兵秣马'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
