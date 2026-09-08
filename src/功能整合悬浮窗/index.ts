// Pinia CDN 构建依赖这些 Vue 编译时常量，酒馆全局 Vue 未注入，需手动补齐
(globalThis as any).__VUE_PROD_DEVTOOLS__ = false;
(globalThis as any).__VUE_OPTIONS_API__ = false;
(globalThis as any).__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

import { createPinia, setActivePinia } from 'pinia';
import { createApp, reactive } from 'vue';
import { RHYTHMS, usePlotPlannerStore } from '../剧情规划大师/store';
import { useSummaryStore } from '../总结助手/store';
import { useHeroSpiritStore } from '../英灵功能/store';
import App from './App.vue';

// ============================================================
// 功能整合悬浮窗 — 将「剧情规划大师 / 英灵功能 / 总结助手」
// 三个独立悬浮球合并为一个带标签页的统一悬浮窗
// ============================================================

// ---- 共享响应式面板状态 ----
const panelState = reactive({
  expanded: false,
  collapsed: false,
});

// ---- 宿主窗口工具（脚本在 iframe 中运行，指向酒馆外层页面） ----
const OUTER: Window = window.parent || window;

function outerDoc(): Document {
  return (OUTER as any)?.document ?? document;
}
function outerBody(): HTMLElement {
  return outerDoc().body;
}
function outerQS<T extends HTMLElement = HTMLElement>(sel: string): T | null {
  return (OUTER as any)?.document?.querySelector?.(sel) as T ?? null;
}
function getViewport() {
  return { w: (OUTER as any).innerWidth || 1280, h: (OUTER as any).innerHeight || 720 };
}
function getChatFileName(): string {
  try {
    const chatId = SillyTavern.getCurrentChatId();
    if (chatId) return chatId.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  } catch {}
  return `chat_${Date.now()}`;
}
function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// ---- 窗口布局：尺寸/最大化持久化（用户可拉伸窗口，重开保留） ----
const LAYOUT_KEY = 'iseria_hub_layout_v1';
type HubLayout = { w: number; h: number; maximized: boolean };
function loadLayout(): HubLayout {
  try {
    const raw = (OUTER as any).localStorage?.getItem(LAYOUT_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return { w: clamp(+o.w || 480, 380, 4000), h: clamp(+o.h || 640, 460, 4000), maximized: !!o.maximized };
    }
  } catch { /* ignore */ }
  return { w: 480, h: 640, maximized: false };
}
const layout = reactive<HubLayout>(loadLayout());
function saveLayout(patch: Partial<HubLayout>) {
  try { (OUTER as any).localStorage?.setItem(LAYOUT_KEY, JSON.stringify({ ...layout, ...patch })); } catch { /* ignore */ }
}
function appliedSize() {
  const vp = getViewport();
  return layout.maximized
    ? { w: Math.max(320, vp.w - 16), h: Math.max(380, vp.h - 16) }
    : { w: clamp(layout.w, 380, Math.max(380, vp.w - 16)), h: clamp(layout.h, 460, Math.max(460, vp.h - 16)) };
}
function applySizeToHost() {
  if (!hostEl) return;
  const s = appliedSize();
  hostEl.style.width = `${s.w}px`;
  hostEl.style.height = `${s.h}px`;
}
/** 将宿主元素钳回视口内（用目标尺寸计算，规避 width 过渡动画中 offsetWidth 读旧值的坑） */
function clampHostPosition() {
  if (!hostEl) return;
  const vp = getViewport();
  const s = appliedSize();
  const curLeft = parseFloat(hostEl.style.left) || 0;
  const curTop = parseFloat(hostEl.style.top) || 0;
  hostEl.style.left = `${clamp(curLeft, 0, Math.max(0, vp.w - s.w))}px`;
  hostEl.style.top = `${clamp(curTop, 0, Math.max(0, vp.h - s.h))}px`;
}
function requestResize(w: number, h: number) {
  layout.maximized = false;
  layout.w = Math.round(w);
  layout.h = Math.round(h);
  saveLayout({});
  applySizeToHost();
  clampHostPosition();
}
function requestToggleMaximize() {
  layout.maximized = !layout.maximized;
  saveLayout({});
  applySizeToHost();
  if (hostEl && panelState.expanded) {
    if (layout.maximized) {
      hostEl.style.left = '8px';
      hostEl.style.top = '8px';
    } else {
      clampHostPosition();
    }
  }
}

