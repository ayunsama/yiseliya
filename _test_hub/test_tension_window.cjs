// 紧张度羊皮纸窗口 · EJS 渲染测试
// 用法: node _test_hub/test_tension_window.mjs <模板路径> [输出路径]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require(path.join(process.env.TEMP, 'ejs-render-test', 'node_modules', 'ejs'));

const tplPath = path.resolve(__dirname, '../dist/变量结构与状态栏代码/紧张度羊皮纸窗口.html');
const outPath = path.resolve(__dirname, '_tension_window_render.html');

// ---- 模拟酒馆环境 ----
const mockStatData = {
  $flags: {
    紧张度: { 当前值: 62, 等级: '动荡期', 上次触发事件: '北境魔潮逼近' },
    紧张度基线: 35,
  },
  世界: {
    当前地点: '北境·霜语城',
    世界见闻: {
      世界概况: '北境魔潮逼近，帝国南方摩擦升级，王国与帝国谈判陷入僵局。',
      动态新闻: {
        '魔潮逼近北境': { 内容: '北境边境发现大批魔物集结，多个村庄被迫撤离', 日期: '8月6日', 重要性: '极高', 相关地点: '北境', 是否过期: '否' },
        '帝国宣战威胁': { 内容: '帝国对王国发出最后通牒，边境战火一触即发', 日期: '8月5日', 重要性: '极高', 相关地点: '帝国边境', 是否过期: '否' },
        '王国谈判': { 内容: '双方停火谈判中', 日期: '8月6日', 重要性: '高', 相关地点: '王都', 是否过期: '否' },
        '村庄小冲突': { 内容: '霜语城外发生小规模遭遇战', 日期: '8月5日', 重要性: '普通', 是否过期: '否' },
        '旧闻过时': { 内容: '过时的新闻', 日期: '7月1日', 重要性: '高', 是否过期: '是' },
      },
    },
  },
  主角: {
    任务: {
      '调查魔潮起源': { 内容: '前往北境调查魔潮来源', 状态: '进行中' },
      '护送商队': { 内容: '护送商队至王都', 状态: '已完成' },
    },
  },
};

const mockDynText = `<动态剧情>
动态剧情·动荡期:

  新大陆·远洋探索:
    现状:
      - 卡兰蒂亚城邦第一批满载移民与拓荒者的船队抵达海岸<q>"新梅萨利亚"</q>
      - 探险家在近海区域发现储量惊人的浅层魔法矿脉
    各方反应:
      - 城邦商业议会宣布新航线安全
</动态剧情>`;

const sandbox = {
  getvar: (key) => (key === 'stat_data' ? mockStatData : undefined),
  getwi: async (name) => (name.includes('动荡期') ? mockDynText : ''),
  console,
  setTimeout,
};

const html = fs.readFileSync(tplPath, 'utf8');
const render = ejs.compile(html, { filename: tplPath, async: true });
let output;
(async () => {
try {
  output = await render(sandbox);
  console.log('✅ EJS 渲染成功');
} catch (e) {
  console.error('❌ EJS 渲染失败:', e.message);
  process.exit(1);
}

fs.writeFileSync(outPath, output);

// ---- 断言 ----
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('✅ ' + name); } else { fail++; console.log('❌ ' + name); } };

check('渲染含紧张度数值 62', output.includes('>62</span>') || output.includes('62/100'));
check('渲染含等级 动荡期', output.includes('动荡期'));
check('渲染含上次大事件', output.includes('北境魔潮逼近'));
check('渲染含世界概况', output.includes('帝国南方摩擦升级'));
check('渲染含进行中任务', output.includes('调查魔潮起源'));
check('极高新闻出现', output.includes('魔潮逼近北境'));
check('高新闻出现', output.includes('王国谈判'));
check('普通新闻被过滤', !output.includes('村庄小冲突'));
check('过期新闻被过滤', !output.includes('旧闻过时'));
check('已完成任务被过滤', !output.includes('护送商队'));
check('动态剧情世界书出现', output.includes('新梅萨利亚'));
check('TS_DATA 含 curLoc', output.includes('北境·霜语城'));
check('TS_DATA 含新闻', output.includes('魔潮逼近北境'));
check('生成按钮存在', output.includes('tsGenBtn'));
check('折叠逻辑存在(初始收起)', output.includes('display:none'));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
console.log('输出:', outPath);
process.exit(fail ? 1 : 0);
})();
