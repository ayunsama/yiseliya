<template>
  <div class="battle-ui">
    <!-- 卷首 -->
    <div class="battle-header">
      <div class="bh-title">⚔ 战斗轮</div>
      <div class="bh-sub">
        第 {{ snap.round }} 轮 · {{ snap.environment || '未知环境' }}
        <span v-if="snap.surprise"> · 突袭：{{ snap.surprise }}</span>
        <span v-if="snap.turn"> · 行动：{{ snap.turn }}</span>
      </div>
      <div class="bh-btns">
        <button class="bh-btn" @click="showSnap = !showSnap">{{ showSnap ? '▾ 收起快照' : '▸ 展开快照' }}</button>
        <button class="bh-btn" :class="{ on: autoFight }" @click="autoFight = !autoFight" :title="autoFight ? '自动战斗：非主角单位自动行动' : '自动战斗：点击开启'">
          ⚡ {{ autoFight ? '自动战斗:开' : '自动战斗:关' }}
        </button>
        <button v-if="!ended" class="bh-btn" @click="endBattleManually">🕊️ 结束战斗</button>
      </div>
    </div>

    <!-- 快照（可折叠，羊皮纸左右对峙） -->
    <div v-show="showSnap" class="snap-slot">
      <SnapshotPanel :snap="snap" :allies="allies" :enemies="enemies" />
    </div>

    <!-- 开战前情（默认收起：开战楼层的原始推演内容，不占战斗主界面） -->
    <details v-if="openingHtml" class="prelude-block">
      <summary>📜 开战前情</summary>
      <div class="prelude-body" v-html="openingHtml"></div>
    </details>

    <!-- 推演区（中间） -->
    <div class="chat-area" ref="chatRef">
      <div v-if="!messages.length" class="chat-empty">
        <div class="empty-seal">⚔</div>
        <div>战斗开始！在下方输入你的行动、台词或描述…</div>
      </div>
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div class="msg-label">{{ m.label || (m.role === 'user' ? '✦ 你' : '✒ GM') }}</div>
        <div class="msg-body" v-html="m.html"></div>
      </div>
      <div v-if="loading" class="msg assistant">
        <div class="msg-label">✒ GM</div>
        <div class="msg-body typing">推演中…</div>
      </div>
    </div>

    <!-- 羊皮纸操作面板：预设 + 技能（过滤被动） + 附赠（药水） + 物品栏 -->
    <div class="action-panel">
      <div class="ap-row">
        <span class="sb-label">预设</span>
        <button class="pb-btn" @click="insertText('攻击')">⚔ 攻击</button>
        <button class="pb-btn" @click="insertText('防御')">🛡 防御</button>
        <button class="pb-btn" @click="insertText('待机')">⏳ 待机</button>
        <button class="pb-btn" @click="insertText('移动')">👣 移动</button>
        <button class="pb-btn" @click="insertText('使用物品')">🎒 使用物品</button>
      </div>
      <div class="ap-row" v-if="skills.length">
        <span class="sb-label">动作</span>
        <button v-for="s in skills" :key="s.name" class="sb-btn" :title="s.desc" @click="insertSkill(s)">
          {{ s.type === '魔法' ? '✦' : (s.type === '神术' ? '✧' : '⚔') }} {{ s.name }}
        </button>
      </div>
      <div class="ap-row">
        <span class="sb-label">附赠</span>
        <button class="sb-btn" @click="insertText('【附赠动作】副手攻击')">⚔ 副手攻击</button>
        <button v-for="p in potions" :key="p.name" class="sb-btn" :title="p.desc" @click="insertText('【附赠动作】喝药水（' + p.name + '）')">
          🧪 喝药水·{{ p.name }}{{ p.count > 1 ? '×' + p.count : '' }}
        </button>
      </div>
      <div class="ap-row items-row" v-if="items.length">
        <span class="sb-label">物品</span>
        <button v-for="it in items" :key="it.name" class="pb-btn" :title="it.desc" @click="insertText('使用【' + it.name + '】')">
          {{ it.name }}×{{ it.count }}
        </button>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area">
      <textarea
        v-model="input"
        rows="2"
        :disabled="loading || ended"
        placeholder="输入你的操作 / 台词 / 描述（RP）… Enter 发送"
        @keydown.enter.prevent="send"
      ></textarea>
      <button class="send-btn" :disabled="loading || ended || !input.trim()" @click="send">➤</button>
    </div>

    <div v-if="ended" class="ended-bar">
      🕊️ 战斗结束（{{ battleResult }}）· 结果已注入上下文，关闭界面后回到正常对话
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { injectStreamingMessageContext } from '@util/streaming';
import { teleportStyle } from '@util/script';
import SnapshotPanel from './SnapshotPanel.vue';
import { replaceDiceMacros } from './dice';
import {
  applyUpdateVariable,
  buildBattleSystemPrompt,
  extractBattleResult,
  extractDataBlocks,
  extractStateChanges,
  isBattleEnd,
  mergeEnemyData,
  normalizeKeyValue,
  parseBattleStart,
  parseEnemyDataBlock,
} from './combat';
import { buildFriendlySnapshot, getBattleData, getBattleDataFromStat, type AllyUnit, type BattleSnapshot, type EnemyUnit } from './store';

const context = injectStreamingMessageContext();

// ---- 战斗状态 ----
const snap = ref<BattleSnapshot>({ active: true, round: 1, environment: '', surprise: '', turn: '', turnIndex: 0, initiative: [], enemies: {}, extraAllies: {}, log: [] });
const allies = ref<AllyUnit[]>([]);
const enemies = ref<EnemyUnit[]>([]);
const messages = ref<{ role: 'user' | 'assistant'; content: string; html: string; label?: string }[]>([]);
const input = ref('');
const loading = ref(false);
const ended = ref(false);
const battleResult = ref('');
const showSnap = ref(true);
const openingHtml = ref('');
const autoFight = ref(false); // 自动战斗：非主角单位自动行动
let lastAutoUnit = '';        // 防止同一单位重复自动触发
const chatRef = ref<HTMLElement | null>(null);
/** 主角技能（动作组：技能/魔法/神术，过滤被动技能） */
const skills = ref<{ name: string; type: '技能' | '魔法' | '神术'; desc: string }[]>([]);
/** 主角物品栏（供快速查看与喝药水） */
const items = ref<{ name: string; count: number; desc: string }[]>([]);
/** 附赠动作：物品栏中带"药水/药剂"字样的道具（喝药水 = 附赠动作） */
const potions = computed(() => items.value.filter(i => /药水|药剂|药/.test(i.name)));
/** 契约英灵：世界书条目内容（无契约英灵时为空，英灵段规则自动忽略） */
const spiritName = ref('');
const spiritContent = ref('');

/**
 * 检测契约英灵（stat_data.英灵.名称 非空）并从世界书读取「英灵/英灵名」条目内容，
 * 供战斗系统提示词引用（英灵的大招/干涉方式/苏醒条件严格以此为准）。
 */
async function loadSpirit(): Promise<void> {
  try {
    const all = typeof getAllVariables === 'function' ? getAllVariables() : {};
    const spirit = _.get(all, 'stat_data.英灵', {});
    const name = String(spirit?.名称 || '').trim();
    if (!name) { spiritName.value = ''; spiritContent.value = ''; return; }
    spiritName.value = name;
    if (spiritContent.value && spiritName.value) return; // 已加载过
    if (typeof getWorldbook !== 'function') return;      // 运行环境无世界书接口
    const entries = await getWorldbook('伊瑟利亚');
    if (!Array.isArray(entries) || !entries.length) return;
    const clean = name.replace(/（[^）]*）|\([^)]*\)/g, '').trim(); // 去「（残响）」类后缀
    const entry = entries.find((e: any) => {
      const short = String(e?.name || '').replace(/^英灵\/?/, '');
      return short === clean || short.includes(clean) || (clean.length >= 2 && clean.includes(short));
    });
    if (entry?.content) {
      spiritContent.value = String(entry.content).slice(0, 3000);
      return;
    }
    // 兜底：世界书可能是合集条目（如「诸英灵」一个条目内含多个「英灵/英灵名:」分段）
    for (const e of entries) {
      const content = String(e?.content || '');
      const idx = content.indexOf(`英灵/${clean}`);
      if (idx < 0) continue;
      const rest = content.slice(idx);
      const segEnd = rest.indexOf('\n英灵/', 1);
      spiritContent.value = (segEnd > 0 ? rest.slice(0, segEnd) : rest).slice(0, 3000);
      return;
    }
  } catch (e) {
    console.warn('[战斗轮] 英灵读取失败:', e?.message || e);
  }
}

// ---- 工具 ----
function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripSystemTags(t: string): string {
  return String(t)
    .replace(/<!--[\s\S]*?-->/g, '') // HTML 注释（AI 的旁注）一律屏蔽
    .replace(/<enemy_data>[\s\S]*?<\/enemy_data>/g, '')
    .replace(/<ally_data>[\s\S]*?<\/ally_data>/g, '')
    .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/g, '')
    .replace(/<Analysis>[\s\S]*?<\/Analysis>/g, '')
    .replace(/<JSONPatch>[\s\S]*?<\/JSONPatch>/g, '')
    .replace(/<StatusPlaceHolderImpl\s*\/?\s*>/g, '')
    .replace(/<小总结>[\s\S]*?<\/小总结>/g, '')
    .replace(/<time_bar>[\s\S]*?<\/time_bar>/g, '')
    .replace(/<dream_parallel_event>\s*([\s\S]*?)\s*<\/dream_parallel_event>/g, '')
    // 伊瑟利亚中文标签：思维链（折叠处理走渲染层，这里剥离防泄露）/ content 包裹 / pp 心理描写
    .replace(/<思维链>[\s\S]*?<\/思维链>/g, '')
    .replace(/<content>/g, '')
    .replace(/<\/content>/g, '')
    .replace(/<pp>/g, '')
    .replace(/<\/pp>/g, '')
    .replace(/^\s*⚔️战斗轮[^\n]*\n?/m, '')
    .replace(/^\s*敌人[:：][^\n]*\n?/m, '');
}

