import { defineStore } from 'pinia';

/** 英灵/同伴条目信息 */
export interface HeroEntry {
  name: string;        // 完整条目名，如 "英灵/初代勇者雷恩" 或 "同伴/莉莉安"
  displayName: string; // 显示名，如 "初代勇者雷恩"
  shortName: string;   // 简称，如 "雷恩"
  content: string;     // 条目内容（人设提示词）
  enabled: boolean;    // 世界书中是否启用
  uid: number;         // 世界书条目 uid
  log: string;         // LOG 图标
  /** NPC 同伴标记 */
  isCompanion?: boolean;
  /** 同伴的运行时数据快照（好感度/位置/HP 等，用于提示词与 UI） */
  companionInfo?: CompanionInfo;
}

/** 同伴运行时数据（stat_data.同伴 的关键字段快照） */
export interface CompanionInfo {
  好感度: number;
  当前位置: string;
  等阶: string;
  hpNow: number;
  hpMax: number;
  异常状态: string[];
  心里话: string;
  战斗方式: string;
  关系分类: string;
  关键事件: string;
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** 态度/情绪（从 <标签|态度> 中解析） */
  mood?: string;
}

/** 回忆碎片（英灵逸事） */
export interface Anecdote {
  title: string;   // 回忆标题
  text: string;    // 回忆正文
  angle: string;   // 取材角度
  timestamp: number;
}

interface AnecdoteRecord {
  list: Anecdote[];
  /** 当日已获羁绊加成（YYYY-MM-DD → 数值，跨日自动归零） */
  bondDate?: string;
  bondToday?: number;
}

/** 圆桌发言（一次 AI 回复可含多个角色的多段发言） */
export interface RoundtableTurn {
  name: string;
  mood: string;
  text: string;
}

export interface RoundtableMessage {
  role: 'user' | 'round';
  text?: string;          // user 消息
  turns?: RoundtableTurn[]; // round 消息
  timestamp: number;
}

export interface RoundtableSession {
  participants: { key: string; name: string; log: string }[];
  messages: RoundtableMessage[];
}

/** 英灵列表（条目名匹配用；同时兼容按「英灵/」前缀自动发现的新英灵） */
const HERO_SPIRIT_NAMES = [
  '英灵/初代勇者雷恩',
  '英灵/第四代魔女莎提拉',
  '英灵/小魔王伊莉丝',
  '英灵/小圣女索菲亚',
  '英灵/指引妖精莉耶芙',
  '英灵/断钢的勇者·艾莉卡',
  '英灵/燃尽的贤者·伊利亚',
  '英灵/末代的神龙·科里维坦',
  '英灵/被夺的魔女·莉莉丝',
  '英灵/盲目的莉莉娅',
  '英灵/圣光神索利昂',
  '英灵/深渊的魅魔·阿丝茉德',
] as const;

/** LOG 图标映射（短名 → 图标） */
const HERO_LOG_MAP: Record<string, string> = {
  '雷恩': '⚔',
  '莎提拉': '😈',
  '伊莉丝': '👑',
  '索菲亚': '👻',
  '指引': '🧚',
  '断钢': '🗡️',
  '燃尽': '🔮',
  '末代': '🐉',
  '被夺': '🌑',
  '盲目': '⌛',
  '回溯': '⌛',
  '圣光': '☀',
  '索利': '☀',
  '索利昂': '☀',
  '深渊': '💋',
};

/** NPC 同伴默认图标 */
const NPC_DEFAULT_LOG = '🧑';

/**
 * 世界书名（3.4 起世界书更名「伊瑟利亚3.4」，按序回退兼容旧卡）
 */
const WORLD_BOOK_NAMES = ['伊瑟利亚3.4', '伊瑟利亚'];

function parseDisplayName(fullName: string): { displayName: string; shortName: string } {
  const parts = fullName.split('/');
  const last = parts[parts.length - 1] || fullName;
  // 提取简称：尝试取第一个有意义的词
  const shortMatch = last.match(/^(.+?)(?:[的])/);
  const shortName = shortMatch ? shortMatch[1] : last.slice(0, 2);
  return { displayName: last, shortName };
}

/** 通用标签解析：自动检测任意 <标签|态度>内容</标签> 格式
 * 例如 <小圣女索菲亚|平静>你好</小圣女索菲亚>
 * 返回 { content: 剥离标签后的内容, mood: 态度文字或空 }
 * 如果没有任何标签匹配，原样返回
 */
function parseAnyTaggedContent(text: string): { content: string; mood: string } {
  // 匹配 <任意标签名|态度>内容</同名标签>
  const regex = /<([^>|]+)\|([^>]+)>([\s\S]*?)<\/\1>/;
  const match = text.match(regex);
  if (match) {
    return { content: match[3].trim(), mood: match[2].trim() };
  }
  // 回退：不带|的标签 <标签>内容</标签>
  const fallbackRegex = /<([^>|]+)>([\s\S]*?)<\/\1>/;
  const fallbackMatch = text.match(fallbackRegex);
  if (fallbackMatch) {
    return { content: fallbackMatch[2].trim(), mood: '' };
  }
  // 没有标签包裹则原样返回
  return { content: text, mood: '' };
}

/** 聊天记录存储键 */
const CHAT_STORAGE_KEY = 'hero_spirit_chats';
/** 自动总结的概要存储键（每英灵/同伴一段累积概要） */
const CHAT_SUMMARY_KEY = 'hero_spirit_summaries';
/** 回忆碎片（英灵逸事）存储键 */
const ANECDOTE_STORAGE_KEY = 'hero_anecdotes';
/** 圆桌会话存储键 */
const ROUNDTABLE_STORAGE_KEY = 'hero_roundtable';
/** 私聊记录超过该条数时触发自动总结 */
const SUMMARY_THRESHOLD = 50;
/** 自动总结后保留的最近消息条数 */
const KEEP_RECENT = 20;
/** 每位英灵的回忆碎片上限 */
const MAX_ANECDOTES = 8;
/** 每解锁一条回忆碎片，英灵殿档案羁绊 +2；每英雄每日上限 +6 */
const ANECDOTE_BOND_GAIN = 2;
const ANECDOTE_BOND_DAILY_CAP = 6;
/** 圆桌记录上限（超出静默裁剪到最近一半） */
const ROUNDTABLE_MAX = 80;

/** 今日日期串（YYYY-MM-DD，用于羁绊加成的每日上限） */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 聊天记录的存储键（同伴用全名前缀避免两字简称撞车；读取时兼容旧的两字键） */
function storageKeyOf(hero: HeroEntry): string {
  return hero.isCompanion ? `同伴:${hero.displayName}` : hero.shortName;
}

/** 保存指定英灵的聊天记录到脚本变量 */
function saveMessages(heroKey: string, msgs: ChatMessage[]) {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_STORAGE_KEY] || {};
    all[heroKey] = msgs;
    insertOrAssignVariables({ [CHAT_STORAGE_KEY]: all }, { type: 'script' });
  } catch { /* 静默失败 */ }
}

