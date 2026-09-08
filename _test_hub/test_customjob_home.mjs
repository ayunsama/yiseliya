/**
 * ④ 首页代码「自创职业」功能测试：
 *   1. 静态：UI 元素/绑定/键名/结构齐备，使用 generateRaw + __ISURIA_NON_RP__，无裸 generate
 *   2. 运行时：真实切片求值 generateCustomJobTree 全流程（AI 响应解析→保存→注册→预览）
 */
import fs from 'node:fs';

const home = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const src = home.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

console.log('========== 静态：UI 与接线 ==========');
for (const id of ['cjc-job-name', 'cjc-style', 'cjc-desc', 'cjc-generate', 'cjc-status', 'custom-job-creator', 'cjc-body', 'cjc-arrow']) {
    assert('HTML 含 #' + id, home.includes('id="' + id + '"'));
}
assert('折叠框 section-header（点击标题切换）', home.includes('onclick="toggleCustomJobCreator()"') && home.includes('jrpg-custom-skilltree-body" id="cjc-body"'));
assert('折叠切换函数 + window 挂载', src.includes('var cjcOpen = false;') && src.includes('function toggleCustomJobCreator()') && src.includes('window.toggleCustomJobCreator = toggleCustomJobCreator;'));
assert('默认收起（body 无 open 类）', !home.includes('id="cjc-body" class="open"'));
assert('生成按钮绑定 jQuery 事件', src.includes("$('#cjc-generate').on('click', function () { generateCustomJobTree(); });"));
assert('window.generateCustomJobTree 挂载', src.includes('window.generateCustomJobTree = generateCustomJobTree;'));
assert('window.cjcRegisterJob 挂载', src.includes('window.cjcRegisterJob = cjcRegisterJob;'));
assert('职业恢复钩子（加载变量时注册下拉/成长）', src.includes("cjcRegisterJob(gClass, cstDef.风格 || '混合')"));

console.log('\n========== 静态：直接作为主技能树（不走「变体」通道） ==========');
const renderSlice = src.slice(src.indexOf('    activeJobs.forEach(function(job) {'), src.indexOf('    if (treeHtml === \'\') {'));
assert('主树渲染：定制树优先于 dbSkills', renderSlice.includes('var customTreeDef = (generatedVariantSkills[job.name] && generatedVariantSkills[job.name].___isCustomTree)') && renderSlice.includes('var skillList = customTreeDef ? customTreeDef.skills : dbSkills[job.name];'));
assert('主树标题带 🎨 定制技能树 徽章', renderSlice.includes('🎨 定制技能树</span>'));
assert('主树勾选值无「·变体」后缀', renderSlice.includes("var skillValue = '[' + job.name + '] ' + sk.n;"));
assert('变体追加块跳过定制树', renderSlice.includes('if (vData.___isCustomTree) return;'));
assert('findSkillDesc 定制树兜底', src.slice(src.indexOf('        function findSkillDesc('), src.indexOf('        async function writeSkillsToVars()')).includes('customV.___isCustomTree'));
assert('submitCC 输出描述定制树兜底', src.slice(src.indexOf('// 处理技能描述'), src.indexOf('var skillStr = allSkillsWithDesc.length > 0')).includes('cv.___isCustomTree'));
assert('加载恢复补 ___isCustomTree 标记', src.includes("___isCustomTree: vName === '定制技能树'"));

console.log('\n========== 静态：AI 生成与保存结构 ==========');
const genSlice = src.slice(src.indexOf('        async function generateCustomJobTree'), src.indexOf('        window.generateCustomJobTree = generateCustomJobTree;'));
assert('使用 generateRaw', genSlice.includes('generateRaw({'));
assert('无裸 generate 调用', !genSlice.includes('await generate({') && !genSlice.includes('generate({'));
assert('设置 __ISURIA_NON_RP__ 标志', genSlice.includes('window.__ISURIA_NON_RP__ = true;') && genSlice.includes('window.__ISURIA_NON_RP__ = false;'));
assert('overrides 清空预设', genSlice.includes("world_info_before: '', world_info_after: '', persona_description: ''"));
assert('robust 提取 extractJsonArray', genSlice.includes('extractJsonArray(result)'));
assert('与状态栏同款保存形状 { skills, level:0, grantedLv:0, grantedSp:0, 风格 }', genSlice.includes("{ skills: validSkills, level: 0, grantedLv: 0, grantedSp: 0, 风格: style }"));
assert('键名「定制技能树」写入', genSlice.includes("trees[jobName]['定制技能树'] ="));
assert('加载恢复按「定制技能树」键查找', src.includes("vMap['定制技能树']") && src.includes("cstDef.风格 || '混合'"));
assert('类型三档 技能/魔法/神术', genSlice.includes("rawType === '魔法' || rawType === '神术' ? rawType : '技能'"));
assert('lvl 夹紧 1..20', genSlice.includes('Math.min(20, Math.max(1, parseInt(sk.lvl, 10) || 1))'));
assert('mp 解析（字段+描述兜底）', genSlice.includes('parseInt(sk.mp, 10) || cjcParseMpCost(sk.d)'));
assert('官方重名确认框', genSlice.includes('isOfficial') && genSlice.includes('继续？'));

