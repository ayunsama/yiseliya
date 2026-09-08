/**
 * 权能觉醒 EJS · 逻辑验证
 * 模拟 getvar/_/print 环境，执行 EJS 主体逻辑，验证：
 *  1. 无角色到传说级 → 输出"无需觉醒"
 *  2. 主角17级无权能 → 输出权能觉醒指令（含路径/写入方式）
 *  3. 主角18级已有1权能（未神话）→ 不输出（状态正常）
 *  4. 同伴17级无权能 → 输出权能觉醒指令（同伴路径）
 *  5. 主角22级（神话）只有1权能 → 输出权能进化提示
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

// 读取 EJS 文件，剥离 <% %> 标签，只取逻辑代码
const ejs = fs.readFileSync('dist/伊瑟利亚/权能觉醒.ejs.txt', 'utf8');
// 提取 <%-code-%> 块
const codeBlocks = [...ejs.matchAll(/<%(?!=)([\s\S]*?)%>/g)].map(m => m[1]);
const code = codeBlocks.join('\n');
assert('EJS 含可执行逻辑代码块', code.length > 200, `len=${code.length}`);

// 模拟环境
function runScenario(vars) {
    const sandbox = {
        getvar: (path, opts) => {
            let v = vars;
            for (const seg of path.replace('stat_data.', '').split('.')) {
                if (v && typeof v === 'object' && seg in v) v = v[seg];
                else return opts?.defaults;
            }
            return v;
        },
        _: {
            get: (obj, path, def) => {
                let v = obj;
                for (const seg of String(path).split('.')) {
                    if (v && typeof v === 'object' && seg in v) v = v[seg];
                    else return def;
                }
                return v === undefined ? def : v;
            }
        },
        print: (...args) => { sandbox.__out += args.join(''); }
    };
    sandbox.__out = '';
    const fn = new Function('getvar', '_', 'print', code);
    fn(sandbox.getvar, sandbox._, sandbox.print);
    return sandbox.__out;
}

// 场景1：无传说级
let out = runScenario({ 世界: {}, 主角: { 基础状态: { 总等级: 12 } }, 同伴: {} });
assert('场景1 · 无传说级 → 无需觉醒', out.includes('无需觉醒'));

// 场景2：主角17级无权能
out = runScenario({ 世界: {}, 主角: { 基础状态: { 总等级: 17, 职业信息: { 骑士: { 等级: 17 } } }, 基础属性: { 力量: 20 }, 资产与能力: {} }, 同伴: {} });
assert('场景2 · 主角17级无权能 → 权能觉醒', out.includes('<权能觉醒 目标="主角"'));
assert('场景2 · 含写入路径 主角/资产与能力/权能', out.includes('"path": "主角/资产与能力/权能/权能名"'));
assert('场景2 · 含生成依据（职业+能力倾向）', out.includes('职业="骑士') && out.includes('能力倾向="力量20'));
assert('场景2 · 含 <权能> 输出标签要求', out.includes('<权能>'));

// 场景3：主角18级已有1权能（非神话）
out = runScenario({ 世界: {}, 主角: { 基础状态: { 总等级: 18, 职业信息: {} }, 资产与能力: { 权能: { 不屈: { 描述: 'x' } } } }, 同伴: {} });
assert('场景3 · 传说级已有权能 → 无需觉醒', out.includes('无需觉醒') && !out.includes('<权能觉醒'));

// 场景4：同伴17级无权能
out = runScenario({ 世界: {}, 主角: { 基础状态: { 总等级: 5 } }, 同伴: { '莉娜': { 基础状态: { 总等级: 17, 职业信息: { 圣光法师: { 等级: 17 } } }, 基础属性: { 智力: 22 }, 权能: {} } } });
assert('场景4 · 同伴17级无权能 → 权能觉醒（同伴顶层路径）', out.includes('目标="莉娜"') && out.includes('"path": "同伴.莉娜/权能/权能名"'));

// 场景5：主角22级（神话）只有1权能
out = runScenario({ 世界: {}, 主角: { 基础状态: { 总等级: 22, 职业信息: {} }, 资产与能力: { 权能: { 不屈: { 描述: 'x' } } } }, 同伴: {} });
assert('场景5 · 主角22级神话1权能 → 权能进化', out.includes('<权能进化'));

// 场景6：同时主角+同伴都达标
out = runScenario({ 世界: {}, 主角: { 基础状态: { 总等级: 17, 职业信息: {} }, 资产与能力: {} }, 同伴: { '伊拉': { 基础状态: { 总等级: 18, 职业信息: {} }, 权能: { 已有: { 描述: 'x' } } }, '莎拉': { 基础状态: { 总等级: 20, 职业信息: {} }, 权能: {} } } });
assert('场景6 · 主角+1同伴需觉醒（另一同伴已有权能跳过）', out.includes('目标="主角"') && out.includes('目标="莎拉"') && !out.includes('目标="伊拉"'));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