/** 结算块类型 → 体系色 class（融合伊瑟利亚战斗轮结算的 ph-* 体系色） */
const TYPE_CLASS: Record<string, string> = {
  战况总览: 'ph-overview',
  行动执行: 'ph-action',
  武技结算: 'ph-weapon',
  战技结算: 'ph-arts',
  魔法结算: 'ph-magic',
  神术结算: 'ph-holy',
  生死判定: 'ph-life',
  战斗结束: 'ph-end',
  攻击结算: 'ph-weapon',
  施法结算: 'ph-magic',
  生产结算: 'ph-craft',
  锻造结算: 'ph-craft',
  炼金结算: 'ph-craft',
  工艺结算: 'ph-craft',
  附魔结算: 'ph-craft',
};

/** 从结算文本提取字段数值（命中/伤害等，供 {{calc:}} 宏引用） */
function buildFieldValues(text: string): Record<string, number> {
  const map: Record<string, number> = {};
  String(text || '').split('\n').forEach(l => {
    const m = l.match(/^(命中检定\d*|伤害结算\d*|伤害检定\d*|伤害计算|掷骰)\s*[:：]\s*[\s\S]*?(?:🎲\s*(\d+)|=\s*(\d+)|\(\s*(\d+)\s*\))/);
    if (m) {
      const key = m[1].replace(/\d+$/, '');
      const val = parseInt(m[2] || m[3] || m[4], 10);
      if (!isNaN(val) && map[key] === undefined) map[key] = val;
    }
  });
  return map;
}

/** 解析 {{calc:表达式}} 宏：支持 + - * / ( ) 与字段引用（如 {{calc:45-伤害结算}}） */
function resolveCalcMacros(text: string, fieldVals: Record<string, number>): string {
  return String(text || '').replace(/\{\{calc:([^}]+)\}\}/g, (_m, expr) => {
    const resolved = String(expr)
      .replace(/伤害结算|伤害检定|命中检定|掷骰|最终伤害/g, k => String(fieldVals[k] ?? 0));
    if (!/^[\d\s+\-*/()]+$/.test(resolved)) return `{{calc:${expr}}}`;
    try {
      const v = new Function('return (' + resolved + ')')();
      return String(typeof v === 'number' && isFinite(v) ? Math.max(0, Math.round(v)) : v);
    } catch {
      return `{{calc:${expr}}}`;
    }
  });
}

/** 渲染键值行（含行级分级：骰子/暴击/失败/资源/提示） */
function renderRow(key: string, val: string): string {
  const k = String(key || '').trim();
  const v = String(val || '').trim();
  let cls = '';
  // 骰子行（命中/伤害/检定）
  if (/命中|检定|掷骰|伤害/.test(k)) cls = 'row-dice';
  // 暴击 / 大失败
  if (/暴击|自然20/.test(v)) cls = 'row-crit';
  else if (/未命中|大失败|自然1/.test(v)) cls = 'row-fail';
  // 资源/状态变更行
  if (/资源剩余/.test(k)) cls = 'row-resource';
  else if (/状态变更/.test(k)) cls = 'row-change';
  // 提示行
  if (/提示/.test(k)) cls = 'row-hint';
  return `<div class="battle-row${cls ? ' ' + cls : ''}"><span class="battle-key">${escapeHtml(k)}</span>${escapeHtml(v)}</div>`;
}

function renderBattleBlock(block: string): string {
  const body = block.replace(/<\/?战斗结算>/g, '');
  let blockCls = '';
  let html = '';
  body.split('\n').forEach(line => {
    const t = line.trim();
    if (!t) return;
    const titleM = t.match(/^[【\{]([^】\}]+)[】\}]$/);
    if (titleM) {
      const title = titleM[1].trim();
      // 第一个标题行决定块的体系色
      if (!html) {
        const base = Object.keys(TYPE_CLASS).find(tk => title.startsWith(tk) || title.includes(tk));
        blockCls = base ? TYPE_CLASS[base] : '';
      }
      html += `<div class="battle-title">${escapeHtml(title)}</div>`;
    } else if (t.startsWith('|')) {
      const kv = t.slice(1).trim();
      const sep = kv.indexOf(':');
      if (sep > 0) {
        html += renderRow(kv.slice(0, sep), kv.slice(sep + 1));
      } else {
        html += `<div class="battle-row">${escapeHtml(kv)}</div>`;
      }
    } else {
      html += `<div class="battle-text">${escapeHtml(t)}</div>`;
    }
  });
  return `<div class="battle-block${blockCls ? ' ' + blockCls : ''}">${html}</div>`;
}

/** 文本 → 显示 HTML：先拆 思维链<thinking>/<思维链> 与 正文<output>，再渲染结算块/裸结算行 */
function renderToHtml(text: string): string {
  // 标签归一：content 剥标签、pp 心理描写 → 斜体标记（渲染后替换）；分行键值 → 同行；注释屏蔽
  const normalized = normalizeKeyValue(String(text))
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<content>/g, '')
    .replace(/<\/content>/g, '')
    .replace(/<pp>/g, '⟦')
    .replace(/<\/pp>/g, '⟧');
  const parts = normalized.split(/(<thinking>[\s\S]*?<\/thinking>|<思维链>[\s\S]*?<\/思维链>|<output>[\s\S]*?<\/output>)/g);
  const html = parts.map(part => {
    const tm = part.match(/^<(thinking|思维链)>([\s\S]*?)<\/\1>$/);
    if (tm) {
      // 思维链：独立折叠卡片（默认收起，点击展开）
      const body = renderPlain(String(tm[2]).trim());
      return `<details class="think-block"><summary>🧠 战斗思维链</summary><div class="think-body">${body}</div></details>`;
    }
    const om = part.match(/^<output>([\s\S]*?)<\/output>$/);
    if (om) return renderInner(String(om[1]));
    return renderInner(part);
  }).join('');
  // pp 斜体还原（此时已 escape，⟦⟧ 为安全标记）
  return html.replace(/⟦/g, '<em class="pp-think">').replace(/⟧/g, '</em>');
}

/** 正文渲染：<战斗结算> 羊皮纸块 + 裸结算行美化 + 叙述段落 */
function renderInner(text: string): string {
  const parts = String(text).split(/(<战斗结算>[\s\S]*?<\/战斗结算>)/g);
  return parts.map(part => {
    if (part.startsWith('<战斗结算>')) return renderBattleBlock(part);
    return renderPlain(part);
  }).join('');
}

