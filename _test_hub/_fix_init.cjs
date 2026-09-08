const fs = require('fs');
const files = ['dist/伊瑟利亚/初始变量', 'dist/伊瑟利亚/初始变量_详细版.yaml'];
for (const p of files) {
  let t = fs.readFileSync(p, 'utf8');
  t = t.split('\r\n').join('\n');
  function rep(label, oldStr, newStr) {
    if (!t.includes(oldStr)) { console.error('FAIL [' + label + '] ' + p); process.exit(1); }
    t = t.replace(oldStr, newStr);
    console.log('ok', label, p);
  }

  // 1) 头注释：更新数据模型 + 追踪记录可见性说明
  rep('header',
`# 数据模型：stat_data.{世界, 主角, 英灵, 主要NPC, 同伴, 召唤物, 契约兽, $avatarMap, $flags, $customSkillTrees}
# 说明：
#   - $ 前缀字段（$flags/$avatarMap/$customSkillTrees）AI 不可见不可写，由脚本/前端托管
#   - 紧张度位于 $flags.紧张度（AI 不可见），旧版 世界.紧张度 已废弃不再使用`,
`# 数据模型：stat_data.{世界, 主角, 英灵, 主要NPC, 同伴, 召唤物, 契约兽, $avatarMap, $flags, $customSkillTrees}
# 说明：
#   - $ 前缀字段（$flags/$avatarMap/$customSkillTrees）AI 不可见不可写，由脚本/前端托管
#   - 紧张度位于 $flags.紧张度（AI 不可见），旧版 世界.紧张度 已废弃不再使用
#   - 世界.追踪记录 为 AI 可见可写容器（非 $ 前缀）：AI 按「变量更新规则·追踪记录」insert 流水账，状态栏只读显示`);

  // 2) 世界 段：加 追踪记录 空容器
  rep('world-track',
`  世界见闻:
    世界概况: ""
    动态新闻: {}`,
`  世界见闻:
    世界概况: ""
    动态新闻: {}
  追踪记录: {}`);

  // 3) 主角.基础信息：加 资质（对象）
  rep('talent',
`  基础信息:
    姓名: ""
    种族: ""
    种族修正: ""
    信仰: "无信仰"
    信仰简述: ""
    性别: ""
    年龄: 0
    魔力回路:
      品阶: 无回路
      描述: ""`,
`  基础信息:
    姓名: ""
    种族: ""
    种族修正: ""
    信仰: "无信仰"
    信仰简述: ""
    性别: ""
    年龄: 0
    资质:
      等级: 平庸
      描述: ""
      经验获取效率: 100
    魔力回路:
      品阶: 无回路
      描述: ""`);

  fs.writeFileSync(p, t.split('\n').join('\r\n'));
}
console.log('both initial vars updated');
