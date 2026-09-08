export interface ChatMessage {
  sender: string;
  timestamp: string;
  content: string;
}

export interface PersonaInfo {
  enabled: boolean;
  avatar: string;
  realName: string;
  nickname: string;
  onlineName: string;
  gender: string;
  age: string;
  callYou: string;
  affection: string;
  relationship: string;
  reason: string;
  whenAdded: string;
  personality: string;
  appearance: string;
  backgroundStory: string;
  currentStatus: string;
  notes: string;
}

export interface ContactData {
  persona: PersonaInfo;
  messages: ChatMessage[];
}

const PERSONA_TAG = '<人设>';
const PERSONA_END_TAG = '</人设>';
const CHAT_TAG = '<聊天消息>';
const CHAT_END_TAG = '</聊天消息>';

export const DEFAULT_PERSONA_TEXT = '暂时还不了解';

export function makeEmptyPersonaInfo(realName: string): PersonaInfo {
  return {
    enabled: true,
    avatar: '',
    realName: realName.trim(),
    nickname: '',
    onlineName: '',
    gender: '',
    age: '',
    callYou: '',
    affection: '',
    relationship: '',
    reason: '',
    whenAdded: '',
    personality: '',
    appearance: '',
    backgroundStory: '',
    currentStatus: '',
    notes: '',
  };
}

export function makeDefaultPersonaInfo(realName: string): PersonaInfo {
  const info = makeEmptyPersonaInfo(realName);
  (Object.keys(info) as Array<keyof PersonaInfo>).forEach((key) => {
    if (key === 'realName' || key === 'nickname' || key === 'onlineName') return;
    (info as any)[key] = DEFAULT_PERSONA_TEXT;
  });
  return info;
}

export function normalizePersonaInfo(info: PersonaInfo): PersonaInfo {
  const normalized: PersonaInfo = { ...info };
  (Object.keys(normalized) as Array<keyof PersonaInfo>).forEach((key) => {
    if (key === 'realName' || key === 'nickname' || key === 'onlineName') return;
    const value = String(normalized[key] ?? '').trim();
    (normalized as any)[key] = value || DEFAULT_PERSONA_TEXT;
  });
  return normalized;
}

export function parsePersonaInfo(raw: string, fallbackName: string): PersonaInfo {
  const trimmed = raw.trim();
  if (!trimmed) {
    return makeDefaultPersonaInfo(fallbackName);
  }

  // 尝试解析新版的 JSON 格式
  try {
    const parsed = JSON.parse(trimmed) as Partial<PersonaInfo>;
    if (parsed && typeof parsed === 'object' && parsed.realName) {
      const defaults = makeDefaultPersonaInfo(parsed.realName || fallbackName);
      return { ...defaults, ...parsed };
    }
  } catch {
    // 不是 JSON，按旧格式纯文本处理
  }

  // 旧格式兼容：将整段文本作为 notes
  const info = makeDefaultPersonaInfo(fallbackName);
  info.notes = trimmed;
  return info;
}

export function formatPersonaInfo(info: PersonaInfo): string {
  return JSON.stringify(info, null, 2);
}

export function getContactDisplayName(info: PersonaInfo): string {
  return info.nickname || info.onlineName || info.realName || '未命名';
}

export function formatPersonaInfoForPrompt(info: PersonaInfo): string {
  const v = (key: keyof PersonaInfo) => {
    const value = info[key];
    if (value === undefined || value === null || value === '' || value === DEFAULT_PERSONA_TEXT) return null;
    return String(value).trim();
  };

  const lines: string[] = [];
  const push = (label: string, key: keyof PersonaInfo) => {
    const value = v(key);
    if (value) lines.push(`${label}：${value}`);
  };

  push('你的名字', 'realName');
  push('你和玩家的关系', 'relationship');
  push('你和玩家成为好友的原因', 'reason');
  push('你和玩家成为好友的时间', 'whenAdded');
  push('你的备注名', 'nickname');
  push('你的网名', 'onlineName');
  push('你的性别', 'gender');
  push('你的年龄', 'age');
  push('你称呼玩家', 'callYou');
  push('你对玩家的好感度', 'affection');
  push('你的性格', 'personality');
  push('你的外貌', 'appearance');
  push('你的背景故事', 'backgroundStory');
  push('你的当前状态', 'currentStatus');
  push('关于你的备注', 'notes');

  return lines.length > 0 ? lines.join('\n') : '暂无详细资料。';
}

export function parseContactContent(content: string, fallbackName = ''): ContactData {
  const persona = extractBlock(content, PERSONA_TAG, PERSONA_END_TAG);
  const chatBlock = extractBlock(content, CHAT_TAG, CHAT_END_TAG);
  const messages = chatBlock
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(parseMessageLine)
    .filter((m): m is ChatMessage => m !== null);
  return {
    persona: parsePersonaInfo(persona, fallbackName),
    messages,
  };
}

function extractBlock(content: string, startTag: string, endTag: string): string {
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);
  if (start === -1 || end === -1 || end <= start) {
    return '';
  }
  return content.slice(start + startTag.length, end).trim();
}

function parseMessageLine(line: string): ChatMessage | null {
  const match = line.match(/^([^|]+)\|([^|]+)\|(.*)$/);
  if (!match) return null;
  const sender = match[1].trim();
  const timestamp = match[2].trim();
  const content = unescapeField(match[3]).trim();
  if (!sender || !timestamp || !content) return null;
  return { sender, timestamp, content };
}