/** 裸文本渲染：识别结算标题行与键值行（| 前缀 或 常见战斗键名）→ 羊皮纸块；叙述行 → 普通段落 */
function renderPlain(text: string): string {
  const lines = String(text).split('\n');
  let html = '';
  let inBlock = false;
  const BLOCK_TITLES = /^(战况总览|行动执行|武技结算|战技结算|魔法结算|神术结算|生死判定|攻击结算|施法结算|生产结算|锻造结算|炼金结算|工艺结算|附魔结算|战斗结束)/;
  // 常见战斗键名（兼容 AI 未加 | 前缀的键值行）
  const KV_KEYS = /^(轮次|回合|环境|突袭|地形|战况|参战方|先攻序列|先攻|攻击方|施法者|目标|角色|类型|动作|瞄准部位|地形修正|资源消耗|掷骰|检定|判定结果|命中检定|命中|伤害结算|伤害检定|伤害计算|伤害|附加效果|效果|弱点|抗性|状态变更|附加状态|当前状态|状态|资源剩余|移动|附赠动作|位置|结果|战况提示|行动提示|提示|EXP计算|EXP|最终获得EXP|最终伤害|经验值更新|防御值|防御|HP|MP|SP|剩余)\s*[:：]?\s+(.+)$/;
  const closeBlock = () => { if (inBlock) { html += '</div>'; inBlock = false; } };
  lines.forEach(line => {
    const t = line.trim();
    if (!t) { closeBlock(); return; }
    // 结算标题行 → 体系色羊皮纸块
    if (BLOCK_TITLES.test(t)) {
      closeBlock();
      const base = Object.keys(TYPE_CLASS).find(tk => t.startsWith(tk) || t.includes(tk));
      const cls = base ? TYPE_CLASS[base] : '';
      html += `<div class="battle-block${cls ? ' ' + cls : ''}"><div class="battle-title">${escapeHtml(t)}</div>`;
      inBlock = true;
      return;
    }
    // 回合横幅：X 的回合（裸文本 → 羊皮纸横幅；兼容 **加粗**、# 标题、- 列表等 markdown 包裹，与行尾标点）
    const turnRaw = t.replace(/^[*#>\-–—\s]+/, '').replace(/\*/g, '').trim();
    const turnM = turnRaw.match(/^(.+?)(?:[（(]([^）)]*)[）)])?\s*的回合[：:。.，,、\s]*$/);
    if (turnM && turnM[1] && !turnM[1].includes('回合')) {
      closeBlock();
      const name = escapeHtml(turnM[1]);
      const mood = turnM[2] ? `<span class="turn-mood">（${escapeHtml(turnM[2])}）</span>` : '';
      html += `<div class="turn-banner"><span class="turn-deco">❖</span><span class="turn-name">${name}${mood}</span><span class="turn-word">的回合</span><span class="turn-deco">❖</span></div>`;
      return;
    }
    // | 键值行 或 常见键名行（无前缀）
    if (t.startsWith('|')) {
      if (!inBlock) { html += '<div class="battle-block">'; inBlock = true; }
      const kv = t.slice(1).trim();
      const sep = kv.indexOf(':');
      if (sep > 0) {
        html += renderRow(kv.slice(0, sep), kv.slice(sep + 1));
      } else {
        html += `<div class="battle-row">${escapeHtml(kv)}</div>`;
      }
      return;
    }
    const kvM = t.match(KV_KEYS);
    if (kvM) {
      if (!inBlock) { html += '<div class="battle-block">'; inBlock = true; }
      html += renderRow(kvM[1].trim(), kvM[2].trim());
      return;
    }
    // 叙述行（叙事样式）
    closeBlock();
    html += `<div class="battle-para">${escapeHtml(t)}</div>`;
  });
  closeBlock();
  return html;
}

function scrollToBottom(): void {
  nextTick(() => {
    if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight;
  });
}

function refreshSnapshot(): void {
  try {
    let stat: any = null;
    // 优先读「开战楼层」的变量（写入目标楼层，避免最新楼层不一致）
    try {
      if (typeof Mvu !== 'undefined' && Mvu.getMvuData) {
        stat = _.get(Mvu.getMvuData({ type: 'message', message_id: context.message_id }), 'stat_data');
      }
    } catch { /* ignore */ }
    if (!stat) {
      try {
        const all = typeof getAllVariables === 'function' ? getAllVariables() : {};
        stat = _.get(all, 'stat_data');
      } catch { /* ignore */ }
    }
    const data = stat ? getBattleDataFromStat(stat) : getBattleData();
    snap.value = data.snapshot;
    allies.value = data.allies;
    enemies.value = data.enemies;
  } catch (e) {
    console.warn('[战斗轮] 快照刷新失败:', e?.message || e);
  }
}

/** 快照 → 文本（给 AI 看当前战况） */
function buildSnapshotText(): string {
  const lines = [
    `轮次:${snap.value.round}`,
    `环境:${snap.value.environment || '未知'}`,
    snap.value.surprise ? `突袭:${snap.value.surprise}` : '',
    snap.value.turn ? `当前行动:${snap.value.turn}` : '',
    snap.value.initiative.length ? `先攻序列:${snap.value.initiative.join(',')}` : '',
  ].filter(Boolean);
  allies.value.forEach(a => {
    if (a.kind === '英灵') {
      lines.push(`[我方·英灵]${a.name}: 残响之力 ${a.spiritPower || 0}/100 状态:${a.spiritStatus || '苏醒'}（残响满时自动释放大招，规则见英灵段）`);
      return;
    }
    const st = Object.keys(a.status || {}).join(',');
    // 技能/装备来自快照 friendlies（开战复制，战斗中只变化数值）
    const f = snap.value.friendlies?.[a.name];
    // ★ 技能明细（类型/MP消耗/效果描述）——战斗规则"力量清单"引用
    const skillsTxt = (() => {
      if (!Array.isArray(f?.技能) || !f.技能.length) return '';
      const sd = (f?.技能详情 || {}) as Record<string, any>;
      return ' 技能:' + f.技能.map((sn: string) => {
        const d = sd?.[sn];
        if (!d || !d.描述) return sn;
        return `${sn}[${d.类型 || '技能'}${d.MP消耗 ? `·MP${d.MP消耗}` : ''}: ${String(d.描述).slice(0, 60)}]`;
      }).join('; ');
    })();
    // ★ 装备明细（品阶/面板效果/附加词条/特别机制）——战斗规则"力量清单"引用
    const equipsTxt = (() => {
      if (!Array.isArray(f?.装备) || !f.装备.length) return '';
      const ed = (f?.装备详情 || {}) as Record<string, any>;
      return ' 装备:' + f.装备.map((en: string) => {
        let d: any = null;
        Object.keys(ed || {}).forEach((k: string) => { if (!d && ed?.[k]?.物品名 === en) d = ed?.[k]; });
        if (!d) return en;
        const bp = (d.面板效果 || {}) as Record<string, any>;
        const bpTxt = Object.keys(bp).filter((k: string) => bp[k] != null && bp[k] !== '').map((k: string) => `${k}:${bp[k]}`).join(' ');
        const tc = (d.附加词条 || []).map((c: any) => String(c?.描述 || c || '')).filter(Boolean).join('；');
        const spec = d.特别机制 ? `；机制:${d.特别机制}` : '';
        return `${d.物品名}${d.品阶 && d.品阶 !== '普通' ? `[${d.品阶}]` : ''}${bpTxt ? `(${bpTxt})` : ''}${tc ? ` 词条:${tc}` : ''}${spec}`;
      }).join(' | ');
    })();
    const atk = a.kind === '友军' && a.attack ? ` 攻击:${a.attack.name}(${a.attack.type || ''} 命中${a.attack.hit || 0} 伤害${a.attack.dmg || '?'}${a.attack.effect ? ' ' + a.attack.effect : ''})` : '';
    const att = a.kind === '友军' && (a.attitude || a.affinity) ? ` 态度:${a.attitude || ''}${a.affinity ? ` 好感${a.affinity}` : ''}` : '';
    lines.push(`[我方]${a.name}: HP ${a.hpCur}/${a.hpMax} MP ${a.mpCur}/${a.mpMax} SP ${a.spCur}/${a.spMax} 防御${a.def}${st ? ` 状态:${st}` : ''}${skillsTxt}${equipsTxt}${atk}${att}`);
  });
  enemies.value.forEach(e => {
    const st = Object.keys(e.status || {}).join(',');
    lines.push(`[敌方]${e.name}: HP ${e.hpCur}/${e.hpMax} MP ${e.mpCur}/${e.mpMax} SP ${e.spCur}/${e.spMax} 防御${e.def}${st ? ` 状态:${st}` : ''}`);
  });
  return lines.join('\n');
}

/** 写 stat_data：应用 AI 的 <UpdateVariable>（兼容非战斗变量/违规输出）；战斗中角色数值只维护在快照（applyAllyChanges/applyEnemyChanges） */
function writeStatData(patchText: string): boolean {
  try {
    let applied = false;
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      const r1 = applyUpdateVariable(patchText, stat);
      applied = r1.applied;
      // ★ 精准同步：AI 若用 <UpdateVariable> 更新了友方三维（违规/兼容路径），只同步命中的值到快照 friendlies
      //   （不做整体覆盖——stat_data 战斗中冻结为开战值，整体覆盖会把快照血量重置回满血）
      applyPatchToFriendly(stat, r1.patches);
      return variables;
    }, { type: 'message', message_id: context.message_id });
    return applied;
  } catch (e) {
    console.warn('[战斗轮] 写变量失败:', e?.message || e);
    return false;
  }
}

/**
 * 精准同步：把 <UpdateVariable> 中命中「友方三维/英灵残响」路径的 patch 应用到快照 friendlies。
 * 路径格式：主角/基础状态/HP/当前 | 同伴/名/基础状态/MP/当前 | 契约兽/名/基础状态/SP/当前 | 英灵/残响之力 | 英灵/状态
 */
function applyPatchToFriendly(stat: any, patches: any[]): void {
  try {
    const f = stat?.$flags?.战斗快照?.friendlies;
    if (!f || typeof f !== 'object' || !Array.isArray(patches) || !patches.length) return;
    patches.forEach((p: any) => {
      if (!p || (p.op !== 'replace' && p.op !== 'add')) return;
      const segs = String(p.path || '').replace(/^\//, '').split('/').map(s => s.trim());
      if (segs[0] === '英灵' && segs[1] === '残响之力' && f['英灵']) {
        f['英灵'].残响之力 = Math.max(0, Math.min(100, Number(p.value) || 0));
        return;
      }
      if (segs[0] === '英灵' && segs[1] === '状态' && f['英灵']) {
        f['英灵'].状态 = String(p.value || '苏醒');
        return;
      }
      if (segs.length >= 5 && (segs[0] === '主角' || segs[0] === '同伴' || segs[0] === '契约兽')) {
        const res = segs[segs.length - 2];
        const field = segs[segs.length - 1];
        if (!/^(HP|MP|SP)$/i.test(res) || field !== '当前') return;
        const key = segs[0] === '主角' ? '主角' : segs[1];
        const fr = f[key];
        if (!fr) return;
        const arr = /^hp$/i.test(res) ? (fr.hp || (fr.hp = [0, 0]))
          : /^mp$/i.test(res) ? (fr.mp || (fr.mp = [0, 0]))
          : (fr.sp || (fr.sp = [0, 0]));
        arr[0] = Math.max(0, Number(p.value) || 0);
      }
    });
  } catch { /* ignore */ }
}

/**
 * 友方数值同步：从「状态变更/资源剩余」行与伤害兜底提取友方（含英灵残响/状态）变化，
 * 只更新快照 friendlies（战斗中 stat_data 角色数值不做逐条回写）。
 */
function applyAllyChanges(text: string): void {
  const lines = normalizeKeyValue(text).split('\n');
  const names = new Set<string>(['主角']);
  const statAll = (typeof getAllVariables === 'function' ? getAllVariables() : {});
  const statNow = _.get(statAll, 'stat_data', {});
  Object.keys(statNow.同伴 || {}).forEach(n => names.add(n));
  Object.keys(statNow.契约兽 || {}).forEach(n => names.add(n));
  const spiritName = String(_.get(statNow, '英灵.名称', '') || '');
  if (spiritName) names.add(spiritName);
  /** 名字 → 快照键：友方名原样；非敌非友（AI 常用角色名，如「亚伦」）兜底为主角；敌方/系统词返回空 */
  const normalizeName = (raw: string): string => {
    const n = String(raw || '').replace(/[【】\[\]<>]/g, '').trim();
    if (!n) return '';
    if (names.has(n)) return n;
    if (n === spiritName) return '英灵';
    // 敌人判断走模糊匹配（「奥姆尼斯」能命中快照「魔王奥姆尼斯」），防止敌人简称被误判为主角
    if (matchEnemyName(snap.value.enemies, n) || n === 'GM' || n === '敌方' || n === '敌人' || n === '系统') return '';
    return '主角';
  };
  const changes: { name: string; field: string; val: number; str?: string }[] = [];
  const appliedHp = new Set<string>();
  lines.forEach(line => {
    const t = line.trim();
    if (!t) return;
    // 1) 状态变更: 名称 HP/MP/SP/残响之力/状态 旧值 -> 新值
    const m = t.match(/状态变更[:：]\s*([^\s|]+)\s+(HP|MP|SP|残响之力|状态)\s*([\d]+|[\u4e00-\u9fa5]+)\s*(?:->|→)\s*([\d]+|[\u4e00-\u9fa5]+)/i);
    if (m) {
      const key = normalizeName(m[1]);
      if (!key) return;
      const field = m[2].toUpperCase();
      if (field === '状态') { changes.push({ name: key, field, val: 0, str: m[4] }); return; }
      const v = parseInt(m[4], 10);
      if (!isNaN(v)) {
        changes.push({ name: key, field, val: v });
        if (field === 'HP') appliedHp.add(key);
      }
      return;
    }
    // 2) 资源剩余: 名称 SP 22/30 | MP 18/40
    const rrM = t.match(/资源剩余[:：]\s*([^\s|]+)\s+(?:SP\s*(\d+)\s*\/\s*\d+)?(?:\s*[|｜]\s*MP\s*(\d+)\s*\/\s*\d+)?/i);
    if (rrM && (rrM[2] || rrM[3])) {
      const key = normalizeName(rrM[1]);
      if (!key) return;
      if (rrM[2]) changes.push({ name: key, field: 'SP', val: parseInt(rrM[2], 10) });
      if (rrM[3]) changes.push({ name: key, field: 'MP', val: parseInt(rrM[3], 10) });
      return;
    }
  });
  // 3) 伤害兜底：命中检定 + 伤害结算 + 目标（友方名）→ 扣快照 HP（兼容 d20(x)+y=z 与 🎲 格式）
  let tgtName = '';
  let hitValue = NaN;
  let defValue = NaN;
  let dmgValue = 0;
  lines.forEach(line => {
    const t = line.trim();
    const tgtM = t.match(/目标[:：]\s*([^\s|（(]+)/);
    if (tgtM) tgtName = tgtM[1].replace(/[【】\[\]<>]/g, '').trim();
    const hitM = t.match(/命中检定\d*\s*[:：]\s*(?:🎲)?\s*(?:d20\(\s*(\d+)\s*\)[^=]*=\s*(\d+)|(\d+))(?:\s*vs\s*防御\s*(\d+))?/i);
    if (hitM) {
      hitValue = parseInt(hitM[2] || hitM[3], 10);
      defValue = hitM[4] ? parseInt(hitM[4], 10) : NaN;
    }
    const dmgM = t.match(/伤害(?:结算|检定)\d*\s*[:：]\s*[\s\S]*?(?:=\s*(\d+)|🎲\s*(\d+)|\((\d+)\))/i);
    if (dmgM) dmgValue = parseInt(dmgM[1] || dmgM[2] || dmgM[3], 10);
  });
  const tgtKey = normalizeName(tgtName);
  if (tgtKey && !isNaN(hitValue) && dmgValue > 0 && !appliedHp.has(tgtKey)) {
    const def = isNaN(defValue) ? 10 : defValue;
    if (hitValue >= def) changes.push({ name: tgtKey, field: 'HP', val: -dmgValue }); // 负数标记扣减
  }
  if (!changes.length) return;
  try {
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      const f = stat.$flags?.战斗快照?.friendlies;
      if (!f || typeof f !== 'object') return variables;
      changes.forEach(c => {
        const fr = f[c.name];
        if (!fr) return;
        if (c.field === 'HP') {
          if (!fr.hp) fr.hp = [0, 0];
          fr.hp[0] = c.val < 0 ? Math.max(0, (Number(fr.hp[0]) || 0) + c.val) : Math.max(0, c.val);
        } else if (c.field === 'MP') {
          if (!fr.mp) fr.mp = [0, 0];
          fr.mp[0] = Math.max(0, c.val);
        } else if (c.field === 'SP') {
          if (!fr.sp) fr.sp = [0, 0];
          fr.sp[0] = Math.max(0, c.val);
        } else if (c.field === '残响之力') {
          fr.残响之力 = Math.max(0, Math.min(100, c.val));
        } else if (c.field === '状态' && c.str) {
          fr.状态 = c.str;
        }
      });
      return variables;
    }, { type: 'message', message_id: context.message_id });
    refreshSnapshot();
  } catch (e) {
    console.warn('[战斗轮] 友方数值同步失败:', e?.message || e);
  }
}