console.log('\n========== 运行时：真实切片求值全流程 ==========');
const slice = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const stylesSrc  = (() => { const s = src.indexOf('        var CJC_STYLES = {'); return src.slice(s, src.indexOf('        };', s) + '        };'.length); })();
const parseMpSrc = slice('        function cjcParseMpCost(', '        // 将自创职业注册进');
const regSrc     = slice('        function cjcRegisterJob(', '        window.cjcRegisterJob = cjcRegisterJob;');
const genSrc     = slice('        async function generateCustomJobTree(', '        window.generateCustomJobTree = generateCustomJobTree;');
const extSrc     = slice('        function extractJsonArray(', '        window.extractJsonArray = extractJsonArray;');
const growthSrc  = (() => { const s = src.indexOf('        var 职业每级成长 = {'); return src.slice(s, src.indexOf('        };', s) + '        };'.length); })();
assert('切片齐全（样式/生成/提取/成长表）', [stylesSrc, parseMpSrc, regSrc, genSrc, extSrc, growthSrc].every(s => s.length > 150), JSON.stringify([stylesSrc.length, parseMpSrc.length, regSrc.length, genSrc.length, extSrc.length, growthSrc.length]));

// ---- 依赖桩 ----
const selectStub = () => ({ options: [{ value: '' }], appendChild(opt) { this.options.push(opt); } });
const docEls = {
    'cjc-job-name': { value: ' 龙战士 ' },
    'cjc-style': { value: '混合' },
    'cjc-desc': { value: '身缠龙魂的战士，龙化双臂以拳与爪作战，核心机制「龙鳞」叠层。' },
    'cc-race': { value: '龙裔' },
    'cjc-status': { style: {}, innerHTML: '' },
    'cc-class': selectStub(), 'cc-subclass1': selectStub(), 'cc-subclass2': selectStub(),
};
const docStub = {
    getElementById(id) {
        if (!docEls[id]) throw new Error('测试桩缺少元素: ' + id);
        return docEls[id];
    },
    createElement() { return { value: '', textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }; },
};
let captured = null;
const MvuStub = {
    getMvuData: () => ({ stat_data: {} }),
    replaceMvuData: (d) => { captured = d; return Promise.resolve(); },
};
const lodashGet = (o, p, d) => {
    const ks = String(p).split('.');
    let cur = o;
    for (const k of ks) { if (cur == null) return d; cur = cur[k]; }
    return cur === undefined ? d : cur;
};
const lodashSet = (o, p, v) => { const ks = String(p).split('.'); let cur = o; for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (cur[k] == null) cur[k] = {}; cur = cur[k]; } cur[ks[ks.length - 1]] = v; };
const myLodash = { get: lodashGet, set: lodashSet };
const windowStub = {};
const fixture = '```json\n[' +
    '{"n":"龙息冲锋","t":"技能","c":"1","lvl":"1","d":"向敌人发起冲锋，造成力量调整值+2的伤害，消耗 SP 3"},' +
    '{"n":"龙鳞硬化","t":"技能","c":"2","lvl":"3","d":"获得护甲加成，消耗 SP 2"},' +
    '{"n":"炽炎吐息","t":"魔法","c":"3","lvl":"5","mp":"6","d":"喷吐灼热火焰，消耗 MP 6，范围灼烧"},' +
    '{"n":"祖龙龙威","t":"神术","c":"5","lvl":"25","d":"龙威震慑敌人，消耗 MP 8"}' +
    ']\n```\n以上技能树可根据角色成长调整';