/** 加载指定英灵的聊天记录 */
function loadMessages(heroKey: string, legacyKey?: string): ChatMessage[] {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_STORAGE_KEY] || {};
    const cur = all[heroKey] as ChatMessage[] | undefined;
    if (cur && cur.length > 0) return cur;
    // 旧版同伴聊天以两字简称存键，兼容读取
    if (legacyKey) return (all[legacyKey] as ChatMessage[]) || [];
    return [];
  } catch {
    return [];
  }
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const existing = getVariables({ type: 'script' });
    const v = existing[key];
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: any) {
  try {
    insertOrAssignVariables({ [key]: value }, { type: 'script' });
  } catch { /* 静默失败 */ }
}

/** 保存指定英灵的自动总结概要到脚本变量 */
function saveSummary(heroKey: string, summary: string) {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_SUMMARY_KEY] || {};
    all[heroKey] = summary;
    insertOrAssignVariables({ [CHAT_SUMMARY_KEY]: all }, { type: 'script' });
  } catch { /* 静默失败 */ }
}

/** 加载指定英灵的自动总结概要 */
function loadSummary(heroKey: string): string {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_SUMMARY_KEY] || {};
    return (all[heroKey] as string) || '';
  } catch {
    return '';
  }
}

/** 过滤主线上下文中的状态/档案类数据块（角色档案、HTML注释、记忆宏等），避免泄漏进私聊 */
function sanitizeMainContext(raw: string): string {
  if (!raw) return '';
  let text = raw
    // 1. 整体删除记忆表格 <Memory>...</Memory> 块（yuzuki-Memory / 记忆类插件的实时追溯块，含注释包裹与无注释两种变体）
    .replace(/<Memory[\s\S]*?<\/Memory>/gi, '')
    // 2. 删除残留的 <Memory> / </Memory> 标签
    .replace(/<\/?Memory\b[^>]*>/gi, '')
    // 3. 去掉 HTML 注释块（如 <!-- #角色档案 ... --> ）
    .replace(/<!--[\s\S]*?-->/g, '')
    // 4. 去掉形如「[角色名]|当前位置：...|周围角色：...」的状态档案行（含不在行首的变体）
    .replace(/\[[^\]]*\]\|[^\n]*/g, '')
    // 5. 去掉记忆表格章节标题（#角色档案 / #物品 / #世界设定 / #主线摘要 ...，含不在行首的变体）
    .replace(/#+(角色档案|物品追踪|世界设定|主线摘要|支线摘要|物品|人物档案|约定|待办事项)[^\n]*/g, '')
    // 6. 去掉记忆注入 marker 标题（【当前世界状态参考 - ...】【前情提要 - ...】【记忆只读数据库 - ...】【剧情摘要 ...】等）
    .replace(/【(?:当前世界状态参考|前情提要|记忆只读数据库|剧情摘要)[^\n]*】?/g, '')
    // 7. 去掉酒馆/记忆宏 {{...}}（如 {{MEMORY}} {{MEMORY_SUMMARY}} {{角色名}} {{VECTOR_MEMORY}} 等）
    .replace(/\{\{[^}]*\}\}/g, '')
    // 8. 去掉 # 标题行
    .replace(/^#+.*$/gm, '')
    // 9. 去掉被清空后残留的空发言行（如仅有注释的 [AI]: ）
    .replace(/^\[[^\]]+\]:\s*$/gm, '');
  // 合并多余空行
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** 读取 yuzuki-Memory 插件的记忆总结（剧情摘要/前情提要，非角色档案表格），供私聊感知外界；插件未启用时返回空串 */
function getYuzukiMemorySummary(): string {
  try {
    const Y = (globalThis as any).YuzukiMemory;
    const state = Y?.Storage?.loadState?.() ?? Y?.Storage?.getCurrentState?.();
    if (!state) return '';
    const summary = Y?.VariableInjector?.buildSummaryText?.(state);
    return String(summary || '').trim();
  } catch {
    return '';
  }
}

/** 读取最近的主聊天消息作为上下文 */
function getMainChatContext(maxCount: number = 10): string {
  try {
    const lastId = getLastMessageId();
    if (lastId < 0) return '';
    const startId = Math.max(0, lastId - maxCount + 1);
    const messages = getChatMessages(`${startId}-${lastId}`, { role: 'all', hide_state: 'unhidden' });
    if (!messages || messages.length === 0) return '';
    return sanitizeMainContext(
      messages
        .map(m => `[${m.role === 'user' ? '你' : m.name || 'AI'}]: ${m.message}`)
        .join('\n\n'),
    );
  } catch {
    return '';
  }
}