/** 面板内开战/补充敌人：从推演回复解析「敌人:」行内名单（⚔️战斗轮 格式）→ 合并进快照（不覆盖已有快照的轮次/环境/先攻） */
function updateEnemiesFromText(text: string): void {
  const t = String(text || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (!/敌人[:：]/.test(t) && !/<enemy_data>/i.test(t)) return;
  let parsed: any = null;
  try { parsed = parseBattleStart(t); } catch { /* ignore */ }
  const newEnemies = parsed && parsed.enemies;
  if (!newEnemies || !Object.keys(newEnemies).length) return;
  try {
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      if (!stat.$flags) stat.$flags = {};
      const snapNow = stat.$flags.战斗快照 || (stat.$flags.战斗快照 = {});
      if (!snapNow.enemies || typeof snapNow.enemies !== 'object') snapNow.enemies = {};
      Object.keys(newEnemies).forEach(n => {
        // 已有且被面板覆盖的敌人不覆盖（保留战斗中的实时数值）；新敌人直接并入
        const cur = snapNow.enemies[n];
        if (!cur || !cur._panelCovered) snapNow.enemies[n] = newEnemies[n];
      });
      return variables;
    }, { type: 'message', message_id: context.message_id });
    refreshSnapshot();
  } catch (e) {
    console.warn('[战斗轮] 敌人名单导入失败:', e?.message || e);
  }
}

/** 解析推演回复中的 <enemy_data> → 更新快照敌人面板（写 $flags，AI 可见持久；支持多块、未闭合标签与名称映射；兼容转义标签） */
function updateEnemyFromText(text: string): void {
  const t = String(text || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const blocks = extractDataBlocks(t, 'enemy_data');
  if (!blocks || !blocks.length) return;
  try {
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      if (!stat.$flags) stat.$flags = {};
      const snap = stat.$flags.战斗快照 || (stat.$flags.战斗快照 = {});
      if (!snap.enemies || typeof snap.enemies !== 'object') snap.enemies = {};
      blocks.forEach(block => {
        const ed = parseEnemyDataBlock(block);
        if (ed) mergeEnemyData(snap.enemies, ed);
      });
      return variables;
    }, { type: 'message', message_id: context.message_id });
    refreshSnapshot();
  } catch (e) {
    console.warn('[战斗轮] 敌人面板更新失败:', e?.message || e);
  }
}

/**
 * 敌人名字匹配：① 精确命中 ② 敌人只有一名时，名字互相包含即可命中（AI 常用简称/全称，
 * 如快照「魔王奥姆尼斯」vs 变更行「奥姆尼斯」）③ 多敌人时仅当包含匹配唯一才命中（避免误伤）。
 */
function matchEnemyName(enemies: Record<string, any>, name: string): string | null {
  const n = String(name || '').replace(/[【】\[\]<>]/g, '').trim();
  if (!n || !enemies) return null;
  if (enemies[n]) return n;
  const keys = Object.keys(enemies);
  if (!keys.length) return null;
  if (n.length < 2) return null; // 太短的名字不做包含匹配（防「王」误伤「魔王奥姆尼斯」）
  if (keys.length === 1) {
    const k = keys[0];
    return (k.includes(n) || n.includes(k)) ? k : null;
  }
  const hits = keys.filter(k => k.includes(n) || n.includes(k));
  return hits.length === 1 ? hits[0] : null;
}

/** 敌人状态同步：状态变更/命中伤害 → 快照敌人 HP（AI 未输出 enemy_data 时的兜底；名字支持简称/全称模糊匹配） */
function applyEnemyChanges(text: string): void {
  const lines = normalizeKeyValue(text).split('\n');
  const changes: { name: string; res: string; val: number }[] = [];
  // 状态变更: 敌名 HP a -> b（名字归一化为快照键）
  lines.forEach(line => {
    const m = line.trim().match(/状态变更[:：]\s*([^\s|]+)\s+(HP|MP|SP)\s*[\d]+\s*->\s*(\d+)/i);
    if (m) {
      const tgt = matchEnemyName(snap.value.enemies, m[1]);
      if (!tgt) return;
      changes.push({ name: tgt, res: m[2].toUpperCase(), val: parseInt(m[3], 10) });
    }
  });
  // 兜底：命中检定 + 伤害结算 + 目标（敌名）→ 扣血（兼容 d20(14)+7=21 与 🎲 格式）
  let tgtName = '';
  let hitValue = NaN;
  let defValue = NaN;
  let dmgValue = 0;
  lines.forEach(line => {
    const t = line.trim();
    const tgtM = t.match(/目标[:：]\s*([^\s|（(]+)/);
    if (tgtM) tgtName = tgtM[1].replace(/[【】\[\]<>]/g, '').trim();
    const hitM = t.match(/命中检定\d*\s*[:：]\s*(?:🎲)?\s*(?:d20\(\s*(\d+)\s*\)[^=]*=\s*(\d+)|(\d+))(?:\s*vs\s*防御\s*(\d+))?/i);
    if (hitM) {
      hitValue = parseInt(hitM[2] || hitM[3], 10);
      defValue = hitM[4] ? parseInt(hitM[4], 10) : NaN;
    }
    const dmgM = t.match(/伤害(?:结算|检定)\d*\s*[:：]\s*[\s\S]*?(?:=\s*(\d+)|🎲\s*(\d+)|\((\d+)\))/i);
    if (dmgM) dmgValue = parseInt(dmgM[1] || dmgM[2] || dmgM[3], 10);
  });
  const appliedSet = new Set(changes.filter(c => c.res === 'HP').map(c => c.name));
  const tgtKey = matchEnemyName(snap.value.enemies, tgtName);
  if (tgtKey && !isNaN(hitValue) && dmgValue > 0 && !appliedSet.has(tgtKey)) {
    const def = isNaN(defValue) ? 10 : defValue;
    if (hitValue >= def) changes.push({ name: tgtKey, res: 'HP', val: -dmgValue }); // 负数标记为扣减
  }
  if (!changes.length) return;
  try {
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      if (!stat.$flags) stat.$flags = {};
      const snap = stat.$flags.战斗快照 || (stat.$flags.战斗快照 = {});
      const enemies = snap.enemies || (snap.enemies = {});
      changes.forEach(c => {
        const e = enemies[c.name];
        if (!e) return;
        if (c.res === 'HP') {
          const hp = e.hp || (e.hp = [0, 0]);
          if (c.val < 0) hp[0] = Math.max(0, (Number(hp[0]) || 0) + c.val); // 扣减
          else hp[0] = Math.max(0, c.val); // 直接设值
        } else if (c.res === 'MP') {
          const mp = e.mp || (e.mp = [0, 0]);
          mp[0] = Math.max(0, c.val);
        } else if (c.res === 'SP') {
          const sp = e.sp || (e.sp = [0, 0]);
          sp[0] = Math.max(0, c.val);
        }
      });
      return variables;
    }, { type: 'message', message_id: context.message_id });
    refreshSnapshot();
  } catch (e) {
    console.warn('[战斗轮] 敌人状态同步失败:', e?.message || e);
  }
}

