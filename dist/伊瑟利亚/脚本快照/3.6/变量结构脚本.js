// 伊瑟利亚 · 变量结构脚本 — 远程加载器（缓存优先模式）
// 真实代码: github.com/ayunsama/iseria-ui@main/scripts/变量结构脚本.js
// 策略: localStorage缓存秒启动(离线可用) + 后台检查更新提示刷新 + CDN三镜像容灾
const _yzKey = 'iseria_cache_变量结构脚本';
const _yzMirrors = [
  'https://cdn.jsdelivr.net/gh/ayunsama/iseria-ui@main/scripts/变量结构脚本.js',
  'https://fastly.jsdelivr.net/gh/ayunsama/iseria-ui@main/scripts/变量结构脚本.js',
  'https://testingcf.jsdelivr.net/gh/ayunsama/iseria-ui@main/scripts/变量结构脚本.js',
];
async function _yzRun(_code, _src) {
  try {
    const _burl = URL.createObjectURL(new Blob([_code], { type: 'text/javascript' }));
    await import(_burl);
    return true;
  } catch (_be) {
    console.warn('[伊瑟利亚外链脚本] ' + _src + ' Blob模块失败, 回退全局执行:', _be);
    try { (0, eval)(_code); return true; } catch (_e2) { return false; }
  }
}
let _yzCached = null;
try { _yzCached = localStorage.getItem(_yzKey); } catch (_e) {}
let _yzBooted = false;
if (_yzCached) {
  _yzBooted = await _yzRun(_yzCached, '本地缓存');
  if (_yzBooted) console.info('[伊瑟利亚外链脚本] 变量结构脚本 缓存启动成功（后台检查更新中）');
  else try { localStorage.removeItem(_yzKey); } catch (_e) {}
}
if (!_yzBooted) {
  let _yzErr;
  for (const _yzUrl of _yzMirrors) {
    try {
      const _r = await fetch(_yzUrl + '?t=' + Date.now(), { cache: 'no-store' });
      if (!_r.ok) throw new Error('HTTP ' + _r.status);
      const _code = await _r.text();
      try { localStorage.setItem(_yzKey, _code); } catch (_le) {}
      _yzBooted = await _yzRun(_code, 'CDN');
      if (_yzBooted) { console.info('[伊瑟利亚外链脚本] 变量结构脚本 加载成功'); break; }
    } catch (_e) { _yzErr = _e; console.warn('[伊瑟利亚外链脚本] 镜像失败:', _yzUrl, _e); }
  }
  if (!_yzBooted) toastr.error('变量结构脚本 外链加载失败：' + (_yzErr?.message || _yzErr) + '（三个镜像均不可达且无可用缓存，请检查网络）', '伊瑟利亚脚本');
} else {
  (async () => {
    for (const _yzUrl of _yzMirrors) {
      try {
        const _r = await fetch(_yzUrl + '?t=' + Date.now(), { cache: 'no-store' });
        if (!_r.ok) return;
        const _code = await _r.text();
        if (_code && _code !== _yzCached) {
          try { localStorage.setItem(_yzKey, _code); } catch (_le) {}
          if (typeof toastr !== 'undefined') toastr.info('脚本有新版本，刷新页面后生效', '伊瑟利亚脚本');
        }
        return;
      } catch (_e) {}
    }
  })();
}
