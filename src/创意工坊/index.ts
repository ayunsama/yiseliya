/**
 * 创意工坊脚本 — 内容安装器
 *
 * 【作用】
 *   从远程 GitHub 仓库拉取内容包清单，让玩家一键安装 MOD。
 *   MOD 可以是新职业、新物品、独立脚本、独立界面等。
 *
 * 【安装流程】
 *   1. 点脚本按钮「创意工坊」→ 弹窗显示可选 MOD 列表
 *   2. 玩家输入序号选择 → 脚本 fetch 远程文件
 *   3. 写入 stat_data.$workshop.已安装MOD 和 .扩展职业成长
 *   4. 升级代码/状态栏自动识别
 *
 * 【给维护者】
 *   修改 WORKSHOP_URL 指向你的 packages.json 托管地址。
 *   packages.json 中每个条目指向 GitHub raw 文件 URL。
 */

const WORKSHOP_URL = 'https://raw.githubusercontent.com/你的用户名/tavern-workshop/main/packages.json';

// ── 获取当前消息楼层的 stat_data ──
function getStatData(): any {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: getCurrentMessageId() });
    return _.get(vars, 'stat_data', {});
  } catch {
    // fallback
    const vars = getVariables({ type: 'message', message_id: -1 });
    return _.get(vars, 'stat_data', {});
  }
}

// ── 写入 stat_data（用 updateVariablesWith，确保写入酒馆变量） ──
function writeStatData(patch: Record<string, any>) {
  updateVariablesWith(vars => {
    const sd = _.get(vars, 'stat_data', {});
    _.merge(sd, patch);
    _.set(vars, 'stat_data', sd);
    return vars;
  }, { type: 'message', message_id: getCurrentMessageId() });
}