/** 解析推演回复中的 <ally_data> → 更新快照友方单位（左侧显示） */
function updateAllyFromText(text: string): void {
  const t = String(text || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const blocks = extractDataBlocks(t, 'ally_data');
  if (!blocks || !blocks.length) return;
  try {
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      if (!stat.$flags) stat.$flags = {};
      const snapNow = stat.$flags.战斗快照 || (stat.$flags.战斗快照 = {});
      if (!snapNow.extraAllies || typeof snapNow.extraAllies !== 'object') snapNow.extraAllies = {};
      blocks.forEach(block => {
        const ad = parseEnemyDataBlock(block);
        if (ad) mergeEnemyData(snapNow.extraAllies, ad);
      });
      return variables;
    }, { type: 'message', message_id: context.message_id });
    refreshSnapshot();
  } catch (e) {
    console.warn('[战斗轮] 友军面板更新失败:', e?.message || e);
  }
}

/** 写快照到 $flags（开战初始化） */
function writeSnapshot(snapData: any): void {
  try {
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      if (!stat.$flags) stat.$flags = {};
      stat.$flags.战斗快照 = snapData;
      return variables;
    }, { type: 'message', message_id: context.message_id });
  } catch (e) {
    console.warn('[战斗轮] 写快照失败:', e?.message || e);
  }
}

/** 摘要用：剥掉全部系统标签（含思维链/output/战斗结算/未闭合标签），只留干净战斗日志 */
function stripForSummary(t: string): string {
  return stripSystemTags(String(t))
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/<思维链>[\s\S]*?<\/思维链>/g, '')
    .replace(/<output>[\s\S]*?<\/output>/g, '')
    .replace(/<output>[\s\S]*$/g, '') // 未闭合的 <output>
    .replace(/<战斗结算>[\s\S]*?<\/战斗结算>/g, '')
    .replace(/<[^>]+>/g, '') // 兜底：剥掉所有剩余标签
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 战斗结束：① 从战斗快照打包结果并回写 stat_data（变量只输出这一次）② 注入战斗日志供下一层楼 AI 结算 */
async function finishBattle(text: string): Promise<void> {
  ended.value = true;
  battleResult.value = extractBattleResult(text);
  const plain = stripForSummary(text);
  const log = plain ? plain.slice(0, 800) : '（无详细日志）';
  // ★ 唯一一次变量输出：从快照打包参战方最终数值 → $flags.战斗结果；并把友方三维/英灵残响回写 stat_data
  try {
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      if (!stat.$flags) stat.$flags = {};
      const snapNow = stat.$flags.战斗快照;
      if (snapNow && typeof snapNow === 'object') snapNow.active = false;
      // 1) 友方最终数值回写 stat_data（战斗中只维护快照，结束统一写回）
      const f = (snapNow && snapNow.friendlies) || {};
      const writeBack = (name: string, actor: any) => {
        const fr = f[name];
        if (!fr || !actor || typeof actor !== 'object') return;
        const base = _.get(actor, '基础状态', {});
        if (fr.hp) _.set(base, 'HP.当前', Math.max(0, Number(fr.hp[0]) || 0));
        if (fr.mp) _.set(base, 'MP.当前', Math.max(0, Number(fr.mp[0]) || 0));
        if (fr.sp) _.set(base, 'SP.当前', Math.max(0, Number(fr.sp[0]) || 0));
      };
      if (stat.主角) writeBack('主角', stat.主角);
      Object.keys(stat.同伴 || {}).forEach(n => writeBack(n, stat.同伴[n]));
      Object.keys(stat.契约兽 || {}).forEach(n => writeBack(n, stat.契约兽[n]));
      if (f['英灵'] && stat.英灵) {
        stat.英灵.残响之力 = Math.max(0, Math.min(100, Number(f['英灵'].残响之力) || 0));
        stat.英灵.状态 = String(f['英灵'].状态 || '苏醒');
      }
      // 2) 打包结果变量（参战方完整数值 + 结果 + 摘要，供下一楼层与世界书读取）
      const friendList = Object.keys(f).map(name => {
        const fr = f[name];
        if (fr.kind === '英灵') {
          return { 名称: fr.name || '英灵', 阵营: '英灵', 残响之力: fr.残响之力 || 0, 状态: fr.状态 || '苏醒' };
        }
        return {
          名称: name,
          阵营: fr.kind || '友方',
          HP: [fr.hp?.[0] || 0, fr.hp?.[1] || 0],
          MP: [fr.mp?.[0] || 0, fr.mp?.[1] || 0],
          SP: [fr.sp?.[0] || 0, fr.sp?.[1] || 0],
          防御: fr.def || 10,
          等阶: fr.rank || '',
          状态: Object.keys(fr.status || {}),
          技能: fr.技能 || [],
          装备: fr.装备 || [],
        };
      });
      const enemyList = Object.keys((snapNow && snapNow.enemies) || {}).map(name => {
        const e = (snapNow && snapNow.enemies[name]) || {};
        return {
          名称: name,
          HP: [Number(e.hp?.[0]) || 0, Number(e.hp?.[1]) || 0],
          MP: [Number(e.mp?.[0]) || 0, Number(e.mp?.[1]) || 0],
          SP: [Number(e.sp?.[0]) || 0, Number(e.sp?.[1]) || 0],
          防御: Number(e.def) || 10,
          状态: Object.keys(e.status || {}),
          攻击: e.attack ? e.attack.name : '',
          能力: e.ability || '',
        };
      });
      stat.$flags.战斗结果 = {
        结果: battleResult.value,
        轮次: snap.value.round,
        摘要: log,
        参战方: { 友方: friendList, 敌方: enemyList },
      };
      return variables;
    }, { type: 'message', message_id: context.message_id });
  } catch (e) {
    console.warn('[战斗轮] 战斗结果写变量失败:', e?.message || e);
  }
  try {
    const summary = `【战斗轮结束】结果：${battleResult.value}
战斗日志摘要：
${log}
（战斗结果与参战方最终数值已打包到 stat_data.$flags.战斗结果，友方 HP/MP/SP 与英灵残响已回写 stat_data；请按[经验获取规则]结算本次战斗的 EXP 与战利品，并按[变量更新规则]输出 <UpdateVariable> 更新变量。）`;

    // 注入上下文（once，供下一层楼 AI 处理），不创建消息楼层、不自动触发生成
    try {
      injectPrompts([{
        id: 'combat_end_' + Date.now(),
        position: 'in_chat',
        depth: 0,
        role: 'system',
        content: summary,
      }], { once: true });
    } catch (e) {
      console.warn('[战斗轮] 注入战斗日志失败:', e?.message || e);
    }
    console.log('[战斗轮] 战斗日志已注入上下文（未创建楼层），等待下一层楼 AI 结算');
    if (typeof toastr !== 'undefined') toastr.success('战斗结束，日志已注入上下文', '战斗轮');
  } catch (e) {
    console.warn('[战斗轮] 战斗结束处理失败:', e?.message || e);
  }
}

function endBattleManually(): void {
  if (loading.value || ended.value) return;
  finishBattle('战斗结束 结果:结束（玩家手动结束）');
}

/** 名字规范化：非同伴/友军/敌方的名字视为主角（AI 常用角色名，如「亚伦」） */
function resolveMainName(name: string): string {
  const n = String(name || '').trim();
  if (!n) return n;
  if (n === '主角' || n === '玩家' || n === '[USER]') return '主角';
  const allyNames = allies.value.filter(a => a.kind !== '主角').map(a => a.name);
  const enemyNames = Object.keys(snap.value.enemies || {});
  if (allyNames.includes(n) || enemyNames.includes(n)) return n;
  return '主角';
}

function isMainChar(name: string): boolean {
  return resolveMainName(name) === '主角';
}

/** 是否敌方回合（不在我方列表中的单位） */
function isEnemyTurn(name: string): boolean {
  const t = String(name || '').trim();
  if (!t) return false;
  if (isMainChar(t)) return false;
  const allyNames = allies.value.map(a => a.name);
  return !allyNames.includes(t);
}

/** 自动行动：非主角单位自动行动（指令注入但不显示在推演区；玩家正在输入时不打扰） */
async function autoAct(unit: string): Promise<void> {
  if (loading.value || ended.value) return;
  if (input.value.trim()) return; // 玩家正在输入 → 跳过本次自动，不覆盖玩家 RP
  await sendWithText(
    `（自动战斗）当前轮到「${unit}」。请以 ${unit} 的视角自行决定并执行本轮行动：选择合理的动作与目标、掷骰结算、更新状态；保持该角色的性格与战术。`,
    true,
  );
}

/** 先攻轮转与轮次管理（基于「本轮已行动集合」）：
 * - 收集本回复中所有行动单位（攻击方 + 显式当前行动 + 「X 的回合」）
 * - 显式「轮次:N / 第N轮」优先覆盖
 * - 已行动集合覆盖先攻序列全部单位 → 自动进入下一回合并清空集合 */