// ---- 预求值小件 ----
const stylesApi = new Function(stylesSrc + '; return { CJC_STYLES };')();
const parseMpApi = new Function(parseMpSrc + '; return { cjcParseMpCost };')();
const growth = new Function(growthSrc + '; return 职业每级成长;')();
const extractApi = new Function(extSrc + '; return { extractJsonArray };')();
const gvs = {}, updateCalled = { v: false };
const mainApi = new Function(
    'document', 'Mvu', '_', 'window', 'generateRaw', 'extractJsonArray',
    'CJC_STYLES', 'cjcParseMpCost', 'cjcRegisterJob', '职业每级成长',
    'generatedVariantSkills', 'updateClass', 'isTransmigrationLocked',
    'baseAttrs', 'raceBonus', 'alert', 'confirm',
    stylesSrc + '\n' + parseMpSrc + '\n' + regSrc + '\n' + genSrc + '\n' +
    'return { generateCustomJobTree, cjcParseMpCost };'
)(docStub, MvuStub, myLodash, windowStub,
   async () => fixture, extractApi.extractJsonArray,
   stylesApi.CJC_STYLES, parseMpApi.cjcParseMpCost, undefined, growth,
   gvs, () => { updateCalled.v = true; }, false, { str: 12, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
   { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, (m) => { throw new Error('意外 alert: ' + m); }, () => true);
// cjcRegisterJob 独立求值后注入（其闭包引用 CJC_STYLES，从真实样式表注入）
const regReal = new Function('document', '职业每级成长', 'CJC_STYLES', regSrc + '; return cjcRegisterJob;')(docStub, growth, stylesApi.CJC_STYLES);
const mainApi2 = new Function(
    'document', 'Mvu', '_', 'window', 'generateRaw', 'extractJsonArray',
    'CJC_STYLES', 'cjcParseMpCost', 'cjcRegisterJob', '职业每级成长',
    'generatedVariantSkills', 'updateClass', 'isTransmigrationLocked',
    'baseAttrs', 'raceBonus', 'alert', 'confirm',
    stylesSrc + '\n' + genSrc + '\n' + 'return { generateCustomJobTree };'
)(docStub, MvuStub, myLodash, windowStub,
   async () => fixture, extractApi.extractJsonArray,
   stylesApi.CJC_STYLES, mainApi.cjcParseMpCost, regReal, growth,
   gvs, () => { updateCalled.v = true; }, false, { str: 12, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
   { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, (m) => { throw new Error('意外 alert: ' + m); }, () => true);

await mainApi2.generateCustomJobTree();

// ---- 断言 ----
const tree = captured && captured.stat_data && captured.stat_data.$customSkillTrees && captured.stat_data.$customSkillTrees['龙战士'] && captured.stat_data.$customSkillTrees['龙战士']['定制技能树'];
assert('已调用 Mvu.replaceMvuData 且写入 $customSkillTrees', !!captured && !!tree);
if (tree) {
    assert('技能数 = 4（尾随说明文本被剔除）', tree.skills.length === 4, 'got ' + (tree && tree.skills && tree.skills.length));
    assert('形状：level/grantedLv/grantedSp = 0', tree.level === 0 && tree.grantedLv === 0 && tree.grantedSp === 0);
    assert('风格 = 混合', tree.风格 === '混合');
    assert('类型三档映射（技能/魔法/神术）', tree.skills[0].type === '技能' && tree.skills[2].type === '魔法' && tree.skills[3].type === '神术');
    assert('lvl 夹紧 25→20 / 缺失→1', tree.skills[3].lvl === 20 && tree.skills[0].lvl === 1);
    assert('mp：字段 mp=6 优先', tree.skills[2].mp === 6);
    assert('mp：未写字段回退 0（SP 描述不误判）', tree.skills[0].mp === 0);
}
assert('每级成长已注册 {HP:d8, SP:d6, MP:d4, sp:4}', growth['龙战士'] && growth['龙战士'].HP === 'd8' && growth['龙战士'].SP === 'd6' && growth['龙战士'].MP === 'd4' && growth['龙战士'].sp === 4, JSON.stringify(growth['龙战士']));
assert('预览已写入 generatedVariantSkills（___isCustomTree 标记，非变体）', !!gvs['龙战士'] && gvs['龙战士'].skills && gvs['龙战士'].skills.length === 4 && gvs['龙战士'].___isCustomTree === true && gvs['龙战士'].variantName.includes('混合'));
assert('updateClass 已触发（技能树刷新）', updateCalled.v === true);
const mainSel = docStub.getElementById('cc-class');
assert('主修下拉已加入自创职业', mainSel.options.map(o => o.value).includes('龙战士'));
const opt = mainSel.options.find(o => o.value === '龙战士');
if (opt) {
    assert('选项属性 data-hp=8 / data-sp=4', opt.attrs['data-hp'] === '8' && opt.attrs['data-sp'] === '4', JSON.stringify(opt.attrs));
    assert('选项属性 data-mp=int / data-mpdice=4', opt.attrs['data-mp'] === 'int' && opt.attrs['data-mpdice'] === '4');
    assert('选项文案含 🛠 与成长', opt.textContent.includes('🛠') && opt.textContent.includes('每级 HP d8'));
}
assert('兼职下拉也已加入（复数）', docStub.getElementById('cc-subclass1').options.map(o => o.value).includes('龙战士') && docStub.getElementById('cc-subclass2').options.map(o => o.value).includes('龙战士'));
const statusEl = docStub.getElementById('cjc-status');
assert('状态栏提示成功+已保存', statusEl.innerHTML.includes('已生成 4 个技能') && statusEl.innerHTML.includes('已保存到变量'), statusEl.innerHTML);
assert('__ISURIA_NON_RP__ 已复位', windowStub.__ISURIA_NON_RP__ === undefined || windowStub.__ISURIA_NON_RP__ === false);
assert('cjcParseMpCost 单测（MP 6 / MP 8 / 无 MP→0）', mainApi.cjcParseMpCost('消耗 MP 6，范围灼烧') === 6 && mainApi.cjcParseMpCost('消耗MP8') === 8 && mainApi.cjcParseMpCost('消耗 SP 3') === 0);
assert('CJC_STYLES 四风格齐备', ['武技', '魔法', '神术', '混合'].every(s => stylesApi.CJC_STYLES[s] && stylesApi.CJC_STYLES[s].hpNum && stylesApi.CJC_STYLES[s].type));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
