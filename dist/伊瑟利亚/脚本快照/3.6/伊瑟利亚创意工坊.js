// ============================================================================
// 伊瑟利亚创意工坊 · 宿主脚本（内联版）
// 来源：github.com/ayunsama/iseria-workshop 本地提交 89fba56（含未 push 的修复）
// 为什么内联：CDN 固定哈希取不到未 push 的修复；待用户 push GitHub 后，可将本文件
// 内容换回单行 import 并 bump commit hash：
//   import 'https://cdn.jsdelivr.net/gh/ayunsama/iseria-workshop@<commit>/host-script/index.js'
// ============================================================================

// ============================================================================
// 伊瑟利亚创意工坊 · 宿主脚本
// 运行环境：酒馆助手（Tavern Helper）脚本（iframe），随"伊瑟利亚大陆"角色卡分发
// 职责：注册「伊瑟利亚创意工坊」按钮 → 打开工坊前端（iframe）→ postMessage 桥 →
//       安装/卸载/更新内容包（世界书条目 + 正则）→ 缓存管理
//
// 部署方式：
//   1. 把本文件上传到你的 GitHub 仓库（例如 iseria-workshop/host-script/index.js）
//   2. 角色卡脚本里加一行：import 'https://cdn.jsdelivr.net/gh/你的用户名/iseria-workshop@main/host-script/index.js'
//   3. 把下方 WORKER_URL 改成你部署好的 Cloudflare Worker 地址（或设置脚本变量 iseria_workshop_worker_url 覆盖）
// ============================================================================