const FLOATING_WINDOW_SINGLETON_KEY = '__WXHL_INTEGRATED_FLOATING_WINDOW_SINGLETON__';
const FLOATING_WINDOW_HOST_ATTR = 'data-integrated-float-root';
const FLOATING_WINDOW_HOST_SELECTOR = `[${FLOATING_WINDOW_HOST_ATTR}="1"]`;

type FloatingWindowSingleton = {
  hostEl: HTMLElement | null;
  mounted: boolean;
};

function getSingletonState(): FloatingWindowSingleton {
  const outerWin = OUTER as Window & Record<string, any>;
  if (!outerWin[FLOATING_WINDOW_SINGLETON_KEY]) {
    outerWin[FLOATING_WINDOW_SINGLETON_KEY] = { hostEl: null, mounted: false } as FloatingWindowSingleton;
  }
  return outerWin[FLOATING_WINDOW_SINGLETON_KEY] as FloatingWindowSingleton;
}

function getExistingHostEl(): HTMLElement | null {
  const existingHosts = Array.from(outerDoc().querySelectorAll(FLOATING_WINDOW_HOST_SELECTOR)) as HTMLElement[];
  if (!existingHosts.length) return null;
  const [primaryHost, ...duplicates] = existingHosts;
  duplicates.forEach((node) => node.remove());
  return primaryHost;
}

function ensureHostEl(): HTMLElement {
  const singletonState = getSingletonState();
  const existingHost = getExistingHostEl();
  if (existingHost) {
    singletonState.hostEl = existingHost;
    return existingHost;
  }

  const host = outerDoc().createElement('div');
  host.setAttribute(FLOATING_WINDOW_HOST_ATTR, '1');
  host.setAttribute('script_id', getScriptId());
  host.style.position = 'fixed';
  host.style.left = '0px';
  host.style.top = '0px';
  host.style.width = '56px';
  host.style.height = '56px';
  host.style.zIndex = '2147483647';
  host.style.overflow = 'visible';
  host.style.background = 'transparent';
  host.style.transition = 'width 0.25s ease, height 0.25s ease';
  outerBody().appendChild(host);
  singletonState.hostEl = host;
  return host;
}

function renderFallbackBall() {
  if (!hostEl) return;
  hostEl.innerHTML = '';
  hostEl.style.width = '56px';
  hostEl.style.height = '56px';
  hostEl.style.display = 'flex';
  hostEl.style.alignItems = 'center';
  hostEl.style.justifyContent = 'center';
  hostEl.style.borderRadius = '999px';
  hostEl.style.background = 'linear-gradient(135deg, #8b5cf6, #3b82f6)';
  hostEl.style.color = '#fff';
  hostEl.style.fontSize = '22px';
  hostEl.style.boxShadow = '0 10px 24px rgba(107, 33, 168, 0.35)';
  hostEl.style.visibility = 'visible';
  hostEl.style.opacity = '1';
  hostEl.textContent = '✦';
}

// ---- Pointer Events 拖拽（瞬发无延迟，setPointerCapture 保证跟手） ----
let hostEl: HTMLElement | null = null;
let dragStartX = 0;
let dragStartY = 0;
let dragBaseLeft = 0;
let dragBaseTop = 0;
let isDragging = false;
let pointerDownOnHandle = false;
let activePointerId: number | null = null;

/** 折叠悬浮球与展开面板头部都可作为拖拽手柄 */
const HANDLE_SELECTOR = '[data-fab-ball="1"], [data-drag-handle="1"]';

function isHandleTarget(el: EventTarget | null): boolean {
  if (!el) return false;
  const t = el as HTMLElement;
  // 忽略按钮/输入框等可交互元素：避免点击它们时误触发拖拽切换（如头部内的收起按钮）
  if (t.closest?.('button, input, select, textarea, a, label')) return false;
  return !!t.closest?.(HANDLE_SELECTOR);
}

let lastToggleTime = 0;
function togglePanel() {
  const now = Date.now();
  if (now - lastToggleTime < 200) return;
  lastToggleTime = now;
  panelState.expanded = !panelState.expanded;
  panelState.collapsed = panelState.expanded ? false : true;
  if (!hostEl) return;
  if (panelState.expanded) {
    applySizeToHost();
    // 展开时贴边内收，避免超出视口（按目标尺寸钳制，不受过渡动画影响）
    clampHostPosition();
  } else {
    hostEl.style.width = '56px';
    hostEl.style.height = '56px';
  }
}

