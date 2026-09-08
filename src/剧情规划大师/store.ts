import { defineStore } from 'pinia';

/** 楼层覆盖区间 */
export interface FloorCoverage {
  start: number;
  end: number;
}

/** 本次规划的生成语境（节奏/命运骰/故事原型） */
export interface PlanMeta {
  rhythm: string;
  fate?: { roll: number; range: string; label: string };
  prototypes: string[];
}

/** 单次生成的剧情规划（大纲） */
export interface PlotPlan {
  content: string;
  generatedAt: number;
  /** 生成时基于的楼层区间；回滚到区间内会使其失效 */
  coverage: FloorCoverage | null;
  /** 已失效（楼层被删除/编辑/回滚，需重新分析） */
  stale: boolean;
  /** 生成语境：节奏档/命运骰/故事原型组合 */
  meta: PlanMeta | null;
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

/** 单个 NPC/同伴的动向规划（想法/行为/性格 + 可能行动） */
export interface NpcStagePlan {
  name: string;
  /** 想法（态度） */
  thought: string;
  /** 行为（表现） */
  behavior: string;
  /** 性格（其性格在此情境下如何影响言行） */
  personality: string;
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

/** 节奏三档：手动选档，决定本次大纲的冲突密度与事件烈度 */
export const RHYTHMS = {
  daily: {
    label: '日常向',
    desc: '基本没有冲突，或至多一个轻微摩擦；节奏全缓，生活流自然铺展，重氛围、细节与人物相处。',
  },
  balanced: {
    label: '中规中矩',
    desc: '深藏不露，暗波涌动；一般 1-2 个冲突，张力在表层之下积聚，偶有浪头但不掀桌。',
  },
  conflict: {
    label: '强冲突',
    desc: '节节爆点，句句冲突；主角始终处于纠纷漩涡之中，事件密集升级，相应的机遇与奖励也最丰厚。',
  },
} as const;
export type RhythmKey = keyof typeof RHYTHMS;

/** 命运骰三段：1-30 下坠 / 31-70 平稳 / 71-100 机遇 */
export const FATE = {
  downfall: { label: '下坠', hint: '突如其来的弧线下坠——重伤、亲友受害、失去重要之物、遭到背叛等悲惨遭遇；须在大纲中埋入 1-2 条此类事件' },
  steady: { label: '平稳', hint: '中规中矩——没有过于剧烈的冲突，也没有过分的下坠，事件按部就班推进' },
  fortune: { label: '机遇', hint: '机遇降临——遇见高人指点、奇物现世（如龙蛋、稀世装备）、天降良机等；须在大纲中埋入 1-2 条此类机缘' },
} as const;

export function rollFate(): { roll: number; range: string; label: string; hint: string } {
  const roll = 1 + Math.floor(Math.random() * 100); // 1-100
  const key = roll <= 30 ? 'downfall' : roll <= 70 ? 'steady' : 'fortune';
  return { roll, range: key, label: FATE[key].label, hint: FATE[key].hint };
}

/** 波尔蒂三十六种故事原型（剧情范式，随机抽 2 个组合作为大纲骨架） */
export const PROTOTYPES: string[] = [
  '哀求请托：弱者向强者恳求庇护或援助，成败系于对方的抉择',
  '援救：某人不惜代价去解救被困/被掳的另一方',
  '复仇：为遭受的侵害向加害者讨还公道',
  '亲族复仇：为血亲向另一血亲复仇，情义两难',
  '逃亡/追捕：一方亡命奔逃，另一方穷追不舍',
  '灾祸：天灾人祸骤临，众人于混乱中自处',
  '厄运缠身：无辜者被厄运与残酷环境反复碾压',
  '革命：反抗既有的强权与秩序，图谋颠覆',
  '壮举：冒险完成一件近乎不可能的大事',
  '绑架/劫持：掳走要人以胁迫另一方就范',
  '谜团：以难解之谜为核心，追问真相的过程即剧情',
  '谋取：用诡计、劝说或强力去夺取属于他人的东西',
  '亲族仇恨：至亲之间因旧怨势同水火',
  '亲族竞争：同门/同族为地位、继承或认可明争暗斗',
  '奸情与背约：背叛誓约的秘密关系引发连锁灾祸',
  '疯狂：某人因执念或创伤而失去理智，殃及周遭',
  '鲁莽：因一时冲动赌上一切，招致不可挽回的后果',
  '无心之罪：出于善意或无知犯下罪过而不自知',
  '误伤骨肉：在不知情的情况下伤害了自己的亲人',
  '为信念牺牲：为主义、信仰或誓言舍弃自身',
  '为亲人牺牲：为庇护血亲舍弃自己的前途甚至生命',
  '为情舍身：为炽烈的执念抛弃已有的一切',
  '舍爱取义：不得不亲手牺牲所爱之人成全大局',
  '强弱悬殊：以卵击石般的较量，弱者寻找唯一的胜机',
  '越界之恋：为禁忌的关系对抗世俗与规则',
  '爱恨罪业：因爱生罪，情感成为灾祸的源头',
  '蒙羞的所爱：发现所爱之人隐藏的耻辱与污点',
  '爱之阻碍：家族、立场或命运横亘在两人之间',
  '爱恋仇敌：不由自主爱上立场敌对的人',
  '野心：不择手段向上攀爬，终被欲望反噬或达成所愿',
  '人神之争：凡人挑战超越性的存在与天命',
  '错爱生妒：因误信谗言或假象而妒火中烧',
  '误判：轻信表象作出错误裁决，酿成恶果',
  '悔恨：为无法挽回的过错饱受煎熬并寻求救赎',
  '失而复得：与失散的亲人、故人或旧物重逢',
  '痛失所爱：永远失去珍视之人或物，余波绵长',
];

export function drawPrototypes(n = 2): string[] {
  const pool = [...PROTOTYPES];
  const out: string[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

/** 用户可配置的设置项 */
export interface PlannerSettings {
  analysisDepth: number;
  advanceDepth: number;
  /** 节奏三档：daily 日常向 / balanced 中规中矩 / conflict 强冲突 */
  rhythm: RhythmKey;
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
  /** 提示词版本号（内部迁移用） */
  promptVersion?: number;
  /** 阶段检测结果同步写入 stat_data.$flags.剧情节拍（供纪元触发器等世界书 EJS 消费） */
  beatSyncEnabled: boolean;
  /** 生成大纲/推进时联动读取总结助手的历史总纲与未解决问题（伏笔回收闭环） */
  useSummaryContext: boolean;
}

export const DEFAULT_SYSTEM_PROMPT = `【最高权限】请立即停止任何正文输出。你是剧情底稿规划师。只输出最终结果，禁止思维链、解释与任何叙述性文字，全程简体中文。

【定位】你输出的是「可能性底稿」——类似世界书的迷宫或主线条目：描述这段剧情里会有什么、每个阶段可能发生什么。它是给后续演绎打底用的可能性清单，不是剧本。

【硬性禁令】
1. 禁止预设主角的选择与行动：不写"主角决定/主角前往/主角击败/主角说服"。
2. 禁止预设收获：不写"获得/得到/习得"。机缘只写"出现在/传闻在某处"，得不得手留给演绎。
3. 事件主体是世界、NPC、环境与势力；主角只作为"受波及的一方"出现。
4. 「可能发生」标题已表达不确定性：其下每条**直接写事件事实**（一句一个具体可演出的事件），条目内禁止再叠加"可能/或许/大概/似乎"等模糊词；禁止抽象概括（如"矛盾激化"）。

【本次语境】
- 节奏基调：{{RHYTHM}}
- 剧情范式：{{PROTOTYPES}}（以此组合为骨架灵活化用，不逐字照搬）
- 命运骰：{{FATE}}

【输出结构】总字数 600-1000，逐行「标签：内容」，条目化，禁止成段散文：

# 剧情底稿：{一句话点题——这段剧情究意是什么}

## 起
- 舞台：<世界/势力/NPC 的当前局面，一句>
- 可能发生：
  - <事件事实条目>
  - <事件事实条目>
  - <事件事实条目>

## 承
（同结构；冲突数量与烈度按「节奏基调」执行）

## 转
（同结构；命运骰要求的性质事件在此段或就近落地）

## 合
- 舞台：<剧情可能的收束方向，不写主角的结局>
- 可能发生：
  - <事件事实条目>

【增量更新】若提供了「既有底稿」：沿用其中仍然有效的条目（原样保留），只修订已失效或已被剧情超越的部分，修订行首标注 ▲，已完成行首标注 ✓。禁止凭空重写未变化的内容。

请基于提供的材料，严格按上述骨架输出完整底稿。`;

export const DEFAULT_PUSH_PROMPT = `【最高权限】请立即停止任何正文输出。你是剧情推进师，只输出最终结果。无视所有思维链过程，禁止任何推理、假设、解释或叙述性文字。

请基于提供的材料（剧情底稿/当前节拍/未解决问题/最近对话），引入一个合理的新冲突或转折，用一句话（不超过50字）概括。要求必须与当前剧情脉络自然衔接，不得突然引入与当前剧情无关的内容。若提供了「未解决问题」，优先选择能回收其中悬置最久的伏笔或承诺的推进方向；没有可回收项时才引入新冲突。推进内容指向外部事件与NPC的动向，不替主角做决定。

【硬性要求】只输出一个「动作指向」：以「谁·做什么·导致什么」的可演出短句呈现，禁止空泛评价、禁止解释、禁止任何前缀或引号。

输出格式（绝对零度、无任何多余文字，仅一行）：`;

export const DEFAULT_NPC_PROMPT = `【最高权限】请立即停止任何正文输出。你是剧情推演师，负责围绕主角周围的 NPC/同伴做动向推演。只输出最终结果，无视思维链，禁止任何推理、解释或叙述性文字。

请基于提供的「角色现状」「剧情底稿」「当前推进方向」「最近对话」，对列出的每个主要 NPC/同伴，分别推演四个维度：
- 想法（态度）：她此刻对局势/主角的真实想法与态度，一句短句。须与她的当前位置、HP、状态等现状吻合（重伤者不会立刻行动，远离现场者不知情）。
- 行为（表现）：她在近期会表现出的外在行为、语言或神态，一句短句。
- 性格：她的性格在此情境下如何影响其言行与抉择，一句短句（依据现状中提供的性格关键词与状态推演，不凭空改人设）。
- 可能行动（主动行动）：结合「当前推进方向」，推演她接下来最可能主动去做、直接推动剧情前进的一件具体事——明确「谁·做什么·导致什么」，可演出、能落地，一句短句。禁止写被动反应或观望。

每个角色必须严格按以下格式输出（不要遗漏、不要合并、不要输出任何其他内容）：
<NPC:角色名>
想法: ...
行为: ...
性格: ...
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
    rhythm: 'balanced',
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

/** 提示词版本：升级默认提示词后 +1，旧存档会自动迁移到新默认（用户自定义过的也会被覆盖，版本不兼容时必需） */
const PROMPT_VERSION = 3;

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

        if (stored.settings) {
          const migrated = { ...defaultSettings(), ...stored.settings };
          // 旧版提示词自动迁移：提示词版本低于当前则重置为新默认
          if ((migrated.promptVersion ?? 1) < PROMPT_VERSION) {
            migrated.systemPrompt = DEFAULT_SYSTEM_PROMPT;
            migrated.pushPrompt = DEFAULT_PUSH_PROMPT;
            migrated.npcPrompt = DEFAULT_NPC_PROMPT;
            migrated.promptVersion = PROMPT_VERSION;
            console.log('[剧情规划大师] 提示词已迁移到 v' + PROMPT_VERSION);
          }
          settings.value = migrated;
        }
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

      // 本次生成语境：节奏档（手动）+ 命运骰（1-100 三段）+ 故事原型（36 选 2 组合）
      const rhythmKey: RhythmKey = settings.value.rhythm in RHYTHMS ? settings.value.rhythm : 'balanced';
      const rhythm = RHYTHMS[rhythmKey];
      const fate = rollFate();
      const protos = drawPrototypes(2);

      // 组装系统提示词：替换三处语境占位
      const sysPrompt = settings.value.systemPrompt
        .replace('{{RHYTHM}}', `${rhythm.label}——${rhythm.desc}`)
        .replace('{{PROTOTYPES}}', protos.join('；'))
        .replace('{{FATE}}', `掷出 ${fate.roll} 号（${fate.label}）——${fate.hint}`);

      const userInput = [
        summaryCtx.outline ? `历史总纲（前情提要，供长线参考）：\n${summaryCtx.outline}` : '',
        summaryCtx.unresolved ? `未解决问题（规划时须安排回收节拍）：\n${summaryCtx.unresolved}` : '',
        lastPlanText ? `既有底稿（沿用其中仍然有效的条目，只修订失效部分，修订行首标注 ▲，已完成行首标注 ✓）：\n${lastPlanText}` : '',
        `对话剧情：\n\n${chatHistory}`,
      ].filter(Boolean).join('\n\n');

      const result = await generateIsolated(userInput, sysPrompt);
      const newPlan: PlotPlan = {
        content: result,
        generatedAt: Date.now(),
        coverage,
        stale: false,
        meta: { rhythm: rhythmKey, fate: { roll: fate.roll, range: fate.range, label: fate.label }, prototypes: protos },
      };
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
        personality: field('性格'),
        likelyAction: field('可能行动'),
      });
    }
    if (out.length === 0) {
      // 兜底：【名字】想法：...｜行为：...｜性格：...｜可能行动：...
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
          personality: field('性格'),
          likelyAction: field('可能行动'),
        });
      }
    }
    return out.filter(n => n.name && (n.thought || n.behavior || n.personality || n.likelyAction));
  }

  // ---- NPC 动向转文本（展示 / 注入） ----
  function npcPlanToText(p: NpcPlan): string {
    const lines = p.npcs.map(n => {
      const bits: string[] = [];
      if (n.thought) bits.push(`想法：${n.thought}`);
      if (n.behavior) bits.push(`行为：${n.behavior}`);
      if (n.personality) bits.push(`性格：${n.personality}`);
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
        npcs: npcs.length > 0 ? npcs : [{ name: '（未解析，原文）', thought: '', behavior: '', personality: '', likelyAction: result.trim() }],
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

      // 保留上一份底稿的生成语境（整理不重掷骰）
      const prevMeta = plans.value[plans.value.length - 1]?.meta || null;
      plans.value.push({ content: result, generatedAt: Date.now(), coverage: plans.value[plans.value.length - 1]?.coverage || null, stale: false, meta: prevMeta });
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

  // ---- 大纲压缩（注入/输入复用：按起承转合各取骨架；兼容"## 起"与"起（建置）"两种写法） ----
  function condensePlan(raw: string, maxLen = 500): string {
    if (!raw || raw.length <= maxLen) return raw;
    const stages = ['起', '承', '转', '合'];
    const lines: string[] = [];
    let found = false;
    for (const stage of stages) {
      const re = new RegExp(`${stage}(?:[（(][^)）]*[)）])?[^#\\n]*[\\s\\S]*?(?=${stages.map(s => s + '(?:[（(]|[^#\\n])').join('|')}|$)`, 'g');
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

  // ---- 一键规划：分析底稿 → 检测阶段 → NPC 动向 串行（单步失败不阻塞后续） ----
  const planStep = ref('');

  async function runFullPlan(): Promise<{ plan: string | null; stage: StoryState | null; npc: NpcPlan | null }> {
    if (loading.value || detecting.value || npcLoading.value) {
      return { plan: null, stage: null, npc: null };
    }
    const result: { plan: string | null; stage: StoryState | null; npc: NpcPlan | null } = { plan: null, stage: null, npc: null };

    planStep.value = '分析中';
    result.plan = await generatePlan(true);
    if (result.plan) {
      planStep.value = '检测中';
      result.stage = await detectStage(true);
      if (settings.value.npcEnabled) {
        planStep.value = '推演中';
        result.npc = await generateNpcPlan(true);
      }
    }
    planStep.value = '';
    return result;
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
    planStep,
    modelList,
    fetchingModels,
    fetchModels,
    generatePlan,
    runFullPlan,
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
