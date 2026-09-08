// 伊瑟利亚 · NPC/敌人前端 奥义+权能 渲染测试
// 验证：史诗级敌人输出奥义、传说级敌人输出奥义+权能；前端正确解析与渲染
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'dist/伊瑟利亚/NPC以及敌人相关规则');
const WB = path.join(ROOT, 'dist/伊瑟利亚/核心/伊瑟利亚.json');

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); }
}

console.log('===== NPC/敌人前端 · 奥义+权能 测试 =====');

// ---- 1. 世界书模板含规范 ----
const wb = JSON.parse(fs.readFileSync(WB, 'utf8'));
const outRule = wb.entries['4'].content;
assert('世界书[NPC角色/敌人输出规则]含 [奥义|...] 模板字段', outRule.includes('[奥义|{{奥义名称}}'));
assert('世界书[NPC角色/敌人输出规则]含 [权能|...] 模板字段', outRule.includes('[权能|{{权能名称}}'));
assert('世界书[NPC角色/敌人输出规则]含 等阶规范说明', outRule.includes('等阶与底牌规范（强制）'));
assert('史诗级规范: Lv13-16 必须输出奥义', outRule.includes('史诗级（Lv13-16）敌人/NPC/召唤物/契约兽: 必须输出 [奥义'));
assert('传说级规范: Lv17-20 输出奥义+权能', outRule.includes('传说级（Lv17-20）敌人/NPC/召唤物/契约兽: 除 [奥义] 外'));
assert('未达史诗级不输出', outRule.includes('未达史诗级（精英及以下）: 不输出奥义/权能字段'));
assert('[NPC角色/敌人输出规则] 条目已启用', wb.entries['4'].disable === false);

// 1.5 [战斗轮交互协议] 未被误改（保持原样）
const battle = wb.entries['240'];
assert('[战斗轮交互协议] 恢复 disable=true', battle.disable === true);
assert('[战斗轮交互协议] 不含奥义模板（未误改）', !battle.content.includes('[奥义|奥义名'));
assert('[战斗轮交互协议] 不含等阶规范（未误改）', !battle.content.includes('★ 等阶与底牌规范'));

// ---- 2. 前端解析与渲染 ----
const src = fs.readFileSync(FILE, 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('✗ 未找到 script'); process.exit(1); }
const ctx = {
  console,
  document: {
    getElementById: () => ({ innerHTML: '', innerText: '', textContent: '', style: {} }),
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ style: {} })
  },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  location: { hash: '' },
  setTimeout, clearTimeout
};
vm.createContext(ctx);
try { vm.runInContext(m[1], ctx, { timeout: 5000 }); }
catch (e) { console.log('（顶层执行提示: ' + e.message + '）'); }

// 史诗级敌人（带奥义）
const EPIC_ENEMY = `<enemy_data>
[名称|深渊领主·马尔科斯]
[种类|魔族]
[等阶|史诗]
[等级|15]
[HP|180|180]
[防御值|22]
[属性|力量22|敏捷14|体质20|智力10|感知12|魅力8]
[攻击|魔爪撕裂|近战|+12|3d10+8|命中流血]
[能力|深渊护体|受非神圣伤害减半]
[奥义|深渊绞杀：消耗SP30，蓄力1轮，将暗渊之力灌入双爪，对R30尺内所有敌人造成8d10+12暗蚀伤害（敏捷豁免DC20减半），并施加「深渊烙印」3轮（期间受神圣伤害+50%）。每场战斗限1次，使用后魔核过载，防御-4持续2轮]
[弱点|神圣]
</enemy_data>`;

// 传说级敌人（带奥义+权能）
const LEGEND_ENEMY = `<enemy_data>
[名称|炎龙王·梵德拉克斯]
[种类|魔兽]
[种族|远古真龙]
[等阶|传说]
[等级|18]
[HP|320|320]
[防御值|28]
[属性|力量28|敏捷16|体质26|智力14|感知18|魅力16]
[攻击|焚天龙息|特殊|自动|10d10火焰|锥形90尺，敏捷豁免DC23减半]
[能力|龙鳞加护|免疫火焰，物理减伤30%]
[奥义|灭世龙炎：消耗SP50+MP30，腾空后以全身龙血为引吐息，R80尺区域化为火海持续3轮，每轮8d10火焰+4d8灼烧，施法者需体质豁免DC23否则施法打断。每场战斗限1次，使用后龙鳞剥落，全属性-4至长休]
[权能|炎之法则·本源燃尽：传说级自悟法则之力。领域效果：自身半径60尺化为「燃尽领域」持续4轮，域内一切非火焰伤害减半、火焰伤害翻倍，敌方每轮受4d8真实火焰伤害且无法恢复HP。发动：每日1次。代价：使用后24小时内无法使用任何火焰能力]
[弱点|冰霜]
</enemy_data>`;

const parseEnemy = ctx.parseEnemy;
const renderEnemy = ctx.renderEnemy;

const ep = parseEnemy(EPIC_ENEMY);
assert('史诗敌人 解析 等阶=史诗', ep.tier === '史诗');
assert('史诗敌人 解析 奥义×1', ep.ougis.length === 1, '实际 ' + ep.ougis.length);
assert('史诗敌人 解析 权能×0', ep.powers.length === 0, '实际 ' + ep.powers.length);
const epHtml = renderEnemy(ep);
assert('史诗敌人 渲染含 奥义区块', epHtml.includes('ougi-sec') && epHtml.includes('✧ 奥义'));
assert('史诗敌人 渲染含 奥义名', epHtml.includes('深渊绞杀'));
assert('史诗敌人 渲染含 消耗/限制', epHtml.includes('SP30') && epHtml.includes('每场战斗限1次'));
assert('史诗敌人 渲染 无 权能区块', !epHtml.includes('power-sec'));

const lg = parseEnemy(LEGEND_ENEMY);
assert('传说敌人 解析 等阶=传说', lg.tier === '传说');
assert('传说敌人 解析 奥义×1', lg.ougis.length === 1, '实际 ' + lg.ougis.length);
assert('传说敌人 解析 权能×1', lg.powers.length === 1, '实际 ' + lg.powers.length);
const lgHtml = renderEnemy(lg);
assert('传说敌人 渲染含 奥义区块', lgHtml.includes('ougi-sec') && lgHtml.includes('奥义'));
assert('传说敌人 渲染含 权能区块', lgHtml.includes('power-sec') && lgHtml.includes('❖ 权能'));
assert('传说敌人 渲染含 权能名', lgHtml.includes('炎之法则'));
assert('传说敌人 渲染含 权能描述', lgHtml.includes('燃尽领域'));

// 无奥义/权能的普通敌人不显示区块
const NORMAL = `<enemy_data>
[名称|拾荒哥布林]
[等阶|普通]
[等级|1]
[HP|10|10]
[防御值|10]
</enemy_data>`;
const np = parseEnemy(NORMAL);
const npHtml = renderEnemy(np);
assert('普通敌人 无奥义/权能区块', !npHtml.includes('ougi-sec') && !npHtml.includes('power-sec'));

// 世界书 JSON 整体仍合法
assert('世界书 JSON 仍可解析', !!wb.entries['240']);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
