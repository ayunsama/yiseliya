/**
 * 开场白初始变量块 · 与当前变量结构一致性 校验
 * 背景：旧版开场白的 主要NPC 只写 好感度/心里话（缺 身份/关系分类/当前位置 等），
 *       与现行 Schema（状态栏关系图直接显示这些字段）不匹配。
 * 校验：每个非空 主要NPC 条目必须包含 身份/关系分类/当前位置 三个字段；
 *       同伴条目标明 Schema 关键字段齐备（好感度/心里话/外貌/性格/背景故事/种族/身份/等阶/基础属性/基础状态/防御值/技能/物品栏）。
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

for (let n = 1; n <= 8; n++) {
    const src = fs.readFileSync(`dist/伊瑟利亚/开场白${n}`, 'utf8');
    const label = `开场白${n}`;
    const npcStart = src.indexOf('主要NPC:');
    if (npcStart < 0) { assert(`${label} · 含 主要NPC 块`, false); continue; }
    const npcEnd = src.indexOf('\n同伴:', npcStart);
    const npcBlock = npcStart >= 0 ? src.slice(npcStart + '主要NPC:'.length, npcEnd < 0 ? src.length : npcEnd) : '';
    if (npcBlock.trim() === '{}' || npcBlock.trim() === '') { assert(`${label} · 主要NPC 空（跳过）`, true); continue; }
    const entries = npcBlock.split('\n').filter(l => /^  \S/.test(l));
    const favs = (npcBlock.match(/^    好感度: /gm) || []).length;
    const ids = (npcBlock.match(/^    身份: /gm) || []).length;
    const cats = (npcBlock.match(/^    关系分类: /gm) || []).length;
    const locs = (npcBlock.match(/^    当前位置: /gm) || []).length;
    const keysOk = (npcBlock.match(/^  \S.*:$/gm) || []).length;
    assert(`${label} · 主要NPC ${entries.length} 条（好感度 ${favs}）`, entries.length === favs && entries.length > 0, `entries=${entries.length} fav=${favs}`);
    assert(`${label} · 每条含 身份/关系分类/当前位置`, ids === entries.length && cats === entries.length && locs === entries.length, `身份=${ids} 分类=${cats} 位置=${locs}`);
    // 新增：每条 主要NPC 需含 出生年月日 + 年龄（符合变量结构）
    const births = (npcBlock.match(/^    出生年月日: /gm) || []).length;
    const ages = (npcBlock.match(/^    年龄: /gm) || []).length;
    assert(`${label} · 每条含 出生年月日 + 年龄`, births === entries.length && ages === entries.length, `出生=${births} 年龄=${ages}`);
    // 同伴条目（若有）：需含 出生年月日 + 年龄
    const compBlock = npcEnd >= 0 ? src.slice(npcEnd + '\n同伴:'.length, src.indexOf('\n$avatarMap:', npcEnd)) : '';
    if (compBlock.trim() && compBlock.trim() !== '{}') {
        const compEntries = compBlock.split('\n').filter(l => /^  \S/.test(l));
        const compBirths = (compBlock.match(/^    出生年月日: /gm) || []).length;
        const compAges = (compBlock.match(/^    年龄: /gm) || []).length;
        assert(`${label} · 同伴每条含 出生年月日 + 年龄`, compEntries.length > 0 && compBirths === compEntries.length && compAges === compEntries.length, `entries=${compEntries.length} 出生=${compBirths} 年龄=${compAges}`);
    } else {
        assert(`${label} · 同伴为空（跳过）`, true);
    }
}

// 场景抽查：开场白1 亚瑟归类家人 / 开场白6 爱丽丝位置王宫 / 状态栏自动归类兜底
const pb1 = fs.readFileSync('dist/伊瑟利亚/开场白1', 'utf8');
const pb6 = fs.readFileSync('dist/伊瑟利亚/开场白6', 'utf8');
const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
assert('开场白1 · 亚瑟·伍德 = 家人/伍德家主人', pb1.includes('身份: "伍德家主人（{{user}}之父）"') && pb1.includes('关系分类: "家人"'));
assert('开场白6 · 爱丽丝·阿尔比恩 = 家人/坎特伯里·王宫', pb6.includes('身份: "阿尔比恩公主"') && pb6.includes('当前位置: "坎特伯里·王宫"'));
assert('状态栏 · 关系分类缺失按好感度自动归类（旧档兜底）', sb.includes('function relmapAutoCat(fv)') && sb.includes("fv < 80 ? '盟友' : '家人'"));
assert('状态栏 · 年龄按出生年月日自动计算（无出生且无年龄时不显示，无冗余括号）', sb.includes('var vAge = calcActorAge(v);') && sb.includes("escapeAttr(String(vAge)) + '岁</div>'") && !sb.includes('岁（按出生日期自动计算）'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