/** 将英灵/同伴聊天记录精简为概要（避免完整记录淹没主线上下文） */
function condenseChatSummary(msgs: ChatMessage[], displayName: string): string {
  const total = msgs.length;
  const last = msgs[total - 1];
  const timeStr = last?.timestamp
    ? new Date(last.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';

  const fmt = (m: ChatMessage, who: string, max: number) => {
    const text = String(m?.content || '').replace(/\s+/g, ' ').trim();
    return `${who}：${text.length > max ? text.slice(0, max) + '…' : text}`;
  };

  const head = `（共 ${total} 条${timeStr ? `，最近 ${timeStr}` : ''}）`;

  // 消息很少时全列（单条截断）；较多时只保留最后一轮对话作为近况
  if (total <= 4) {
    const parts = msgs.map(m => fmt(m, m.role === 'user' ? '你' : displayName, 50));
    return `${head}\n${parts.join('\n')}`;
  }
  const recent = msgs.slice(-2).map(m => fmt(m, m.role === 'user' ? '你' : displayName, 50));
  return `${head}\n最近：${recent.join(' / ')}`;
}

/** 生成期间置非 RP 标记：避免规划/总结/共鸣等注入污染工具型生成（与总结助手同一约定） */
async function generateIsolated(payload: any): Promise<string> {
  (window as any).__ISURIA_NON_RP__ = true;
  try {
    const r = await generateRaw(payload);
    return typeof r === 'string' ? r : String(r);
  } finally {
    (window as any).__ISURIA_NON_RP__ = false;
  }
}

export const useHeroSpiritStore = defineStore('heroSpirit', () => {
  // ---- 状态 ----
  const heroes = ref<HeroEntry[]>([]);
  const companions = ref<HeroEntry[]>([]);
  const selectedHero = ref<HeroEntry | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const panelExpanded = ref(false);
  const viewMode = ref<'list' | 'chat' | 'detail' | 'roundtable'>('list');
  /** 当前标签页：'heroes' = 英灵殿，'companions' = 同伴 */
  const activeTab = ref<'heroes' | 'companions'>('heroes');
  /** 英灵共鸣运行时数据（stat_data.英灵，含残响/羁绊/被动/执念/英灵技） */
  const spiritRuntime = ref<any>(null);
  /** 英灵殿档案（stat_data.英灵.英灵殿：{英灵名: {残响, 羁绊, 状态, 执念完成}}） */
  const hall = ref<Record<string, any>>({});
  /** 回忆碎片（英灵逸事）：{ 存储键: { list, bondDate, bondToday } } */
  const anecdotes = ref<Record<string, AnecdoteRecord>>({});
  /** 当前正在生成回忆碎片 */
  const anecdoteLoading = ref(false);
  /** 展示回忆碎片的英灵（null = 关闭碎片墙） */
  const anecdoteViewHero = ref<HeroEntry | null>(null);
  /** 圆桌会话（null = 未开启） */
  const roundtable = ref<RoundtableSession | null>(null);
  /** 圆桌生成中 */
  const rtLoading = ref(false);

  // ---- 读取 stat_data.英灵（MVU 快照，与状态栏一致） ----
  function readSpiritRuntime(): any {
    try {
      const mvu = (window as any).Mvu;
      if (!mvu?.getMvuData) return null;
      const d = mvu.getMvuData({ type: 'message', message_id: 'latest' });
      return d?.stat_data?.英灵 || null;
    } catch {
      return null;
    }
  }

  /** 刷新英灵共鸣数据（残响/羁绊/被动/执念/英灵技/英灵殿） */
  function refreshSpiritRuntime() {
    const s = readSpiritRuntime();
    spiritRuntime.value = s;
    hall.value = (s && s.英灵殿) || {};
  }

  /** 查询某英灵的英灵殿档案（按名称互相包含匹配） */
  function hallInfo(heroName: string): any | null {
    const h = hall.value || {};
    for (const k of Object.keys(h)) {
      if ((heroName && heroName.includes(k)) || k.includes(heroName || '')) return h[k];
    }
    return null;
  }

  /** 英灵当前是否处于沉睡（契主英灵看运行时状态，其余看英灵殿档案） */
  function isHeroSleeping(hero: HeroEntry): boolean {
    if (hero.isCompanion) return false;
    const s = spiritRuntime.value || readSpiritRuntime();
    if (s?.名称 && (hero.displayName.includes(s.名称) || s.名称.includes(hero.displayName))) {
      return String(s.状态 || '') === '沉睡';
    }
    return hallInfo(hero.displayName)?.状态 === '沉睡';
  }

  /** 释放英灵技（硬校验 + 变量写入；与 /英灵技 指令逻辑一致，面板按钮直接调用） */
  async function releaseSpiritSkill(): Promise<{ ok: boolean; msg: string }> {
    try {
      const s = readSpiritRuntime();
      if (!s) return { ok: false, msg: '未找到契主英灵（stat_data.英灵 为空）' };
      const name = String(s.名称 || '无名英灵');
      const power = Number(s.残响之力 || 0);
      const status = String(s.状态 || '苏醒');
      const cooldown = Number(s.英灵技?.冷却 || 0);
      const skillName = String(s.英灵技?.名称 || '');

      if (power < 100) return { ok: false, msg: `残响之力不足（${power}/100），无法释放` };
      if (status !== '苏醒') return { ok: false, msg: `英灵正处于「${status}」状态，无法释放` };
      if (cooldown > 0) return { ok: false, msg: `英灵技冷却中（剩余 ${cooldown}）` };
      if (!skillName) return { ok: false, msg: '未登记英灵技名称（英灵.英灵技.名称 为空）' };

      const mvu = (window as any).Mvu;
      if (!mvu?.replaceMvuData) return { ok: false, msg: 'MVU 框架未初始化' };
      const mvuData = mvu.getMvuData({ type: 'message', message_id: 'latest' });
      if (!mvuData.stat_data) mvuData.stat_data = {};
      const sp = mvuData.stat_data.英灵 || (mvuData.stat_data.英灵 = { 名称: name, 残响之力: 0, 状态: '苏醒' });

      // 沉睡冷却：莉莉丝系按已释放次数翻倍（1/3/7/15…），其余固定 1
      let newCool = 1;
      if (name.includes('莉莉丝')) {
        newCool = Math.min(30, Math.pow(2, Number(sp.英灵技?.已释放 || 0) + 1) - 1);
      }
      sp.残响之力 = 0;
      sp.状态 = '沉睡';
      sp.英灵技 = sp.英灵技 || {};
      sp.英灵技.冷却 = newCool;
      sp.英灵技.已释放 = Number(sp.英灵技.已释放 || 0) + 1;
      // 同步英灵殿档案
      const h = sp.英灵殿 || {};
      for (const k of Object.keys(h)) {
        if (name.includes(k) || k.includes(name)) {
          h[k].残响 = 0;
          h[k].状态 = '沉睡';
        }
      }
      await mvu.replaceMvuData(mvuData, { type: 'message', message_id: 'latest' });
      refreshSpiritRuntime();
      return { ok: true, msg: `「${skillName}」已释放！${name}陷入沉睡（${newCool}日后苏醒），请在正文输出 <英灵技·${skillName}>` };
    } catch (e: any) {
      console.warn('[英灵功能] 释放英灵技失败:', e);
      return { ok: false, msg: String(e?.message || e) };
    }
  }

  // ---- 从 stat_data.同伴 读取 NPC ----
  function loadCompanions(): HeroEntry[] {
    try {
      // 尝试多个来源读取 stat_data.同伴
      let raw: any;
      let npcMap: any;
      let source = '';

      // 来源1：Mvu.getMvuData({ type: 'chat' })
      const readStat = (): any => {
        try {
          const mvu = (window as any).Mvu;
          if (mvu?.getMvuData) {
            const d = mvu.getMvuData({ type: 'message', message_id: 'latest' }) || {};
            const chat = (() => { try { return mvu.getMvuData({ type: 'chat' }) || {}; } catch { return {}; } })();
            return { stat: d.stat_data || {}, chatStat: chat.stat_data || {} };
          }
        } catch {}
        try {
          const d = getVariables({ type: 'chat' }) || {};
          return { stat: d?.stat_data || {}, chatStat: d?.stat_data || {} };
        } catch {}
        return { stat: {}, chatStat: {} };
      };
      const { stat, chatStat } = readStat();
      raw = stat.同伴 || chatStat.同伴;
      if (raw) source = 'stat_data.同伴';
      npcMap = stat.主要NPC || chatStat.主要NPC || {};

      if (!raw) {
        console.log('[英灵功能·同伴] 所有来源均未找到 stat_data.同伴');
        return [];
      }
      console.log(`[英灵功能·同伴] 从 ${source} 读取到同伴数据`);

      const names = Object.keys(raw).filter(k => k.trim());
      if (names.length === 0) return [];

      return names.map((name, idx) => {
        const info = raw[name] || {};
        const npc = npcMap?.[name] || {};
        const hpNow = Number(info?.基础状态?.HP?.当前 ?? 0);
        const hpMax = Number(info?.基础状态?.HP?.最大 ?? 0);
        const buffs = info?.基础状态?.自身状态 || {};
        const compInfo: CompanionInfo = {
          好感度: Number(info.好感度 ?? npc.好感度 ?? 0),
          当前位置: String(info.当前位置 || npc.当前位置 || ''),
          等阶: String(info.等阶 || '普通'),
          hpNow, hpMax,
          异常状态: Object.keys(buffs).filter(k => buffs[k]),
          心里话: String(info.心里话 || ''),
          战斗方式: String(info.战斗方式 || info.扉斗方式 || info.戫斗方式 || ''),
          关系分类: String(npc.关系分类 || ''),
          关键事件: String(npc.关键事件 || ''),
        };
        return buildCompanionEntry(name, info, compInfo, idx);
      });
    } catch (e) {
      console.warn('[英灵功能] 读取同伴失败:', e);
      return [];
    }
  }

  /** 由同伴数据构建对话用条目（方案A：提示词携带好感度/位置/状态/心里话等） */
  function buildCompanionEntry(name: string, info: any, compInfo: CompanionInfo, idx: number): HeroEntry {
    const parts: string[] = [];
    if (info.种族) parts.push(`种族：${info.种族}`);
    if (info.所属势力) parts.push(`所属势力：${info.所属势力}`);
    if (info.身份) parts.push(`身份：${info.身份}`);
    if (info.等阶) parts.push(`等阶：${info.等阶}`);
    if (info.外貌) parts.push(`外貌：${info.外貌}`);
    if (info.性格) parts.push(`性格：${info.性格}`);
    if (info.背景故事) parts.push(`背景：${info.背景故事}`);

    const bonds = compInfo.好感度;
    const bondTier = bonds < 30 ? '（冷淡/戒备，称呼客气疏远）' : bonds < 70 ? '（友善，自然亲近）' : '（亲密，可以撒娇或交心）';
    const statusBits: string[] = [];
    if (compInfo.hpMax > 0) statusBits.push(`HP ${compInfo.hpNow}/${compInfo.hpMax}${compInfo.hpNow < compInfo.hpMax * 0.3 ? '（重伤，虚弱无力）' : ''}`);
    if (compInfo.异常状态.length) statusBits.push(`异常状态：${compInfo.异常状态.join('、')}`);

    const promptLines: string[] = [
      `你是一位名叫${name}的角色，与冒险者（用户）相识同行。`,
      parts.length ? parts.join('\n') : '',
      `你对冒险者的好感度：${bonds}/100${bondTier}。请以符合好感度的心情、称呼和语气对话。`,
      compInfo.当前位置 ? `你们当前所在：${compInfo.当前位置}。若对白内容涉及别处，请保持位置常识。` : '',
      statusBits.length ? `你当前的状态：${statusBits.join('；')}。身体状况会自然影响你的语气和精力。` : '',
      compInfo.战斗方式 ? `你的战斗倾向（玩家设定，仅在聊到战斗时参考）：${compInfo.战斗方式}` : '',
      compInfo.心里话 ? `你的心里话（真实想法，不会轻易说出口，仅在交心话题或高好感时才可能流露）：${compInfo.心里话}` : '',
      compInfo.关系分类 ? `你们的关系：${compInfo.关系分类}` : '',
      compInfo.关键事件 ? `你们之间经历过的关键事件：${compInfo.关键事件}` : '',
      '',
      '输出格式：每次回复都使用标签包裹台词，格式为',
      `<${name}|表情> 台词内容 </${name}>`,
      '表情从：平静、开心、惊讶、生气、难过、害羞、疲惫、调皮 中选择一个。',
      '除标签包裹的台词外，不要输出任何其他文字。',
    ].filter(l => l !== '');

    const content = promptLines.join('\n');
    return {
      name: `同伴/${name}`,
      displayName: name,
      shortName: name.slice(0, 2),
      content,
      enabled: true,
      uid: 9000 + idx,
      log: NPC_DEFAULT_LOG,
      isCompanion: true,
      companionInfo: compInfo,
    };
  }

  // ---- 切换标签页 ----
  function switchTab(tab: 'heroes' | 'companions') {
    activeTab.value = tab;
    // 切标签时回到列表视图，关掉可能的覆盖层
    if (viewMode.value !== 'list') viewMode.value = 'list';
    anecdoteViewHero.value = null;
  }

  // ---- 世界书操作 + 同伴 ----
  async function loadHeroesFromWorldbook() {
    try {
      // 1. 从世界书读取英灵（按 WORLD_BOOK_NAMES 顺序回退，兼容 3.4 改名前后的卡）
      let entries: any[] | null = null;
      for (const bookName of WORLD_BOOK_NAMES) {
        try {
          const list = await getWorldbook(bookName);
          if (list && list.length > 0) { entries = list; break; }
        } catch { /* 尝试下一个名字 */ }
      }
      const heroEntries = (entries || []).filter(e =>
        HERO_SPIRIT_NAMES.some(name => e.name.includes(name)) || /^英灵\//.test(e.name),
      );
      heroes.value = heroEntries.map(e => {
        const { displayName, shortName } = parseDisplayName(e.name);
        // 图标按包含匹配（简称截取可能取不到映射键，如「初代勇者雷恩」→「初代」）
        const logEntry = Object.entries(HERO_LOG_MAP).find(([k]) => displayName.includes(k) || k.includes(displayName));
        return {
          name: e.name,
          displayName,
          shortName,
          content: e.content || '(空)',
          enabled: e.enabled,
          uid: e.uid,
          log: logEntry ? logEntry[1] : '✦',
        };
      });

      // 2. 从 stat_data.同伴 读取 NPC（独立列表）
      companions.value = loadCompanions();
    } catch (e: any) {
      console.warn('[英灵功能] 读取列表失败:', e?.message || e);
      heroes.value = [];
      companions.value = [];
    }
  }

  // ---- 选择英灵/同伴 ----
  function selectHero(hero: HeroEntry) {
    const entry = hero.isCompanion
      ? (companions.value.find(c => c.displayName === hero.displayName) || hero)
      : hero;
    selectedHero.value = entry;
    messages.value = loadMessages(storageKeyOf(entry), entry.isCompanion ? entry.shortName : undefined);
    viewMode.value = 'chat';
  }

  /** 打开英灵档案页（方案D） */
  function openDetail(hero: HeroEntry) {
    selectedHero.value = hero;
    viewMode.value = 'detail';
  }

  function goBack() {
    // 回去前保存当前聊天记录
    const hero = selectedHero.value;
    if (hero) saveMessages(storageKeyOf(hero), messages.value);
    if (viewMode.value === 'chat' && hero && !hero.isCompanion) {
      viewMode.value = 'detail'; // 英灵：聊天返回档案页
    } else {
      selectedHero.value = null;
      viewMode.value = 'list';
    }
  }

  /** 英灵/同伴通用的对话提示词组装（私聊 sendMessage/regenerateMessage 共用） */
  function buildChatPrompts(hero: HeroEntry, historyText: string, userText: string): any[] {
    const systemDef = hero.isCompanion
      ? hero.content
      : `你是${hero.displayName}。${hero.content}\n\n请完全以${hero.displayName}的身份与我对话，保持角色设定，使用符合你身份的语气和口吻。每次回复控制在200字以内，用自然的口语对话风格，像真正的面对面聊天一样。`;

    const ordered_prompts: any[] = [
      { role: 'system', content: systemDef },
      { role: 'system', content: '对话规则：\n1. 用第一人称回复\n2. 每次回复简洁自然，像日常对话\n3. 不要刻意输出长段落\n4. 保留角色特色的语气词和口头禅\n5. 可以主动提问推进对话' },
    ];

    // 注入外界上下文（已过滤角色档案/状态数据块）
    const mainContext = getMainChatContext(10);
    if (mainContext) {
      ordered_prompts.push({
        role: 'system',
        content: `以下是你所感知到的外界正在发生的事情（仅供背景参考，绝不直接复述）。
特别注意：若其中出现 <Memory>、<!-- -->、#角色档案、[角色名]|字段 等记忆/状态/元数据格式，属于系统内部数据，严禁模仿、引用或输出任何类似格式，只当作普通背景信息即可。
${mainContext}`,
      });
    }

    // 注入 yuzuki-Memory 记忆总结（剧情进展/前情提要；非角色档案表格，插件未启用时自动跳过）
    const yuzukiSummary = getYuzukiMemorySummary();
    if (yuzukiSummary) {
      ordered_prompts.push({
        role: 'system',
        content: `以下是你记忆中的主线剧情摘要（帮助你知道主线最近发生了什么；仅供背景参考，用自然语言理解即可，严禁直接复述或输出任何表格/档案/状态格式）：
${yuzukiSummary}`,
      });
    }

    // 英灵：注入该英灵的殿内羁绊档案，让对话与共鸣进度自洽
    if (!hero.isCompanion) {
      const hi: any = hallInfo(hero.displayName);
      const bond = Number(hi?.羁绊 ?? 0);
      const heard = (anecdotes.value[storageKeyOf(hero)]?.list || []).map(a => `《${a.title}》`).join('、');
      if (bond > 0 || heard) {
        ordered_prompts.push({
          role: 'system',
          content: `你们当前的羁绊：${bond}/100（羁绊越深，你越愿意敞开心扉）。${heard ? `你已经给冒险者讲过这些往事：${heard}。` : ''}`,
        });
      }
    }

    // 注入对话历史（作为上下文）
    if (historyText) {
      ordered_prompts.push({
        role: 'system',
        content: `以下是你们之间的对话历史：\n${historyText}`,
      });
    }

    // 当前用户输入作为 user 角色
    ordered_prompts.push({ role: 'user', content: userText });
    return ordered_prompts;
  }

  // ---- 聊天 ---- */
  async function sendMessage(text: string): Promise<void> {
    if (!selectedHero.value || loading.value || !text.trim()) return;
    const hero = selectedHero.value;
    if (isHeroSleeping(hero)) {
      toastr.info(`${hero.displayName}正沉睡于英灵殿深处，只有模糊的梦呓……`, '英灵殿');
      return;
    }
    loading.value = true;

    const userText = text.trim();
    const userMsg: ChatMessage = { role: 'user', content: userText, timestamp: Date.now() };
    messages.value.push(userMsg);
    saveMessages(storageKeyOf(hero), messages.value);

    try {
      // 构建历史（不含当前最新消息，因为后面作为 user_input 单独传入）
      const historyWithoutLast = messages.value.slice(0, -1)
        .map(m => `${m.role === 'user' ? '你' : hero.displayName}：${m.content}`)
        .join('\n\n');

      const ordered_prompts = buildChatPrompts(hero, historyWithoutLast, userText);

      // 使用 generateRaw 完全隔离酒馆预设
      const result = await generateRaw({
        user_input: userText,
        should_silence: true,
        ordered_prompts,
      });

      let reply = typeof result === 'string' ? result : String(result);

      // ---- 通用标签解析：<任意标签|态度>内容</任意标签> ----
      const parsed = parseAnyTaggedContent(reply);
      reply = parsed.content;
      const mood = parsed.mood;

      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now(), mood };
      messages.value.push(assistantMsg);
      saveMessages(storageKeyOf(hero), messages.value);

      // ---- 私聊记录超过阈值时，自动把旧消息压缩成概要（保留最近若干条） ----
      if (messages.value.length > SUMMARY_THRESHOLD) {
        await maybeSummarizeChat(hero);
      }

      // ---- 将聊天记录注入到主聊天上下文（英灵 + 同伴都注入） ----
      recordInfluence(hero);

    } catch (e: any) {
      console.warn('[英灵功能] 生成回复失败:', e?.message || e);
      const name = selectedHero.value?.displayName || '英灵';
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `（${name}似乎陷入了沉默……）`,
        timestamp: Date.now(),
      };
      messages.value.push(errMsg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 当私聊记录超过阈值时，自动调用 LLM 把旧消息总结成概要，并只保留最近若干条原文。
   * 生成失败时不折叠、保留全部消息，等下一次发送时重试。
   */
  async function maybeSummarizeChat(hero: HeroEntry): Promise<void> {
    try {
      const msgs = messages.value;
      if (msgs.length <= SUMMARY_THRESHOLD) return;

      const keepCount = KEEP_RECENT;
      const oldMsgs = msgs.slice(0, msgs.length - keepCount);
      const recentMsgs = msgs.slice(msgs.length - keepCount);
      if (oldMsgs.length === 0) return;

      const prevSummary = loadSummary(storageKeyOf(hero));
      const chatText = oldMsgs
        .map(m => `${m.role === 'user' ? '你' : hero.displayName}：${m.content}`)
        .join('\n');

      // 用 generateRaw 完全隔离酒馆预设，仅做记忆压缩
      const result = await generateIsolated({
        user_input: '请压缩以上对话为概要',
        should_silence: true,
        ordered_prompts: [
          {
            role: 'system',
            content:
              '你是一位记忆整理员。你的任务是把一份私聊记录压缩成精简的中文概要。\n' +
              '要求：\n' +
              '- 只输出概要本身，禁止输出任何解释、寒暄或前言\n' +
              '- 用要点式短句，保留：重要事件、约定承诺、未了结的话题、关系变化、关键信息\n' +
              '- 去除寒暄、无关细节和重复内容\n' +
              '- 全文控制在 200 字以内\n' +
              '- 若提供【已有概要】，需把旧概要的核心信息与新对话合并，避免丢失',
          },
          {
            role: 'system',
            content:
              `${prevSummary ? '【已有概要】\n' + prevSummary + '\n\n' : ''}` +
              `【本次需整理的对话】\n${chatText}`,
          },
          { role: 'user', content: '请把以上内容压缩为一份 200 字以内的要点式概要。' },
        ],
      });

      const summaryText = result.trim();
      // 生成失败/为空时不折叠，保留原文，等下次再试
      if (!summaryText) return;

      const merged = prevSummary ? `${prevSummary}\n${summaryText}` : summaryText;
      saveSummary(storageKeyOf(hero), merged);
      messages.value = recentMsgs;
      saveMessages(storageKeyOf(hero), recentMsgs);

      toastr.success(`已自动总结与「${hero.displayName}」的 ${oldMsgs.length} 条旧对话`, '英灵殿');
    } catch (e: any) {
      console.warn('[英灵功能] 自动总结失败（保留原文，下次再试）:', e?.message || e);
    }
  }

  /** 记录英灵的名片信息（显示名、图标），供注入监听器组装互动概要时使用 */
  function recordInfluence(hero: HeroEntry) {
    try {
      const existing = getVariables({ type: 'script' });
      const key = 'hero_spirit_influence';
      const influence = existing[key] || {};
      influence[storageKeyOf(hero)] = {
        lastInteraction: Date.now(),
        log: hero.log,
        displayName: hero.displayName,
      };
      insertOrAssignVariables({ [key]: influence }, { type: 'script' });
    } catch { /* ignore */ }
  }

  // ============================================================
  // 回忆碎片（方案B：英灵逸事）
  // ============================================================

  const ANGLE_POOL: { key: string; text: string; tier: number }[] = [
    { key: '日常小事', text: '一段生前无忧无虑的日常小事（一顿饭、一场雨、一次偷懒、一次恶作剧）', tier: 0 },
    { key: '心爱之物', text: '一件曾经珍爱、后来失去的小物件，以及它背后的故事', tier: 0 },
    { key: '难忘经历', text: '一场让你大笑或大哭的往事', tier: 0 },
    { key: '故人', text: '一个至今仍会想起的人——你们最后一条对话是什么？', tier: 1 },
    { key: '遗憾', text: '一次至今没能释怀的遗憾，你当时为什么没有那样做？', tier: 1 },
    { key: '小秘密', text: '一个从未对任何人说过的、无伤大雅的小秘密', tier: 2 },
    { key: '执念之源', text: '你的执念最深处的源头——那件事真正让你放不下的瞬间', tier: 2 },
  ];

  function anecdoteListOf(hero: HeroEntry): Anecdote[] {
    return anecdotes.value[storageKeyOf(hero)]?.list || [];
  }

  function anecdoteCountOf(hero: HeroEntry): number {
    return anecdoteListOf(hero).length;
  }

  /** 由英灵殿档案计算羁绊档位（0 浅 / 1 中 / 2 深） */
  function bondTierOf(hero: HeroEntry): number {
    const bond = Number(hallInfo(hero.displayName)?.羁绊 ?? 0);
    if (bond >= 70) return 2;
    if (bond >= 30) return 1;
    return 0;
  }

  async function generateAnecdote(hero: HeroEntry): Promise<{ ok: boolean; msg: string }> {
    if (anecdoteLoading.value) return { ok: false, msg: '正在回忆中…' };
    if (hero.isCompanion) return { ok: false, msg: '回忆碎片仅英灵可用' };
    if (isHeroSleeping(hero)) return { ok: false, msg: `${hero.displayName}正沉睡，无法回忆` };

    const key = storageKeyOf(hero);
    const record = anecdotes.value[key] || { list: [] };
    if (record.list.length >= MAX_ANECDOTES) {
      return { ok: false, msg: `${hero.displayName}的回忆碎片已全部集齐（${MAX_ANECDOTES}/${MAX_ANECDOTES}）` };
    }

    anecdoteLoading.value = true;
    anecdoteViewHero.value = hero;
    try {
      const tier = bondTierOf(hero);
      const pool = ANGLE_POOL.filter(a => a.tier <= tier);
      const angle = pool[Math.floor(Math.random() * pool.length)];
      const heard = record.list.map(a => `《${a.title}》`).join('、');

      const reply = await generateIsolated({
        user_input: '请讲一段往事',
        should_silence: true,
        ordered_prompts: [
          { role: 'system', content: `你是${hero.displayName}。${hero.content}` },
          {
            role: 'system',
            content:
              `现在请在英灵殿中，向冒险者轻声讲一段你生前记忆里的往事。\n` +
              `取材角度：${angle.text}\n` +
              `要求：\n` +
              `- 第一行单独输出回忆标题，格式：『标题』（8字以内）\n` +
              `- 正文150~260字，第一人称，像面对面讲述，细节具体、有画面感\n` +
              `- 可以在结尾自然收住或留一点余韵\n` +
              (tier < 2 ? `- 羁绊尚浅，讲到最深处可以停住："等我们更熟悉些，再告诉你后面的事。"\n` : '') +
              (heard ? `- 以下往事你已经讲过，绝不要重复：${heard}\n` : '') +
              `- 严禁输出对话标签、表情后缀或其他任何格式标记`,
          },
        ],
      });

      const raw = reply.trim();
      if (!raw) return { ok: false, msg: '她似乎一时想不起来……（生成失败，稍后再试）' };

      // 解析『标题』+ 正文
      const m = raw.match(/^『\s*([^』]{1,16})\s*』\s*\n?([\s\S]*)$/) || raw.match(/^【\s*([^】]{1,16})\s*】\s*\n?([\s\S]*)$/);
      const title = (m ? m[1] : angle.key).trim();
      const text = (m ? m[2] : raw).trim() || raw;

      const anecdote: Anecdote = { title, text, angle: angle.key, timestamp: Date.now() };
      record.list.push(anecdote);
      anecdotes.value = { ...anecdotes.value, [key]: record };
      saveJson(ANECDOTE_STORAGE_KEY, anecdotes.value);

      // 羁绊小额加成：每条 +2，每日每英灵上限 +6（只动英灵殿档案，不动 AI 管理的主字段）
      const today = todayStr();
      const gained = record.bondDate === today ? Number(record.bondToday || 0) : 0;
      let bondMsg = '';
      if (gained < ANECDOTE_BOND_DAILY_CAP) {
        const bonus = Math.min(ANECDOTE_BOND_GAIN, ANECDOTE_BOND_DAILY_CAP - gained);
        const okBond = await addHallBond(hero.displayName, bonus);
        if (okBond) {
          record.bondDate = today;
          record.bondToday = gained + bonus;
          anecdotes.value = { ...anecdotes.value, [key]: record };
          saveJson(ANECDOTE_STORAGE_KEY, anecdotes.value);
          bondMsg = `，羁绊 +${bonus}`;
        }
      }

      toastr.success(`回忆碎片解锁：『${title}』（${record.list.length}/${MAX_ANECDOTES}${bondMsg}）`, '英灵殿');
      return { ok: true, msg: '' };
    } catch (e: any) {
      console.warn('[英灵功能] 回忆碎片生成失败:', e?.message || e);
      return { ok: false, msg: '她似乎一时想不起来……（生成失败，稍后再试）' };
    } finally {
      anecdoteLoading.value = false;
    }
  }

  /** 英灵殿档案羁绊小额加成（cap 100） */
  async function addHallBond(heroName: string, bonus: number): Promise<boolean> {
    try {
      const mvu = (window as any).Mvu;
      if (!mvu?.replaceMvuData) return false;
      const mvuData = mvu.getMvuData({ type: 'message', message_id: 'latest' });
      const h = mvuData?.stat_data?.英灵?.英灵殿;
      if (!h) return false;
      for (const k of Object.keys(h)) {
        if ((heroName && heroName.includes(k)) || k.includes(heroName || '')) {
          h[k].羁绊 = Math.min(100, Number(h[k].羁绊 || 0) + bonus);
          await mvu.replaceMvuData(mvuData, { type: 'message', message_id: 'latest' });
          refreshSpiritRuntime();
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  function openAnecdotes(hero: HeroEntry) {
    anecdoteViewHero.value = hero;
  }

  function closeAnecdotes() {
    anecdoteViewHero.value = null;
  }

  // ============================================================
  // 英灵殿圆桌（方案E：多角色群聊）
  // ============================================================

  function loadRoundtable(): RoundtableSession | null {
    const s = loadJson<RoundtableSession | null>(ROUNDTABLE_STORAGE_KEY, null);
    roundtable.value = s && s.participants?.length ? s : null;
    return roundtable.value;
  }

  function startRoundtable(participants: HeroEntry[]) {
    if (participants.length < 2) return;
    const session: RoundtableSession = {
      participants: participants.map(p => ({ key: storageKeyOf(p), name: p.displayName, log: p.log })),
      messages: [],
    };
    roundtable.value = session;
    saveJson(ROUNDTABLE_STORAGE_KEY, session);
    viewMode.value = 'roundtable';
  }

  function endRoundtable(keep: boolean) {
    if (!keep) {
      roundtable.value = null;
      saveJson(ROUNDTABLE_STORAGE_KEY, null);
    }
    viewMode.value = 'list';
  }

  /** 圆桌多角色生成 */
  async function sendRoundtable(text: string): Promise<void> {
    const session = roundtable.value;
    if (!session || rtLoading.value || !text.trim()) return;
    rtLoading.value = true;

    const userText = text.trim();
    session.messages.push({ role: 'user', text: userText, timestamp: Date.now() });
    saveJson(ROUNDTABLE_STORAGE_KEY, session);

    try {
      // 角色卡（英灵用世界书原文；同伴已带富提示词）
      const personas = session.participants.map(p => {
        const all = [...heroes.value, ...companions.value];
        const entry = all.find(h => storageKeyOf(h) === p.key);
        return `### ${p.name}\n${entry?.content || '（设定缺失，按名字自然扮演）'}`;
      }).join('\n\n');

      const historyText = session.messages.slice(0, -1).map(m => {
        if (m.role === 'user') return `冒险者：${m.text}`;
        return (m.turns || []).map(t => `${t.name}：${t.text}`).join('\n');
      }).join('\n\n');

      const mainContext = getMainChatContext(10);

      const ordered_prompts: any[] = [
        {
          role: 'system',
          content:
            `现在是「英灵殿圆桌夜谈」：以下角色与冒险者（用户）围坐闲谈。\n\n${personas}\n\n` +
            `规则：\n` +
            `1. 每次回复输出2~5段发言，每段必须用该角色的标签包裹：<角色全名|态度>发言</角色全名>\n` +
            `2. 角色之间可以互相接话、调侃、反驳，贴合各自性格、时代背景与彼此的关系\n` +
            `3. 绝不替冒险者发言，也不描写冒险者的动作台词\n` +
            `4. 每段发言1~3句，总回复控制在350字以内\n` +
            `5. 标签之外不要输出任何叙述文字`,
        },
      ];

      if (mainContext) {
        ordered_prompts.push({
          role: 'system',
          content: `以下是外界最近发生的事（供闲谈时自然引用，不要复述）：\n${mainContext}`,
        });
      }
      if (historyText) {
        ordered_prompts.push({ role: 'system', content: `以下是圆桌此前的谈话：\n${historyText}` });
      }
      ordered_prompts.push({ role: 'user', content: userText });

      const reply = await generateIsolated({
        user_input: userText,
        should_silence: true,
        ordered_prompts,
      });

      // 解析全部 <名字|态度>发言</名字> 段
      const turns: RoundtableTurn[] = [];
      const re = /<([^>|]+)\|([^>]*)>([\s\S]*?)<\/\1>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(reply)) !== null) {
        const name = m[1].trim();
        const known = session.participants.find(p => p.name === name || p.name.includes(name) || name.includes(p.name));
        turns.push({ name: known?.name || name, mood: m[2].trim(), text: m[3].trim() });
      }
      if (turns.length === 0) {
        turns.push({ name: '圆桌', mood: '', text: reply.trim() });
      }

      session.messages.push({ role: 'round', turns, timestamp: Date.now() });

      // 超长裁剪（圆桌无自动总结，静默保留最近一半）
      if (session.messages.length > ROUNDTABLE_MAX) {
        session.messages = session.messages.slice(-Math.floor(ROUNDTABLE_MAX / 2));
      }
      roundtable.value = { ...session };
      saveJson(ROUNDTABLE_STORAGE_KEY, session);
    } catch (e: any) {
      console.warn('[英灵功能] 圆桌生成失败:', e?.message || e);
      toastr.error('圆桌谈话没能继续……（生成失败）', '英灵殿');
    } finally {
      rtLoading.value = false;
    }
  }

  // ---- 消息操作：编辑 ----
  function editMessage(index: number, newContent: string) {
    if (index < 0 || index >= messages.value.length) return;
    messages.value[index].content = newContent;
    const hero = selectedHero.value;
    if (hero) saveMessages(storageKeyOf(hero), messages.value);
  }

  // ---- 消息操作：删除 ----
  function deleteMessage(index: number) {
    if (index < 0 || index >= messages.value.length) return;
    messages.value.splice(index, 1);
    const hero = selectedHero.value;
    if (hero) saveMessages(storageKeyOf(hero), messages.value);
  }

  // ---- 消息操作：撤回（移除最后一组对话） ----
  function recallLast() {
    if (messages.value.length === 0) return;
    // 移除最后的 assistant 消息
    if (messages.value[messages.value.length - 1].role === 'assistant') {
      messages.value.pop();
    }
    // 移除最后的 user 消息
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user') {
      messages.value.pop();
    }
    const hero = selectedHero.value;
    if (hero) saveMessages(storageKeyOf(hero), messages.value);
  }

  // ---- 消息操作：重新生成 AI 回复 ----
  async function regenerateMessage(index: number): Promise<void> {
    if (index < 0 || index >= messages.value.length || loading.value) return;
    const msg = messages.value[index];
    if (msg.role !== 'assistant') return;

    const hero = selectedHero.value;
    if (!hero) return;

    // 移除这条 AI 消息
    messages.value.splice(index, 1);
    saveMessages(storageKeyOf(hero), messages.value);

    // 找到它前面的 user 消息
    let userIdx = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (messages.value[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx < 0) return;

    const userText = messages.value[userIdx].content;
    loading.value = true;

    try {
      const historyWithoutLast = messages.value.slice(0, userIdx)
        .map(m => `${m.role === 'user' ? '你' : hero.displayName}：${m.content}`)
        .join('\n\n');

      const ordered_prompts = buildChatPrompts(hero, historyWithoutLast, userText);

      const result = await generateRaw({
        user_input: userText,
        should_silence: true,
        ordered_prompts,
      });

      let reply = typeof result === 'string' ? result : String(result);
      const parsed = parseAnyTaggedContent(reply);
      reply = parsed.content;
      const mood = parsed.mood;

      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now(), mood };
      messages.value.push(assistantMsg);
      saveMessages(storageKeyOf(hero), messages.value);

      recordInfluence(hero);
    } catch (e: any) {
      console.warn('[英灵功能] 重新生成失败:', e?.message || e);
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `（${hero.displayName}似乎陷入了沉默……）`,
        timestamp: Date.now(),
      };
      messages.value.push(errMsg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 注册主线上下文注入监听器。
   * ★无条件在 store 初始化时注册：监听器随 iframe 生命周期存活，
   * 旧版用脚本变量记「已注册」标记，刷新后标记仍在而监听器已亡，导致注入静默失效。
   */
  function registerInjectionListener() {
    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }: any) => {
      // 非 RP 工具生成（技能树/总结/装备定制等）不注入英灵互动与共鸣状态，避免污染工具任务
      if ((window as any).__ISURIA_NON_RP__) return;
      try {
        const stored = getVariables({ type: 'script' });
        const allChats = stored[CHAT_STORAGE_KEY] as Record<string, ChatMessage[]> | undefined;
        const heroInfoMap = stored['hero_spirit_influence'] as Record<string, any> | undefined;
        const summaryMap = stored[CHAT_SUMMARY_KEY] as Record<string, string> | undefined;
        const anecdoteMap = stored[ANECDOTE_STORAGE_KEY] as Record<string, AnecdoteRecord> | undefined;
        const hasChats = allChats && Object.keys(allChats).length > 0;
        const hasAnecdotes = anecdoteMap && Object.values(anecdoteMap).some(r => r.list?.length > 0);
        if (!hasChats && !hasAnecdotes) return;

        // ---- 英灵共鸣状态注入（英灵共鸣系统 v2：让 AI 感知残响/被动/执念并结算） ----
        try {
          const resoMarker = '【英灵共鸣状态】';
          const resoInjected = (chat || []).some((m: any) => String(m?.content || '').includes(resoMarker));
          const s = readSpiritRuntime();
          if (!resoInjected && s) {
            const resoLines: string[] = [];
            const name = String(s.名称 || '');
            const power = Number(s.残响之力 || 0);
            const status = String(s.状态 || '苏醒');
            const bond = Number(s.羁绊值 || 0);
            const skillName = String(s.英灵技?.名称 || '');
            const cooldown = Number(s.英灵技?.冷却 || 0);
            const passives = Object.entries(s.被动效果 || {}).map(([k, v]) => `${k}（${v}）`).join('、');
            const obsession = s.执念 || {};
            resoLines.push(`契主英灵：${name || '无'}｜状态：${status}｜残响之力：${power}/100｜羁绊值：${bond}`);
            if (skillName) resoLines.push(`英灵技：${skillName}（释放条件：残响=100 且 苏醒 且 冷却=0；当前冷却 ${cooldown}）`);
            if (passives) resoLines.push(`生效被动：${passives}`);
            if (obsession?.内容) resoLines.push(`执念：${obsession.内容}（进度 ${obsession.进度 || 0}%）${obsession.是否完成 ? '【已完成】' : ''}`);
            if (name) {
              chat.unshift({
                role: 'system',
                content: `${resoMarker}\n以下为当前契主英灵的运行时状态（战斗/检定结算必须遵守被动加成与英灵技释放规则，不要复述本段）：\n${resoLines.join('\n')}`,
              });
            }
          }
        } catch { /* ignore resonance inject */ }

        const marker = '【英灵/同伴互动概要】';
        const alreadyInjected = (chat || []).some((m: any) => String(m?.content || '').includes(marker));
        if (alreadyInjected) return;

        const lines: string[] = [];
        // 遍历所有英灵/同伴：注入「自动总结概要 + 最近对话」
        if (hasChats) {
          for (const [key, msgs] of Object.entries(allChats!)) {
            if (!msgs || msgs.length === 0) continue;
            const heroInfo = heroInfoMap?.[key] as any;
            // 旧版同伴聊天以两字简称存键，显示名从当前同伴表兜底解析
            let displayName = heroInfo?.displayName;
            if (!displayName) {
              const comp = companions.value.find(c => c.shortName === key);
              displayName = comp ? comp.displayName : key;
            }
            const logIcon = heroInfo?.log || '✦';
            const summary = summaryMap?.[key] || '';

            const block: string[] = [];
            if (summary) block.push(`【概要】${summary}`);
            if (msgs.length > 0) block.push(`【最近对话】\n${condenseChatSummary(msgs, displayName)}`);

            lines.push(`${logIcon} === 与 ${displayName} 的互动概要 ===`);
            lines.push(block.join('\n'));
            lines.push(''); // 空行分隔
          }
        }

        // 回忆碎片：只注入标题清单（token 极省），供主线回收当伏笔
        if (hasAnecdotes) {
          const fragLines: string[] = [];
          for (const [key, record] of Object.entries(anecdoteMap!)) {
            if (!record.list?.length) continue;
            const heroInfo = heroInfoMap?.[key] as any;
            let displayName = heroInfo?.displayName;
            if (!displayName) {
              const comp = companions.value.find(c => c.shortName === key);
              displayName = comp ? comp.displayName : key.replace(/^同伴:/, '');
            }
            fragLines.push(`· ${displayName}：${record.list.map(a => `《${a.title}》`).join('')}`);
          }
          if (fragLines.length) {
            lines.push(`=== 已听过的回忆碎片（主线中可自然引用其细节作为伏笔/谈资） ===`);
            lines.push(fragLines.join('\n'));
            lines.push('');
          }
        }

        if (lines.length > 0) {
          chat.unshift({
            role: 'system',
            content: `以下是你与英灵和同伴们的互动概要（旧对话已自动总结，作为外界互动参考，不要直接复述，也不要让私聊细节喧宾夺主地影响主线叙事）：\n${lines.join('\n')}`,
          });
        }
      } catch { /* ignore inject errors */ }
    });
  }

  function clearChat() {
    messages.value = [];
    // 同时清除存储与自动总结概要
    const hero = selectedHero.value;
    if (hero) {
      saveMessages(storageKeyOf(hero), []);
      saveSummary(storageKeyOf(hero), '');
    }
  }

  // ---- 初始化 ----
  loadHeroesFromWorldbook();
  refreshSpiritRuntime();
  loadRoundtable();
  anecdotes.value = loadJson<Record<string, AnecdoteRecord>>(ANECDOTE_STORAGE_KEY, {});
  registerInjectionListener();
  // 变量更新结束后自动刷新英灵共鸣数据（残响/羁绊/被动/执念变化实时反映到面板）
  try {
    const mvu = (window as any).Mvu;
    if (mvu?.events?.VARIABLE_UPDATE_ENDED && typeof eventOn === 'function') {
      eventOn(mvu.events.VARIABLE_UPDATE_ENDED, () => {
        refreshSpiritRuntime();
        // 同伴好感度/HP/位置同样实时刷新（保留当前选中的同伴引用）
        const sel = selectedHero.value;
        companions.value = loadCompanions();
        if (sel?.isCompanion) {
          const fresh = companions.value.find(c => c.displayName === sel.displayName);
          if (fresh) selectedHero.value = fresh;
        }
      });
    }
  } catch { /* ignore */ }

  return {
    heroes,
    companions,
    selectedHero,
    messages,
    loading,
    panelExpanded,
    viewMode,
    activeTab,
    spiritRuntime,
    hall,
    anecdotes,
    anecdoteLoading,
    anecdoteViewHero,
    roundtable,
    rtLoading,
    refreshSpiritRuntime,
    hallInfo,
    isHeroSleeping,
    releaseSpiritSkill,
    switchTab,
    loadHeroesFromWorldbook,
    loadCompanions,
    selectHero,
    openDetail,
    openAnecdotes,
    closeAnecdotes,
    anecdoteListOf,
    anecdoteCountOf,
    bondTierOf,
    generateAnecdote,
    startRoundtable,
    sendRoundtable,
    endRoundtable,
    sendMessage,
    clearChat,
    editMessage,
    deleteMessage,
    recallLast,
    regenerateMessage,
    goBack,
  };
});