// ── 拉取远程 packages.json ──
async function fetchPackages(): Promise<any[]> {
  const res = await fetch(WORKSHOP_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── 安装内容包（支持所有类型） ──
async function installPackage(pkg: any) {
  const name = pkg.名称;
  const baseURL = pkg.baseURL;
  const type = pkg.类型;

  toastr.info(`正在安装「${name}」...`);

  try {
    // ── 职业 ──
    if (type === '职业') {
      const growth = await fetch(baseURL + 'growth.json').then(r => r.json());

      writeStatData({
        $workshop: {
          已安装MOD: { [name]: makeModMeta(pkg) },
          扩展职业成长: {
            [growth.职业名]: {
              HP骰: growth.HP骰 || '', SP骰: growth.SP骰 || '', MP骰: growth.MP骰 || '',
              每级技能点: growth.每级技能点 || 3, 启用: true, 来自MOD: name
            }
          }
        }
      });

      // 可选技能树
      try {
        const skillsText = await fetch(baseURL + 'skills.yaml').then(r => r.text());
        writeStatData({ $workshop: { 扩展职业成长: { [growth.职业名]: { 技能树文本: skillsText } } } });
      } catch { /* 可选 */ }

      toastr.success(`✅ 「${name}」安装完成！新职业「${growth.职业名}」已可用`);
    }

    // ── 种族 ──
    else if (type === '种族') {
      const races = await fetch(baseURL + 'races.json').then(r => r.json());
      const patch: any = { $workshop: { 已安装MOD: { [name]: makeModMeta(pkg) }, 扩展种族: {} } };
      for (const r of (Array.isArray(races) ? races : [races])) {
        patch.$workshop.扩展种族[r.种族名] = {
          描述: r.描述 || '', 属性修正: r.属性修正 || {},
          可选职业: r.可选职业 || [], 启用: true, 来自MOD: name
        };
      }
      writeStatData(patch);
      toastr.success(`✅ 「${name}」安装完成！新种族「${Object.keys(patch.$workshop.扩展种族).join('、')}」已可用`);
    }

    // ── 开局 ──
    else if (type === '开局') {
      const scenarios = await fetch(baseURL + 'scenarios.json').then(r => r.json());
      const patch: any = { $workshop: { 已安装MOD: { [name]: makeModMeta(pkg) }, 扩展开局: {} } };
      for (const s of (Array.isArray(scenarios) ? scenarios : [scenarios])) {
        patch.$workshop.扩展开局[s.开局名] = {
          描述: s.描述 || '', 初始地点: s.初始地点 || '',
          初始物品: s.初始物品 || [], 初始职业: s.初始职业 || [],
          初始属性: s.初始属性 || {}, 初始任务: s.初始任务 || [],
          启用: true, 来自MOD: name
        };
      }
      writeStatData(patch);
      toastr.success(`✅ 「${name}」安装完成！新开局已可用`);
    }

    // ── 英灵 ──
    else if (type === '英灵') {
      const spirits = await fetch(baseURL + 'spirits.json').then(r => r.json());
      const patch: any = { $workshop: { 已安装MOD: { [name]: makeModMeta(pkg) }, 扩展英灵: {} } };
      for (const sp of (Array.isArray(spirits) ? spirits : [spirits])) {
        patch.$workshop.扩展英灵[sp.名称] = {
          名称: sp.名称, 描述: sp.描述 || '',
          初始残响之力: sp.初始残响之力 ?? 0, 初始状态: sp.初始状态 || '苏醒',
          启用: true, 来自MOD: name
        };
      }
      writeStatData(patch);
      toastr.success(`✅ 「${name}」安装完成！新英灵已可用`);
    }

    // ── DLC ──
    else if (type === 'DLC') {
      const dlcData = await fetch(baseURL + 'dlc.json').then(r => r.json());
      writeStatData({
        $workshop: {
          已安装MOD: { [name]: makeModMeta(pkg) },
          扩展DLC: {
            [name]: {
              名称: name, 版本: pkg.版本 || '1.0', 描述: pkg.描述 || '',
              启用: true, 世界覆盖: dlcData.世界覆盖 || {},
              变量更新规则补充: dlcData.变量更新规则补充 || '',
              来自MOD: name
            }
          }
        }
      });
      toastr.success(`✅ 「${name}」DLC 已启用！`);
    }

    // ── 物品 ──
    else if (type === '物品') {
      const items = await fetch(baseURL + 'items.json').then(r => r.json());
      updateVariablesWith(vars => {
        const 物品栏 = _.get(vars, 'stat_data.主角.资产与能力.物品栏', {});
        for (const item of items) {
          物品栏[item.物品名 || Object.keys(item)[0]] = item;
        }
        const ws = _.get(vars, 'stat_data.$workshop', {});
        if (!ws.已安装MOD) ws.已安装MOD = {};
        ws.已安装MOD[name] = makeModMeta(pkg);
        return vars;
      }, { type: 'message', message_id: getCurrentMessageId() });
      toastr.success(`✅ 「${name}」安装完成！${items.length} 件物品已加入背包`);
    }

    // ── 脚本 ──
    else if (type === '脚本') {
      await import(baseURL + 'script.js');
      toastr.success(`✅ 「${name}」脚本已加载`);
    }

    // ── 界面 ──
    else if (type === '界面') {
      $(`<iframe src="${baseURL}interface.html" style="width:100%;border:none;display:block;">`).appendTo('body');
      toastr.success(`✅ 「${name}」界面已加载`);
    }

    else {
      toastr.warning(`未知 MOD 类型: ${type}`);
    }
  } catch (e: any) {
    console.error('[创意工坊] 安装失败:', e);
    toastr.error(`❌ 「${name}」安装失败: ${e.message}`);
  }
}

function makeModMeta(pkg: any) {
  return {
    名称: pkg.名称, 作者: pkg.作者 || '', 版本: pkg.版本 || '1.0',
    类型: pkg.类型, 描述: pkg.描述 || '', 安装时间: new Date().toISOString()
  };
}

// ── 显示 MOD 列表弹窗 ──
async function showWorkshopMenu() {
  try {
    const packages = await fetchPackages();
    if (!packages || packages.length === 0) {
      toastr.warning('📭 创意工坊暂无内容');
      return;
    }

    // 检查已安装
    const statData = getStatData();
    const installed = _.get(statData, '$workshop.已安装MOD', {});
    const installedNames = new Set(Object.keys(installed));

    // 构建列表文本
    const lines = packages.map((p, i) => {
      const tag = installedNames.has(p.名称) ? '✅' : '⬜';
      return `${i + 1}. ${tag} [${p.类型}] ${p.名称}  by ${p.作者 || '未知'}\n   ${p.描述 || ''}`;
    });

    const choice = prompt(
      `📦 创意工坊 — 输入序号安装\n（✅=已安装 ⬜=未安装）\n\n${lines.join('\n\n')}\n\n输入 0 取消`,
      '1'
    );

    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= packages.length) return;

    if (installedNames.has(packages[idx].名称)) {
      toastr.warning(`「${packages[idx].名称}」已安装`);
      return;
    }

    await installPackage(packages[idx]);
  } catch (e: any) {
    console.error('[创意工坊] 拉取失败:', e);
    toastr.error(`❌ 无法连接到创意工坊: ${e.message}`);
  }
}

// ── 注册按钮 ──
$(() => {
  const 按钮名 = '创意工坊';
  const btns = getScriptButtons();
  if (!btns.some(b => b.name === 按钮名)) {
    btns.push({ name: 按钮名, visible: true });
    replaceScriptButtons(btns);
  }
  eventOn(getButtonEvent(按钮名), showWorkshopMenu);

  console.log('[创意工坊] 已加载');
  toastr.success('📦 创意工坊已就绪');
});
