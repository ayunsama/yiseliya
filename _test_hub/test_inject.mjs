/**
 * 总结助手 · 上下文注入测试（多环境模拟）
 * 被测代码：三合一窗口 index.ts 的总结注入段（逐字提取）+ 真实 src/总结助手/store.ts
 * 环境：标准20楼 / 100楼大总结 / 防重 / 无数据 / 聊天切换 / 剧情规划联动 / 多注入共存 / 隐藏楼层
 */
import { createPinia, setActivePinia } from 'pinia';

// ============ 环境 stub ============
const toastrStub = { info: () => {}, success: () => {}, warning: () => {}, error: () => {} };
globalThis.toastr = toastrStub;
globalThis.window = globalThis;
globalThis.document = { activeElement: null, body: {} };
globalThis.tavern_events = { GENERATION_ENDED: 'generation_ended', CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready', MESSAGE_RECEIVED: 'message_received' };

const eventHandlers = {};
globalThis.eventOn = (evt, cb) => { (eventHandlers[evt] = eventHandlers[evt] || []).push(cb); return { stop: () => {} }; };

// ---- 楼层数据源（支持 hide_state 过滤） ----
const chatMessages = [];
globalThis.getLastMessageId = () => chatMessages.length ? chatMessages[chatMessages.length - 1].id : -1;
globalThis.getChatMessages = (range, opts) => {
  const [a, b] = String(range).split('-').map(Number);
  const hideState = opts?.hide_state;
  return chatMessages.filter(m => m.id >= a && m.id <= b && !(hideState === 'unhidden' && m.is_hidden));
};
globalThis.setChatMessages = async () => {};
globalThis.insertOrAssignVariables = async () => {};
globalThis.getVariables = () => ({});
globalThis.SillyTavern = { getCurrentChatId: () => 'chat-A' };

// ---- 伪 AI 总结生成器 ----
globalThis.generateRaw = async ({ ordered_prompts }) => {
  const userInput = ordered_prompts?.[1]?.content || '';
  const m = userInput.match(/本次总结范围\s*第(\d+)-(\d+)楼/);
  const s = m ? Number(m[1]) : 1, e = m ? Number(m[2]) : 1;
  const batch = chatMessages.filter(x => x.id >= s && x.id <= e && !x.is_hidden);
  const byRole = {};
  for (const msg of batch) { if (msg.role === 'user') continue; (byRole[msg.name] = byRole[msg.name] || []).push(msg.message); }
  const lines = ['【主线总结】', `圣光历1497年 [测试地] 第${s}-${e}楼 主角推进剧情：${(batch.find(x => x.role !== 'user')?.message || '').slice(0, 30)}…`];
  for (const [who, msgs] of Object.entries(byRole)) lines.push(`【支线总结：${who}】`, `${msgs.map(t => t.slice(0, 25)).join('；')}（第${s}-${e}楼）`);
  lines.push('【未解决问题】', `- 第${e}楼约定待兑现`);
  return `<Memory>\n${lines.join('\n')}\n</Memory>`;
};

// ---- 楼层填充 ----
function pushFloors(n, startId, opts = {}) {
  for (let i = 0; i < n; i++) {
    const id = startId + i;
    chatMessages.push({
      id,
      role: i % 2 === 0 ? 'user' : 'assistant',
      name: i % 2 === 0 ? '玩家' : ['艾琳', '格罗姆'][(i / 2) % 2 | 0],
      message: `${i % 2 === 0 ? '玩家' : ['艾琳', '格罗姆'][(i / 2) % 2 | 0]}第${id}楼：关于魔潮的对话${id}`,
      ...(opts.hiddenIds?.includes(id) ? { is_hidden: true } : {}),
    });
  }
}

// ---- 模拟酒馆提示词构建（楼层 → SendingMessage 数组） ----
function buildPromptChat(extra = []) {
  const chat = [
    { role: 'system', content: '角色卡设定…' },
    ...chatMessages.slice(0, 6).map(m => ({ role: m.role, content: `${m.name}：${m.message}` })),
    { role: 'user', content: '（当前输入）' },
    ...extra,
  ];
  return chat;
}

// ---- 三合一窗口 index.ts 的总结注入段（逐字提取） ----
function installSummaryInjection(store) {
  eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }) => {
    const marker = '【伊瑟利亚总结】';
    if ((chat || []).some((m) => String(m?.content || '').includes(marker))) return;
    const injected = store.buildInjectionText();
    if (!injected) return;
    chat.unshift({ role: 'system', content: `${marker}\n${injected.text}` });
  });
}

// ============ 断言 ============
let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}
function firePromptReady(chat) {
  for (const cb of eventHandlers[tavern_events.CHAT_COMPLETION_PROMPT_READY] || []) cb({ chat });
  return chat;
}

// ============ 加载真实 store ============
const pinia = createPinia();
setActivePinia(pinia);
const { useSummaryStore } = await import('../src/总结助手/store.ts');
const store = useSummaryStore();
store.initialize('test');
installSummaryInjection(store);

// ============================================================
console.log('\n========== 环境1：标准酒馆环境（20楼 + 已总结） ==========');
pushFloors(20, 1);
await store.generateSummary(true);
let chat = firePromptReady(buildPromptChat());
assert('注入 system 消息（含【伊瑟利亚总结】标记）', chat[0]?.role === 'system' && chat[0].content.includes('【伊瑟利亚总结】'), `chat[0]: ${chat[0]?.content?.slice(0, 30)}`);
assert('注入位于提示词最前', chat[0].content.includes('【最近进展 · 第1-20楼】'));
assert('注入包含未解决问题', chat[0].content.includes('【未解决问题】') && chat[0].content.includes('约定待兑现'));
assert('注入包含支线角色', chat[0].content.includes('艾琳') && chat[0].content.includes('格罗姆'));
assert('原提示词保留（注入不破坏楼层）', chat.length >= 8 && chat.some(m => m.content.includes('角色卡设定')));
console.log(`  注入预览: ${chat[0].content.replace(/\n/g, ' ').slice(0, 80)}…`);

