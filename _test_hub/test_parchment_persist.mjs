/**
 * 聊天正文美化（羊皮纸多风格）· 设置持久化补丁 测试
 * 背景：世界书/正则注入消息的 <script> 被 ST 净化剥离 → 每层楼回到默认主题/字号
 * 修复：状态栏脚本内置补丁，安装到宿主文档（本窗/parent/top），
 *       change 委托写 localStorage + MutationObserver 对新楼层回放。
 * 1. 静态：补丁存在（键名/幂等标记/MutationObserver/捕获监听/容器选择器）
 * 2. 运行时：回放历史楼层 / 修改写入 / 新楼层自动回放 / 幂等防重复
 */
import fs from 'node:fs';

const sb = fs.readFileSync('dist/伊瑟利亚/核心/状态栏', 'utf8');
const parch = fs.readFileSync('dist/伊瑟利亚/聊天背景_多风格羊皮纸.html', 'utf8');

let pass = 0, fail = 0;
function assert(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); } }

console.log('========== 静态：补丁安装 ==========');
assert('状态栏含持久化补丁', sb.includes('聊天正文美化（羊皮纸多风格）· 设置持久化补丁'));
assert('键名 pt_theme / pt_font', sb.includes("var PT_T = 'pt_theme'") && sb.includes("PT_F = 'pt_font'"));
assert('幂等标记 __isuriaPtPersist', sb.includes('win.__isuriaPtPersist'));
assert('宿主候选：本窗/parent/top 均尝试安装', sb.includes('install(window);') && sb.includes('install(window.parent)') && sb.includes('install(window.top)'));
assert('MutationObserver 观察消息注入', sb.includes('new MutationObserver') && sb.includes('childList: true, subtree: true'));
assert('capture 捕获阶段监听 change（防拦截）', sb.includes("doc.addEventListener('change'") && sb.includes(', true);'));
assert('按容器回放（__ptApplied 标记防覆盖手动操作）', sb.includes('box.__ptApplied'));
assert('羊皮纸 HTML 内嵌脚本注释已说明原因', parch.includes('<script> 会被') && parch.includes('持久化已由「核心\\状态栏」脚本内置'));

console.log('\n========== 运行时：真实切片求值补丁模块 ==========');
const bodyIdx = sb.indexOf('<body>');
const scriptStart = sb.indexOf('<script>', bodyIdx);
const scriptEnd = sb.indexOf('</script>', scriptStart);
const moduleSrc = sb.slice(scriptStart + '<script>'.length, scriptEnd);
assert('补丁模块切片成功', moduleSrc.length > 1200, 'len=' + moduleSrc.length);

// ---- 桩 ----
function makeRadio(name, value) { return { name, value, checked: false }; }
function makeBox() {
    return {
        __ptApplied: false,
        _t: [makeRadio('pt-theme', 'parchment'), makeRadio('pt-theme', 'simple'), makeRadio('pt-theme', 'royal'), makeRadio('pt-theme', 'dawn'), makeRadio('pt-theme', 'night')],
        _f: [makeRadio('pt-font', 'f13'), makeRadio('pt-font', 'f14'), makeRadio('pt-font', 'f16'), makeRadio('pt-font', 'f18')],
        querySelectorAll(sel) {
            if (sel === 'input[name="pt-theme"]') return this._t;
            if (sel === 'input[name="pt-font"]') return this._f;
            return [];
        }
    };
}
function makeLS(seed) { const m = Object.assign({}, seed || {}); return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; }
function makeDoc(boxes) {
    const handlers = {};
    return {
        handlers,
        body: {},
        addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
        querySelectorAll(sel) { return sel === '[data-parchment]' ? boxes : []; }
    };
}
const FakeMO = class {
    static instances = [];
    constructor(cb) { this.cb = cb; FakeMO.instances.push(this); }
    observe() {}
};
FakeMO.instances = [];

// 历史楼层 2 个容器 + 后续新楼层 1 个（注入后由 observer 回放）
const topBoxes = [makeBox(), makeBox()];
const parentBoxes = [makeBox()];
const topWin = { document: makeDoc(topBoxes), localStorage: makeLS({ pt_theme: 'royal', pt_font: 'f18' }) };
const parentWin = { document: makeDoc(parentBoxes), localStorage: makeLS() };
const scriptWin = { document: makeDoc([]), localStorage: makeLS(), parent: parentWin, top: topWin };

// 第一次执行（第一层）：安装到 scriptWin/parentWin/topWin
new Function('window', 'MutationObserver', moduleSrc)(scriptWin, FakeMO);

assert('三窗均安装成功', topWin.__isuriaPtPersist === true && parentWin.__isuriaPtPersist === true && scriptWin.__isuriaPtPersist === true);
assert('历史楼层回放：主题 royal + 字号 f18', topBoxes.every(b => b._t[2].checked === true && b._f[3].checked === true), JSON.stringify([topBoxes[0]._t.map(r => r.checked), topBoxes[0]._f.map(r => r.checked)]));
assert('未选中主题保持 unchecked（夜曲 false）', topBoxes[0]._t[4].checked === false);
assert('__ptApplied 标记已打（防重复覆盖）', topBoxes.every(b => b.__ptApplied === true));
assert('parent 窗（无保存值）不动——仅标记不误改', parentBoxes[0]._t[0].checked === false && parentBoxes[0].__ptApplied === false);
assert('每个宿主各挂一个 change 监听', topWin.document.handlers.change.length === 1 && parentWin.document.handlers.change.length === 1);
assert('每个宿主各挂一个 MutationObserver', FakeMO.instances.length === 3);

// 用户修改主题 → change 委托写 localStorage
topWin.document.handlers.change[0]({ target: { name: 'pt_theme', value: 'night' } });
topWin.document.handlers.change[0]({ target: { name: 'pt_font', value: 'f13' } });
assert('修改写入 localStorage（theme=night / font=f13）', topWin.localStorage._m.pt_theme === 'night' && topWin.localStorage._m.pt_font === 'f13');
topWin.document.handlers.change[0]({ target: { name: 'unrelated', value: 'x' } });
assert('无关 change 不写入', topWin.localStorage._m.pt_theme === 'night');

// 新楼层注入 → observer 回放
const newBox = makeBox();
topBoxes.push(newBox);
FakeMO.instances.forEach(m => m.cb());
assert('新楼层自动回放所选主题/字号', newBox._t[4].checked === true && newBox._f[0].checked === true, JSON.stringify([newBox._t.map(r => r.checked), newBox._f.map(r => r.checked)]));
assert('已回放楼层不被再次改动（保持用户的手动切换）', topBoxes[0]._t[4].checked === false);

// 下一层：状态栏重新执行（新 iframe win，但宿主 top 存活）→ 幂等不重复安装
topWin.__isuriaPtPersist = true; // 宿主标记由上次安装保持
const scriptWin2 = { document: makeDoc([]), localStorage: makeLS(), parent: parentWin, top: topWin };
new Function('window', 'MutationObserver', moduleSrc)(scriptWin2, FakeMO);
assert('幂等：宿主监听不重复（change 仍 1 个）', topWin.document.handlers.change.length === 1 && parentWin.document.handlers.change.length === 1);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
