import { defineStore } from 'pinia';

/** 楼层覆盖区间 */
export interface FloorCoverage {
  start: number;
  end: number;
}

/** 单次生成的剧情规划（大纲） */
export interface PlotPlan {
  content: string;
  generatedAt: number;
  /** 生成时基于的楼层区间；回滚到区间内会使其失效 */
  coverage: FloorCoverage | null;
  /** 已失效（楼层被删除/编辑/回滚，需重新分析） */
  stale: boolean;
}

/** 单次主动推进 */
export interface PlotAdvance {
  content: string;
  generatedAt: number;
  /** 生成时的楼层 */
  floor: number;
  /** 已被更新的推进覆盖或手动标记为已执行 */
  resolved: boolean;
}

/** 剧情进度指针：当前进行到大纲的哪一幕/哪一序列/哪一节拍 */
export interface StoryState {
  /** 关联的规划序号 */
  planId: number;
  /** 当前所处幕 */
  stage: '起' | '承' | '转' | '合';
  /** 当前序列（1-3） */
  sequence: 1 | 2 | 3;
  /** 当前这一拍要达成的目标 */
  currentGoal: string;
  /** 已完成的关键事件 */
  completed: string[];
  /** 下一步应当发生的具体事件 */
  nextMove: string;
  /** 进行中的冲突 */
  activeConflicts: string[];
  updatedAt: number;
}

/** 单个 NPC/同伴的动向规划（想法/行为/积极面/阴暗面 + 可能行动） */
export interface NpcStagePlan {
  name: string;
  /** 想法（态度） */
  thought: string;
  /** 行为（表现） */
  behavior: string;
  /** 积极面（建设性倾向：善意/合作/成长/援助） */
  positive: string;
  /** 阴暗面（破坏性倾向：局势恶化时可能走向的极端方向） */
  darkSide: string;
  /** 结合推进推演：她最可能主动去做、直接推动剧情前进的事 */
  likelyAction: string;
}

/** 一次 NPC 动向规划 */
export interface NpcPlan {
  generatedAt: number;
  /** 关联的推进内容 */
  linkedAdvance: string;
  /** 生成时的楼层 */
  floor: number;
  npcs: NpcStagePlan[];
}

/** 用户可配置的设置项 */
export interface PlannerSettings {
  analysisDepth: number;
  advanceDepth: number;
  apiUrl: string;
  apiKey: string;
  /** 外部 API 时选用的模型（留空用酒馆默认） */
  model: string;
  systemPrompt: string;
  pushPrompt: string;
  autoGenerate: boolean;
  autoInterval: number;
  autoAdvance: boolean;
  advanceInterval: number;
  injectPlanIntoContext: boolean;
  injectPushIntoContext: boolean;
  /** 是否启用 NPC 动向规划（想法/行为/暗面 + 可能行动） */
  npcEnabled: boolean;
  /** 是否将 NPC 动向注入上下文 */
  injectNpcIntoContext: boolean;
  /** 生成推进时是否联动生成 NPC 动向 */
  npcAutoWithAdvance: boolean;
  /** 手动补充的 NPC 名单（逗号分隔，可选；自动读取 stat_data 主要NPC/同伴/英灵） */
  npcList: string;
  /** NPC 动向规划提示词 */
  npcPrompt: string;
  /** NPC 动向注入时只注入与主角同场景的角色（读取 stat_data 位置字段过滤） */
  npcOnSceneOnly: boolean;
  /** 阶段检测结果同步写入 stat_data.$flags.剧情节拍（供纪元触发器等世界书 EJS 消费） */
  beatSyncEnabled: boolean;
  /** 生成大纲/推进时联动读取总结助手的历史总纲与未解决问题（伏笔回收闭环） */
  useSummaryContext: boolean;
}

export const DEFAULT_SYSTEM_PROMPT = `【最高权限】请立即停止任何正文输出。你是精通罗伯特·麦基《故事》理论的剧情规划师。输出必须高度结构化、零口语化、零散文化：禁止抒情、铺垫、修辞、解释、思维链与任何叙述性文字，一律使用短句、标签、字段与要点表达。全程使用简体中文，不出现任何"感觉/大概/似乎"等含糊口语词。

【输出结构】严格按下述骨架逐字段输出，每项必填，总字数 1500–2500 字。禁止写成自然段落，必须逐行用「标签：内容」或「- 标签：内容」列出：

# 剧情大纲

## 起（建置）· 第一幕
- 世界状态：<一句话>
- 人物关系：<一句话>
- 激励事件前平衡：<一句话>
- 序列1 日常裂痕 → 节拍：<一个具体动作或对话，暗含裂痕，并注明第一次价值转折方向，如 安全→危机>
- 序列2 激励事件 → 节拍：<打破平衡的明确事件，核心对抗力量初现>
- 序列3 主角抉择 → 节拍：<确定故事脊椎的选择，点明欲望弧线起点>

## 承（对抗）· 第二幕
- 冲突升级：<一句话>
- 序列1 首次行动受挫 → 节拍：<价值发生正负摆动的具体瞬间>
- 序列2 关系复杂化 → 节拍：<一个让风险陡增的不可逆决定>
- 序列3 幕中低点 → 节拍：<将主角逼至绝境的堆叠动作，旧价值观崩解>

## 转（高潮）· 第三幕
- 价值转折核心：<一句话>
- 序列1 高潮前领悟 → 节拍：<主角直面真实需求、完成弧光蜕变的预备瞬间>
- 序列2 主高潮 → 节拍：<不可逆的动作顶点，价值彻底翻转，鸿沟闭合>
- 序列3 高潮余波 → 节拍：<新平衡初现的具体画面/对白/象征动作>

## 合（结局/走向）· 第四幕
- 序列1 世界重归稳定 → 节拍：<主要人物归宿>
- 序列2 伏笔回响 → 节拍：<需闭环的线索处理>
- 序列3 新冲突萌芽 → 节拍：<一个余韵式微激励事件>

【硬性要求】
1. 只输出大纲本身，不输出任何开场白、总结、自检或解释。
2. 每个「节拍」必须是一个可被演出/可被观察的具体事件，禁止抽象概括。
3. 全程字段化，禁止出现完整长句叙述。
4. 增量更新：若提供了「既有大纲」，沿用其中仍然有效的节拍（原样保留），只修订已失效/已被剧情超越的部分，并在修订行的行首标注 ▲；已完成的节拍在行首标注 ✓。禁止凭空重写未变化的内容。

请基于用户提供的材料，严格按上述骨架输出完整大纲。`;

