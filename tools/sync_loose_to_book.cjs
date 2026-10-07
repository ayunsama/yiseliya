/* 把散装文件同步进 核心/伊瑟利亚.json 对应条目（散装为准），并做指定条目的追加编辑
 * 用法: node tools/sync_loose_to_book.cjs
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const bookPath = path.join(root, 'dist/伊瑟利亚/核心/伊瑟利亚.json');
const book = JSON.parse(fs.readFileSync(bookPath, 'utf8'));
const entries = book.entries;

// comment → 散装文件
const looseMap = {
  '[mvu_update]变量更新规则': 'dist/伊瑟利亚/核心/变量更新规则',
  '纪元触发器': 'dist/伊瑟利亚/核心/纪元触发器',
  '变量列表': 'dist/伊瑟利亚/状态变量输出',
  '[经验值获取规则]': 'dist/伊瑟利亚/经验获取规则'
};
let synced = 0;
for (const [comment, rel] of Object.entries(looseMap)) {
  const content = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r/g, '');
  let hit = 0;
  for (const k of Object.keys(entries)) {
    if (entries[k].comment === comment) { entries[k].content = content; hit++; }
  }
  console.log((hit ? '✓' : '✗ 未找到') + ' ' + comment + ' ← ' + rel + ' (' + content.length + '字)');
  synced += hit;
}

// 追加：骰值表条款（检定输出规则 + 战斗回合协议）
const DICE_RULE = '\n- 【回合骰值表·最高优先级】若本轮上下文中出现系统注入的「【回合骰值表】」，本回合所有随机骰值（d20 检定/伤害骰/百分骰）必须且只能从该表取用，禁止自行编造任何骰值；同一骰值不得用于同回合内第二次独立判定。未见骰值表时按常规处理。';
for (const [comment, marker] of [['[检定输出规则]', 'type:'], ['[战斗回合协议]', null]]) {
  for (const k of Object.keys(entries)) {
    if (entries[k].comment === comment && !entries[k].content.includes('回合骰值表')) {
      entries[k].content = entries[k].content.replace(/\r/g, '') + DICE_RULE;
      console.log('✓ 追加骰值条款 → ' + comment);
    }
  }
}

fs.writeFileSync(bookPath, JSON.stringify(book));
console.log('已写回 ' + bookPath + '（共 ' + Object.keys(entries).length + ' 条，同步 ' + synced + ' 条散装）');
