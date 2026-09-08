/**
 * 用用户提供的测试数据验证 权能前端 解析渲染
 */
import fs from 'node:fs';

const USER_DATA = `<权能>
  权能名: 领域·魔刃绝界
  持有者: 无名者（主角）
  类型: 领域型
  来源职业: 魔剑士(Lv.17)
  描述: 施法者将体内积蓄的强横气血与魔力源质向外宣泄，使方圆30尺内的空间充斥着无数肉眼难辨的无形力场魔刃。
  领域效果: 任何踏入或在此领域内移动的敌对目标，每移动10尺需进行一次敏捷豁免（DC 18），失败则受到2d8点力场伤害。此外，施法者在领域内释放“魔刃投掷”或“魔刃风暴”时不消耗任何MP与SP，且所有攻击命中检定获得优势。
  发动: 消耗当前50点MP与30点SP，最长维持1分钟。需要持续专注。
  代价: 领域结束后，施法者因力量瞬间内收而承受等同于维持轮数×5的体力反噬伤害（直接扣除物理HP，但不致死），且在之后的3轮内移动速度减半。
</权能>
`;

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

const src = fs.readFileSync('dist/伊瑟利亚/权能前端', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('✗ 未找到 script'); process.exit(1); }
const scriptBody = m[1];

// 在 vm 中执行整个 script，并捕获函数
import vm from 'node:vm';
const ctx = {
  console,
  document: {
    getElementById: () => ({ innerHTML: USER_DATA, innerText: USER_DATA, textContent: '' }),
    addEventListener: () => {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { className: '' }
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  location: { hash: '' },
  setTimeout, clearTimeout
};
vm.createContext(ctx);
// script 里用了 $ (jquery) 判断；提供 undefined
ctx.$ = undefined;
try {
  vm.runInContext(scriptBody, ctx);
} catch (e) {
  // 函数声明会 hoist，即使 boot 报错也不影响函数可用
  console.log('script 顶层执行提示: ' + e.message);
}
// 从 vm 上下文取函数
const parsePowers = ctx.parsePowers;
const renderPowers = ctx.renderPowers;
const detectSys = ctx.detectSys;
const detectSysLabel = ctx.detectSysLabel;
if (typeof parsePowers !== 'function') { console.log('✗ parsePowers 未定义'); process.exit(1); }

// ===== 职业系别识别单元测试 =====
assert('武技系: 战士', detectSys('战士') === 'martial');
assert('武技系: 骑士', detectSys('骑士') === 'martial');
assert('武技系: 猎人(Lv.17) 去括号', detectSys('猎人(Lv.17)') === 'martial');
assert('武技系: 战士[乌尔坎] 去后缀', detectSys('狂战士[乌尔坎]') === 'martial');
assert('魔法系: 元素法师', detectSys('元素法师') === 'arcane');
assert('魔法系: 元素法师(火)', detectSys('元素法师(火)') === 'arcane');
assert('魔法系: 魔兽使(御兽)', detectSys('魔兽使（御兽/契约）') === 'arcane');
assert('神术系: 圣光法师', detectSys('圣光法师') === 'divine');
assert('神术系: 圣殿骑士(不误判武技)', detectSys('圣殿骑士') === 'divine');
assert('神术系: 神官', detectSys('神官') === 'divine');
assert('混合系: 魔剑士', detectSys('魔剑士') === 'mixed');
assert('未知: 无职业名', detectSys('') === 'unknown');
assert('系别标签: 魔剑士→混合系', detectSysLabel('魔剑士(Lv.17)') === '混合系');

const parsed = parsePowers(USER_DATA);
assert('parsePowers 解析出 1 条权能', parsed.length === 1, 'len=' + parsed.length);
if (parsed.length === 1) {
  const p = parsed[0];
  assert('权能名 = 领域·魔刃绝界', p['权能名'] === '领域·魔刃绝界', JSON.stringify(p['权能名']));
  assert('持有者 = 无名者（主角）', p['持有者'] === '无名者（主角）');
  assert('类型 = 领域型 → 识别为领域', /领域/.test(p['类型'] || ''));
  assert('来源职业 = 魔剑士(Lv.17)', p['来源职业'] === '魔剑士(Lv.17)');
  assert('含 描述', p['描述'].includes('无形力场魔刃'));
  assert('含 领域效果', p['领域效果'].includes('敏捷豁免'));
  assert('含 发动', p['发动'].includes('50点MP'));
  assert('含 代价', p['代价'].includes('反噬'));
}

const html = renderPowers(USER_DATA);
assert('渲染含 权能名', html.includes('领域·魔刃绝界'));
assert('渲染含 领域型徽章', html.includes('◎ 领域型'));
assert('渲染含 描述小标题条(sec-title)', html.includes('sec-title">描述'));
assert('渲染含 领域法则小标题条(sec-title)', html.includes('sec-title">领域法则'));
assert('渲染含 领域法则框(field-box)', html.includes('field-box'));
assert('渲染含 持有者徽章', html.includes('无名者（主角）'));
assert('渲染含 来源职业徽章', html.includes('魔剑士(Lv.17)'));
// 职业系别：魔剑士 → 混合系
assert('渲染含 混合系类(sys-mixed)', html.includes('sys-mixed'));
assert('渲染含 混合系徽章(◈ 混合系)', html.includes('◈ 混合系'));
// 结构化 meta：发动/代价 统一 ◈ 前缀花纹小标题 + 彩色标注
assert('渲染含 发动小标题条(◈)', html.includes('sec-title costsec pull') && html.includes('>发动<'));
assert('渲染含 发动内容(彩色)', html.includes('costbody pull'));
assert('渲染含 代价小标题条(◈)', html.includes('sec-title costsec toll') && html.includes('>代价<'));
assert('渲染含 代价内容(彩色)', html.includes('costbody toll'));
assert('渲染含 阶梯入场动画', html.includes('power-pre') && html.includes('animation-delay'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
