/**
 * 动态关键词控制器 — 根据当前位置，直接读取已关闭的世界书条目内容并注入到提示词中
 *
 * 【工作原理】
 *   世界书条目完全保持关闭状态（不修改任何启用开关）。
 *   脚本监听每次 AI 生成事件（GENERATION_AFTER_COMMANDS），
 *   读取 stat_data 中的「当前位置」→ 模糊匹配国家 → 遍历世界书条目名称 →
 *   将名称匹配国家的条目内容通过 injectPrompts 注入到本次生成中。
 *
 * 【世界书条目命名约定 — 硬编码格式】
 *   条目名称必须完全匹配配置中 `entryNames` 指定的硬编码字符串，例如：
 *     - 「势力/卡兰蒂亚合众城邦/历史脉络」    ← 完全匹配 entryNames 中的字面值
 *     - 「地点/卡兰蒂亚合众城邦」             ← 完全匹配 entryNames 中的字面值
 *
 *   每个国家在 COUNTRIES 配置中都有 entryNames 数组，
 *   硬编码了该国家所有世界书条目的精确标题。
 *   脚本检查条目名称是否「以其中任一硬编码字符串开头」，以实现精确匹配。
 *
 *   所有条目在酒馆中保持关闭（不打勾），脚本直接读取内容注入。
 *
 * 【配置】
 *   修改下方 WORLD_BOOK_NAME 为你实际的世界书名称。
 *   修改下方 COUNTRIES 匹配你实际的国家列表。
 */

// ═══════════════════════════════════════════════
// 配置区 — 根据你的实际情况修改
// ═══════════════════════════════════════════════

/** 要读取的世界书名称。设为 null 则自动获取当前角色卡绑定的主世界书 */
const WORLD_BOOK_NAME: string | null = null;

/**
 * 国家列表（用于模糊匹配当前位置）
 * name: 国家完整名称
 * aliases: 别名（当前位置文本中可能出现的其他称呼）
 * entryNames: 该国家世界书条目的硬编码完整标题（必须完全以此格式命名的条目才会被匹配）
 */
const COUNTRIES: {
  name: string;
  aliases: string[];
  /** 世界书条目名称的硬编码列表，脚本会检查条目名称是否「以此数组中任一值开头」 */
  entryNames: string[];
}[] = [
  {
    name: '卡兰蒂亚合众城邦',
    aliases: ['卡兰蒂亚', '合众城邦'],
    entryNames: [
      '势力/卡兰蒂亚合众城邦/历史脉络',
      '地点/卡兰蒂亚合众城邦',
    ],
  },
  {
    name: '奥尔德南帝国',
    aliases: ['奥尔德南', '帝国'],
    entryNames: [
      '势力/奥尔德南帝国/历史脉络',
      '地点/奥尔德南帝国',
    ],
  },
  {
    name: '乌尔加特汗国',
    aliases: ['乌尔加特', '汗国'],
    entryNames: [
      '势力/乌尔加特汗国/历史脉络',
      '地点/乌尔加特汗国',
    ],
  },
  {
    name: '艾瑟尔邦联',
    aliases: ['艾瑟尔', '邦联'],
    entryNames: [
      '势力/艾瑟尔邦联/历史脉络',
      '地点/艾瑟尔邦联',
      '势力/艾瑟尔邦联/扩展内容',
    ],
  },
  {
    name: '希尔凡蒂尔',
    aliases: ['希尔凡', '精灵'],
    entryNames: [
      '势力/希尔凡蒂尔/历史脉络',
      '地点/希尔凡蒂尔',
    ],
  },
  {
    name: '多尔海姆',
    aliases: ['多尔'],
    entryNames: [
      '势力/多尔海姆/历史脉络',
      '地点/多尔海姆',
    ],
  },
  {
    name: '涅瑞廷',
    aliases: ['涅瑞', '海妖'],
    entryNames: [
      '势力/涅瑞廷/历史脉络',
      '地点/涅瑞廷',
    ],
  },
  {
    name: '尼弗海姆',
    aliases: ['尼弗', '极北'],
    entryNames: [
      '势力/尼弗海姆/历史脉络',
      '地点/尼弗海姆',
    ],
  },
];

/** 未匹配到任何国家时，注入的默认内容 */
const DEFAULT_INJECT_CONTENT = '【当前位置处于未识别区域，可能为荒野、中立地带或偏远地区。】';

/** 注入内容的插入深度（0 = 最新深度，越大越靠前） */
const INJECT_DEPTH = 0;

/** 注入内容的角色 */
const INJECT_ROLE: 'system' | 'user' | 'assistant' = 'system';

// ═══════════════════════════════════════════════
// 核心逻辑
// ═══════════════════════════════════════════════

/** 模糊匹配：检查位置文本中是否包含任一国家名或别名，返回匹配的国家配置 */
function matchCountry(locationText: string): (typeof COUNTRIES)[number] | null {
  if (!locationText) return null;
  for (const country of COUNTRIES) {
    if (locationText.includes(country.name)) return country;
    for (const alias of country.aliases) {
      if (locationText.includes(alias)) return country;
    }
  }
  return null;
}

/** 判断条目名称是否属于某个国家（硬编码完整标题匹配） */
function isEntryForCountry(entryName: string, country: (typeof COUNTRIES)[number]): boolean {
  return country.entryNames.some(name => entryName.startsWith(name));
}

