import { klona } from 'klona';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { z } from 'zod/v4';

// ============================================================
// 双轨结构化总结提示词（参考 yuzuki-Memory 记忆总结）
// - 主线按日期归档；支线按核心角色归档
// - 客观记录协议 + 时空聚合 + 未解决问题
// ============================================================
const SUMMARY_PROMPT = `你是"伊瑟利亚档案员"，一名严谨的历史记录者。现在请停止角色扮演，将下方对话正文转化为结构化的剧情档案。

【最高级禁令：客观记录，严禁主观臆断与抽象描述】
1. 绝对禁止心理分析：严禁使用"宣示主权""占有欲爆发""试图控制"等心理动机或抽象定性词汇，只记录客观行为与言行。
   错误："A向B宣示主权" → 正确："A搂住B的腰，并对C说B是他的女友"
2. 绝对禁止概括性动词：严禁用"言语挑衅""出言安抚""提供帮助""进行教导""予以安慰"代替内容，必须概括说话的核心信息或具体意图。
   错误："A用言语挑衅B" → 正确："A嘲讽B实际上是私生子"
3. 绝对禁止模糊指代：严禁用"那个秘密""真相""把柄""条件""承诺"等笼统词，必须展开写明具体内容。
   错误："A用把柄威胁B，B同意了条件" → 正确："A用[B私吞公款的账本]威胁B，B同意[协助A运送私盐]的条件"
4. 忽略无剧情推动作用的流水账（如菜单描述、普通起居）。强制保留：口头承诺、交易约定、具体条件、关键冲突、重要决策、剧烈情感波动。

【防遗忘协议】
1. 在场人员全记录：事件必须在地点后或描述中写明谁在场（含配角），防止"幽灵角色"或"凭空消失"。
2. 前因后果闭环：每条记录必须包含 起因(具体) -> 经过(含在场者/具体手段) -> 结果(具体)。
3. 状态覆盖原则：身份/关系/状态变化必须体现"新状态覆盖旧状态"，用"从此开始""不再是"等定性词。
4. 关键变动追踪：状态突变（怀孕/死亡/失忆/恢复）、关系逆转（结盟/决裂/恋爱/背叛）必须记录在发生的时间点上。

【时空聚合规则】
1. 同地点+连续时间内的连续剧情必须合并成唯一一段，只写"开始时间-结束时间"，严禁逐楼流水账式罗列。
2. 一个连贯事件跨越多个回合时（如A邀请→穿插其他→B接受），必须跨回合提取合并为一段完整剧情。
3. 主线和支线严禁记录同一事件，同一事件只能归入一条线。

【双轨归档】
1. 主线（按日期归档）：只记录主角与用户/主角团之间的直接互动核心。
2. 支线（按核心角色归档）：记录与单个 NPC/同伴/配角相关的互动或独立行动。一个角色一段。
3. 格式：
   【主线总结】
   YYYY年MM月DD日,HH:mm-HH:mm [地点] 事件（必须包含导致的状态/关系变更结果）
   同日后续段落只写 HH:mm-HH:mm；跨天再写新日期。
   【支线总结：角色名】
   HH:mm-HH:mm [地点] 事件（必须包含导致的状态/关系变更结果）
4. 支线标题角色名只能写一个具体角色名，严禁写组织名、势力名、事件名或多个角色名。若该角色已存在于【已有支线核心角色】，必须复用原名，禁止改写成别名、称号或简称。

【已有支线核心角色】
{{BRANCH_NAMES}}

【未解决问题】
最后用单独分块列出当前悬而未决、影响后续剧情走向的具体问题（伏笔、约定、待追查的线索、未兑现的承诺等），没有则写"无"：
【未解决问题】
- ...

【输出硬性要求】
只输出 <Memory>...</Memory>，不要解释、不要 Markdown。标签外不要输出任何内容。
总结正文是纯文本，不加粗、不用列表符号（未解决问题分块除外，可用"- "）。`;

const BIG_SUMMARY_PROMPT = `你是"伊瑟利亚档案员"，一名严谨的历史记录者。请将下面提供的多段剧情总结合并压缩为一份完整的历史总纲。

【要求】
1. 合并重复事件，删除重复表达，但不得删除会影响后续剧情连续性的事实。
2. 修正明显冲突，统一角色称呼、地点名称、时间顺序和状态变化。
3. 保留所有关键事实：身份/关系/状态变化、承诺/交易条件、物品流转、未解决问题。
4. 严禁编造原文没有依据的新剧情、心理动机或未来发展。
5. 保持双轨结构：主线按日期、支线按核心角色，格式与总结一致。
6. 未解决问题单独分块列出，没有则写"无"。

【输出硬性要求】
只输出 <Memory>...</Memory>，不要解释、不要 Markdown。标签外不要输出任何内容。`;