function advanceTurn(text: string): void {
  try {
    const cur = snap.value;
    if (!cur.initiative || !cur.initiative.length) return;
    if (!Array.isArray(cur.actedRound)) cur.actedRound = [];
    const normInit = cur.initiative.map(n => resolveMainName(n));
    let changed = false;

    // 1) 收集本回复的行动单位
    const acted: string[] = [];
    const atkMs = String(text || '').match(/攻击方[:：]\s*([^\s|（(]+)/g) || [];
    atkMs.forEach(m => { const n = m.match(/攻击方[:：]\s*([^\s|（(]+)/); if (n) acted.push(n[1]); });
    const turnM = String(text || '').match(/当前行动[:：]\s*([^\s，,。]+)/);
    if (turnM) acted.push(turnM[1]);
    // 「X 的回合」标题
    const roundTitleMs = String(text || '').match(/([^\s，,。]+)的回合/g) || [];
    roundTitleMs.forEach(m => { const n = m.replace(/的回合$/, ''); if (n) acted.push(n); });

    // 2) 显式轮次（兼容 轮次: 2 / 第2轮）
    const roundM = String(text || '').match(/(?:轮次[:：]|第)\s*(\d+)\s*(?:轮)?/);
    if (roundM && parseInt(roundM[1], 10) !== cur.round) {
      cur.round = parseInt(roundM[1], 10);
      cur.actedRound = [];
      if (!Array.isArray(cur.log)) cur.log = [];
      cur.log.push(`⏳ 进入第 ${cur.round} 轮`);
      changed = true;
    }

    // 3) 标记已行动（去重）
    acted.forEach(n => {
      const norm = resolveMainName(n);
      const key = isMainChar(norm) ? '主角' : norm;
      if (key && !cur.actedRound.includes(key)) cur.actedRound.push(key);
    });

    // 4) 当前行动者：最后行动单位的下一个（指针推进）
    if (acted.length) {
      const last = resolveMainName(acted[acted.length - 1]);
      const lastKey = isMainChar(last) ? '主角' : last;
      const idx = normInit.findIndex((n, i) => (isMainChar(n) ? '主角' : n) === lastKey);
      if (idx >= 0) {
        cur.turnIndex = (idx + 1) % cur.initiative.length;
        cur.turn = cur.initiative[cur.turnIndex];
        changed = true;
      }
    }

    // 5) 整轮走完 → 自动换回合
    const allActed = cur.initiative.every(n => cur.actedRound.includes(isMainChar(n) ? '主角' : n));
    if (allActed && cur.initiative.length > 0) {
      cur.round += 1;
      cur.actedRound = [];
      cur.turnIndex = 0;
      cur.turn = cur.initiative[0] || '';
      if (!Array.isArray(cur.log)) cur.log = [];
      cur.log.push(`⏳ 进入第 ${cur.round} 轮`);
      changed = true;
    }

    if (changed) {
      writeSnapshot(cur);
      refreshSnapshot();
    }
  } catch (e) {
    console.warn('[战斗轮] 先攻轮转失败:', e?.message || e);
  }
}

/** GM 消息标签：轮到己方单位（主角/同伴/友军）显示单位名，敌方回合/其他用 GM */
function labelForTurn(turn: string): string {
  const t = String(turn || '').trim();
  if (!t) return 'GM';
  if (isMainChar(t)) return '主角';
  const allyNames = allies.value.filter(a => a.kind !== '主角').map(a => a.name);
  if (allyNames.includes(t)) return t;
  return 'GM';
}

/** 读取主角技能（角色技能/魔法栏/神术栏）供技能栏选择；带[被动]前缀的被动技能无法主动使用，过滤掉 */
function loadSkills(): void {
  try {
    const all = typeof getAllVariables === 'function' ? getAllVariables() : {};
    const stat = _.get(all, 'stat_data.主角.资产与能力', {});
    const list: { name: string; type: '技能' | '魔法' | '神术'; desc: string }[] = [];
    const pushSkill = (key: string, type: '技能' | '魔法' | '神术') => {
      Object.keys(_.get(stat, key, {})).forEach(n => {
        const desc = String(_.get(stat, [key, n, '描述'], ''));
        if (/^\s*\[被动/.test(desc) || /^\s*\[被动/.test(n)) return; // 被动技能：过滤，不进入动作栏
        list.push({ name: n, type, desc });
      });
    };
    pushSkill('角色技能', '技能');
    pushSkill('魔法栏', '魔法');
    pushSkill('神术栏', '神术');
    skills.value = list;
  } catch { /* ignore */ }
}

/** 读取主角物品栏（物品名 → {描述,数量,...}），供快速查看与喝药水 */
function loadItems(): void {
  try {
    const all = typeof getAllVariables === 'function' ? getAllVariables() : {};
    const inv = _.get(all, 'stat_data.主角.资产与能力.物品栏', {});
    const list: { name: string; count: number; desc: string }[] = [];
    Object.keys(inv).forEach(n => {
      const it = inv[n] || {};
      const count = Number(it['数量'] ?? 0) || 0;
      if (count <= 0) return;
      list.push({ name: n, count, desc: String(it['描述'] ?? it['其它说明'] ?? '') });
    });
    items.value = list;
  } catch { /* ignore */ }
}

/** 向输入框追加文本（预设/技能选择） */
function insertText(append: string): void {
  const sep = input.value.trim() ? '，' : '';
  input.value = (input.value + sep + append).slice(0, 500);
}
function insertSkill(s: { name: string }): void {
  insertText(`使用【${s.name}】`);
}

// ---- 推演 ----
async function send(): Promise<void> {
  const text = input.value.trim();
  if (!text || loading.value || ended.value) return;
  input.value = '';
  await sendWithText(text, false);
}

/** 核心推演（silent=true 时不显示发送的指令，用于自动行动） */
async function sendWithText(text: string, silent: boolean): Promise<void> {
  if (!text || loading.value || ended.value) return;
  lastAutoUnit = ''; // 重置自动触发标记
  // 输入：前端先掷骰（宏替换），显示真实结果并让 AI 看到（silent 时不显示自动指令）
  const inputReplaced = replaceDiceMacros(text).text;
  if (!silent) {
    messages.value.push({ role: 'user', content: text, label: '你', html: escapeHtml(inputReplaced).replace(/\n+/g, '<br>') });
  }
  loading.value = true;
  scrollToBottom();
  try {
    // 历史（界面内最近 10 条，过滤空消息）
    const history = messages.value
      .slice(-10)
      .filter(m => m.content && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }));

    // ★ 前情上下文：读取酒馆最近聊天（之前的 RP、世界书注入的前情提要等），AI 才能连贯
    let preludeCtx = '';
    try {
      const lastId = getLastMessageId();
      if (lastId > 0) {
        const from = Math.max(1, lastId - 30);
        const msgs = getChatMessages(`${from}-${lastId}`, { role: 'all' });
        const ctx = msgs
          .filter(m => !String(m.message || '').includes('⚔️战斗轮')) // 跳过开战触发楼层
          .slice(-12)
          .map(m => `[${m.role === 'user' ? '玩家' : 'GM'}] ${String(m.message || '').slice(0, 400)}`)
          .join('\n');
        if (ctx.trim()) preludeCtx = ctx;
      }
    } catch { /* ignore */ }

    // 玩家输入：前端先掷骰（宏替换），AI 看到真实结果
    const inputForAi = replaceDiceMacros(inputReplaced).text;

    const ordered: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: buildBattleSystemPrompt(buildSnapshotText(), spiritContent.value) },
    ];
    // ★ 自动行动规则：敌方始终自动；同伴/友军看 ⚡ 开关；连续自动单位在同一回复内按序处理
    ordered.push({
      role: 'system',
      content: autoFight.value
        ? '【自动行动】敌方单位回合始终由你自动执行；当前为自动战斗模式，同伴/友军回合也由你自动执行。当前单位行动完毕后，请在同一回复中按先攻顺序自动处理后续所有非主角单位（每个单位一节「X 的回合」+ 行动与结算），直到轮到主角为止。'
        : '【自动行动】敌方单位回合由你自动执行并结算；同伴/友军回合等待玩家指令。当前单位行动完毕后，若下一个单位是敌方，请在同一回复中继续处理其回合。',
    });
    if (preludeCtx) {
      ordered.push({ role: 'system', content: `【前情上下文】（开战前的剧情与设定，供你参考连贯剧情；不要复述给玩家，战斗判定以战斗规则为准）\n${preludeCtx}` });
    }
    ordered.push(...history);

    const result = await generateRaw({
      user_input: inputForAi,
      should_silence: true,
      // ★ 只清空「角色扮演预设」提示词；保留世界书（伊瑟利亚结算格式约定/世界观）与聊天历史（上下文必需）
      overrides: {
        char_description: '',
        char_personality: '',
        persona_description: '',
        scenario: '',
        dialogue_examples: '',
      },
      max_chat_history: 30,
      ordered_prompts: ordered,
    });
    const raw = typeof result === 'string' ? result : String(result || '');

    // 1) 宏处理：roll 掷骰 → 提取字段值 → calc 计算宏
    const { text: replaced } = replaceDiceMacros(raw);
    const fieldVals = buildFieldValues(replaced);
    const replacedCalc = resolveCalcMacros(replaced, fieldVals);
    // 2) 变量更新（UpdateVariable → stat_data）+ 状态变更提取 + 敌方同步（用 calc 解析后的文本）
    try { writeStatData(replacedCalc); } catch { /* ignore */ }
    try { applyAllyChanges(replacedCalc); } catch { /* ignore */ }
    try { applyEnemyChanges(replacedCalc); } catch { /* ignore */ }
    // 3) 敌人面板 / 友军：解析回复中的「敌人:」名单 + <enemy_data> / <ally_data> → 快照实时更新
    try { updateEnemiesFromText(replacedCalc); } catch { /* ignore */ }
    try { updateEnemyFromText(replacedCalc); } catch { /* ignore */ }
    try { updateAllyFromText(replacedCalc); } catch { /* ignore */ }
    // 4) 显示（系统标签隐藏 + 羊皮纸 + 酒馆格式）；标签 = 当前行动单位（己方显名/敌方 GM）
    const html = renderToHtml(stripSystemTags(replacedCalc));
    const msgLabel = labelForTurn(snap.value.turn);
    messages.value.push({ role: 'assistant', content: raw, label: msgLabel, html });
    refreshSnapshot();
    scrollToBottom();
    // 5) 先攻序列轮转（当前行动者推进）
    try { advanceTurn(replacedCalc); } catch { /* ignore */ }
    // 6) 敌方全灭自动结束：所有敌人 HP ≤ 0（无需 AI 输出结束标记）
    try {
      const es = Object.values(snap.value.enemies || {});
      if (!ended.value && es.length > 0 && es.every((e: any) => (Number(e.hp?.[0]) || 0) <= 0)) {
        await finishBattle('战斗结束 结果:胜利（敌方全灭）');
        return;
      }
    } catch { /* ignore */ }

    // 7) 战斗结束检测（严格信号）
    if (isBattleEnd(replacedCalc)) {
      await finishBattle(replacedCalc);
    }
  } catch (e: any) {
    messages.value.push({
      role: 'assistant',
      content: '',
      html: `<div class="battle-para" style="color:#8a2020">⚠️ 推演失败：${escapeHtml(e?.message || e)}</div>`,
    });
    console.error('[战斗轮] 推演失败:', e);
  } finally {
    loading.value = false;
  }
}