// ============================================================
console.log('\n========== 环境2：100楼 + 大总结后的注入 ==========');
pushFloors(80, 21);
store.updateSettings({ bigGenerate: true, bigInterval: 100 });
await store.generateSummary(true);
await new Promise(r => setTimeout(r, 120));
chat = firePromptReady(buildPromptChat());
assert('注入含【历史总纲 · 截至第100楼】', chat[0].content.includes('【历史总纲 · 截至第100楼】'), chat[0].content.slice(0, 50));
assert('总纲在进展之前（历史在前）', chat[0].content.indexOf('【历史总纲') < chat[0].content.indexOf('【最近进展') || !chat[0].content.includes('【最近进展'));
assert('注入含总纲未解决问题', chat[0].content.includes('【未解决问题】'));

// ============================================================
console.log('\n========== 环境3：防重复注入 ==========');
const chat2 = buildPromptChat();
firePromptReady(chat2);
const lenAfterFirst = chat2.length;
firePromptReady(chat2);
assert('同一次提示词构建只注入一次', chat2.length === lenAfterFirst, `二次注入后长度 ${chat2.length} vs ${lenAfterFirst}`);
// 下一次独立生成（新 chat 数组）→ 正常注入一次
const chat3 = firePromptReady(buildPromptChat());
assert('下一次生成正常注入（不误伤）', chat3[0].content.includes('【伊瑟利亚总结】'));

// ============================================================
console.log('\n========== 环境4：无总结数据（新聊天未总结） ==========');
store.resetForNewChat('chat-B');
chatMessages.length = 0;
pushFloors(5, 1); // 5楼未总结
chat = firePromptReady(buildPromptChat());
assert('无总结数据时不注入（不污染提示词）', !chat[0].content.includes('【伊瑟利亚总结】'), chat[0].content.slice(0, 30));

// ============================================================
console.log('\n========== 环境5：聊天切换后不泄漏旧总结 ==========');
pushFloors(15, 6); // 共20楼
await store.generateSummary(true); // 新聊天总结 1-20
chat = firePromptReady(buildPromptChat());
assert('新聊天注入自己的总结', chat[0].content.includes('【最近进展 · 第1-20楼】'));
store.resetForNewChat('chat-C'); // 切换聊天
chatMessages.length = 0;
pushFloors(3, 1);
chat = firePromptReady(buildPromptChat());
assert('切换聊天后旧总结不泄漏（不注入）', !chat[0].content.includes('【伊瑟利亚总结】'));

// ============================================================
console.log('\n========== 环境6：剧情规划联动（plannerLink） ==========');
store.resetForNewChat('chat-D');
chatMessages.length = 0;
pushFloors(20, 1);
store.setContextProvider((phase) => phase === 'inject' ? '当前阶段：危机期 · 序列3\n当前目标：寻找魔王线索\n周围NPC：艾琳、格罗姆' : '');
await store.generateSummary(true);
chat = firePromptReady(buildPromptChat());
assert('注入含【剧情当前指向】', chat[0].content.includes('【剧情当前指向】') && chat[0].content.includes('寻找魔王线索'));
store.updateSettings({ plannerLink: false });
chat = firePromptReady(buildPromptChat());
assert('关闭联动后不注入剧情指向', !chat[0].content.includes('【剧情当前指向】'));
store.updateSettings({ plannerLink: true });

// ============================================================
console.log('\n========== 环境7：多注入共存（英灵概要 + 剧情规划 + 总结） ==========');
store.resetForNewChat('chat-E');
chatMessages.length = 0;
pushFloors(20, 1);
await store.generateSummary(true);
const chat7 = buildPromptChat([
  { role: 'system', content: '【剧情规划大师】\n当前目标：讨伐魔将' },   // 模拟三合一剧情规划注入
  { role: 'system', content: '【英灵/同伴互动概要】\n与索菲亚的互动…' }, // 模拟英灵store注入
]);
firePromptReady(chat7);
assert('总结注入与其他注入共存（3个标记都在）',
  chat7.some(m => m.content.includes('【伊瑟利亚总结】')) &&
  chat7.some(m => m.content.includes('【剧情规划大师】')) &&
  chat7.some(m => m.content.includes('【英灵/同伴互动概要】')),
  JSON.stringify(chat7.map(m => m.content.slice(0, 12))));
assert('总结注入在最前（后注入的 unshift 领先）', chat7[0].content.includes('【伊瑟利亚总结】'));

// ============================================================
console.log('\n========== 环境8：隐藏楼层不进总结/注入 ==========');
store.resetForNewChat('chat-F');
chatMessages.length = 0;
pushFloors(20, 1, { hiddenIds: [5, 6, 7, 8, 9, 10] }); // 6~10楼隐藏
await store.generateSummary(true);
assert('隐藏楼层不计入指针覆盖（总结到 20 但跳过隐藏内容）', store.pointers.summary === 20, `实际 ${store.pointers.summary}`);
assert('支线角色统计不受隐藏影响（艾琳/格罗姆仍在）', store.blocks.filter(b => b.kind === 'branch').length === 2);
chat = firePromptReady(buildPromptChat());
assert('隐藏楼层后注入仍正常', chat[0].content.includes('【伊瑟利亚总结】'));

// ============================================================
console.log(`\n========== 测试结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