// ---- 将长规划压缩为关键要点（避免分析性文本淹没角色扮演指令） ----
function condensePlanForContext(raw: string, maxLen = 500): string {
  if (!raw || raw.length <= maxLen) return raw;
  // 尝试提取"起承转合"各阶段的第一句话作为骨架
  const stages = ['起', '承', '转', '合'];
  const lines: string[] = [];
  let found = false;
  for (const stage of stages) {
    // 匹配形如「起（建置）」或「起」开头的段落
    const re = new RegExp(`${stage}[（(][^)）]*[)）]?[\\s\\S]*?(?=${stages.map(s => s + '[（(]').join('|')}|$)`, 'g');
    const m = raw.match(re);
    if (m && m[0]) {
      // 每个阶段只取前 120 字
      const trimmed = m[0].replace(/\n+/g, ' ').trim();
      lines.push(trimmed.length > 120 ? trimmed.slice(0, 120) + '…' : trimmed);
      found = true;
    }
  }
  if (found && lines.length > 0) return lines.join('\n');
  // 兜底：直接截断
  return raw.slice(0, maxLen) + '…';
}

// ---- 加载入口 ----
$(() => {
  console.log('[功能整合悬浮窗] 脚本开始加载...');

  try {
    const pinia = createPinia();
    setActivePinia(pinia);

    // ---- 载入三个 store（id 互不冲突：plotPlanner / heroSpirit / summary）----
    const planner = usePlotPlannerStore();
    const hero = useHeroSpiritStore();
    const summary = useSummaryStore();

    try {
      summary.initialize(getChatFileName());
    } catch (e) {
      console.warn('[功能整合悬浮窗] summary 初始化失败，继续显示悬浮窗', e);
    }

    // ---- D联动：让总结读取剧情规划的当前节拍 + NPC 名单 ----
    try {
      summary.setContextProvider((phase) => {
        if (!summary.settings.plannerLink) return '';
        const parts: string[] = [];
        const s = planner.storyState;
        if (s?.currentGoal) {
          parts.push(`当前阶段：${s.stage} · 序列${s.sequence}`);
          parts.push(`当前目标：${s.currentGoal}`);
          if (s.nextMove) parts.push(`下一步：${s.nextMove}`);
          if (s.activeConflicts?.length) parts.push(`进行中冲突：${s.activeConflicts.join('；')}`);
          if (s.completed?.length) parts.push(`已达成：${s.completed.slice(-3).join('；')}`);
        }
        const latest = planner.latestNpcByName(false);
        if (latest?.npcs?.length) {
          parts.push(`周围主要NPC/同伴：${latest.npcs.map(n => n.name).join('、')}`);
        }
        return parts.join('\n');
      });
    } catch (e) {
      console.warn('[功能整合悬浮窗] context provider 注册失败', e);
    }

    // ---- D联动（反向）：规划读取总结助手的历史总纲 + 未解决问题（伏笔回收闭环） ----
    try {
      planner.setSummaryProvider(() => {
        const injected = summary.buildInjectionText();
        return injected?.text || '';
      });
    } catch (e) {
      console.warn('[功能整合悬浮窗] summary provider 注册失败', e);
    }

    // ---- 注册脚本按钮（收敛为四枚：一键规划/推进/总结/英灵技）----
    replaceScriptButtons([
      { name: '✦ 一键规划', visible: true },
      { name: '🚀 生成推进', visible: true },
      { name: '📜 生成总结', visible: true },
      { name: '⚡ 释放英灵技', visible: true },
    ]);

    const singletonState = getSingletonState();
    if (singletonState.mounted && singletonState.hostEl?.isConnected) {
      hostEl = singletonState.hostEl;
      console.log('[功能整合悬浮窗] 检测到已存在实例，跳过重复挂载');
      return;
    }

    // ---- 在外层页面创建宿主元素（同一页面只保留一个实例） ----
    const vp = getViewport();
    hostEl = ensureHostEl();
    hostEl.style.left = `${Math.max(12, vp.w - 78)}px`;
    hostEl.style.top = `${Math.max(12, vp.h - 78)}px`;
    hostEl.style.width = '56px';
    hostEl.style.height = '56px';
    hostEl.style.zIndex = '2147483647';
    hostEl.style.overflow = 'visible';
    hostEl.style.background = 'transparent';
    hostEl.style.transition = 'width 0.25s ease, height 0.25s ease';

    // ---- 克隆样式到外层页面 head ----
    const { destroy: destroyStyle } = (() => {
      const doc = outerDoc();
      const $styleDiv = $(doc.createElement('div'))
        .attr('script_id', getScriptId())
        .append($('head > style', document).clone());
      doc.head.appendChild($styleDiv[0]);
      return { destroy: () => $styleDiv.remove() };
    })();

    // ---- 挂载统一面板 ----
    try {
      const app = createApp(App as any, {
        panelState,
        requestCollapse: () => togglePanel(),
        requestResize,
        requestToggleMaximize,
        winLayout: layout,
      }).use(pinia);
      app.mount(hostEl);
      singletonState.mounted = true;
    } catch (e) {
      singletonState.mounted = false;
      console.error('[功能整合悬浮窗] 挂载失败，显示兜底球', e);
      renderFallbackBall();
    }

    // ---- Pointer Events 拖拽 ----
    hostEl.addEventListener('pointerdown', (e) => {
      if (!hostEl || e.button !== 0) return;
      pointerDownOnHandle = isHandleTarget(e.target);
      if (!pointerDownOnHandle) return;

      const rect = hostEl.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragBaseLeft = rect.left;
      dragBaseTop = rect.top;
      isDragging = false;
      activePointerId = e.pointerId;

      hostEl.setPointerCapture(e.pointerId);
      outerBody().style.cursor = 'grabbing';
      e.preventDefault();
    });

    hostEl.addEventListener('pointermove', (e) => {
      if (!hostEl || activePointerId === null || e.pointerId !== activePointerId) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;
      if (!isDragging) return;

      const vpNow = getViewport();
      const pw = hostEl.offsetWidth;
      const ph = hostEl.offsetHeight;
      const newLeft = clamp(dragBaseLeft + dx, 0, Math.max(0, vpNow.w - pw));
      const newTop = clamp(dragBaseTop + dy, 0, Math.max(0, vpNow.h - ph));

      hostEl.style.left = `${newLeft}px`;
      hostEl.style.top = `${newTop}px`;
      e.preventDefault();
    });

    hostEl.addEventListener('pointerup', (e) => {
      if (!hostEl || activePointerId === null || e.pointerId !== activePointerId) return;
      activePointerId = null;
      hostEl.releasePointerCapture(e.pointerId);
      outerBody().style.cursor = '';

      if (isDragging) {
        const vpNow = getViewport();
        const pw = hostEl.offsetWidth;
        const ph = hostEl.offsetHeight;
        const finalLeft = clamp(parseFloat(hostEl.style.left) || 0, 0, Math.max(0, vpNow.w - pw));
        const finalTop = clamp(parseFloat(hostEl.style.top) || 0, 0, Math.max(0, vpNow.h - ph));
        hostEl.style.left = `${finalLeft}px`;
        hostEl.style.top = `${finalTop}px`;
      } else if (pointerDownOnHandle) {
        togglePanel();
      }
      isDragging = false;
      pointerDownOnHandle = false;
    });

    // ---- resize 时确保不超出边界（最大化时随视口重算尺寸） ----
    const repositionOnResize = () => {
      if (!hostEl) return;
      if (panelState.expanded) applySizeToHost();
      const vpNow = getViewport();
      const pw = hostEl.offsetWidth;
      const ph = hostEl.offsetHeight;
      const left = clamp(parseFloat(hostEl.style.left) || 0, 0, Math.max(0, vpNow.w - pw));
      const top = clamp(parseFloat(hostEl.style.top) || 0, 0, Math.max(0, vpNow.h - ph));
      hostEl.style.left = `${left}px`;
      hostEl.style.top = `${top}px`;
    };
    (OUTER as any).addEventListener('resize', repositionOnResize);

    // ---- 上下文注入：剧情规划（节拍优先 → 有效大纲压缩要点 → 推进 → 在场NPC动向）----
    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }: any) => {
      // 非 RP 工具生成（技能树/总结/装备定制等）不注入剧情规划，避免污染工具任务
      if ((window as any).__ISURIA_NON_RP__) return;
      const marker = '【剧情规划大师】';
      const alreadyInjected = (chat || []).some((m: any) => String(m?.content || '').includes(marker));
      if (alreadyInjected) return;

      const parts: string[] = [];

      // P0：优先注入「当前剧情节拍」（唯一目标），让 AI 明确知道现在这一拍；无进度指针时回退到最近一份有效规划的压缩要点
      if (planner.storyState?.currentGoal) {
        const s = planner.storyState;
        const beatParts: string[] = [
          '【当前剧情节拍 — 必须执行】你是角色扮演 AI。以下是你当前必须推动到达的唯一剧情目标，请用自然的人物行动、对话与心理来呈现它，绝不输出规划文本本身、绝不跳出角色。',
          `当前阶段：${s.stage} · 序列${s.sequence}`,
          `当前目标：${s.currentGoal}`,
        ];
        if (s.nextMove) beatParts.push(`下一步应发生：${s.nextMove}`);
        if (s.activeConflicts?.length) beatParts.push(`进行中冲突：${s.activeConflicts.join('；')}`);
        if (s.completed?.length) beatParts.push(`已达成：${s.completed.slice(-3).join('；')}`);
        parts.push(beatParts.join('\n'));
      } else if (planner.settings.injectPlanIntoContext) {
        const planItem = [...planner.plans].reverse().find(p => !p.stale);
        if (planItem?.content?.trim()) {
          const condensed = condensePlanForContext(planItem.content.trim());
          // 生成语境行：节奏/命运骰/范式
          const m = planItem.meta;
          const ctxLine = m
            ? `本次基调：${(RHYTHMS as Record<string, { label: string }>)[m.rhythm]?.label ?? m.rhythm}` +
              (m.fate ? `｜命运：🎲${m.fate.roll} ${m.fate.label}` : '') +
              (m.prototypes?.length ? `｜范式：${m.prototypes.join(' + ')}` : '') + '\n'
            : '';
          parts.push(
            '【剧情规划 — 隐性走向指引】你是角色扮演 AI。以下是当前剧情的可能性底稿，你的正文须让剧情朝其中的事件自然推进，保持角色扮演、不输出任何规划/大纲/元文本：\n' +
            ctxLine +
            `底稿要点：\n${condensed}`
          );
        }
      }
      if (planner.settings.injectPushIntoContext) {
        const adv = [...planner.advances].reverse().find(a => !a.resolved)?.content?.trim();
        if (adv) {
          // 推进通常较短（一句话），但也需要强指令
          const cleaned = adv.replace(/【最高权限】请立即停止任何正文输出[。.]?/g, '').trim();
          parts.push(
            '【剧情推进 — 当前转折方向，必须让剧情向其发展】将以下方向自然地编织进角色扮演正文中，不要以任何形式复述或提及推进文本本身：\n' +
            cleaned
          );
        }
      }
      // NPC 动向注入：最新有效动向按名字合并 + 在场过滤（读 stat_data 位置，同场景才注入）
      if (planner.settings.injectNpcIntoContext && planner.npcPlans.length > 0) {
        const latest = planner.latestNpcByName(planner.settings.npcOnSceneOnly);
        const npcLines = latest
          ? latest.npcs.slice(0, 8).map(n => {
            const bits: string[] = [];
            if (n.thought) bits.push(`想法：${n.thought}`);
            if (n.behavior) bits.push(`行为：${n.behavior}`);
            if (n.personality) bits.push(`性格：${n.personality}`);
            if (n.likelyAction) bits.push(`可能行动：${n.likelyAction}`);
            return `【${n.name}】${bits.join('｜')}`;
          }).join('\n')
          : '';
        if (npcLines) {
          parts.push(
            '【NPC动向 — 周围主要角色当下动态，须按人设体现】以下是主角周围主要 NPC/同伴此刻可能的想法、行为与性格表现。请让她们在正文中以符合人设的方式自然体现，尤其是「可能行动」应作为她们主动推动剧情的行动融入发展，不要复述本段：\n' +
            npcLines
          );
        }
      }
      if (parts.length === 0) return;

      chat.unshift({
        role: 'system',
        content: `${marker}\n${parts.join('\n\n')}`,
      });
    });

    // ---- 上下文注入：剧情总结（yuzuki 式前情提要，纯注入、不再建世界书）----
    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }: any) => {
      // 非 RP 工具生成（含总结助手自身生成总结时）不注入前情提要，避免自我污染
      if ((window as any).__ISURIA_NON_RP__) return;
      const marker = '【伊瑟利亚总结】';
      if ((chat || []).some((m: any) => String(m?.content || '').includes(marker))) return;

      const injected = summary.buildInjectionText();
      if (!injected) return;

      chat.unshift({
        role: 'system',
        content: `${marker}\n${injected.text}`,
      });
    });

    // ---- 聊天切换：重置规划 + 总结数据 ----
    eventOn(tavern_events.CHAT_CHANGED, () => {
      const chatId = (() => { try { return SillyTavern.getCurrentChatId() || ''; } catch { return ''; } })();
      planner.resetForNewChat(chatId);
      summary.settings.worldbookSuffix = getChatFileName();
      summary.resetForNewChat(chatId);
    });

    // ---- 健壮化：主生成期间挂起自动规划任务（防抢接口/防上下文污染） ----
    eventOn(tavern_events.GENERATION_STARTED, () => planner.setGenerationBusy(true));
    eventOn(tavern_events.GENERATION_ENDED, () => planner.setGenerationBusy(false));
    eventOn(tavern_events.GENERATION_STOPPED, () => planner.setGenerationBusy(false));

    // ---- 健壮化：楼层被删除/编辑/切换 swipe 后，覆盖该楼层的规划数据失效 ----
    const invalidate = (floor: number) => planner.invalidateCoverage(Number(floor) || 0);
    eventOn(tavern_events.MESSAGE_DELETED, (id: number) => invalidate(id));
    eventOn(tavern_events.MESSAGE_EDITED, (id: number) => invalidate(id));
    eventOn(tavern_events.MESSAGE_SWIPED, (id: number) => invalidate(id));

    // ---- 世界书变更：刷新英灵列表 + 英灵共鸣数据 ----
    const refreshListener = eventOn(tavern_events.WORLDINFO_UPDATED, () => {
      setTimeout(() => {
        hero.loadHeroesFromWorldbook();
        hero.refreshSpiritRuntime();
      }, 500);
    });

    // ---- 脚本按钮事件 ----
    eventOn(getButtonEvent('✦ 一键规划'), () => {
      if (planner.loading || planner.detecting || planner.npcLoading) { toastr.info('规划进行中，请稍候...'); return; }
      planner.runFullPlan().then(r => {
        if (r.plan) {
          const bits: string[] = ['底稿已生成'];
          if (r.stage) bits.push(`阶段 ${r.stage.stage}·序列${r.stage.sequence}`);
          if (r.npc) bits.push(`${r.npc.npcs.length} 个NPC动向`);
          toastr.success(bits.join('，'), '一键规划');
        }
      });
    });
    eventOn(getButtonEvent('🚀 生成推进'), () => {
      if (planner.loading) { toastr.info('正在分析中，请稍候...'); return; }
      planner.generateAdvance().then(r => {
        if (r) toastr.success('推进指令生成完成' + (planner.settings.npcEnabled && planner.settings.npcAutoWithAdvance ? '（已联动 NPC 动向）' : ''), '剧情规划大师');
      });
    });
    eventOn(getButtonEvent('📜 生成总结'), () => {
      if (summary.loading) { toastr.info('正在总结中，请稍候...'); return; }
      summary.generateSummary(false).then(result => {
        if (result) toastr.success('剧情总结完成', '伊瑟利亚总结助手');
      });
    });
    eventOn(getButtonEvent('⚡ 释放英灵技'), () => {
      hero.releaseSpiritSkill().then(r => {
        if (r.ok) toastr.success(r.msg, '英灵技');
        else toastr.warning(r.msg, '英灵技');
      });
    });

    // ---- 卸载清理 ----
    $(window).on('pagehide', () => {
      planner.setAutoGenerate(false);
      planner.setAutoAdvance(false);
      summary.destroy();
      (OUTER as any).removeEventListener('resize', repositionOnResize);
      if (refreshListener && (refreshListener as any).stop) (refreshListener as any).stop();
      app.unmount();
      const singletonState = getSingletonState();
      singletonState.hostEl = null;
      singletonState.mounted = false;
      const hosts = outerDoc().querySelectorAll(FLOATING_WINDOW_HOST_SELECTOR);
      hosts.forEach((node) => node.remove());
      destroyStyle();
    });

    toastr.success('功能整合悬浮窗已就绪', '加载成功');
  } catch (e: any) {
    console.error('[功能整合悬浮窗] 加载失败:', e?.message || e);
    toastr.error(e?.message || '未知错误', '功能整合悬浮窗加载失败');
  }
});
