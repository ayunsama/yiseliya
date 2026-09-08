/**
 * 规则文档（NPC以及敌人相关规则）契约兽链路冒烟测试
 * 从 HTML 抽出 <script>，替换 rawData 占位符为契约兽示例，
 * 验证：detectType → parseContract → renderContract → loadAsContract（写入 stat_data.契约兽）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'dist/伊瑟利亚/NPC以及敌人相关规则'), 'utf8');
const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到 <script>'); process.exit(2); }
let js = m[1];

const sample = `<contract_data>
[名称|冰霜巨龙]
[种族|冰霜巨龙]
[职业|巨龙]
[契约主|主角]
[等阶|精英]
[等级|7]
[体型|巨型]
[元素属性|冰]
[羁绊|65]
[HP|120|140]
[MP|60|80]
[SP|40|50]
[防御值|16]
[移动速度|40]
[先攻修正|2]
[属性|力量18|敏捷10|体质16|智力10|感知12|魅力10]
[攻击|寒冰爪击|近战|6|2d6+3|附带冰冻]
[攻击|甩尾|近战|4|2d8|击退]
[能力|冰甲|受到物理伤害-2]
[能力|霜冻光环|周围敌人移速减半]
[吐息|冰霜吐息|冰|8d6|锥形30尺|3轮]
[弱点|火焰]
[抗性|冰霜]
[免疫|冰冻]
[外貌|覆盖冰晶的巨龙]
[性格|高傲,孤僻]
[所属势力|极北龙族]
[背景故事|守护冰原千年的古龙。]
[状态|健康]
</contract_data>`;

// 替换 rawData 模板占位符为具体示例（原为反引号模板 $1）
const marker = 'var rawData = `$1`;';
const idx = js.indexOf(marker);
if (idx < 0) { console.error('未找到 rawData 占位符'); process.exit(2); }
js = js.slice(0, idx) + 'var rawData = ' + JSON.stringify(sample) + ';' + js.slice(idx + marker.length);

let capturedPayload = null;
const els = {};
function fakeEl() {
  return {
    innerHTML: '', textContent: '', className: '', style: {},
    listeners: {},
    addEventListener(t, fn) { this.listeners[t] = fn; }
  };
}
const document = {
  getElementById(id) { if (!els[id]) els[id] = fakeEl(); return els[id]; }
};
const window = {
  TavernHelper: {
    insertOrAssignVariables(payload) { capturedPayload = payload; }
  }
};

const sandbox = vm.createContext({ document, window, console });

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗ FAIL:', msg); }
}

vm.runInContext(js, sandbox);

console.log('[detectType]');
assert(sandbox.detectType(sample) === 'contract', 'detectType 识别为 contract');

console.log('\n[parseContract]');
const c = sandbox.parseContract(sample);
assert(c.name === '冰霜巨龙', `名称 ${c.name}`);
assert(c.race === '冰霜巨龙' && c.job === '巨龙' && c.caster === '主角', `种族/职业/契约主: ${c.race}/${c.job}/${c.caster}`);
assert(c.tier === '精英' && c.level === 7, `等阶/等级: ${c.tier}/${c.level}`);
assert(c.size === '巨型' && c.element === '冰' && c.bond === 65, `体型/元素/羁绊: ${c.size}/${c.element}/${c.bond}`);
assert(c.hpCur === 120 && c.hpMax === 140, `HP ${c.hpCur}/${c.hpMax}`);
assert(c.mpCur === 60 && c.mpMax === 80 && c.spCur === 40 && c.spMax === 50, `MP/SP 解析`);
assert(c.def === 16 && c.spd === 40 && c.init === 2, `防御/速度/先攻: ${c.def}/${c.spd}/${c.init}`);
assert(c.attr.str === 18 && c.attr.con === 16, `属性 力量/体质: ${c.attr.str}/${c.attr.con}`);
assert(c.attacks.length === 2 && c.attacks[0].name === '寒冰爪击', `攻击 ${c.attacks.length} 条`);
assert(c.abilities.length === 2 && c.abilities[0].name === '冰甲', `能力 ${c.abilities.length} 条`);
assert(c.breath && c.breath.name === '冰霜吐息' && c.breath.dmg === '8d6' && c.breath.cd === '3轮', `吐息: ${c.breath && c.breath.name} ${c.breath && c.breath.dmg}`);
assert(c.weak === '火焰' && c.resist === '冰霜' && c.immune === '冰冻', `弱点/抗性/免疫`);
assert(c.appear && c.personality === '高傲,孤僻' && c.faction === '极北龙族' && c.bgStory && c.status === '健康', `外貌/性格/势力/背景/状态`);

console.log('\n[renderContract]');
const out = sandbox.renderContract(c);
assert(out.includes('🐉'), '冰霜巨龙 → 龙主题图标 🐉');
assert(out.includes('冰霜巨龙') && out.includes('契约兽'), '含名称与契约兽标识');
assert(out.includes('btn-write-contract'), '含一键写入按钮');
assert(out.includes('龙息'), '含龙息区块');
assert(out.includes('65%'), `含羁绊条 65%`);
assert(out.includes('contract-dragon'), '冰霜巨龙 → contract-dragon 主题');

console.log('\n[contractTheme 分类]');
assert(sandbox.contractTheme({race:'冰霜巨龙', job:'巨龙', name:'冰霜巨龙'}) === 'dragon', '冰霜巨龙→dragon');
assert(sandbox.contractTheme({race:'元素精灵', job:'', name:'火元素'}) === 'elemental', '元素精灵→elemental');
assert(sandbox.contractTheme({race:'远古古树', job:'古树', name:'古树'}) === 'forest', '古树→forest');
assert(sandbox.contractTheme({race:'风狼', job:'魔兽', name:'风狼'}) === 'beast', '风狼→beast');
assert(sandbox.contractElementClass('火') === 'elem-fire', '元素映射 火→elem-fire');
assert(sandbox.contractElementClass('冰') === 'elem-ice', '元素映射 冰→elem-ice');
{
  const el = sandbox.parseContract(`<contract_data>
[名称|火元素]
[种族|元素精灵]
[职业|魔兽]
[等级|1]
[元素属性|火]
</contract_data>`);
  const elOut = sandbox.renderContract(el);
  assert(elOut.includes('contract-elemental'), '元素精灵 → contract-elemental');
  assert(elOut.includes('elem-fire'), '火元素 → elem-fire 元素着色');
}

// 元素主题（任意契约兽按元素渲染）+ 元素切换
assert(out.includes('elem-ice'), '冰霜巨龙(冰) → elem-ice 冰蓝主题');
assert(out.includes('elem-switch'), '契约兽面板含元素切换条');
assert(out.includes('elem-btn'), '含元素切换按钮');
assert(out.includes('elem-btn active" data-elem="冰"'), '冰按钮高亮 active');
assert(out.includes(String.fromCodePoint(0x2744) + String.fromCodePoint(0xFE0F)), '龙息使用冰元素图标');
assert(sandbox.elementIco('火') === String.fromCodePoint(0x1F525), 'elementIco 火→🔥');
assert(sandbox.elementIco('冰') === String.fromCodePoint(0x2744) + String.fromCodePoint(0xFE0F), 'elementIco 冰→❄️');
{
  const fireD = Object.assign({}, c, { element: '火' });
  const fireOut = sandbox.renderContract(fireD);
  assert(fireOut.includes('elem-fire'), '切换火元素 → elem-fire');
  assert(fireOut.includes('elem-btn active" data-elem="火"'), '切换后火按钮高亮');
}

console.log('\n[loadAsContract → 写入 stat_data.契约兽]');
const btn = els['btn-write-contract'];
assert(btn && typeof btn.listeners.click === 'function', '写入按钮已绑定 click');
if (btn && btn.listeners.click) btn.listeners.click();
const beast = capturedPayload && capturedPayload.stat_data && capturedPayload.stat_data.契约兽 && capturedPayload.stat_data.契约兽['冰霜巨龙'];
assert(!!beast, 'payload 含 stat_data.契约兽.冰霜巨龙');
if (beast) {
  assert(beast.种族 === '冰霜巨龙' && beast.职业 === '巨龙' && beast.契约主 === '主角', `种族/职业/契约主: ${beast.种族}/${beast.职业}/${beast.契约主}`);
  assert(beast.等阶 === '精英' && beast.基础状态.总等级 === 7, `等阶/总等级: ${beast.等阶}/${beast.基础状态.总等级}`);
  assert(beast.羁绊 === 65 && beast.体型 === '巨型' && beast.元素属性 === '冰', `羁绊/体型/元素`);
  assert(beast.基础状态.HP.最大 === 140 && beast.基础状态.HP.当前 === 120, `HP ${beast.基础状态.HP.当前}/${beast.基础状态.HP.最大}`);
  assert(beast.基础属性.力量 === 18 && beast.基础属性.未分配点数 === 0, `基础属性`);
  assert(beast.基础状态.职业信息['巨龙'] && beast.基础状态.职业信息['巨龙'].等级 === 7, `职业信息.巨龙 等级=7`);
  assert(beast.基础状态.职业信息['巨龙'].技能点 === 0 && beast.基础状态.职业信息['巨龙'].grantedLv === 7, `职业信息.巨龙 无技能点+追踪字段`);
  assert(beast.攻击.length === 2 && beast.能力.length === 2, `攻击/能力 数组`);
  assert(beast.吐息 && beast.吐息.名称 === '冰霜吐息' && beast.吐息.伤害骰 === '8d6', `吐息结构`);
  assert(beast.弱点 === '火焰' && beast.抗性 === '冰霜' && beast.免疫 === '冰冻', `弱点/抗性/免疫`);
  assert(beast.状态 === '健康' && beast.外貌 && beast.背景故事, `状态/外貌/背景`);
}

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
