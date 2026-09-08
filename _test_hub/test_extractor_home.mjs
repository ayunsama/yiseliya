import fs from 'node:fs';
import vm from 'node:vm';
const home = fs.readFileSync('dist/伊瑟利亚/核心/首页代码', 'utf8');
const m = home.match(/<script[^>]*>([\s\S]*?)<\/script>/);
const src = m[1];
const fnText = src.slice(src.indexOf('        function extractJsonArray'), src.indexOf('        window.extractJsonArray = extractJsonArray;'));
const fn = new Function(fnText + '; return { extractJsonArray };');
const api = fn();
let pass = 0, fail = 0;
function assert(n, c, e) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + ' ' + e); } }
// 用户报错场景复现：JSON 后带尾随非空白字符（position 3712 行尾）
const userCase = '```json\n[{"name":"神器·苍穹之刃","type":"武器","effect":"攻击+15，冰属性附加","desc":"以龙脊为骨，霜星为刃。执柄者号令霜原。"},{"name":"冕冠·王权之环","type":"饰品","effect":"魅力+6，领导力检定+2","desc":"初代王覆灭时遗落的冠冕残片。"},{"name":"铠甲·不灭壁垒","type":"防具","effect":"防御+10，免疫一次致死伤害/场","desc":"矮人之王以秘银锻造的最后杰作。"},{"name":"手甲·苍穹之握","type":"武器","effect":"力量+4，空手伤害翻倍","desc":"终焉世纪前陨落神明的臂甲。"}]\n```\n以上就是为角色定制的传奇装备，若有不满意的部分可再次调整。';
const r1 = api.extractJsonArray(userCase);
assert('用户报错场景（尾随说明）→ 解析成功 4 件', Array.isArray(r1) && r1.length === 4 && r1[0].name.includes('苍穹'), JSON.stringify(r1).slice(0, 60));
assert('尾随逗号修复', api.extractJsonArray('[{"name":"x"},]').length === 1);
assert('描述含 ] 修复', api.extractJsonArray('[{"name":"a","desc":"2]金币"},{"name":"b"}]').length === 2);
assert('对象JSON', api.extractJsonArray('{"name":"混血","attributes":"+2"}').name === '混血');
let err = ''; try { api.extractJsonArray('垃圾文本'); } catch (e) { err = e.message; }
assert('无JSON抛错带预览', err.includes('JSON解析失败') && err.includes('原文尾部'));
console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
