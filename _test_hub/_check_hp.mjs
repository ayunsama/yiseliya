import fs from 'node:fs';
import vm from 'node:vm';
let ok = true;
function chk(label, cond, extra) { console.log((cond ? '✅ ' : '❌ ') + label + (extra ? ' ' + extra : '')); if (!cond) ok = false; }

const up = fs.readFileSync('dist/伊瑟利亚/核心/升级代码', 'utf8');
chk('无 hpMult 变量', !up.includes('hpMult'));
chk('无 «HP骰×2» 残留', !up.includes('HP骰×2'));
chk('无 «HP 骰额外乘 2» 残留', !up.includes('HP 骰额外乘 2') && !up.includes('HP 骰额外 ×2'));
chk('HP 计算保留 体质修正', up.includes('rollDice(g.HP, useMax) + getAbilityModifier(attr.体质)'));
chk('isKeyLevel 保留（属性点+2 奖励仍用）', up.includes('const bonusPoints = isKeyLevel(newTotal) ? 2 : 1;'));
chk('注释同步（仅属性点）', up.includes('仅属性点+2') || up.includes('仅用于属性点+2 奖励'));

try { new vm.Script(up); chk('升级代码语法 OK', true); }
catch (e) { chk('升级代码语法 OK', false, e.message); }

const rule = fs.readFileSync('dist/伊瑟利亚/核心/变量更新规则', 'utf8');
chk('变量更新规则文案已改（HP 骰不额外×2）', rule.includes('HP 骰不额外×2'));

process.exit(ok ? 0 : 1);