function escapeField(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '\\n')
    .replace(/<人设>/g, '\\<人设>')
    .replace(/<\/人设>/g, '\\</人设>')
    .replace(/<聊天消息>/g, '\\<聊天消息>')
    .replace(/<\/聊天消息>/g, '\\</聊天消息>')
    .replace(/<回复>/g, '\\<回复>')
    .replace(/<\/回复>/g, '\\</回复>')
    .replace(/<语音>/g, '\\<语音>')
    .replace(/<\/语音>/g, '\\</语音>');
}

function unescapeField(value: string): string {
  return value
    .replace(/\\<\/聊天消息>/g, '</聊天消息>')
    .replace(/\\<聊天消息>/g, '<聊天消息>')
    .replace(/\\<\/人设>/g, '</人设>')
    .replace(/\\<人设>/g, '<人设>')
    .replace(/\\<\/回复>/g, '</回复>')
    .replace(/\\<回复>/g, '<回复>')
    .replace(/\\<\/语音>/g, '</语音>')
    .replace(/\\<语音>/g, '<语音>')
    .replace(/\\n/g, '\n')
    .replace(/\\\|/g, '|')
    .replace(/\\\\/g, '\\');
}

export function formatContactContent(data: ContactData): string {
  const messagesText = data.messages
    .map(m => `${m.sender}|${m.timestamp}|${escapeField(m.content)}`)
    .join('\n');
  return `${PERSONA_TAG}\n${formatPersonaInfo(data.persona)}\n${PERSONA_END_TAG}\n\n${CHAT_TAG}\n${messagesText}\n${CHAT_END_TAG}`;
}

export function makeEmptyContactContent(realName = ''): string {
  return formatContactContent({ persona: makeDefaultPersonaInfo(realName), messages: [] });
}

export function nowTimestamp(): string {
  return new Date().toISOString();
}

export interface TransferInfo {
  from: string;
  to: string;
  amount: string;
}

export type RenderItem =
  | { kind: 'text'; content: string }
  | { kind: 'voice'; transcript: string }
  | { kind: 'transfer'; info: TransferInfo };

export interface VariableUpdate {
  contactName: string;
  affection?: string;
  relationship?: string;
  onlineName?: string;
}

export function formatTransferTag(from: string, to: string, amount: string): string {
  return `<发起转账>（${from}）给（${to}）进行了（${amount}）的转账</发起转账>`;
}

export function parseTransferTag(content: string): TransferInfo | null {
  const match = content.match(/<发起转账>\s*（([^）]+)）给（([^）]+)）进行了（([^）]+)）的转账\s*<\/发起转账>/);
  if (!match) return null;
  return {
    from: match[1].trim(),
    to: match[2].trim(),
    amount: match[3].trim(),
  };
}

export function isTransferMessage(content: string): boolean {
  return /<发起转账>[\s\S]*?<\/发起转账>/.test(content);
}

export function parseMessageItems(content: string): RenderItem[] {
  const safeContent = content ?? '';
  const items: RenderItem[] = [];
  const replyRegex = /<回复>([\s\S]*?)<\/回复>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = replyRegex.exec(safeContent)) !== null) {
    const before = safeContent.slice(lastIndex, match.index).trim();
    if (before) {
      items.push(...parseSegments(before));
    }
    const replyContent = match[1].trim();
    if (replyContent) {
      items.push(...parseSegments(replyContent));
    }
    lastIndex = replyRegex.lastIndex;
  }

  const after = safeContent.slice(lastIndex).trim();
  if (after) {
    items.push(...parseSegments(after));
  }

  return items;
}

function parseSegments(text: string): RenderItem[] {
  const segments: RenderItem[] = [];
  const voiceRegex = /<语音>([\s\S]*?)<\/语音>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = voiceRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      segments.push(...parseTextSegment(before));
    }
    const transcript = match[1].trim();
    if (transcript) {
      segments.push({ kind: 'voice', transcript });
    }
    lastIndex = voiceRegex.lastIndex;
  }

  const after = text.slice(lastIndex).trim();
  if (after) {
    segments.push(...parseTextSegment(after));
  }

  return segments;
}

function parseTextSegment(text: string): RenderItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (isTransferMessage(trimmed)) {
    const info = parseTransferTag(trimmed);
    if (info) return [{ kind: 'transfer', info }];
  }
  return [{ kind: 'text', content: trimmed }];
}

export function parseVariableUpdates(content: string): { updates: VariableUpdate[]; cleanText: string } {
  const updates: VariableUpdate[] = [];
  const cleanText = content
    .replace(/<更新\s+[^>]*>[\s\S]*?<\/更新>/g, (match) => {
      const update = parseSingleUpdate(match);
      if (update) updates.push(update);
      return '';
    })
    .trim();
  return { updates, cleanText };
}

function parseSingleUpdate(xml: string): VariableUpdate | null {
  const contactMatch = xml.match(/<更新\s+[^>]*联系人=["']([^"']+)["']/);
  if (!contactMatch) return null;
  const contactName = contactMatch[1].trim();
  const update: VariableUpdate = { contactName };

  const affectionMatch = xml.match(/<好感度>([\s\S]*?)<\/好感度>/);
  if (affectionMatch) update.affection = affectionMatch[1].trim();

  const relationshipMatch = xml.match(/<关系>([\s\S]*?)<\/关系>/);
  if (relationshipMatch) update.relationship = relationshipMatch[1].trim();

  const onlineNameMatch = xml.match(/<网名>([\s\S]*?)<\/网名>/);
  if (onlineNameMatch) update.onlineName = onlineNameMatch[1].trim();

  return update;
}