const SettingsSchema = z.object({
  /** 每次总结分析的楼层数 */
  analysisDepth: z.number().default(20),
  /** 自定义 API 地址（留空使用酒馆默认） */
  apiUrl: z.string().default(''),
  /** API 密钥 */
  apiKey: z.string().default(''),
  /** 自定义模型名 */
  model: z.string().default(''),
  /** 总结提示词 */
  systemPrompt: z.string().default(SUMMARY_PROMPT),
  /** 是否启用自动小总结 */
  autoGenerate: z.boolean().default(false),
  /** 自动小总结间隔楼层数 */
  autoInterval: z.number().default(20),
  /** 是否启用逐层增量总结：每次只总结当前批次，不重述历史 */
  incrementalMode: z.boolean().default(true),
  /** 是否启用自动大总结（历史总纲） */
  bigGenerate: z.boolean().default(false),
  /** 自动大总结间隔楼层数 */
  bigInterval: z.number().default(100),
  /** 调度模式：silent 静默执行 / confirm 执行前确认 */
  autoRunMode: z.enum(['silent', 'confirm']).default('silent'),
  /** 总结后是否隐藏已总结楼层 */
  hideFloors: z.boolean().default(false),
  /** 隐藏延迟楼层：隐藏指针落后总结指针 N 楼，最近 N 楼原文对 AI 保持可见（0=总结即隐藏） */
  hideDelay: z.number().default(0),
  /** 是否联动剧情规划（当前节拍 + NPC 名单进入总结/注入） */
  plannerLink: z.boolean().default(true),
  /** 聊天文件名后缀（保留字段） */
  worldbookSuffix: z.string().default(''),
});

type Settings = z.infer<typeof SettingsSchema>;

/** 总结块类型：主线 / 支线 */
export type SummaryBlockKind = 'main' | 'branch';

/** 当前生效的结构化总结块（主线一条 + 支线按角色各一条） */
export interface SummaryBlock {
  id: string;
  kind: SummaryBlockKind;
  /** 支线核心角色名（主线为空） */
  character: string;
  /** 累积正文 */
  content: string;
  /** 未解决问题（累积去重） */
  unresolved: string;
  floorStart: number;
  floorEnd: number;
  updatedAt: number;
}

/** 历史大总结（总纲） */
export interface BigSummary {
  id: string;
  floorStart: number;
  floorEnd: number;
  /** 主线总纲 */
  main: string;
  branches: { character: string; content: string; unresolved: string }[];
  unresolved: string;
  generatedAt: number;
}

/** 小总结日志（仅 UI 展示） */
export interface SmallSummaryLog {
  floorStart: number;
  floorEnd: number;
  preview: string;
  branchCount: number;
  generatedAt: number;
}

/** 外部上下文提供者（剧情规划联动），phase: summarize=总结时 / inject=注入时 */
export type SummaryContextProvider = (phase: 'summarize' | 'inject') => string;

const STORAGE_KEY = 'isuria_summary_data';