// ---- 挂载初始化 ----
let timer: ReturnType<typeof setInterval> | null = null;

/** 从开战楼层消息解析快照 + 生成开战前情（流式完成后再调一次确保数据完整）。
 * 规则：只取「触发行（⚔️战斗轮 / 【战斗开始】）之后」的内容作为开战前情（折叠）；
 *       触发行之前的正常推演内容完全不加入战斗界面。 */
function initFromMessage(): void {
  let snapData: any = null;
  try {
    snapData = parseBattleStart(context.message);
    // 初始化先攻指针：默认序列第一位行动
    if (snapData && Array.isArray(snapData.initiative) && snapData.initiative.length) {
      snapData.turnIndex = 0;
      snapData.turn = snapData.turn || snapData.initiative[0];
    }
    // ★ 友方战斗数据区：开战时从 stat_data 复制（三维/技能/装备/防御/等阶），战斗中数值只在这里变化
    try {
      let statNow: any = null;
      try {
        if (typeof Mvu !== 'undefined' && Mvu.getMvuData) {
          statNow = _.get(Mvu.getMvuData({ type: 'message', message_id: context.message_id }), 'stat_data');
        }
      } catch { /* ignore */ }
      if (!statNow) {
        try { statNow = _.get(typeof getAllVariables === 'function' ? getAllVariables() : {}, 'stat_data'); } catch { /* ignore */ }
      }
      snapData.friendlies = buildFriendlySnapshot(statNow);
    } catch { snapData.friendlies = {}; }
    writeSnapshot(snapData);
    refreshSnapshot();
    console.info('[战斗轮] 开战解析：环境=' + (snapData.environment || '') + ' 轮次=' + snapData.round +
      ' 先攻=' + (snapData.initiative || []).join(',') + ' 敌人=' + Object.keys(snapData.enemies || {}).join(',') || '无');
  } catch (e) {
    console.warn('[战斗轮] 快照初始化失败:', e);
    refreshSnapshot();
  }
  // ★ 应用开战消息中的 <UpdateVariable> 与状态变更（AI 开战时可能直接更新 HP/地点/种族等）
  try {
    const enemyNames = Object.keys((snapData && snapData.enemies) || {});
    updateVariablesWith(variables => {
      const stat = variables?.stat_data || (variables.stat_data = {});
      const r = applyUpdateVariable(context.message, stat);
      extractStateChanges(context.message, stat, enemyNames);
      // 开战消息若更新了友方三维，同步进刚建立的快照 friendlies
      applyPatchToFriendly(stat, r.patches);
      return variables;
    }, { type: 'message', message_id: context.message_id });
  } catch (e) {
    console.warn('[战斗轮] 开战变量应用失败:', e?.message || e);
  }
  // ★ 开战消息中的敌方扣血（<content> 内战斗结算）同步到快照敌人
  try {
    applyEnemyChanges(context.message);
  } catch (e) {
    console.warn('[战斗轮] 开战敌方同步失败:', e?.message || e);
  }
  const markerIdx = context.message.search(/⚔️战斗轮|【战斗开始】/);
  const battlePart = markerIdx >= 0 ? context.message.slice(markerIdx) : context.message;
  const cleaned = stripSystemTags(replaceDiceMacros(battlePart).text).trim();
  // ★ 前情 = AI 叙事 + 自动生成的开战信息摘要（AI 只输出数据行没写叙事时也保证前情有内容）
  try {
    const s = snapData || snap.value;
    const env = String(s.environment || '') || '未知环境';
    const initList = (s.initiative && s.initiative.length) ? s.initiative.join('、') : '待定';
    const enemyList = Object.keys((s.enemies || {})).join('、') || '暂无';
    const header = `【第 ${Number(s.round) || 1} 轮 · ${env}】${s.surprise ? ` 突袭：${s.surprise}` : ''}
先攻序列：${initList}
敌方：${enemyList}`;
    openingHtml.value = renderToHtml(cleaned ? `${cleaned}\n\n${header}` : header);
  } catch { /* ignore */ }
  // 推演区第一条：战斗开始提示（先前内容不进推演区）
  if (messages.value.length === 0) {
    messages.value.push({
      role: 'assistant',
      content: '',
      label: 'GM',
      html: `<div class="battle-para">⚔️ 战斗开始 · 第 ${snap.value.round} 轮 · 敌方 ${enemies.value.length} 个。在下方输入你的第一个行动。</div>`,
    });
  }
  scrollToBottom();
}