(function () {
  'use strict';

  var NS = 'iseria-workshop-bridge';
  var WORKER_URL = 'https://iseria-workshop.1020803065.workers.dev'; // ← 已部署地址（2026-09-08）
  var REGEX_ID_PREFIX = 'iseria_workshop:';
  var CACHE_KEY = 'iseria_workshop_cache';
  var AGREEMENT_KEY = 'iseria_workshop_agreement_accepted';
  var CACHE_TTL = { worldbookSources: 90 * 60 * 1000 }; // 项目源文件缓存 90 分钟

  // 运行环境：酒馆助手脚本 iframe（隐藏）。遮罩/iframe 必须挂到父页面（酒馆网页）才能全屏可见；
  // 消息监听也要挂在父窗口（工坊 iframe 是父窗口的子节点，其 postMessage 发往父窗口）。
  var DOC = (function () {
    try {
      if (window.parent && window.parent.document && window.parent !== window) return window.parent.document;
    } catch (e) { /* 非 iframe 环境 */ }
    return document;
  })();
  var MSG_TARGET = (function () {
    try {
      if (window.parent && window.parent !== window) return window.parent;
    } catch (e) { /* 非 iframe 环境 */ }
    return window;
  })();

  function log() { console.info('[伊瑟利亚工坊]', Array.prototype.join.call(arguments, ' ')); }
  function warn() { console.warn('[伊瑟利亚工坊]', Array.prototype.join.call(arguments, ' ')); }

  // ---- 配置 ----
  function workerUrl() {
    try {
      var vars = getVariables({ type: 'script', script_id: getScriptId() });
      if (vars && vars.iseria_workshop_worker_url) return vars.iseria_workshop_worker_url;
    } catch (e) { /* 忽略 */ }
    return WORKER_URL;
  }

  // ---- 脚本变量缓存 ----
  function readCache() {
    try {
      var vars = getVariables({ type: 'script', script_id: getScriptId() }) || {};
      return vars[CACHE_KEY] || {};
    } catch (e) { return {}; }
  }
  function writeCache(cache) {
    try {
      var vars = getVariables({ type: 'script', script_id: getScriptId() }) || {};
      vars[CACHE_KEY] = cache;
      replaceVariables(vars, { type: 'script', script_id: getScriptId() });
    } catch (e) { warn('缓存写入失败', e); }
  }
  function cacheGet(bucket, key) {
    var c = readCache();
    var item = (c[bucket] || {})[key];
    if (!item) return null;
    if (Date.now() - item.time > CACHE_TTL[bucket]) return null;
    return item.data;
  }
  function cacheSet(bucket, key, data) {
    var c = readCache();
    if (!c[bucket]) c[bucket] = {};
    c[bucket][key] = { time: Date.now(), data: data };
    writeCache(c);
  }

  // ---- 安装器：命名规则 ----
  function entryName(comment, projectName, tags) {
    if (/^\[伊瑟利亚工坊\]/.test(comment)) return comment; // 已带前缀，原样保留
    if (/系统/.test(comment)) return '伊瑟利亚系统-' + comment;
    var category = '扩展';
    if (tags.indexOf('角色包') >= 0) category = '角色';
    else if (tags.indexOf('事件') >= 0) category = '事件';
    return '[伊瑟利亚工坊][' + category + '][' + projectName + ']' + comment;
  }

  // ---- 安装器：字段映射（项目文件条目 → 酒馆世界书条目） ----
  function mapEntry(src, project, idx) {
    var tags = project.tags || [];
    var selective = !!src.selective || !!(src.strategy && src.strategy.type === 'selective');
    var keys = Array.isArray(src.key) ? src.key : (src.key ? [src.key] : []);
    var posType = 'after_character_definition';
    var depth = 0;
    var rawPos = src.position;
    if (rawPos === 'before_char') posType = 'before_character_definition';
    else if (rawPos === 'in_chat' || rawPos === 'at_depth' || rawPos === 'before_example_messages' ||
             rawPos === 'after_example_messages' || rawPos === 'before_author_note' ||
             rawPos === 'after_author_note' || rawPos === 'outlet') posType = rawPos;
    else if (typeof rawPos === 'number') { posType = 'at_depth'; depth = rawPos; }
    if (src.depth !== undefined && src.depth !== null) { posType = 'at_depth'; depth = src.depth; }
    return {
      uid: 0, // 安装时统一分配，避免与其他条目编号冲突
      name: entryName(src.comment || src.name || ('条目' + (idx + 1)), project.name, tags),
      enabled: src.enabled !== false,
      strategy: {
        type: selective ? 'selective' : 'constant',
        keys: keys,
        keys_secondary: {
          logic: 'and_any',
          keys: Array.isArray(src.keysecondary) ? src.keysecondary : (src.keysecondary ? [src.keysecondary] : []),
        },
        scan_depth: 'same_as_global',
      },
      position: { type: posType, role: 'system', depth: depth, order: 100 },
      content: src.content || '',
      probability: typeof src.probability === 'number' ? src.probability : 100,
      recursion: {
        prevent_incoming: !!src.preventRecursion || !!src.prevent_recursion,
        prevent_outgoing: !!src.excludeRecursion || !!src.prevent_activation,
        delay_until: src.recursion_delay != null ? src.recursion_delay : null,
      },
      effect: {
        sticky: src.sticky != null ? src.sticky : null,
        cooldown: src.cooldown != null ? src.cooldown : null,
        delay: src.delay != null ? src.delay : null,
      },
      // 打标：卸载/更新/列表识别的把手
      extra: Object.assign({}, src.extra || {}, {
        iseria_cw_project_id: project.id,
        iseria_cw_project_name_display: project.name,
        iseria_cw_project_version: project.version,
        iseria_cw_remote_version: project.version,
        iseria_cw_entry_key: project.id + ':' + idx,
      }),
    };
  }

  // ---- 安装器：正则映射 ----
  function mapRegex(src, project) {
    var placement = src.placement;
    var source = { user_input: false, ai_output: true, slash_command: false, world_info: false, reasoning: false };
    if (typeof placement === 'string') {
      source.user_input = placement.indexOf('1') >= 0;
      source.ai_output = placement.indexOf('2') >= 0;
    } else if (Array.isArray(placement)) {
      source.user_input = placement.indexOf(1) >= 0 || placement.indexOf('1') >= 0;
      source.ai_output = placement.indexOf(2) >= 0 || placement.indexOf('2') >= 0;
    }
    var destination = { display: true, prompt: false };
    if (src.promptOnly) destination = { display: false, prompt: true };
    return {
      id: REGEX_ID_PREFIX + project.id + ':' + (src.id || String(Math.random()).slice(2, 10)),
      script_name: '[伊瑟利亚工坊] ' + project.name + ' - ' + (src.scriptName || src.name || '脚本'),
      enabled: !src.disabled,
      find_regex: src.findRegex || '',
      replace_string: src.replaceString || '',
      trim_strings: Array.isArray(src.trimStrings) ? src.trimStrings : [],
      source: source,
      destination: destination,
      run_on_edit: !!src.runOnEdit,
      min_depth: src.minDepth !== undefined ? src.minDepth : null,
      max_depth: src.maxDepth !== undefined ? src.maxDepth : null,
    };
  }

  // ---- 下载项目源（带 90 分钟缓存） ----
  async function fetchProjectSource(url, projectId) {
    var cached = cacheGet('worldbookSources', url);
    if (cached) return cached;
    var res = await fetch(url);
    if (!res.ok) throw new Error('下载失败（HTTP ' + res.status + '），请稍后重试');
    var data = await res.json();
    if (!data || typeof data !== 'object') throw new Error('项目文件格式错误');
    var entries = data.worldbookEntries || data.entries || data;
    if (Array.isArray(data)) entries = data;
    else if (data.entries && Array.isArray(data.entries)) entries = data.entries;
    var pack = {
      id: projectId || data.id || String(Math.random()).slice(2, 10),
      name: data.name || url,
      version: data.version || '0.0.0',
      tags: Array.isArray(data.tags) ? data.tags : [],
      worldbookEntries: Array.isArray(entries) ? entries : [],
      regexEntries: Array.isArray(data.regexEntries) ? data.regexEntries : [],
    };
    if (!pack.worldbookEntries.length) throw new Error('内容包没有世界书条目');
    cacheSet('worldbookSources', url, pack);
    return pack;
  }

  // ---- 世界书读写（酒馆助手新接口：按世界书名称读写条目数组） ----
  // 解析目标世界书名称：优先当前角色卡绑定的主世界书，其次当前聊天世界书，最后新建聊天世界书
  function resolveWorldbookName() {
    try {
      var c = getCharWorldbookNames('current');
      if (c && c.primary) return c.primary;
    } catch (e) { /* 接口不可用则继续回退 */ }
    try {
      var n = getChatWorldbookName('current');
      if (n) return n;
    } catch (e) { /* 接口不可用则继续回退 */ }
    return null;
  }
  async function loadWorldbook() {
    var name = resolveWorldbookName();
    if (!name) name = await getOrCreateChatWorldbook('current', '伊瑟利亚工坊');
    var entries = await getWorldbook(name);
    return { name: name, entries: Array.isArray(entries) ? entries : [] };
  }
  async function saveWorldbook(wb) {
    await replaceWorldbook(wb.name, wb.entries);
  }

  // ---- 正则读写（酒馆助手新接口：getTavernRegexes / replaceTavernRegexes） ----
  // 只读写角色卡作用域；严禁把角色卡正则数组写进 global（会覆盖玩家全局正则）
  async function loadRegex() {
    try { return getTavernRegexes({ type: 'character', name: 'current' }) || []; } catch (e) { /* 角色卡作用域不可用时返回空 */ }
    return [];
  }
  async function saveRegex(arr) {
    await replaceTavernRegexes(arr, { type: 'character', name: 'current' });
  }
  // 卸载时兜底清理 global 作用域可能存在的历史残留（旧版本曾把正则误写入全局）
  async function purgeGlobalRegex(projectId) {
    try {
      var arr = getTavernRegexes({ type: 'global' }) || [];
      var kept = arr.filter(function (r) {
        return !(r && r.id && r.id.indexOf(REGEX_ID_PREFIX + projectId + ':') === 0);
      });
      if (kept.length !== arr.length) await replaceTavernRegexes(kept, { type: 'global' });
      return arr.length - kept.length;
    } catch (e) { return 0; }
  }

  // ---- 安装 ----
  async function installProject(data) {
    var projectId = data.projectId;
    var url = data.downloadUrl;
    if (!projectId || !url) throw new Error('缺少项目信息');
    var pack = await fetchProjectSource(url, projectId);

    // 1. 写入世界书（按 iseria_cw_entry_key upsert；清理新版不再包含的孤儿条目）
    var wb = await loadWorldbook();
    var entries = wb.entries;
    var oldMap = {};
    var prevDisabled = {};
    var installedCount = 0;
    var maxUid = 0;
    entries.forEach(function (en) {
      if (en && typeof en.uid === 'number' && en.uid > maxUid) maxUid = en.uid;
      if (en && en.extra && en.extra.iseria_cw_project_id === projectId) {
        oldMap[en.extra.iseria_cw_entry_key] = en;
        if (en.extra.iseria_cw_disabled) prevDisabled[en.extra.iseria_cw_entry_key] = true;
      }
    });

    pack.worldbookEntries.forEach(function (src, idx) {
      var key = projectId + ':' + idx;
      var neu = mapEntry(src, pack, idx);
      // 重装/更新时保留用户之前的禁用状态
      if (prevDisabled[key]) {
        neu.enabled = false;
        neu.extra.iseria_cw_disabled = true;
      }
      if (oldMap[key]) {
        // 已存在：原位替换（保留原 uid，避免世界书内部编号冲突）
        var old = oldMap[key];
        neu.uid = old.uid;
        Object.assign(old, neu);
      } else {
        maxUid++;
        neu.uid = maxUid;
        entries.push(neu);
      }
      installedCount++;
    });
    // 清理孤儿条目：该项目下 entry_key 不在新版集合内的旧条目
    var validKeys = {};
    pack.worldbookEntries.forEach(function (src, idx) { validKeys[projectId + ':' + idx] = true; });
    wb.entries = entries.filter(function (en) {
      if (en && en.extra && en.extra.iseria_cw_project_id === projectId) {
        return !!validKeys[en.extra.iseria_cw_entry_key];
      }
      return true;
    });
    await saveWorldbook(wb);

    // 2. 写入正则（先删本项目旧正则，再写新正则；保留用户之前的禁用状态）
    var regexArr = await loadRegex();
    var prevRegexDisabled = {};
    regexArr.forEach(function (r) {
      if (r && r.id && r.id.indexOf(REGEX_ID_PREFIX + projectId + ':') === 0 && r.enabled === false) {
        prevRegexDisabled[r.id] = true;
      }
    });
    var kept = regexArr.filter(function (r) {
      return !(r && r.id && r.id.indexOf(REGEX_ID_PREFIX + projectId + ':') === 0);
    });
    (pack.regexEntries || []).forEach(function (src) {
      var nr = mapRegex(src, pack);
      if (prevRegexDisabled[nr.id]) nr.enabled = false;
      kept.push(nr);
    });
    await saveRegex(kept);

    log('安装完成：', projectId, installedCount, '条世界书,', (pack.regexEntries || []).length, '个正则');
    return { ok: true, installed: installedCount, regex: (pack.regexEntries || []).length };
  }

  // ---- 卸载 ----
  async function uninstallProject(data) {
    var projectId = data.projectId;
    var projectName = data.projectName || '';
    if (!projectId && !projectName) throw new Error('缺少项目信息');

    var wb = await loadWorldbook();
    var entries = wb.entries;
    var before = entries.length;
    var kept = entries.filter(function (en) {
      if (!en) return true;
      if (projectId && en.extra && en.extra.iseria_cw_project_id === projectId) return false;
      // 兜底：条目 extra 把手被其他工具剥离时，按工坊条目名规则匹配（[伊瑟利亚工坊][类别][包名]…）
      if (projectId && projectName && en.name && en.name.indexOf('[' + projectName + ']') !== -1) return false;
      return true;
    });
    var removed = before - kept.length;
    if (removed > 0) {
      wb.entries = kept;
      await saveWorldbook(wb);
    }

    var regexArr = await loadRegex();
    var rBefore = regexArr.length;
    var rKept = regexArr.filter(function (r) {
      return !(r && r.id && r.id.indexOf(REGEX_ID_PREFIX + projectId + ':') === 0);
    });
    var rRemoved = rBefore - rKept.length;
    if (rRemoved > 0) {
      await saveRegex(rKept);
    }
    // 清理 global 作用域的历史残留（旧版本 bug 可能写进去过）
    var gRemoved = await purgeGlobalRegex(projectId);
    // 清理该项目对应的下载缓存
    purgeCacheForProject(projectId);

    log('卸载完成：', projectId, '移除', removed, '条目,', rRemoved, '正则(含全局残留', gRemoved, ')');
    if (removed === 0 && rRemoved === 0 && gRemoved === 0) {
      return { ok: false, error: '没有找到该项目的内容（可能已卸载，或条目被改名/移动到了其他世界书）', removed: 0, regexRemoved: 0 };
    }
    return { ok: true, removed: removed, regexRemoved: rRemoved + gRemoved };
  }

  // 清理脚本变量下载缓存中属于某项目的条目
  function purgeCacheForProject(projectId) {
    try {
      var vars = getVariables({ type: 'script', script_id: getScriptId() }) || {};
      var c = vars[CACHE_KEY];
      if (!c || !c.worldbookSources) return;
      var purged = false;
      Object.keys(c.worldbookSources).forEach(function (u) {
        var item = c.worldbookSources[u];
        if (item && item.data && item.data.id === projectId) {
          delete c.worldbookSources[u];
          purged = true;
        }
      });
      if (purged) replaceVariables(vars, { type: 'script', script_id: getScriptId() });
    } catch (e) { /* 缓存清理失败不影响卸载 */ }
  }

  // ---- 已安装列表 ----
  async function listInstalled() {
    var wb = await loadWorldbook();
    var map = {};
    wb.entries.forEach(function (en) {
      if (!en || !en.extra || !en.extra.iseria_cw_project_id) return;
      var pid = en.extra.iseria_cw_project_id;
      if (!map[pid]) {
        map[pid] = {
          projectId: pid,
          name: en.extra.iseria_cw_project_name_display || pid,
          nameDisplay: en.extra.iseria_cw_project_name_display || pid,
          version: en.extra.iseria_cw_project_version || '',
          entriesCount: 0,
          regexCount: 0,
          disabled: true, // 所有条目都带禁用标记才视为已禁用
        };
      }
      if (!en.extra.iseria_cw_disabled) map[pid].disabled = false;
      map[pid].entriesCount++;
    });
    var regexArr = await loadRegex();
    var regexByProject = {};
    regexArr.forEach(function (r) {
      if (!r || !r.id) return;
      var m = r.id.match(new RegExp('^' + REGEX_ID_PREFIX + '([0-9a-f]+):'));
      if (m) regexByProject[m[1]] = (regexByProject[m[1]] || 0) + 1;
    });
    Object.keys(map).forEach(function (pid) { map[pid].regexCount = regexByProject[pid] || 0; });
    return { ok: true, installedProjects: Object.keys(map).map(function (k) { return map[k]; }) };
  }

  // ---- diff（实读世界书安装记录，不信任前端传的版本号） ----
  async function getProjectDiff(data) {
    var remoteVersion = (data.remoteVersion || '');
    var liveVersion = null;
    try {
      var wb = await loadWorldbook();
      for (var i = 0; i < wb.entries.length; i++) {
        var en = wb.entries[i];
        if (en && en.extra && en.extra.iseria_cw_project_id === data.projectId) {
          liveVersion = en.extra.iseria_cw_project_version || '';
          break;
        }
      }
    } catch (e) { /* 世界书读取失败时退回前端值 */ }
    var installedVersion = liveVersion !== null ? liveVersion : (data.localVersion || '');
    if (!installedVersion) return { ok: true, status: 'not-installed' };
    if (installedVersion !== remoteVersion) return { ok: true, status: 'update-available', localVersion: installedVersion, remoteVersion: remoteVersion };
    return { ok: true, status: 'up-to-date' };
  }

  // ---- 启用/禁用（可插拔：批量切换条目与正则的 enabled，保留内容便于随时恢复） ----
  async function toggleProject(data) {
    var projectId = data.projectId;
    var disabled = !!data.disabled;
    if (!projectId) throw new Error('缺少项目 ID');
    var wb = await loadWorldbook();
    var touched = 0;
    wb.entries.forEach(function (en) {
      if (en && en.extra && en.extra.iseria_cw_project_id === projectId) {
        var want = !disabled;
        if (!!en.enabled !== want) { en.enabled = want; touched++; }
        else touched++; // 记录把手状态即使 enabled 未变
        en.extra.iseria_cw_disabled = disabled;
      }
    });
    if (touched) await saveWorldbook(wb);
    var regexArr = await loadRegex();
    var rTouched = 0;
    regexArr.forEach(function (r) {
      if (r && r.id && r.id.indexOf(REGEX_ID_PREFIX + projectId + ':') === 0) {
        var want = !disabled;
        if (!!r.enabled !== want) { r.enabled = want; rTouched++; }
      }
    });
    if (rTouched) await saveRegex(regexArr);
    log((disabled ? '禁用' : '启用') + '完成：', projectId, touched, '条目,', rTouched, '正则');
    return { ok: true, disabled: disabled, entries: touched, regex: rTouched };
  }

  // ---- 更新：先确认新版可下载（失败则不动原内容），卸载后重装；失败且有旧版缓存时回滚 ----
  async function updateProject(data) {
    var oldSnapshot = null;
    try { oldSnapshot = cacheGet('worldbookSources', data.downloadUrl); } catch (e) {}
    await uninstallProject({ projectId: data.projectId, projectName: data.projectName || data.name });
    try {
      var r = await installProject(data);
      return { ok: true, message: '更新完成', installed: r.installed };
    } catch (e) {
      if (oldSnapshot) {
        try {
          cacheSet('worldbookSources', data.downloadUrl, oldSnapshot);
          await installProject(data);
          warn('更新失败，已回滚到旧版本');
          return { ok: false, error: '更新失败（已回滚旧版本）：' + ((e && e.message) || e) };
        } catch (e2) { /* 回滚也失败，如实抛出 */ }
      }
      throw e;
    }
  }

  // ---- 写操作互斥队列（世界书读改写不可并发，避免 last-write-wins 丢条目） ----
  var _opQueue = Promise.resolve();
  function queued(fn) {
    var run = _opQueue.then(fn, fn); // 前序操作失败不阻塞后续
    _opQueue = run.then(function () {}, function () {});
    return run;
  }

  // ---- 桥：统一入口 ----
  function bridgeCall(type, data) {
    switch (type) {
      case 'handshake':
      case 'get-context':
        return listInstalled().then(function (li) {
          var cn = '';
          try { if (typeof getCharacterName === 'function') cn = getCharacterName() || ''; } catch (e) { /* 接口缺失不影响握手 */ }
          return { ok: true, connected: true, characterName: cn, installedProjects: li.installedProjects };
        });
      case 'list-installed-projects':
        return listInstalled();
      case 'install-project':
        return installProject(data);
      case 'uninstall-project':
        return uninstallProject(data);
      case 'toggle-project':
        return toggleProject(data);
      case 'get-project-diff':
        return getProjectDiff(data);
      case 'confirm-project-update':
        return updateProject(data);
      default:
        return Promise.reject(new Error('未知消息类型：' + type));
    }
  }

  // ---- 工坊窗口（遮罩 + iframe） ----
  var overlay = null;
  var iframe = null;
  var origin = '';

  function defaultSrcdoc() {
    return (
      '<!doctype html><html><head><meta charset="utf-8"><style>' +
      'html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;' +
      'background:#f4f1ea;font-family:sans-serif;color:#6b7280;font-size:14px}' +
      '</style></head><body><div>正在连接「伊瑟利亚创意工坊」…</div>' +
      '<script>window.addEventListener("load",function(){location.replace(' + JSON.stringify(workerUrl() + '/') + ');});<\/script>' +
      '</body></html>'
    );
  }

  function disclaimerSrcdoc() {
    return (
      '<!doctype html><html><head><meta charset="utf-8"><style>' +
      'html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;' +
      'background:#f4f1ea;font-family:\'PingFang SC\',\'Segoe UI\',sans-serif}' +
      '.card{max-width:520px;padding:36px 32px;border-radius:16px;background:#fff;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.08);text-align:center}' +
      'h1{font-size:20px;margin:0 0 12px;color:#1a1b1c}' +
      'p{font-size:14px;line-height:1.9;color:#4b5563;text-align:left;margin:0 0 22px}' +
      '.btn{display:inline-block;padding:11px 34px;border:none;border-radius:999px;' +
      'background:#8a5a44;color:#fff;font-size:15px;cursor:pointer}' +
      '.btn:hover{background:#744936}' +
      '</style></head><body><div class="card"><h1>伊瑟利亚创意工坊</h1>' +
      '<p>内容包均由玩家创作并经工坊主审核后上架。安装第三方内容包可能存在与角色卡冲突的风险，请自行判断是否安装。</p>' +
      '<button class="btn" id="go">我已了解，进入工坊</button></div>' +
      '<script>document.getElementById(\'go\').onclick=function(){' +
      'parent.postMessage({namespace:\'' + NS + '\',type:\'agreement-accepted\'},\'*\')};<\/script>' +
      '</body></html>'
    );
  }

  function buildOverlay(srcdoc) {
    overlay = DOC.createElement('div');
    overlay.id = 'iseria-workshop-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(10,8,6,.72);' +
      'display:flex;align-items:center;justify-content:center;';
    var frame = DOC.createElement('iframe');
    frame.style.cssText =
      'width:min(1180px,96vw);height:min(820px,92vh);border:none;border-radius:14px;background:#f4f1ea;' +
      'box-shadow:0 12px 48px rgba(0,0,0,.5);';
    frame.srcdoc = srcdoc || defaultSrcdoc();
    overlay.appendChild(frame);
    // 关闭按钮：固定在遮罩右上角，任何情况下（含工坊页面加载失败）都能关掉窗口
    var closeBtn = DOC.createElement('div');
    closeBtn.id = 'iseria-workshop-close';
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭工坊（也可点击遮罩空白处，或按 ESC）';
    closeBtn.style.cssText =
      'position:fixed;top:14px;right:14px;z-index:2147483646;width:46px;height:46px;' +
      'border-radius:50%;background:rgba(25,18,14,.8);color:#fff;font-size:20px;line-height:46px;' +
      'text-align:center;cursor:pointer;font-family:sans-serif;user-select:none;box-shadow:0 2px 10px rgba(0,0,0,.45);' +
      'display:flex;align-items:center;justify-content:center;';
    // 多重保险绑定：onclick 与捕获阶段 click 都挂（幂等，重复触发也安全）
    function onCloseTap(ev) {
      try { if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (e) {}
      closeOverlay();
    }
    closeBtn.onclick = onCloseTap;
    closeBtn.addEventListener('click', onCloseTap, true);
    overlay.appendChild(closeBtn);
    // 点击遮罩空白区域（暗色背景，非窗口本身）也可关闭
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) closeOverlay();
    });
    // ESC 关闭（焦点位于父页面时生效；iframe 内由前端页面自行监听并 postMessage）
    try { MSG_TARGET.addEventListener('keydown', onEscClose); } catch (e) {}
    (DOC.body || document.body).appendChild(overlay);
    iframe = frame;
    origin = (function () {
      try { return new URL(workerUrl()).origin; } catch (e) { return workerUrl(); }
    })();
  }

  function onEscClose(ev) {
    if (ev && (ev.key === 'Escape' || ev.keyCode === 27)) closeOverlay();
  }

  function closeOverlay() {
    // 不依赖闭包变量：直接从 DOM 清除全部工坊遮罩（兼容脚本重载、重复实例、闭包失效等情况）
    try {
      var nodes = DOC.querySelectorAll('#iseria-workshop-overlay');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n && n.parentNode) n.parentNode.removeChild(n);
      }
    } catch (e) {
      try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e2) { /* 忽略 */ }
    }
    try { MSG_TARGET.removeEventListener('keydown', onEscClose); } catch (e) { /* 忽略 */ }
    // 若免责声明尚未同意就关窗，摘掉其监听（避免残留到下次打开造成重复导航）
    try { MSG_TARGET.removeEventListener('message', handleAgreement); } catch (e) { /* 忽略 */ }
    overlay = null; iframe = null;
  }

  function installBridgeListener() {
    if (!window.__iseriaBridgeInstalled) {
      window.__iseriaBridgeInstalled = true;
      MSG_TARGET.addEventListener('message', onBridgeMessage);
    }
  }

  // 导航工坊 iframe：重建 iframe 并设置 src（避免跨窗口 location.replace 被浏览器静默忽略）
  function navigateIframe(url) {
    if (!iframe || !overlay) return;
    try {
      var fr = DOC.createElement('iframe');
      fr.style.cssText = iframe.style.cssText;
      fr.setAttribute('src', url);
      fr.addEventListener('load', installBridgeListener);
      overlay.replaceChild(fr, iframe);
      iframe = fr;
    } catch (e) { warn('导航工坊失败', e); }
  }

  function handleAgreement(ev) {
    var d = ev.data;
    if (!d || d.namespace !== NS || d.type !== 'agreement-accepted') return;
    if (ev.source !== (iframe && iframe.contentWindow)) return;
    MSG_TARGET.removeEventListener('message', handleAgreement);
    try { localStorage.setItem(AGREEMENT_KEY, 'true'); } catch (e) {}
    navigateIframe(workerUrl() + '/');
  }

  function openWorkshop() {
    if (overlay) { closeOverlay(); return; }
    var accepted = false;
    try { accepted = localStorage.getItem(AGREEMENT_KEY) === 'true'; } catch (e) {}

    if (!accepted) {
      // 首次：遮罩内嵌免责声明，同意后再进入工坊（不依赖 window.confirm）
      buildOverlay(disclaimerSrcdoc());
      MSG_TARGET.addEventListener('message', handleAgreement);
      return;
    }

    buildOverlay();
    iframe.addEventListener('load', installBridgeListener);
  }

  function onBridgeMessage(ev) {
    var d = ev.data;
    if (!d || d.namespace !== NS) return;
    var type = d.type;
    // 关闭指令无安全风险，优先处理（避免因 iframe source/origin 时序问题导致页面内按钮关不掉）
    if (type === 'close') { closeOverlay(); return; }
    // 安全校验：来源必须是我们的 iframe，且 origin 与工坊一致
    if (ev.source !== (iframe && iframe.contentWindow)) return;
    if (origin && ev.origin !== origin) { warn('拒绝来自', ev.origin, '的消息'); return; }

    var requestId = d.requestId;
    var data = d.data || {};
    var frame = iframe; // 捕获消息时刻的 frame；期间用户关窗也能把结果送达（操作已实际完成，不能吞响应）

    function post(payload) {
      try {
        if (!frame || !frame.contentWindow) return;
        frame.contentWindow.postMessage(payload, origin || '*');
      } catch (e) { warn('回传失败', e); }
    }
    function respond(result) {
      post({ namespace: NS, type: 'bridge:response', requestId: requestId, data: result });
    }
    function respondError(err) {
      post({ namespace: NS, type: 'bridge:response', requestId: requestId, data: { ok: false, error: (err && err.message) || '未知错误' } });
    }

    // 写操作（装/卸/更/启停）走互斥队列，读操作直接执行
    var MUTATING = { 'install-project': 1, 'uninstall-project': 1, 'confirm-project-update': 1, 'toggle-project': 1 };
    var call = MUTATING[type] ? queued(function () { return bridgeCall(type, data); }) : bridgeCall(type, data);
    call.then(respond).catch(respondError);
  }

  // ---- 注册按钮 ----
  function register() {
    try {
      appendInexistentScriptButtons([{ name: '伊瑟利亚创意工坊', visible: true }]);
      eventOn(getButtonEvent('伊瑟利亚创意工坊'), function () {
        openWorkshop();
      });
      log('宿主脚本已加载');
    } catch (e) {
      console.error('[伊瑟利亚工坊] 注册失败：', e);
    }
  }

  // 加载时机：jQuery ready（禁止使用 DOMContentLoaded）
  $(function () {
    register();
  });
})();