export const DEFAULT_PUSH_PROMPT = `【最高权限】请立即停止任何正文输出。你是剧情推进师，只输出最终结果。无视所有思维链过程，禁止任何推理、假设、解释或叙述性文字。

请基于提供的材料（剧情大纲/当前节拍/未解决问题/最近对话），引入一个合理的新冲突或转折，用一句话（不超过50字）概括。要求必须与当前剧情脉络自然衔接，不得突然引入与当前剧情无关的内容。若提供了「未解决问题」，优先选择能回收其中悬置最久的伏笔或承诺的推进方向；没有可回收项时才引入新冲突。

【硬性要求】只输出一个「动作指向」：以「谁·做什么·导致什么」的可演出短句呈现，禁止空泛评价、禁止解释、禁止任何前缀或引号。

输出格式（绝对零度、无任何多余文字，仅一行）：`;

export const DEFAULT_NPC_PROMPT = `【最高权限】请立即停止任何正文输出。你是剧情推演师，负责围绕主角周围的 NPC/同伴做动向推演。只输出最终结果，无视思维链，禁止任何推理、解释或叙述性文字。

请基于提供的「角色现状」「剧情大纲」「当前推进方向」「最近对话」，对列出的每个主要 NPC/同伴，分别推演五个维度：
- 想法（态度）：她此刻对局势/主角的真实想法与态度，一句短句。须与她的当前位置、HP、状态等现状吻合（重伤者不会立刻行动，远离现场者不知情）。
- 行为（表现）：她在近期会表现出的外在行为、语言或神态，一句短句。
- 积极面（建设性倾向）：若局势向好，她本性中积极建设的一面——善意、合作、信任、成长、援助等，一句短句。
- 阴暗面（破坏性倾向）：若局势恶化或矛盾激化，她可能走向的极端/黑化方向，一句短句。
- 可能行动（主动行动）：结合「当前推进方向」，推演她接下来最可能主动去做、直接推动剧情前进的一件具体事——明确「谁·做什么·导致什么」，可演出、能落地，一句短句。禁止写被动反应或观望。

每个角色必须严格按以下格式输出（不要遗漏、不要合并、不要输出任何其他内容）：
<NPC:角色名>
想法: ...
行为: ...
积极面: ...
阴暗面: ...
可能行动: ...
</NPC>`;

/** 阶段检测专用提示词（内部使用，不强求用户编辑） */
const DETECT_STAGE_PROMPT = `【最高权限】请立即停止任何正文输出。你是剧情进度分析器，只输出一个 JSON 对象，禁止任何其他文字、Markdown 或注释。

请根据提供的「剧情大纲」与「最近对话」，判断故事当前进行到大纲的哪一幕/哪一序列/哪一节拍，并输出如下键的 JSON：
{
  "stage": "起|承|转|合 之一",
  "sequence": 1 或 2 或 3,
  "currentGoal": "当前这一拍要达成的目标，一句话，30字内",
  "completed": ["已经发生的关键事件，简短，最多5条"],
  "nextMove": "下一步应当发生的具体事件，一句话",
  "activeConflicts": ["当前悬而未决的冲突，最多3条"]
}
增量对照：若提供了「上次检测结果」，先用最近对话校验它是否仍然成立；未变化的部分保持原样输出，只在有确凿剧情依据时才修改对应字段。禁止凭空改写。
只输出 JSON。`;

/** 规划整理专用提示词（合并重复、修正冲突、标记已完成节拍） */
const CONSOLIDATE_PROMPT = `【最高权限】请立即停止任何正文输出。你是记忆表格优化助手。请只根据用户提供的【既有大纲】【推进历史】【未解决问题】进行整理、合并与修正，使结果可以直接作为新大纲使用。严禁编造材料里没有依据的新剧情、新设定或未来发展。

【整理目标】
1. 合并重复节拍，删除已被剧情超越的旧节拍，但不得删除影响后续剧情连续性的事实。
2. 修正互相冲突的节拍与走向，保留与「推进历史」「未解决问题」一致的版本。
3. 已被最近对话明确达成的节拍，行首标注 ✓ 并改写为过去式。
4. 保留所有未回收的伏笔/约定/承诺，落入对应幕的「伏笔回响」或就近节拍。
5. 保持原大纲的「幕/序列/节拍」骨架格式，逐字段输出完整大纲，禁止输出解释或对比说明。

请直接输出整理后的完整大纲。`;