onMounted(() => {
  // ★ 关键：把组件 scoped 样式传送到酒馆页面 head。
  //   注意 teleportStyle 默认参数 'head' 会被解析成脚本 iframe 自己的 head（错误目标），
  //   必须显式传入父页面 document 的 head（音乐盒/三合一同款做法）。只执行一次。
  try {
    if (!(window as any).__mbx_style_done) {
      (window as any).__mbx_style_done = true;
      const ownerDoc = (window.parent && window.parent.document) || document;
      teleportStyle(ownerDoc.head);
    }
  } catch { /* ignore */ }

  initFromMessage();
  loadSkills(); // 读取主角技能供技能栏选择（过滤被动）
  loadItems();  // 读取主角物品栏供快速查看/喝药水
  loadSpirit(); // 检测契约英灵并读取「英灵/英灵名」世界书条目
  // 流式输出完成时重新解析（挂载时消息可能不完整）
  watch(
    () => context.during_streaming,
    () => {
      if (!context.during_streaming) {
        setTimeout(() => initFromMessage(), 200);
      }
    },
  );
  // 轮询刷新快照（变量变化实时反映）
  timer = setInterval(refreshSnapshot, 1200);
  try {
    if (typeof Mvu !== 'undefined' && Mvu.events) {
      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => setTimeout(refreshSnapshot, 300));
    }
  } catch { /* ignore */ }
  // 自动行动由 prompt 层驱动（AI 在同一回复中按序处理非主角单位），不再前端自动发送
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.battle-ui {
  width: 100%;
  font-family: "Noto Serif SC", "Source Han Serif SC", "华文中宋", "楷体", serif;
  font-weight: 500;
  color: #33220f;
  font-size: 0.95em;
  line-height: 1.75;
}

/* 卷首 */
.battle-header {
  text-align: center;
  padding: 8px 12px;
  background: #f3e8cd;
  border: 1px solid #a07840;
  border-top: 3px double #5a3a1a;
  border-bottom: 3px double #5a3a1a;
  border-radius: 3px;
  margin-bottom: 8px;
}
.bh-title {
  font-size: 1.2em;
  font-weight: 800;
  letter-spacing: 6px;
  color: #4a2f08;
}
.bh-sub {
  font-size: 0.75em;
  color: #8a6a3a;
  margin-top: 2px;
}
.bh-btns {
  margin-top: 6px;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.bh-btn {
  font-size: 0.72em;
  font-family: inherit;
  background: rgba(212, 175, 55, 0.2);
  border: 1px solid #c4a050;
  color: #5a3a08;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}
.bh-btn:hover {
  background: rgba(212, 175, 55, 0.35);
}
.bh-btn.on {
  background: rgba(42, 106, 58, 0.22);
  border-color: #2a6a3a;
  color: #1c4a28;
}

.snap-slot {
  margin-bottom: 8px;
}

/* 推演区 */
.chat-area {
  max-height: 46vh;
  overflow-y: auto;
  padding: 8px 10px;
  background: rgba(245, 234, 208, 0.85);
  border: 1px solid rgba(160, 120, 64, 0.4);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chat-empty {
  text-align: center;
  color: #a09070;
  font-size: 0.85em;
  padding: 18px 0;
}
.empty-seal {
  font-size: 1.6em;
  margin-bottom: 4px;
}
.msg {
  display: flex;
  gap: 6px;
}
.msg.user {
  flex-direction: row-reverse;
}
.msg-label {
  flex-shrink: 0;
  font-size: 0.7em;
  font-weight: 800;
  color: #fff;
  background: #8a6a3a;
  border-radius: 3px;
  padding: 1px 7px;
  height: fit-content;
  margin-top: 2px;
}
.msg.user .msg-label {
  background: #3a6a2a;
}
.msg-body {
  flex: 1;
  min-width: 0;
  background: #fbf3e2;
  border: 1px solid rgba(160, 120, 64, 0.3);
  border-radius: 4px;
  padding: 5px 9px;
  font-size: 0.9em;
}
.msg.user .msg-body {
  background: #e9f2df;
}
.msg-body.typing {
  color: #a09070;
  font-style: italic;
}

/* 开战前情（默认折叠，实底同正文） */
.prelude-block {
  margin: 0 0 8px;
  background: #fbf3e2;
  border: 1px solid rgba(160, 120, 64, 0.45);
  border-radius: 4px;
  padding: 2px 10px;
}
.prelude-block summary {
  cursor: pointer;
  font-size: 0.75em;
  font-weight: 800;
  color: #8a6a3a;
  letter-spacing: 1px;
  padding: 4px 0;
  user-select: none;
}
.prelude-block summary:hover {
  color: #5a3a08;
}
.prelude-body {
  border-top: 1px dashed rgba(160, 120, 64, 0.25);
  padding: 6px 2px 8px;
  font-size: 0.88em;
  color: #4a3820;
  line-height: 1.7;
}
.prelude-body .battle-para {
  margin: 3px 0;
}

/* 羊皮纸操作面板：预设 + 动作（技能） + 附赠（药水） + 物品 */
.action-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  padding: 6px 8px;
  background:
    radial-gradient(ellipse at 15% 20%, rgba(120, 80, 30, 0.05) 0%, transparent 45%),
    radial-gradient(ellipse at 88% 85%, rgba(120, 80, 30, 0.05) 0%, transparent 40%),
    repeating-linear-gradient(0deg, rgba(120, 80, 30, 0.035) 0px, rgba(120, 80, 30, 0.035) 1px, transparent 1px, transparent 4px),
    #f3e6c9;
  border: 1px solid #a07840;
  border-top: 3px double #7a5228;
  border-bottom: 3px double #7a5228;
  border-radius: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 250, 235, 0.7), inset 0 -1px 0 rgba(90, 58, 26, 0.15);
}
.ap-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.ap-row + .ap-row {
  border-top: 1px dashed rgba(122, 82, 40, 0.35);
  padding-top: 4px;
}
.items-row {
  max-height: 84px;
  overflow-y: auto;
}
.pb-btn,
.sb-btn {
  font-family: inherit;
  font-size: 0.72em;
  background: linear-gradient(180deg, rgba(255, 250, 238, 0.9), rgba(240, 224, 192, 0.9));
  border: 1px solid rgba(160, 120, 64, 0.55);
  border-radius: 3px;
  color: #4a3018;
  padding: 2px 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  box-shadow: 0 1px 2px rgba(90, 58, 26, 0.15);
}
.pb-btn:hover,
.sb-btn:hover {
  background: linear-gradient(180deg, #f7ead0, #eed9ad);
  border-color: #c4a050;
}
.sb-label {
  font-size: 0.68em;
  font-weight: 800;
  color: #7a5228;
  letter-spacing: 1px;
  margin: 0 2px;
  padding: 1px 5px;
  background: rgba(122, 82, 40, 0.1);
  border: 1px solid rgba(122, 82, 40, 0.25);
  border-radius: 2px;
  white-space: nowrap;
}

/* 输入区 */
.input-area {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.input-area textarea {
  flex: 1;
  min-height: 42px;
  resize: vertical;
  font-family: inherit;
  font-size: 0.88em;
  background: rgba(255, 250, 240, 0.9);
  border: 1px solid #a07840;
  border-radius: 4px;
  padding: 6px 9px;
  color: #3a2718;
  outline: none;
}
.input-area textarea:focus {
  border-color: #d4af37;
}
.send-btn {
  width: 48px;
  border: none;
  border-radius: 4px;
  font-size: 1.1em;
  background: linear-gradient(135deg, #c4a050, #8a6a3a);
  color: #fff;
  cursor: pointer;
}
.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ended-bar {
  margin-top: 8px;
  text-align: center;
  font-size: 0.8em;
  color: #3a6a2a;
  background: rgba(90, 160, 60, 0.12);
  border: 1px solid rgba(90, 160, 60, 0.35);
  border-radius: 4px;
  padding: 6px;
}
</style>

<style>
/* ===== 非 scoped：v-html 注入内容的样式（scoped 的 data-v 选择器不匹配 v-html 内容）===== */

/* 心理描写（pp 标签）斜体 */
.pp-think {
  font-style: italic;
  color: #6a5a3a;
  opacity: 0.9;
}

/* 思维链（可折叠卡片） */
.think-block {
  margin: 4px 0;
  background: rgba(90, 90, 110, 0.08);
  border: 1px dashed rgba(90, 90, 110, 0.35);
  border-radius: 4px;
  padding: 2px 8px;
}
.think-block summary {
  cursor: pointer;
  font-size: 0.75em;
  font-weight: 800;
  color: #6a6a8a;
  letter-spacing: 1px;
  padding: 3px 0;
  user-select: none;
}
.think-block summary:hover {
  color: #4a4a6a;
}
.think-body {
  border-top: 1px dashed rgba(90, 90, 110, 0.25);
  padding: 5px 2px 6px;
  font-size: 0.82em;
  color: #5a5a78;
  line-height: 1.65;
}
.think-body .battle-para {
  margin: 2px 0;
}

/* <战斗结算> 羊皮纸块（体系色，融合伊瑟利亚战斗轮结算） */
.battle-block {
  position: relative;
  margin: 6px 0;
  padding: 10px 12px 12px;
  background: linear-gradient(135deg, var(--wash, rgba(232, 214, 178, 0.32)), rgba(232, 214, 178, 0.3));
  border: 1px solid rgba(160, 120, 64, 0.28);
  border-left: 2px solid var(--phase, #c4a050);
  border-radius: 4px;
  color: #33220f;
  box-shadow: inset 0 1px 8px rgba(120, 80, 30, 0.09);
}
.battle-block::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: linear-gradient(180deg, transparent, var(--phase, #c4a050), transparent);
  border-radius: 2px;
}
.battle-block.ph-overview { --phase: #c4a050; --wash: linear-gradient(135deg, rgba(224, 206, 170, 0.32), rgba(224, 206, 170, 0.3)); }
.battle-block.ph-action { --phase: #c4a050; --wash: linear-gradient(135deg, rgba(224, 206, 170, 0.32), rgba(224, 206, 170, 0.3)); }
.battle-block.ph-weapon { --phase: #9a3b2a; --wash: linear-gradient(135deg, rgba(154, 59, 42, 0.14), rgba(154, 59, 42, 0.04)); }
.battle-block.ph-arts { --phase: #a06020; --wash: linear-gradient(135deg, rgba(160, 96, 32, 0.14), rgba(160, 96, 32, 0.04)); }
.battle-block.ph-magic { --phase: #2a4a8a; --wash: linear-gradient(135deg, rgba(42, 74, 138, 0.14), rgba(42, 74, 138, 0.04)); }
.battle-block.ph-holy { --phase: #b8892a; --wash: linear-gradient(135deg, rgba(184, 137, 42, 0.16), rgba(184, 137, 42, 0.05)); }
.battle-block.ph-life { --phase: #8a1a1a; --wash: linear-gradient(135deg, rgba(138, 26, 26, 0.12), rgba(138, 26, 26, 0.04)); }
.battle-block.ph-end { --phase: #2a6a3a; --wash: linear-gradient(135deg, rgba(42, 106, 58, 0.14), rgba(42, 106, 58, 0.05)); }
.battle-block.ph-craft { --phase: #8a4a1a; --wash: linear-gradient(135deg, rgba(138, 74, 26, 0.18), rgba(138, 74, 26, 0.06)); }

.battle-title {
  display: block;
  width: fit-content;
  margin: 0 auto 6px;
  padding: 3px 18px;
  background: var(--wash, linear-gradient(135deg, rgba(180, 150, 60, 0.16), rgba(160, 130, 50, 0.08)));
  border: 1px solid var(--phase, #c4a050);
  border-radius: 3px;
  color: #5a3a08;
  font-weight: 700;
  font-size: 1em;
  letter-spacing: 3px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(120, 80, 30, 0.15);
}

.battle-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 4px 0 4px 8px;
  margin: 2px 0;
  gap: 4px 8px;
  border-left: 2px solid rgba(160, 120, 64, 0.25);
  border-radius: 0 3px 3px 0;
  font-size: 0.88em;
  transition: border-left-color 0.2s, background 0.2s;
}
.battle-row:hover {
  background: rgba(255, 248, 225, 0.6);
  border-left-color: #d4af37;
}
.battle-key {
  font-weight: 700;
  color: #3a2718;
  flex-shrink: 0;
}
.battle-key::after {
  content: ":";
  color: #7a5020;
  margin-left: 1px;
  margin-right: 5px;
}

/* 行级分级 */
.battle-row.row-dice {
  background: linear-gradient(90deg, rgba(232, 214, 178, 0.4), rgba(232, 214, 178, 0.08));
  border-left-color: #b08020;
  font-weight: 600;
}
.battle-row.row-crit {
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.22), rgba(255, 248, 200, 0.06));
  border-left-color: #d4af37;
  font-weight: 700;
}
.battle-row.row-fail {
  background: linear-gradient(90deg, rgba(154, 31, 31, 0.1), transparent);
  border-left-color: #9a1f1f;
}
.battle-row.row-resource {
  background: rgba(245, 240, 220, 0.55);
  border-left-color: #8b7330;
  margin-top: 4px;
}
.battle-row.row-change {
  background: linear-gradient(90deg, rgba(190, 150, 60, 0.14), rgba(190, 150, 60, 0.03));
  border-left-color: #a08030;
  font-weight: 600;
}
.battle-row.row-hint {
  font-style: italic;
  color: #7a5a30;
}

.battle-text {
  font-size: 0.88em;
  color: #4a3820;
  padding: 2px 6px;
}

/* 叙事段落（首字金线） */
.battle-para {
  margin: 6px 0;
  padding: 5px 12px;
  font-style: italic;
  font-weight: 500;
  color: #4a3018;
  border-left: 3px solid #c4a050;
  background: linear-gradient(90deg, rgba(255, 248, 225, 0.5), transparent);
  border-radius: 0 4px 4px 0;
  line-height: 1.85;
  white-space: pre-wrap;
}

/* 回合横幅：X 的回合（羊皮纸缎带） */
.turn-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 10px 0 8px;
  padding: 5px 12px;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255, 244, 210, 0.55), transparent 70%),
    repeating-linear-gradient(0deg, rgba(122, 82, 40, 0.03) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, #f0e0c0, #e6d0a8);
  border-top: 2px solid #a07840;
  border-bottom: 2px solid #a07840;
  box-shadow: 0 1px 3px rgba(90, 58, 26, 0.18);
  position: relative;
}
.turn-banner::before,
.turn-banner::after {
  content: '';
  flex: 1;
  height: 1px;
  background: repeating-linear-gradient(90deg, #a07840 0 4px, transparent 4px 8px);
  opacity: 0.7;
}
.turn-name {
  font-size: 0.98em;
  font-weight: 900;
  color: #8a2a10;
  letter-spacing: 2px;
  text-shadow: 0 1px 0 rgba(255, 250, 235, 0.8);
  white-space: nowrap;
}
.turn-mood {
  font-size: 0.72em;
  font-weight: 600;
  color: #6a4a20;
}
.turn-word {
  font-size: 0.72em;
  font-weight: 800;
  color: #6a5430;
  letter-spacing: 2px;
}
.turn-deco {
  color: #c4a050;
  font-size: 0.8em;
  text-shadow: 0 1px 0 rgba(90, 58, 26, 0.25);
}

/* 开战前情折叠区内的内容 */
.prelude-body .battle-para {
  margin: 3px 0;
}
</style>