export const useSummaryStore = defineStore('summary', () => {
  // === 设置 ===
  const settings = ref<Settings>(SettingsSchema.parse({}));

  // === 状态 ===
  const loading = ref(false);
  const bigLoading = ref(false);
  const error = ref<string | null>(null);
  /** 当前生效总结块（主线 + 支线） */
  const blocks = ref<SummaryBlock[]>([]);
  /** 历史大总结（总纲） */
  const bigSummaries = ref<BigSummary[]>([]);
  /** 小总结日志 */
  const smallLog = ref<SmallSummaryLog[]>([]);
  /** 指针：summary=小总结 / big=大总结 */
  const pointers = ref({ summary: 0, big: 0 });
  const modelList = ref<string[]>([]);
  const fetchingModels = ref(false);
  /** 当前绑定的聊天 ID，用于检测聊天切换 */
  const currentChatId = ref<string>('');
  /** 剧情规划联动上下文提供者 */
  let contextProvider: SummaryContextProvider | null = null;

  // === 工具 ===
  function uid(): string {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeName(value: string): string {
    return String(value || '').normalize('NFKC').replace(/\s+/g, '').trim().toLowerCase();
  }

  // === 解析 <Memory> 双轨分块（主线 / 支线：角色名 / 未解决问题） ===
  function parseSummaryBlocks(content: string): { blocks: { kind: SummaryBlockKind; character: string; content: string }[]; unresolved: string } {
    const mem = String(content || '').match(/<Memory>([\s\S]*?)<\/Memory>/i);
    let body = mem ? mem[1].trim() : String(content || '').trim();
    if (!body) return { blocks: [], unresolved: '' };

    // 先提取并移除【未解决问题】分块
    const unresolvedRe = /【\s*未解决问题\s*】([\s\S]*?)(?=【\s*(?:主线总结|支线总结|未解决问题)\s*】|$)/;
    let unresolved = '';
    const uMatch = body.match(unresolvedRe);
    if (uMatch) {
      unresolved = uMatch[1].replace(/^[-\s*]+/gm, '').trim();
      body = body.slice(0, uMatch.index) + body.slice(uMatch.index + uMatch[0].length);
    }

    const headingPattern = /【\s*(主线总结|支线总结)\s*(?:[:：\-－—]\s*([^】]+?))?\s*】/g;
    const matches = [...body.matchAll(headingPattern)];
    const blocks: { kind: SummaryBlockKind; character: string; content: string }[] = [];
    if (matches.length) {
      matches.forEach((m, i) => {
        const start = m.index + m[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
        const kindLabel = m[1];
        const character = String(m[2] || '').trim();
        const text = body.slice(start, end).trim();
        if (kindLabel.includes('支线')) {
          if (character && text) blocks.push({ kind: 'branch', character, content: text });
        } else if (text) {
          blocks.push({ kind: 'main', character: '', content: text });
        }
      });
    } else if (body.trim().length > 5) {
      // 兜底：无分块标题，整体当作主线
      blocks.push({ kind: 'main', character: '', content: body.trim() });
    }
    return { blocks, unresolved };
  }

  // === 未解决问题合并去重 ===
  function mergeUnresolved(oldU: string, newU: string): string {
    const seen = new Set<string>();
    const out: string[] = [];
    [oldU, newU].forEach(text => {
      String(text || '').split(/\n+/).map(l => l.replace(/^[-\s*]+/, '').trim()).filter(Boolean).forEach(l => {
        if (!seen.has(l)) { seen.add(l); out.push(l); }
      });
    });
    return out.join('\n');
  }

  // === 生成精简上下文：仅保留最新摘要片段，避免每次把历史全部再重述 ===
  function buildIncrementalContext(): string {
    const lines: string[] = [];
    const main = blocks.value.find(b => b.kind === 'main');
    if (main) {
      const text = String(main.content || '').trim();
      const snippets = text.split(/\n{2,}/).filter(Boolean).slice(-3);
      if (snippets.length) {
        lines.push(`【主线摘要（仅供背景）】\n${snippets.join('\n\n').slice(0, 1400)}`);
      }
      if (main.unresolved) lines.push(`【未解决问题（背景）】\n${main.unresolved}`);
    }
    const branches = blocks.value.filter(b => b.kind === 'branch').slice(0, 6);
    for (const br of branches) {
      const text = String(br.content || '').trim();
      const snippets = text.split(/\n{2,}/).filter(Boolean).slice(-2);
      if (snippets.length) {
        lines.push(`【支线摘要：${br.character}】\n${snippets.join('\n\n').slice(0, 900)}`);
      }
    }
    return lines.join('\n\n');
  }

  // === 将解析出的分块合并进 blocks（主线累加 / 支线按角色归组） ===
  function applyBlocks(
    parsed: { kind: SummaryBlockKind; character: string; content: string }[],
    unresolved: string,
    start: number,
    end: number,
  ): void {
    const now = Date.now();
    for (const pb of parsed) {
      if (pb.kind === 'main') {
        let b = blocks.value.find(x => x.kind === 'main');
        if (!b) {
          b = { id: uid(), kind: 'main', character: '', content: '', unresolved: '', floorStart: start, floorEnd: end, updatedAt: now };
          blocks.value.unshift(b);
        }
        b.content = b.content ? `${b.content}\n\n${pb.content}` : pb.content;
        b.floorStart = Math.min(b.floorStart, start);
        b.floorEnd = Math.max(b.floorEnd, end);
        b.updatedAt = now;
      } else {
        let b = blocks.value.find(x => x.kind === 'branch' && normalizeName(x.character) === normalizeName(pb.character));
        if (!b) {
          b = { id: uid(), kind: 'branch', character: pb.character, content: '', unresolved: '', floorStart: start, floorEnd: end, updatedAt: now };
          blocks.value.push(b);
        }
        b.content = b.content ? `${b.content}\n\n${pb.content}` : pb.content;
        b.floorStart = Math.min(b.floorStart, start);
        b.floorEnd = Math.max(b.floorEnd, end);
        b.updatedAt = now;
      }
    }
    if (unresolved) {
      const main = blocks.value.find(x => x.kind === 'main');
      if (main) main.unresolved = mergeUnresolved(main.unresolved, unresolved);
    }
  }

  // === 把 blocks 渲染为文本（总结输入 / 注入） ===
  function summarizeBlocksText(bs: SummaryBlock[], intro = ''): string {
    const lines: string[] = [];
    if (intro) lines.push(intro);
    const mains = bs.filter(b => b.kind === 'main');
    const branches = bs.filter(b => b.kind === 'branch');
    for (const m of mains) {
      lines.push(`【主线总结】\n${m.content}`);
      if (m.unresolved) lines.push(`【未解决问题】\n${m.unresolved}`);
    }
    for (const br of branches) {
      lines.push(`【支线总结：${br.character}】\n${br.content}`);
      if (br.unresolved) lines.push(`【未解决问题】\n${br.unresolved}`);
    }
    return lines.join('\n\n');
  }

  // === 从 API 获取模型列表 ===
  async function fetchModels(): Promise<void> {
    const url = settings.value.apiUrl;
    const key = settings.value.apiKey;
    if (!url) {
      toastr.warning('请先填写 API 地址', '总结助手');
      return;
    }
    fetchingModels.value = true;
    try {
      const baseUrl = url.replace(/\/+$/, '');
      const modelsUrl = `${baseUrl}/models`;
      const response = await fetch(modelsUrl, {
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
        toastr.info('API 返回了空的模型列表', '总结助手');
      } else {
        toastr.success(`获取到 ${models.length} 个模型`, '总结助手');
      }
      // 如果当前选中的模型不在列表中，清空
      if (settings.value.model && !models.includes(settings.value.model)) {
        settings.value.model = '';
        saveToVariables();
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      toastr.error(`获取模型列表失败: ${msg}`, '总结助手');
      modelList.value = [];
    } finally {
      fetchingModels.value = false;
    }
  }

  // === 当前已覆盖到的楼层（指针） ===
  function getLastCovered(): number {
    return pointers.value.summary;
  }

  // === 剧情规划联动上下文提供者（由功能整合悬浮窗注入） ===
  function setContextProvider(fn: SummaryContextProvider | null): void {
    contextProvider = fn;
  }

  function buildPlannerContext(phase: 'summarize' | 'inject'): string {
    try {
      if (!settings.value.plannerLink || !contextProvider) return '';
      return contextProvider(phase);
    } catch {
      return '';
    }
  }

  // === busy 检测：生成中/流式/输入中则跳过自动任务 ===
  function isBusy(): boolean {
    const w = window as any;
    if (w.is_send_press === true || w.isStreaming === true || w.isGenerating === true) return true;
    try {
      const ctx = w.SillyTavern?.getContext?.();
      if (ctx?.is_send_press === true || ctx?.isStreaming === true || ctx?.generationStarted === true) return true;
    } catch {}
    const active = document.activeElement;
    if (active && active !== document.body) {
      const tag = String(active.tagName || '').toLowerCase();
      if (tag === 'textarea') return true;
      if (tag === 'input') {
        const type = String((active as HTMLInputElement).type || 'text').toLowerCase();
        if (!['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(type)) return true;
      }
      if ((active as any).isContentEditable === true) return true;
    }
    return false;
  }

  // === 隐藏已总结楼层 ===
  async function hideFloorsRange(start: number, end: number): Promise<void> {
    try {
      const hideMessages: Array<{ message_id: number; is_hidden: boolean }> = [];
      for (let i = start; i <= end; i++) hideMessages.push({ message_id: i, is_hidden: true });
      if (hideMessages.length > 0) await setChatMessages(hideMessages, { refresh: 'affected' });
    } catch (e) {
      console.warn('[总结助手] 隐藏总结消息失败:', e?.message || e);
    }
  }

  // === 自动调度引擎：GENERATION_ENDED 触发 + 指针回填 + busy 检测 + 失败重试 ===
  let schedulerTimer: any = null;
  let schedulerArmed = false;

  function scheduleAutoCheck(delay = 800): void {
    if (!schedulerArmed) return;
    clearTimeout(schedulerTimer);
    schedulerTimer = setTimeout(async () => {
      if (!schedulerArmed) return;
      if (isBusy()) { scheduleAutoCheck(2000); return; }
      try {
        const lastId = getLastMessageId();
        if (lastId < 0) { scheduleAutoCheck(3000); return; }
        let didRun = false;
        if (settings.value.autoGenerate && lastId - pointers.value.summary >= settings.value.autoInterval) {
          if (settings.value.autoRunMode === 'confirm') {
            const ok = window.confirm(`自动小总结触发：未总结 ${lastId - pointers.value.summary} 楼（≥${settings.value.autoInterval}）。是否执行？`);
            if (!ok) pointers.value.summary = Math.max(pointers.value.summary, lastId - settings.value.autoInterval);
          }
          if (pointers.value.summary < lastId - settings.value.autoInterval + 1) {
            await generateSummary(true);
            didRun = true;
          }
        }
        if (settings.value.bigGenerate && blocks.value.length > 0 && lastId - pointers.value.big >= settings.value.bigInterval) {
          await generateBigSummary(true);
          didRun = true;
        }
        if (didRun) saveToVariables();
      } catch (e) {
        console.warn('[总结助手] 自动总结失败，稍后重试:', e?.message || e);
        scheduleAutoCheck(15000);
      }
    }, delay);
  }

  function buildSummarySystemPrompt(): string {
    let prompt = settings.value.systemPrompt || SUMMARY_PROMPT;
    if (!settings.value.incrementalMode) return prompt;
    prompt += `\n\n【逐层增量总结协议】\n1. 只总结本次输入对应的当前批次，不要重写整段历史。\n2. 只保留本批次新增的关键事实、状态变化、冲突与未解决问题。\n3. 禁止输出思维链、分析、心理推测、抽象评价与大段总结性叙述。\n4. 结果必须直接落在主线/支线/未解决问题三类结构里。`;
    return prompt;
  }

  // === 生成总结（核心逻辑）：双轨增量总结，按批次推进 ===
  /** 非 RP 标志 + generateRaw 的公共封装 */
  function buildLlmPayload(userInput: string, ordered_prompts: any[]) {
    return {
      user_input: userInput,
      // 内部工具生成必须静默：不把总结内容当正文写入聊天楼层
      should_silence: true,
      ordered_prompts,
      ...(settings.value.apiUrl
        ? {
            custom_api: {
              apiurl: settings.value.apiUrl,
              key: settings.value.apiKey || '',
              ...(settings.value.model ? { model: settings.value.model } : {}),
            } as any,
          }
        : {}),
    };
  }

  /**
   * 带自动重试的 LLM 调用：调用失败或输出校验不通过时自动重试（默认 3 次，间隔 1 秒），
   * 中间失败弹黄色警告，全部失败才抛错（由上层弹红色报错）。
   */
  async function callLlmWithRetry(payload: any, label: string, validate?: (content: string) => void, maxAttempts = 3): Promise<string> {
    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        window.__ISURIA_NON_RP__ = true;
        const r = await generateRaw(payload);
        const content = typeof r === 'string' ? r : String(r);
        validate?.(content);
        return content;
      } catch (e: any) {
        lastErr = e;
        if (attempt < maxAttempts) {
          toastr.warning(`${label}第 ${attempt}/${maxAttempts} 次失败：${String(e?.message || e).slice(0, 60)}，1 秒后自动重试`, '总结助手');
          await new Promise(r2 => setTimeout(r2, 1000));
        }
      } finally {
        window.__ISURIA_NON_RP__ = false;
      }
    }
    throw lastErr;
  }

  async function generateSummary(silent = false, range?: { from: number; to: number }, overwrite = false): Promise<string | null> {
    if (loading.value) return null;
    loading.value = true;
    error.value = null;

    try {
      const batchSize = Math.max(1, settings.value.analysisDepth);
      const lastId = getLastMessageId();

      // 没有任何消息
      if (lastId < 0) {
        const msg = '当前聊天没有任何消息，请先开始对话';
        if (!silent) toastr.info(msg, '总结助手');
        return null;
      }

      // 范围：优先用调用方指定（用于指定楼层/重新总结）；否则从指针推进
      const startFloor = range
        ? Math.max(1, Math.min(Math.round(range.from) || 1, lastId))
        : (getLastCovered() + 1);
      const endFloor = range
        ? Math.max(startFloor, Math.min(Math.round(range.to) || lastId, lastId))
        : lastId;

      // 非指定范围且没有新消息时提示
      if (!range && startFloor > endFloor) {
        const msg = lastId >= 0
          ? `所有消息已总结完毕（截至第${getLastCovered()}楼），请继续聊天后再生成新总结`
          : '当前聊天没有任何消息，请先开始对话';
        if (!silent) toastr.info(msg, '总结助手');
        return null;
      }

      const batchResults: string[] = [];
      let batchCount = 0;
      let lastProcessedFloor = startFloor - 1;

      for (let cursor = startFloor; cursor <= endFloor; cursor += batchSize) {
        const effectiveStart = cursor;
        const effectiveEnd = Math.min(cursor + batchSize - 1, endFloor);

        // 覆盖重写：移除与当前批次重叠的旧分块（累积主线块跨越多批次时也能整块重建，
        // 否则新总结会追加到旧总结后面，看起来就像“保持出错的样子”）
        if (overwrite) {
          blocks.value = blocks.value.filter(b => !(b.floorEnd >= effectiveStart && b.floorStart <= effectiveEnd));
          smallLog.value = smallLog.value.filter(s => !(s.floorEnd >= effectiveStart && s.floorStart <= effectiveEnd));
        }

        // 获取当前批次楼层消息
        // hide_state 用 'all'：连同酒馆中被隐藏的楼层一并总结，避免漏掉已隐藏但仍是剧情一部分的内容
        const messages = getChatMessages(`${effectiveStart}-${effectiveEnd}`, {
          role: 'all',
          hide_state: 'all',
        });

        if (messages.length === 0) {
          if (!silent) toastr.warning(`第 ${effectiveStart}-${effectiveEnd} 楼没有可总结消息，已跳过`, '总结助手');
          continue;
        }

        // 构造输入：压缩背景 + 剧情规划上下文 + 当前批次正文
        const existingText = buildIncrementalContext();
        const plannerCtx = buildPlannerContext('summarize');
        const branchNames = [...new Set(blocks.value.filter(b => b.kind === 'branch').map(b => b.character))].join('、');

        const messageText = messages
          .map(m => {
            const role = m.role === 'user' ? '用户' : m.name || 'AI';
            return `[第${m.message_id}楼][${role}]: ${m.message}`;
          })
          .join('\n\n---\n\n');

        const userInput = [
          existingText || '【已有总结】（暂无）',
          plannerCtx ? `【剧情规划参考】\n${plannerCtx}` : null,
          `【对话正文（本次总结范围 第${effectiveStart}-${effectiveEnd}楼）】\n\n${messageText}`,
        ].filter(Boolean).join('\n\n');

        // 系统提示词：注入已有支线核心角色名单，并启用逐层增量约束
        let sysPrompt = buildSummarySystemPrompt();
        sysPrompt = sysPrompt.replace(/\{\{\s*BRANCH_NAMES\s*\}\}/g, branchNames || '（暂无）');

        // 调用 AI 生成：使用 generateRaw 完全隔离酒馆当前预设；失败自动重试 3 次
        const ordered_prompts: any[] = [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userInput },
        ];
        const content = await callLlmWithRetry(
          buildLlmPayload(userInput, ordered_prompts),
          '总结',
          (c) => {
            const p = parseSummaryBlocks(c);
            if (!p.blocks.length) throw new Error('AI 未返回有效的总结内容（缺少【主线总结】/【支线总结】分块）');
          },
        );

        // ---- 解析双轨分块 ----
        const parsed = parseSummaryBlocks(content);
        if (!parsed.blocks.length) {
          throw new Error('AI 未返回有效的总结内容（缺少【主线总结】/【支线总结】分块），请重试');
        }

        // ---- 合并进 blocks（主线累加 / 支线按角色归组）----
        applyBlocks(parsed.blocks, parsed.unresolved, effectiveStart, effectiveEnd);

        // ---- 更新指针（覆盖重写时直接对齐到本次批次末尾，被移除的后续旧块视为未总结） ----
        pointers.value.summary = overwrite ? effectiveEnd : Math.max(pointers.value.summary, effectiveEnd);
        lastProcessedFloor = effectiveEnd;
        batchCount += 1;
        batchResults.push(content);

        // ---- 小总结日志 ----
        const mainBlock = blocks.value.find(b => b.kind === 'main');
        smallLog.value.push({
          floorStart: effectiveStart,
          floorEnd: effectiveEnd,
          preview: mainBlock ? mainBlock.content.slice(-120) : '',
          branchCount: parsed.blocks.filter(b => b.kind === 'branch').length,
          generatedAt: Date.now(),
        });
        if (smallLog.value.length > 30) smallLog.value = smallLog.value.slice(-30);

        // ---- 可选隐藏已总结楼层 ----
        if (settings.value.hideFloors) {
          // 隐藏延迟：只隐藏到 (本批末楼 - hideDelay)，最近 N 楼原文保留给 AI 读
          const hideEnd = Math.max(effectiveStart - 1, effectiveEnd - Math.max(0, settings.value.hideDelay));
          if (hideEnd >= effectiveStart) await hideFloorsRange(effectiveStart, hideEnd);
          // ★ 隐藏后立即保存：防止后续批次失败（AI 未返回有效分块等）导致已隐藏楼层的总结数据未落盘
          saveToVariables();
        }
      }

      if (batchCount === 0) {
        const msg = '没有可总结的新楼层';
        if (!silent) toastr.info(msg, '总结助手');
        return null;
      }

      // ---- 保存状态 ----
      saveToVariables();

      // ---- 大总结检查（指针回填） ----
      if (settings.value.bigGenerate && lastProcessedFloor - pointers.value.big >= settings.value.bigInterval) {
        setTimeout(() => { generateBigSummary(true).catch(() => {}); }, 0);
      }

      if (!silent) {
        toastr.success(batchCount > 1 ? `已分批总结 ${batchCount} 批（每批 ${batchSize} 楼）` : `已总结第 ${startFloor}-${endFloor} 楼`, '总结助手');
      }

      return batchResults.join('\n\n');
    } catch (e) {
      const msg = e?.message || String(e);
      error.value = msg;
      if (!silent) {
        toastr.error(msg, '总结失败');
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  // === 生成大总结（历史总纲）：合并当前 blocks 为总纲，清空重新累积 ===
  async function generateBigSummary(silent = false): Promise<BigSummary | null> {
    if (bigLoading.value) return null;
    if (!blocks.value.length) {
      if (!silent) toastr.info('当前没有可合并的总结内容，请先生成小总结', '总结助手');
      return null;
    }
    bigLoading.value = true;
    error.value = null;
    try {
      const source = summarizeBlocksText(blocks.value, '');
      const plannerCtx = buildPlannerContext('summarize');
      const lastId = getLastMessageId();
      const endFloor = Math.max(lastId, pointers.value.summary);

      const userInput = [
        `【待合并的剧情总结】\n${source}`,
        plannerCtx ? `【剧情规划参考】\n${plannerCtx}` : null,
        '请将这些总结合并压缩为一份完整的历史总纲，删除重复、修正冲突，保留所有关键事实、状态变化与未解决问题。',
      ].filter(Boolean).join('\n\n');

      const ordered_prompts: any[] = [
        { role: 'system', content: BIG_SUMMARY_PROMPT },
        { role: 'user', content: userInput },
      ];

      const content = await callLlmWithRetry(
        buildLlmPayload(userInput, ordered_prompts),
        '大总结',
        (c) => {
          const p = parseSummaryBlocks(c);
          if (!p.blocks.length) throw new Error('AI 未返回有效的总结分块');
        },
      );
      const parsed = parseSummaryBlocks(content);

      const big: BigSummary = {
        id: uid(),
        floorStart: 1,
        floorEnd: endFloor,
        main: parsed.blocks.find(b => b.kind === 'main')?.content || '',
        branches: parsed.blocks
          .filter(b => b.kind === 'branch')
          .map(b => ({ character: b.character, content: b.content, unresolved: b.unresolved })),
        unresolved: parsed.unresolved,
        generatedAt: Date.now(),
      };

      bigSummaries.value.push(big);
      if (bigSummaries.value.length > 10) bigSummaries.value = bigSummaries.value.slice(-10);

      // 大总结后：blocks 清空（历史已进总纲），指针对齐
      pointers.value.big = endFloor;
      blocks.value = [];

      saveToVariables();
      if (!silent) toastr.success('历史总纲生成完成', '伊瑟利亚总结助手');
      return big;
    } catch (e) {
      const msg = e?.message || String(e);
      error.value = msg;
      if (!silent) toastr.error(msg, '大总结失败');
      return null;
    } finally {
      bigLoading.value = false;
    }
  }

  // === 构建注入文本（yuzuki 式前情提要：总纲 + 最近进展 + 未解决问题 + 剧情指向） ===
  function buildInjectionText(): { floorEnd: number; text: string } | null {
    const lines: string[] = [];
    let floorEnd = 0;

    // 历史总纲（最新大总结）
    const big = bigSummaries.value[bigSummaries.value.length - 1];
    if (big) {
      floorEnd = Math.max(floorEnd, big.floorEnd);
      lines.push(`【历史总纲 · 截至第${big.floorEnd}楼】`);
      if (big.main) lines.push(`【主线总结】\n${big.main}`);
      for (const br of big.branches) {
        lines.push(`【支线总结：${br.character}】\n${br.content}`);
        if (br.unresolved) lines.push(`（未解决问题：${br.unresolved.replace(/\n+/g, '；')}）`);
      }
      if (big.unresolved) lines.push(`【未解决问题】\n${big.unresolved}`);
    }

    // 最近进展（大总结后重新累积的 blocks）
    if (blocks.value.length) {
      const bStart = Math.min(...blocks.value.map(b => b.floorStart));
      const bEnd = Math.max(...blocks.value.map(b => b.floorEnd));
      floorEnd = Math.max(floorEnd, bEnd);
      lines.push(`【最近进展 · 第${bStart}-${bEnd}楼】`);
      lines.push(summarizeBlocksText(blocks.value, ''));
    }

    // 未解决问题汇总
    const allUnresolved = mergeUnresolved(
      big?.unresolved || '',
      blocks.value.map(b => b.unresolved).join('\n'),
    );
    if (allUnresolved) lines.push(`【未解决问题】\n${allUnresolved}`);

    // D联动：当前剧情指向（节拍 + NPC 名单）
    const plannerCtx = buildPlannerContext('inject');
    if (plannerCtx) lines.push(`【剧情当前指向】\n${plannerCtx}`);

    if (!lines.length) return null;
    return { floorEnd, text: lines.join('\n\n') };
  }

  // === 未总结楼层检测：返回已覆盖 / 最新 / 未总结数 ===
  function getCoverageInfo(): { lastId: number; covered: number; unsummarized: number } {
    let lastId = -1;
    try { lastId = getLastMessageId(); } catch {}
    const covered = Math.max(0, pointers.value.summary);
    return { lastId, covered, unsummarized: Math.max(0, lastId - covered) };
  }

  // === 重新总结（重roll）：从指定楼层起重新生成总结，替换旧结果 ===
  // overwrite 会在生成成功后移除与目标范围重叠的旧块；失败则保留旧数据，不丢内容
  async function regenerateFrom(floor: number): Promise<string | null> {
    if (loading.value) return null;
    const start = Math.max(1, Math.round(Number(floor) || 1));
    try {
      const to = start + Math.max(1, settings.value.analysisDepth) - 1;
      return generateSummary(false, { from: start, to }, true);
    } catch (e) {
      const msg = e?.message || String(e);
      error.value = msg;
      toastr.error(msg, '重新总结失败');
      return null;
    }
  }

  // === 切换聊天时重置总结数据 ===
  function resetForNewChat(chatId: string): void {
    if (currentChatId.value === chatId) return; // 同一聊天，无需重置
    console.log('[总结助手] 检测到聊天切换:', currentChatId.value || '(首次)', '→', chatId);
    currentChatId.value = chatId;
    blocks.value = [];
    bigSummaries.value = [];
    smallLog.value = [];
    pointers.value = { summary: 0, big: 0 };
    error.value = null;
    saveToVariables();
  }

  // === 保存到酒馆变量 ===
  function saveToVariables(): void {
    try {
      const data = {
        currentChatId: currentChatId.value,
        settings: klona(settings.value),
        blocks: klona(blocks.value),
        bigSummaries: klona(bigSummaries.value),
        smallLog: klona(smallLog.value),
        pointers: klona(pointers.value),
      };
      insertOrAssignVariables({ [STORAGE_KEY]: data }, { type: 'script' });
    } catch (e) {
      console.warn('[总结助手] 保存变量失败:', e?.message || e);
    }
  }

  // === 更新设置 ===
  function updateSettings(partial: Partial<Settings>): void {
    settings.value = { ...settings.value, ...partial };
    saveToVariables();

    // 如果更新了自动总结相关设置，重新配置监听
    if ('autoGenerate' in partial || 'autoInterval' in partial || 'bigGenerate' in partial) {
      configureAutoSummary(settings.value.autoGenerate);
    }
  }

  // === 重置提示词 ===
  function resetSystemPrompt(): void {
    settings.value.systemPrompt = SUMMARY_PROMPT;
    saveToVariables();
  }

  // === 自动总结控制：GENERATION_ENDED 触发 + 指针回填 ===
  let autoListener: { stop: () => void } | null = null;

  function configureAutoSummary(enabled: boolean): void {
    // 清除旧监听
    if (autoListener) {
      autoListener.stop();
      autoListener = null;
    }
    schedulerArmed = false;
    clearTimeout(schedulerTimer);

    if (enabled) {
      try {
        const events = (window as any).tavern_events;
        const triggerEvent = events?.GENERATION_ENDED || events?.MESSAGE_RECEIVED;
        if (!triggerEvent) {
          throw new Error('未找到可用的生成结束事件');
        }
        autoListener = eventOn(triggerEvent, () => {
          schedulerArmed = true;
          scheduleAutoCheck(600);
        });
        schedulerArmed = true;
      } catch (e) {
        console.warn('[总结助手] 自动监听设置失败:', e?.message || e);
        settings.value.autoGenerate = false;
      }
    }
  }

  // === 初始化（从酒馆变量恢复） ===
  function initialize(worldbookSuffix: string): void {
    try {
      // 获取当前聊天 ID
      let chatId = '';
      try { chatId = SillyTavern.getCurrentChatId() || ''; } catch {}

      const stored = getVariables({ type: 'script' })[STORAGE_KEY];
      if (stored) {
        // 检测聊天是否已切换：若存储的 chatId 与当前不同，丢弃旧总结数据
        const storedChatId = stored.currentChatId || '';
        const chatChanged = !!storedChatId && storedChatId !== chatId;

        if (stored.settings) {
          settings.value = SettingsSchema.parse({ ...stored.settings, worldbookSuffix });
        }
        if (stored.blocks && !chatChanged) blocks.value = stored.blocks;
        if (stored.bigSummaries && !chatChanged) bigSummaries.value = stored.bigSummaries;
        if (stored.smallLog && !chatChanged) smallLog.value = stored.smallLog;
        if (stored.pointers && !chatChanged) pointers.value = stored.pointers;

        if (chatChanged) {
          console.log('[总结助手] 初始化时检测到聊天已变更，已清空旧总结数据');
        }
      } else {
        settings.value.worldbookSuffix = worldbookSuffix;
      }

      currentChatId.value = chatId;

      // 自动恢复自动总结
      if (settings.value.autoGenerate) {
        configureAutoSummary(true);
      }
    } catch (e) {
      console.warn('[总结助手] 初始化失败:', e?.message || e);
      settings.value.worldbookSuffix = worldbookSuffix;
    }
  }

  // === 清理 ===
  function destroy(): void {
    if (autoListener) {
      autoListener.stop();
      autoListener = null;
    }
    schedulerArmed = false;
    clearTimeout(schedulerTimer);
  }

  return {
    settings,
    loading,
    bigLoading,
    error,
    blocks,
    bigSummaries,
    smallLog,
    pointers,
    modelList,
    fetchingModels,
    setContextProvider,
    buildInjectionText,
    generateSummary,
    getCoverageInfo,
    regenerateFrom,
    generateBigSummary,
    fetchModels,
    updateSettings,
    resetSystemPrompt,
    resetForNewChat,
    initialize,
    destroy,
    saveToVariables,
  };
});