function defaultSettings(): PlannerSettings {
  return {
    analysisDepth: 10,
    advanceDepth: 5,
    apiUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    pushPrompt: DEFAULT_PUSH_PROMPT,
    autoGenerate: false,
    autoInterval: 20,
    autoAdvance: false,
    advanceInterval: 5,
    injectPlanIntoContext: true,
    injectPushIntoContext: true,
    npcEnabled: true,
    injectNpcIntoContext: true,
    npcAutoWithAdvance: true,
    npcList: '',
    npcPrompt: DEFAULT_NPC_PROMPT,
    npcOnSceneOnly: true,
    beatSyncEnabled: true,
    useSummaryContext: true,
  };
}

// 使用脚本级变量存储历史，不污染聊天变量
const SCRIPT_VAR_KEY = 'plot_planner_data';

/** 总结上下文提供者：由宿主（功能整合悬浮窗）注入，返回总结助手的总纲文本（含未解决问题） */
type SummaryProvider = () => string;

export const usePlotPlannerStore = defineStore('plotPlanner', () => {
  const settings = ref<PlannerSettings>(defaultSettings());
  const plans = ref<PlotPlan[]>([]);
  const advances = ref<PlotAdvance[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  /** 外部 API 的模型列表 */
  const modelList = ref<string[]>([]);
  const fetchingModels = ref(false);
  const autoCounter = ref(0);
  const advanceCounter = ref(0);
  /** 剧情进度指针（当前节拍） */
  const storyState = ref<StoryState | null>(null);
  /** NPC 动向规划历史 */
  const npcPlans = ref<NpcPlan[]>([]);
  /** 阶段检测进行中 */
  const detecting = ref(false);
  /** NPC 动向生成进行中（与 loading 分离，避免互相阻塞） */
  const npcLoading = ref(false);
  /** 整理规划进行中 */
  const consolidating = ref(false);
  /** 当前绑定的聊天 ID，用于检测聊天切换 */
  const currentChatId = ref<string>('');
  /** 酒馆正在生成回复（自动任务在此期间跳过，防止与主生成抢上下文/接口） */
  const generationBusy = ref(false);

  /** 总结助手上下文提供者（宿主注入） */
  let summaryProvider: SummaryProvider | null = null;
  function setSummaryProvider(fn: SummaryProvider) {
    summaryProvider = fn;
  }

  /** 读取总结上下文（历史总纲 + 未解决问题），未启用或不可用时返回空 */
  function readSummaryContext(): { outline: string; unresolved: string } {
    if (!settings.value.useSummaryContext || !summaryProvider) return { outline: '', unresolved: '' };
    try {
      const text = summaryProvider() || '';
      const uMatch = text.match(/【未解决问题】([\s\S]*?)(?=【|$)/);
      const unresolved = uMatch ? uMatch[1].replace(/^[-\s*]+/gm, '').trim() : '';
      return { outline: text.trim(), unresolved };
    } catch { return { outline: '', unresolved: '' }; }
  }

  // ---- 从脚本变量加载 ----
  function loadFromStorage() {
    try {
      const vars = getVariables({ type: 'script' });
      const stored = vars[SCRIPT_VAR_KEY];
      // 获取当前聊天 ID
      let chatId = '';
      try { chatId = SillyTavern.getCurrentChatId() || ''; } catch {}

      if (stored) {
        const storedChatId = stored.currentChatId || '';
        const chatChanged = !!storedChatId && storedChatId !== chatId;

        if (stored.settings) settings.value = { ...defaultSettings(), ...stored.settings };
        if (stored.plans && !chatChanged) plans.value = stored.plans;
        if (stored.advances && !chatChanged) advances.value = stored.advances;
        if (stored.storyState && !chatChanged) storyState.value = stored.storyState;
        if (stored.npcPlans && !chatChanged) npcPlans.value = stored.npcPlans;
        if (typeof stored.autoCounter === 'number' && !chatChanged) autoCounter.value = stored.autoCounter;
        if (typeof stored.advanceCounter === 'number' && !chatChanged) advanceCounter.value = stored.advanceCounter;

        if (chatChanged) {
          console.log('[剧情规划大师] 初始化时检测到聊天已变更，已清空旧规划数据');
        }
      }
      currentChatId.value = chatId;
    } catch { /* 首次加载 */ }
  }

  function saveToStorage() {
    try {
      const payload = {
        currentChatId: currentChatId.value,
        settings: { ...defaultSettings(), ...settings.value },
        plans: Array.isArray(plans.value) ? plans.value : [],
        advances: Array.isArray(advances.value) ? advances.value : [],
        storyState: storyState.value || null,
        npcPlans: Array.isArray(npcPlans.value) ? npcPlans.value : [],
        autoCounter: typeof autoCounter.value === 'number' ? autoCounter.value : 0,
        advanceCounter: typeof advanceCounter.value === 'number' ? advanceCounter.value : 0,
      };
      insertOrAssignVariables({ [SCRIPT_VAR_KEY]: payload }, { type: 'script' });
    } catch (e: any) {
      console.warn('[剧情规划大师] 保存失败:', e?.message || e);
    }
  }

  // ---- 切换聊天时重置规划数据 ----
  function resetForNewChat(chatId: string) {
    if (currentChatId.value === chatId) return;
    console.log('[剧情规划大师] 检测到聊天切换:', currentChatId.value || '(首次)', '→', chatId);
    currentChatId.value = chatId;
    plans.value = [];
    advances.value = [];
    storyState.value = null;
    npcPlans.value = [];
    autoCounter.value = 0;
    advanceCounter.value = 0;
    error.value = null;
    saveToStorage();
  }

  // ---- 回滚失效：楼层被删除/编辑/切换 swipe 后，覆盖该楼层的规划数据失效 ----
  function invalidateCoverage(floor: number) {
    let changed = false;
    for (const p of plans.value) {
      if (!p.stale && p.coverage && floor >= p.coverage.start && floor <= p.coverage.end) {
        p.stale = true;
        changed = true;
        console.log('[剧情规划大师] 大纲因楼层变更失效:', p.coverage, '变更楼层:', floor);
      }
    }
    for (const n of npcPlans.value) {
      if (floor <= n.floor) {
        n.floor = -1; // 标记失效，注入时跳过过期动向
        changed = true;
      }
    }
    if (changed) saveToStorage();
  }

  /** 最近的推进楼层号（回滚检测的参照） */
  function latestFloor(): number {
    try { return getLastMessageId(); } catch { return 0; }
  }

  // ---- 从外部 API 获取模型列表 ----
  async function fetchModels(): Promise<void> {
    const url = settings.value.apiUrl;
    const key = settings.value.apiKey;
    if (!url) {
      toastr.warning('请先填写 API 地址', '剧情规划大师');
      return;
    }
    fetchingModels.value = true;
    try {
      const baseUrl = url.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const json = await response.json();
      const models: string[] = (json.data || [])
        .map((m: any) => m.id)
        .filter(Boolean)
        .sort();
      modelList.value = models;
      if (models.length === 0) {
        toastr.info('API 返回了空的模型列表', '剧情规划大师');
      } else {
        toastr.success(`获取到 ${models.length} 个模型`, '剧情规划大师');
      }
      // 当前选中的模型不在列表中则清空
      if (settings.value.model && !models.includes(settings.value.model)) {
        settings.value.model = '';
        saveToStorage();
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      toastr.error(`获取模型列表失败: ${msg}`, '剧情规划大师');
      modelList.value = [];
    } finally {
      fetchingModels.value = false;
    }
  }

  // ---- 隔离预设的静默生成（内部工具调用） ----
  // 用 generateRaw + ordered_prompts 完全屏蔽酒馆当前预设（角色卡/系统提示词等）；
  // should_silence 恒为 true：绝不把工具输出写入正文消息楼层。
  async function generateIsolated(userInput: string, sysPrompt: string): Promise<string> {
    const generateConfig: Record<string, any> = {
      user_input: userInput,
      should_stream: false,
      should_silence: true,
      ordered_prompts: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userInput },
      ],
    };
    if (settings.value.apiUrl) {
      generateConfig.custom_api = {
        apiurl: settings.value.apiUrl,
        key: settings.value.apiKey || '',
        ...(settings.value.model ? { model: settings.value.model } : {}),
      };
    }
    const result = await generateRaw(generateConfig);
    return typeof result === 'string' ? result : String(result);
  }

  // ---- 楼层消息读取（区间化，供手动补跑） ----
  function readMessages(from: number | null, to: number | null): { text: string; coverage: FloorCoverage } {
    const lastId = to ?? getLastMessageId();
    const depth = from ?? Math.max(0, lastId - (settings.value.analysisDepth || 10) + 1);
    const startId = Math.max(0, Math.min(depth, lastId));
    const messages = getChatMessages(`${startId}-${lastId}`, { role: 'all', hide_state: 'unhidden' });
    if (messages.length === 0) throw new Error('没有可分析的消息');
    const text = messages
      .map(m => `[${m.role === 'user' ? '用户' : m.name || 'AI'}]: ${m.message}`)
      .join('\n\n');
    return { text, coverage: { start: startId, end: lastId } };
  }

  // ---- 核心：生成剧情规划（增量：沿用既有大纲有效节拍 + 总结总纲 + 未解决问题） ----
  async function generatePlan(silent = false, range?: { from: number; to: number }): Promise<string | null> {
    if (loading.value) return null;
    if (generationBusy.value) { if (!silent) toastr.info('酒馆正在生成回复，请稍后再试', '剧情规划大师'); return null; }
    loading.value = true;
    error.value = null;

    try {
      const { text: chatHistory, coverage } = readMessages(range?.from ?? null, range?.to ?? null);
      const summaryCtx = readSummaryContext();
      const lastPlan = plans.value[plans.value.length - 1];
      const lastPlanText = lastPlan && !lastPlan.stale ? lastPlan.content.trim() : '';

      const userInput = [
        summaryCtx.outline ? `历史总纲（前情提要，供长线参考）：\n${summaryCtx.outline}` : '',
        summaryCtx.unresolved ? `未解决问题（规划时须安排回收节拍）：\n${summaryCtx.unresolved}` : '',
        lastPlanText ? `既有大纲（沿用其中仍然有效的节拍，只修订失效部分，修订行首标注 ▲，已完成行首标注 ✓）：\n${lastPlanText}` : '',
        `对话剧情：\n\n${chatHistory}`,
      ].filter(Boolean).join('\n\n');

      const result = await generateIsolated(userInput, settings.value.systemPrompt);
      const newPlan: PlotPlan = { content: result, generatedAt: Date.now(), coverage, stale: false };
      plans.value.push(newPlan);
      if (plans.value.length > 20) plans.value = plans.value.slice(-20);

      saveToStorage();
      return result;
    } catch (e: any) {
      const msg = e?.message || String(e);
      error.value = msg;
      if (!silent) toastr.error(msg, '剧情规划失败');
      return null;
    } finally {
      loading.value = false;
    }
  }

  // ---- 核心：生成主动推进（未解决问题优先回收） ----
  async function generateAdvance(silent = false): Promise<string | null> {
    if (loading.value) return null;
    if (generationBusy.value) { if (!silent) toastr.info('酒馆正在生成回复，请稍后再试', '剧情规划大师'); return null; }
    loading.value = true;
    error.value = null;

    try {
      const { text: chatHistory } = readMessages(null, null);
      const summaryCtx = readSummaryContext();

      const lastPlan = plans.value[plans.value.length - 1]?.content?.trim();
      const s = storyState.value;

      const userInput = [
        summaryCtx.unresolved ? `未解决问题（悬置的伏笔/约定/承诺，优先回收悬置最久的）：\n${summaryCtx.unresolved}` : '',
        lastPlan ? `剧情大纲要点：\n${condensePlan(lastPlan)}` : '',
        s?.currentGoal ? `当前节拍：${s.stage}·序列${s.sequence} 目标「${s.currentGoal}」${s.nextMove ? `，下一步应发生：${s.nextMove}` : ''}` : '',
        `最近对话：\n${chatHistory}`,
      ].filter(Boolean).join('\n\n');

      const result = await generateIsolated(userInput, settings.value.pushPrompt);
      // 旧的最新推进标记为已覆盖
      const lastAdv = advances.value[advances.value.length - 1];
      if (lastAdv && !lastAdv.resolved) lastAdv.resolved = true;

      advances.value.push({ content: result, generatedAt: Date.now(), floor: latestFloor(), resolved: false });
      if (advances.value.length > 20) advances.value = advances.value.slice(-20);

      saveToStorage();
      // 联动：结合推进推演 NPC 动向（想法/行为/暗面 + 可能行动）
      if (settings.value.npcEnabled && settings.value.npcAutoWithAdvance) {
        try { await generateNpcPlan(true, result); } catch (e: any) { console.warn('[剧情规划大师] 联动生成 NPC 动向失败:', e?.message || e); }
      }
      return result;
    } catch (e: any) {
      const msg = e?.message || String(e);
      error.value = msg;
      if (!silent) toastr.error(msg, '推进生成失败');
      return null;
    } finally {
      loading.value = false;
    }
  }

  // ---- 读取主要 NPC/同伴/英灵名单 + MVU 现状（HP/位置/状态/好感度） ----
  function readCharacterRoster(withState = false): string[] {
    const names = new Set<string>();
    const stateOf = new Map<string, string>();
    const tryRead = (key: string) => {
      try {
        let raw: any;
        const mvu = (window as any).Mvu;
        if (mvu?.getMvuData) {
          const d = mvu.getMvuData({ type: 'chat' });
          raw = d?.stat_data?.[key];
          if (!raw) {
            const d2 = mvu.getMvuData({ type: 'message', message_id: 'latest' });
            raw = d2?.stat_data?.[key];
          }
        }
        if (!raw) { const d = getVariables({ type: 'chat' }); raw = d?.stat_data?.[key]; }
        if (!raw) { const d = getVariables({ type: 'message', message_id: -1 }); raw = d?.stat_data?.[key]; }
        if (raw && typeof raw === 'object') {
          for (const k of Object.keys(raw).filter(k => k.trim())) {
            names.add(k);
            if (withState) {
              const bits: string[] = [];
              const obj = raw[k];
              if (obj && typeof obj === 'object') {
                const 基础 = obj.基础状态 || obj.基础状态面板 || {};
                if (基础?.HP || obj.HP) bits.push(`HP:${基础?.HP ?? obj.HP}`);
                const loc = obj.位置 || obj.当前位置 || 基础?.位置;
                if (loc) bits.push(`位置:${loc}`);
                const st = obj.自身状态 || 基础?.自身状态;
                if (st && typeof st === 'object' && Object.keys(st).length) bits.push(`状态:${Object.keys(st).slice(0, 4).join('/')}`);
                else if (typeof st === 'string' && st) bits.push(`状态:${st}`);
                if (obj.好感度 != null) bits.push(`好感度:${obj.好感度}`);
              }
              if (bits.length) stateOf.set(k, bits.join('，'));
            }
          }
        }
      } catch { /* 该来源不可用则跳过 */ }
    };
    tryRead('主要NPC');
    tryRead('同伴');
    tryRead('英灵');
    // 手动补充名单
    const manual = (settings.value.npcList || '')
      .split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
    manual.forEach(n => names.add(n));

    if (!withState) return Array.from(names);
    return Array.from(names).map(n => stateOf.get(n) ? `${n}（${stateOf.get(n)}）` : n);
  }

  // ---- 解析阶段检测返回的 JSON ----
  function parseStoryState(raw: string): Omit<StoryState, 'planId' | 'updatedAt'> | null {
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return null;
      const obj = JSON.parse(m[0]);
      const stage = ['起', '承', '转', '合'].includes(obj.stage) ? obj.stage as StoryState['stage'] : null;
      if (!stage) return null;
      const seq = [1, 2, 3].includes(Number(obj.sequence)) ? Number(obj.sequence) as 1 | 2 | 3 : 1;
      return {
        stage,
        sequence: seq,
        currentGoal: String(obj.currentGoal || '').trim(),
        completed: Array.isArray(obj.completed) ? obj.completed.map(String).filter(Boolean) : [],
        nextMove: String(obj.nextMove || '').trim(),
        activeConflicts: Array.isArray(obj.activeConflicts) ? obj.activeConflicts.map(String).filter(Boolean) : [],
      };
    } catch {
      return null;
    }
  }

  // ---- 节拍同步：写入 stat_data.$flags.剧情节拍（世界书 EJS 经 getvar 消费；$ 前缀 AI 不可写） ----
  async function syncBeatToMvu(s: StoryState | null) {
    if (!settings.value.beatSyncEnabled) return;
    try {
      const mvu = (window as any).Mvu;
      if (!mvu?.getMvuData || !mvu?.replaceMvuData) return;
      const opt = { type: 'message', message_id: 'latest' } as const;
      const data = mvu.getMvuData(opt);
      if (!data?.stat_data) return;
      if (!data.stat_data.$flags || typeof data.stat_data.$flags !== 'object') data.stat_data.$flags = {};
      if (s) {
        data.stat_data.$flags['剧情节拍'] = {
          阶段: s.stage,
          序列: s.sequence,
          当前目标: s.currentGoal,
          下一步: s.nextMove,
          进行中冲突: s.activeConflicts,
          更新时间: new Date(s.updatedAt).toLocaleString('zh-CN'),
        };
      } else {
        delete data.stat_data.$flags['剧情节拍'];
      }
      await mvu.replaceMvuData(data, opt);
      console.log('[剧情规划大师] 节拍已同步到 $flags.剧情节拍');
    } catch (e: any) {
      console.warn('[剧情规划大师] 节拍同步失败:', e?.message || e);
    }
  }

  // ---- 解析 NPC 动向（优先 <NPC:名> 块，其次 【名】...｜... 行） ----
  function parseNpcPlan(raw: string): NpcStagePlan[] {
    const out: NpcStagePlan[] = [];
    const blockRe = /<NPC:\s*([^>]+)>([\s\S]*?)<\/NPC>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(raw))) {
      const name = m[1].trim();
      const body = m[2];
      const field = (label: string) => {
        const r = new RegExp(`${label}[:：]\\s*([^\\n]+)`);
        const mm = body.match(r);
        return mm ? mm[1].trim() : '';
      };
      out.push({
        name,
        thought: field('想法'),
        behavior: field('行为'),
        positive: field('积极面'),
        darkSide: field('暗面') || field('阴暗面'),
        likelyAction: field('可能行动'),
      });
    }
    if (out.length === 0) {
      // 兜底：【名字】想法：...｜行为：...｜积极面：...｜暗面：...｜可能行动：...
      const lineRe = /^【(.+?)】\s*([\s\S]*?)(?=^【|$)/gm;
      let lm: RegExpExecArray | null;
      while ((lm = lineRe.exec(raw))) {
        const name = lm[1].trim();
        const body = lm[2];
        const field = (label: string) => {
          const r = new RegExp(`${label}[:：]\\s*([^｜\\n]+)`);
          const mm = body.match(r);
          return mm ? mm[1].trim() : '';
        };
        out.push({
          name,
          thought: field('想法'),
          behavior: field('行为'),
          positive: field('积极面'),
          darkSide: field('暗面') || field('阴暗面'),
          likelyAction: field('可能行动'),
        });
      }
    }
    return out.filter(n => n.name && (n.thought || n.behavior || n.positive || n.darkSide || n.likelyAction));
  }

  // ---- NPC 动向转文本（展示 / 注入） ----
  function npcPlanToText(p: NpcPlan): string {
    const lines = p.npcs.map(n => {
      const bits: string[] = [];
      if (n.thought) bits.push(`想法：${n.thought}`);
      if (n.behavior) bits.push(`行为：${n.behavior}`);
      if (n.positive) bits.push(`积极面：${n.positive}`);
      if (n.darkSide) bits.push(`阴暗面：${n.darkSide}`);
      if (n.likelyAction) bits.push(`可能行动：${n.likelyAction}`);
      return `【${n.name}】${bits.join('｜')}`;
    });
    return lines.join('\n');
  }

  // ---- 主角当前位置（在场过滤用） ----
  function readPlayerLocation(): string {
    try {
      const mvu = (window as any).Mvu;
      let stat: any;
      if (mvu?.getMvuData) {
        stat = mvu.getMvuData({ type: 'chat' })?.stat_data;
        if (!stat) stat = mvu.getMvuData({ type: 'message', message_id: 'latest' })?.stat_data;
      }
      if (!stat) stat = getVariables({ type: 'chat' })?.stat_data;
      const world = stat?.世界 || {};
      return String(world.当前地点 || world.当前位置 || '');
    } catch { return ''; }
  }

  /** 判断某 NPC 是否与主角同场景（位置字段双向包含即视为同场景；无位置数据视为在场） */
  function isOnScene(npcName: string, playerLoc: string): boolean {
    if (!playerLoc) return true;
    try {
      const mvu = (window as any).Mvu;
      let stat: any;
      if (mvu?.getMvuData) {
        stat = mvu.getMvuData({ type: 'chat' })?.stat_data;
        if (!stat) stat = mvu.getMvuData({ type: 'message', message_id: 'latest' })?.stat_data;
      }
      if (!stat) stat = getVariables({ type: 'chat' })?.stat_data;
      const findLoc = (obj: any): string => {
        if (!obj || typeof obj !== 'object') return '';
        for (const key of ['位置', '当前位置']) {
          if (typeof obj[key] === 'string' && obj[key]) return obj[key];
        }
        const 基础 = obj.基础状态 || {};
        if (typeof 基础?.位置 === 'string' && 基础.位置) return 基础.位置;
        return '';
      };
      const loc = findLoc(stat?.主要NPC?.[npcName]) || findLoc(stat?.同伴?.[npcName]) || findLoc(stat?.英灵?.[npcName]);
      if (!loc) return true; // 无数据不硬过滤，避免漏掉该出现的角色
      return loc.includes(playerLoc) || playerLoc.includes(loc);
    } catch { return true; }
  }

  /** 最新有效 NPC 动向（按名字从新到旧合并：新计划缺的角色沿用旧计划），可附带在场过滤 */
  function latestNpcByName(onSceneFilter = false): { npcs: NpcStagePlan[]; generatedAt: number } | null {
    const playerLoc = onSceneFilter ? readPlayerLocation() : '';
    const merged = new Map<string, NpcStagePlan>();
    for (const plan of [...npcPlans.value].reverse()) {
      if (plan.floor < 0) continue; // 已因回滚失效
      for (const n of plan.npcs) {
        if (!merged.has(n.name)) merged.set(n.name, n);
      }
    }
    let list = Array.from(merged.values());
    if (onSceneFilter && playerLoc) {
      list = list.filter(n => isOnScene(n.name, playerLoc));
    }
    if (list.length === 0) return null;
    return { npcs: list, generatedAt: npcPlans.value[npcPlans.value.length - 1]?.generatedAt || Date.now() };
  }

  // ---- 核心：检测当前剧情阶段（增量对照 + 写入 $flags.剧情节拍） ----
  async function detectStage(silent = false): Promise<StoryState | null> {
    if (detecting.value) return null;
    if (generationBusy.value) { if (!silent) toastr.info('酒馆正在生成回复，请稍后再试', '剧情规划大师'); return null; }
    detecting.value = true;
    error.value = null;
    try {
      const lastPlan = plans.value[plans.value.length - 1]?.content?.trim();
      if (!lastPlan) throw new Error('还没有剧情规划，请先生成规划');

      const { text: chatHistory } = readMessages(null, null);

      const prev = storyState.value;
      const prevText = prev
        ? `上次检测结果（先用最近对话校验，未变化保持原样）：\n${JSON.stringify({ stage: prev.stage, sequence: prev.sequence, currentGoal: prev.currentGoal, completed: prev.completed, nextMove: prev.nextMove, activeConflicts: prev.activeConflicts })}`
        : '';

      const result = await generateIsolated(
        [prevText, `剧情大纲：\n${lastPlan}`, `最近对话：\n${chatHistory}`].filter(Boolean).join('\n\n'),
        DETECT_STAGE_PROMPT,
      );
      const parsed = parseStoryState(result);
      if (!parsed) throw new Error('无法解析阶段检测结果，请重试');

      storyState.value = {
        ...parsed,
        planId: plans.value.length,
        updatedAt: Date.now(),
      };
      saveToStorage();
      await syncBeatToMvu(storyState.value);
      return storyState.value;
    } catch (e: any) {
      const msg = e?.message || String(e);
      error.value = msg;
      if (!silent) toastr.error(msg, '阶段检测失败');
      return null;
    } finally {
      detecting.value = false;
    }
  }

  // ---- 核心：生成 NPC 动向规划（输入带 MVU 现状） ----
  async function generateNpcPlan(silent = false, linkedAdvance = ''): Promise<NpcPlan | null> {
    if (npcLoading.value) return null;
    if (generationBusy.value) { if (!silent) toastr.info('酒馆正在生成回复，请稍后再试', '剧情规划大师'); return null; }
    npcLoading.value = true;
    error.value = null;
    try {
      const roster = readCharacterRoster(true);
      if (roster.length === 0) throw new Error('未找到主要NPC/同伴，可在设置中手动填写名单');

      const { text: chatHistory } = readMessages(null, null);

      const lastAdvance = linkedAdvance || advances.value[advances.value.length - 1]?.content?.trim() || '';
      const lastPlan = plans.value[plans.value.length - 1]?.content?.trim() || '';

      const userInput = [
        `需要推演的NPC/同伴现状：\n${roster.join('\n')}`,
        lastPlan ? `剧情大纲要点：\n${condensePlan(lastPlan)}` : '',
        lastAdvance ? `当前推进方向：\n${lastAdvance}` : '',
        `最近对话：\n${chatHistory}`,
      ].filter(Boolean).join('\n\n');

      const result = await generateIsolated(userInput, settings.value.npcPrompt);
      const npcs = parseNpcPlan(result);
      const npcPlan: NpcPlan = {
        generatedAt: Date.now(),
        linkedAdvance: lastAdvance,
        floor: latestFloor(),
        npcs: npcs.length > 0 ? npcs : [{ name: '（未解析，原文）', thought: '', behavior: '', positive: '', darkSide: '', likelyAction: result.trim() }],
      };
      npcPlans.value.push(npcPlan);
      if (npcPlans.value.length > 10) npcPlans.value = npcPlans.value.slice(-10);

      saveToStorage();
      return npcPlan;
    } catch (e: any) {
      const msg = e?.message || String(e);
      error.value = msg;
      if (!silent) toastr.error(msg, 'NPC动向生成失败');
      return null;
    } finally {
      npcLoading.value = false;
    }
  }

  // ---- 核心：整理规划（合并重复推进/节拍，修正冲突） ----
  async function consolidatePlan(silent = false): Promise<string | null> {
    if (loading.value) return null;
    if (generationBusy.value) { if (!silent) toastr.info('酒馆正在生成回复，请稍后再试', '剧情规划大师'); return null; }
    loading.value = true;
    error.value = null;
    try {
      const lastPlan = plans.value[plans.value.length - 1]?.content?.trim();
      if (!lastPlan) throw new Error('还没有剧情规划，无需整理');
      const advHistory = advances.value.slice(-10)
        .map(a => `${a.resolved ? '[已执行]' : '[待执行]'} ${a.content}`)
        .join('\n');
      const summaryCtx = readSummaryContext();

      const result = await generateIsolated(
        [
          `【既有大纲】\n${lastPlan}`,
          advHistory ? `【推进历史】\n${advHistory}` : '',
          summaryCtx.unresolved ? `【未解决问题】\n${summaryCtx.unresolved}` : '',
        ].filter(Boolean).join('\n\n'),
        CONSOLIDATE_PROMPT,
      );

      plans.value.push({ content: result, generatedAt: Date.now(), coverage: plans.value[plans.value.length - 1]?.coverage || null, stale: false });
      if (plans.value.length > 20) plans.value = plans.value.slice(-20);
      // 节拍指针关联新大纲，提示重新检测
      if (storyState.value) storyState.value.planId = plans.value.length;
      saveToStorage();
      if (!silent) toastr.success('规划已整理', '剧情规划大师');
      return result;
    } catch (e: any) {
      const msg = e?.message || String(e);
      error.value = msg;
      if (!silent) toastr.error(msg, '整理规划失败');
      return null;
    } finally {
      loading.value = false;
    }
  }

  // ---- 大纲压缩（注入/输入复用：按起承转合各取骨架） ----
  function condensePlan(raw: string, maxLen = 500): string {
    if (!raw || raw.length <= maxLen) return raw;
    const stages = ['起', '承', '转', '合'];
    const lines: string[] = [];
    let found = false;
    for (const stage of stages) {
      const re = new RegExp(`${stage}[（(][^)）]*[)）]?[\\s\\S]*?(?=${stages.map(s => s + '[（(]').join('|')}|$)`, 'g');
      const m = raw.match(re);
      if (m && m[0]) {
        const trimmed = m[0].replace(/\n+/g, ' ').trim();
        lines.push(trimmed.length > 120 ? trimmed.slice(0, 120) + '…' : trimmed);
        found = true;
      }
    }
    if (found && lines.length > 0) return lines.join('\n');
    return raw.slice(0, maxLen) + '…';
  }

  // ---- 自动生成 ----
  let autoListener: { stop: () => void } | null = null;

  /** 启动/停止自动监听。只要 plan 或 advance 任一开启就启动监听，各自独立计数。 */
  function refreshAutoListener() {
    const shouldListen = settings.value.autoGenerate || settings.value.autoAdvance;
    if (autoListener && !shouldListen) {
      autoListener.stop();
      autoListener = null;
      autoCounter.value = 0;
      advanceCounter.value = 0;
    }
    if (!autoListener && shouldListen) {
      autoCounter.value = 0;
      advanceCounter.value = 0;
      try {
        autoListener = eventOn(tavern_events.MESSAGE_RECEIVED, async () => {
          // 酒馆主生成进行中则跳过本轮计数（防与主生成抢接口）
          if (generationBusy.value) return;

          // 规划计数器（每 autoInterval 楼触发一次）
          if (settings.value.autoGenerate) {
            autoCounter.value++;
            if (autoCounter.value >= settings.value.autoInterval) {
              autoCounter.value = 0;
              await generatePlan(true);
            }
          }

          // 推进计数器（每 advanceInterval 楼触发一次，独立于规划）
          if (settings.value.autoAdvance) {
            advanceCounter.value++;
            const advInterval = settings.value.advanceInterval || 5;
            if (advanceCounter.value >= advInterval) {
              advanceCounter.value = 0;
              await generateAdvance(true);
            }
          }

          saveToStorage();
        });
      } catch (e: any) {
        console.warn('[剧情规划大师] 自动监听失败:', e?.message || e);
        settings.value.autoGenerate = false;
        settings.value.autoAdvance = false;
      }
    }
    saveToStorage();
  }

  function setGenerationBusy(busy: boolean) {
    generationBusy.value = busy;
  }

  function setAutoGenerate(enabled: boolean) {
    settings.value.autoGenerate = enabled;
    refreshAutoListener();
  }

  function setAutoAdvance(enabled: boolean) {
    settings.value.autoAdvance = enabled;
    refreshAutoListener();
  }

  function updateSettings(patch: Partial<PlannerSettings> = {}) {
    settings.value = { ...settings.value, ...patch };
    saveToStorage();
    if ('autoGenerate' in patch || 'autoAdvance' in patch || 'autoInterval' in patch || 'advanceInterval' in patch) {
      refreshAutoListener();
    }
  }

  function resetSystemPrompt() {
    settings.value.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    saveToStorage();
  }

  function resetPushPrompt() {
    settings.value.pushPrompt = DEFAULT_PUSH_PROMPT;
    saveToStorage();
  }

  function resetNpcPrompt() {
    settings.value.npcPrompt = DEFAULT_NPC_PROMPT;
    saveToStorage();
  }

  // ---- 初始化 ----
  try {
    loadFromStorage();
    if (settings.value.autoGenerate) setAutoGenerate(true);
    if (settings.value.autoAdvance) setAutoAdvance(true);
  } catch (e: any) {
    console.warn('[剧情规划大师] 初始化失败:', e?.message || e);
  }

  return {
    settings,
    plans,
    advances,
    storyState,
    npcPlans,
    loading,
    error,
    detecting,
    npcLoading,
    consolidating,
    generationBusy,
    modelList,
    fetchingModels,
    fetchModels,
    generatePlan,
    generateAdvance,
    detectStage,
    generateNpcPlan,
    consolidatePlan,
    latestNpcByName,
    setSummaryProvider,
    setGenerationBusy,
    invalidateCoverage,
    resetForNewChat,
    updateSettings,
    setAutoGenerate,
    setAutoAdvance,
    resetSystemPrompt,
    resetPushPrompt,
    resetNpcPrompt,
  };
});