/** 获取要读取的世界书名称 */
async function getWorldbookName(): Promise<string> {
  if (WORLD_BOOK_NAME) return WORLD_BOOK_NAME;
  const charWorldbooks = getCharWorldbookNames('current');
  const name = charWorldbooks.primary;
  if (!name) {
    throw new Error('无法获取当前角色卡绑定的世界书，请在 WORLD_BOOK_NAME 中手动指定');
  }
  return name;
}

/** 从 MVU 变量中提取当前位置文本 */
function getLocationTextSync(): string {
  try {
    const data = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    const sd = data?.stat_data;
    const loc1: string = sd?.世界?.当前位置 ?? '';
    const loc2: string = sd?.世界?.当前地点 ?? '';
    return [loc1, loc2].filter(Boolean).join(' ').trim();
  } catch {
    return '';
  }
}

// ── 缓存上一次注入的国家和内容，避免重复读取世界书 ──
let _lastInjectedCountry: string | null = null;
let _lastInjectedContent: string = '';
let _uninjectCurrent: (() => void) | null = null;

/** 核心注入函数：读取匹配国家的世界书条目内容，注入到提示词中 */
async function injectCountryWorldbook(): Promise<void> {
  try {
    const worldbookName = await getWorldbookName();
    const locationText = getLocationTextSync();

    if (!locationText) {
      console.log('⚠️ [动态关键词控制器] 未获取到位置信息');
      return;
    }

    const matched = matchCountry(locationText);
    const countryName = matched?.name || null;

    // ── 如果国家没变且已有注入内容，跳过重复读取 ──
    if (countryName === _lastInjectedCountry && _lastInjectedContent) {
      return;
    }

    // ── 读取世界书所有条目（即使已关闭也能读取） ──
    const allEntries = await getWorldbook(worldbookName);

    // ── 筛选出名称匹配当前国家的条目 ──
    const matchedEntries = matched
      ? allEntries.filter(entry => isEntryForCountry(entry.name || '', matched))
      : [];

    // ── 拼接注入内容 ──
    let injectContent: string;
    let logCountry: string;

    if (matchedEntries.length > 0) {
      injectContent = matchedEntries
        .map(entry => {
          const header = `【${entry.name}】`;
          return `${header}\n${entry.content}`;
        })
        .join('\n\n');
      logCountry = countryName!;
    } else if (matched) {
      // 匹配到了国家，但该国家没有对应的世界书条目
      injectContent = DEFAULT_INJECT_CONTENT;
      logCountry = countryName!;
    } else {
      injectContent = DEFAULT_INJECT_CONTENT;
      logCountry = '未识别区域';
    }

    // ── 取消旧注入 ──
    if (_uninjectCurrent) {
      _uninjectCurrent();
      _uninjectCurrent = null;
    }

    // ── 执行新注入 ──
    const result = injectPrompts(
      [
        {
          id: 'dynamic-keyword-controller',
          position: 'in_chat',
          depth: INJECT_DEPTH,
          role: INJECT_ROLE,
          content: injectContent,
        },
      ],
      { once: false },
    );

    _uninjectCurrent = result.uninject;
    _lastInjectedCountry = countryName;
    _lastInjectedContent = injectContent;

    const matchedCount = matchedEntries.length;
    console.log(
      `📌 [动态关键词控制器] ${logCountry} | 读取 ${matchedCount} 条已关闭的条目 | 已注入提示词`,
    );
  } catch (error) {
    console.error('❌ [动态关键词控制器] 注入失败:', error);
  }
}

// ═══════════════════════════════════════════════
// 生命周期与事件绑定
// ═══════════════════════════════════════════════

$(() => {
  waitGlobalInitialized('Mvu')
    .then(async () => {
      console.log('✅ [动态关键词控制器] MVU 框架已就绪');

      // ── 等待变量数据就绪 ──
      await new Promise<void>(resolve => {
        const check = () => {
          try {
            const data = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
            if (data?.stat_data != null) return resolve();
          } catch {
            // ignore
          }
          setTimeout(check, 500);
        };
        check();
      });

      console.log('✅ [动态关键词控制器] 变量数据已就绪');

      // ── 首次注入 ──
      await injectCountryWorldbook();

      // ── 在每次 AI 生成前注入（保证提示词始终包含当前地点的世界书信息） ──
      eventOn(tavern_events.GENERATION_AFTER_COMMANDS, async () => {
        await injectCountryWorldbook();
      });

      // ── 监听 MVU 变量更新，位置变化时立即更新注入 ──
      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, async () => {
        const oldCountry = _lastInjectedCountry;
        await injectCountryWorldbook();
        if (oldCountry !== _lastInjectedCountry) {
          console.log(
            `🔄 [动态关键词控制器] 地点变更: "${oldCountry || '未知'}" → "${_lastInjectedCountry || '未知'}"`,
          );
        }
      });

      console.log('✅ [动态关键词控制器] 已启动');
    })
    .catch(error => {
      console.error('❌ [动态关键词控制器] 初始化失败:', error);
    });

  // ── 卸载时清理注入 ──
  $(window).on('pagehide', () => {
    if (_uninjectCurrent) {
      _uninjectCurrent();
      _uninjectCurrent = null;
    }
    console.log('👋 [动态关键词控制器] 已卸载');
  });
});
