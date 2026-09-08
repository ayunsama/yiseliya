/**
 * 冲突测试：总结助手/技能融合（工具性生成）vs 紧张度/三合一注入/英灵注入
 * 复现阶段：证明工具性生成请求被各注入污染
 */
import { createPinia, setActivePinia } from 'pinia';

const toastrStub = { info: () => {}, success: () => {}, warning: () => {}, error: () => {} };
globalThis.toastr = toastrStub;
globalThis.window = globalThis;
globalThis.document = { activeElement: null, body: {} };
globalThis.tavern_events = { GENERATION_ENDED: 'generation_ended', CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready', MESSAGE_RECEIVED: 'message_received' };

const eventHandlers = {};
globalThis.eventOn = (evt, cb) => { (eventHandlers[evt] = eventHandlers[evt] || []).push(cb); return { stop: () => {} }; };

const chatMessages = [];
globalThis.getLastMessageId = () => chatMessages.length ? chatMessages[chatMessages.length - 1].id : -1;
globalThis.getChatMessages = (range) => {
  const [a, b] = String(range).split('-').map(Number);
  return chatMessages.filter(m => m.id >= a && m.id <= b);
};
globalThis.setChatMessages = async () => {};
globalThis.insertOrAssignVariables = async () => {};
globalThis.getVariables = () => ({});
globalThis.SillyTavern = { getCurrentChatId: () => 'chat-conflict' };

// ---- 捕获每次 generateRaw/generate 的最终提示词（模拟酒馆：构建提示词后触发 CHAT_COMPLETION_PROMPT_READY） ----
const capturedPrompts = [];
let aiReplyIndex = 0;
const FAKE_SUMMARIES = [
  '<Memory>\n【主线总结】\n圣光历1497年 [测试地] 第1-20楼 主角推进剧情：对话要点…\n【支线总结：艾琳】\n艾琳回应主角（第1-20楼）\n【未解决问题】\n- 约定待兑现\n</Memory>',
];
function firePromptReady(chat) {
  for (const cb of eventHandlers[tavern_events.CHAT_COMPLETION_PROMPT_READY] || []) cb({ chat });
}
globalThis.generateRaw = async (opts) => {
  // 模拟酒馆完整管线：ordered_prompts 构建后触发事件（注入会修改该数组）
  const chat = opts.ordered_prompts ? opts.ordered_prompts.map(m => ({ ...m })) : [{ role: 'user', content: String(opts.user_input || '') }];
  firePromptReady(chat);
  capturedPrompts.push({ via: 'generateRaw', chat: chat.map(m => m.content).join('\n---\n') });
  return FAKE_SUMMARIES[aiReplyIndex++] || FAKE_SUMMARIES[0];
};
globalThis.generate = async (opts) => {
  const chat = [{ role: 'user', content: String(opts.user_input || '') }];
  firePromptReady(chat);
  capturedPrompts.push({ via: 'generate', chat: chat.map(m => m.content).join('\n---\n') });
  return '[{"n":"测试技能","t":"技能","c":1,"lvl":1,"d":"测试"}]';
};

// ============ 注入模拟（与真实文件同逻辑，修复后版本） ============
// ① 紧张度【世界动态】（检查 __ISURIA_NON_RP__）
eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }) => {
  if (window.__ISURIA_NON_RP__) return;
  chat.unshift({ role: 'system', content: '【世界动态】当前局势…（紧张度注入）' });
});
// ② 三合一【伊瑟利亚总结】（修复后：检查标志）
eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }) => {
  if (window.__ISURIA_NON_RP__) return;
  const marker = '【伊瑟利亚总结】';
  if ((chat || []).some(m => String(m?.content || '').includes(marker))) return;
  chat.unshift({ role: 'system', content: `${marker}\n（总结助手前情提要注入）` });
});
// ③ 三合一【剧情规划大师】（修复后：检查标志）
eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }) => {
  if (window.__ISURIA_NON_RP__) return;
  if ((chat || []).some(m => String(m?.content || '').includes('【剧情规划大师】'))) return;
  chat.unshift({ role: 'system', content: '【剧情规划大师】当前目标…（剧情规划注入）' });
});
// ④ 英灵【英灵共鸣状态】/【英灵/同伴互动概要】（修复后：检查标志）
eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }) => {
  if (window.__ISURIA_NON_RP__) return;
  if ((chat || []).some(m => String(m?.content || '').includes('【英灵共鸣状态】'))) return;
  chat.unshift({ role: 'system', content: '【英灵共鸣状态】契主英灵…（英灵注入）' });
});

// ============ 断言 ============
let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}
function findInCaptured(tag) {
  return capturedPrompts.some(p => (p.chat || '').includes(tag));
}

// ============ 加载真实总结 store ============
const pinia = createPinia();
setActivePinia(pinia);
const { useSummaryStore } = await import('../src/总结助手/store.ts');
const store = useSummaryStore();
store.initialize('test');
store.setContextProvider(() => '');

// ============================================================
console.log('\n========== 复现1（修复后）：总结助手生成总结时的请求内容 ==========');
for (let i = 0; i < 20; i++) chatMessages.push({ id: i + 1, role: i % 2 ? 'assistant' : 'user', name: i % 2 ? '艾琳' : '玩家', message: `楼层${i + 1}对话` });
capturedPrompts.length = 0;
window.__ISURIA_NON_RP__ = false;
await store.generateSummary(true);
const sumReq = capturedPrompts[0] || { chat: '' };
console.log(`  总结请求最终提示词（前140字）: ${sumReq.chat.replace(/\n/g, ' ').slice(0, 140)}…`);
assert('【世界动态】未混入总结请求', !findInCaptured('【世界动态】'), '→ 已污染！');
assert('【伊瑟利亚总结】未混入总结请求（无自我污染）', !findInCaptured('【伊瑟利亚总结】'), '→ 已污染！');
assert('【剧情规划大师】未混入总结请求', !findInCaptured('【剧情规划大师】'), '→ 已污染！');
assert('【英灵共鸣状态】未混入总结请求', !findInCaptured('【英灵共鸣状态】'), '→ 已污染！');
assert('总结请求保留档案员指令', sumReq.chat.includes('伊瑟利亚档案员'), '→ 指令丢失！');
assert('总结请求保留对话正文', sumReq.chat.includes('【对话正文'), '→ 正文丢失！');

// ============================================================
console.log('\n========== 复现2（修复后）：状态栏技能融合生成的请求内容 ===========');
capturedPrompts.length = 0;
window.__ISURIA_NON_RP__ = true; // 状态栏职业融合已打标志
await generate({ user_input: '请将「战士」与「法师」融合生成一套融合技能树…' });
const fuseReq = capturedPrompts[0] || { chat: '' };
assert('【伊瑟利亚总结】未混入技能融合请求', !fuseReq.chat.includes('【伊瑟利亚总结】'), '→ 已污染！');
assert('【剧情规划大师】未混入技能融合请求', !fuseReq.chat.includes('【剧情规划大师】'), '→ 已污染！');
assert('【英灵共鸣状态】未混入技能融合请求', !fuseReq.chat.includes('【英灵共鸣状态】'), '→ 已污染！');
assert('【世界动态】未混入技能融合请求', !fuseReq.chat.includes('【世界动态】'), '→ 已污染！');
assert('融合请求保留任务指令', fuseReq.chat.includes('融合生成一套融合技能树'), '→ 指令丢失！');

// ============================================================
console.log('\n========== 回归：正常 RP 生成时注入照常 ===========');
capturedPrompts.length = 0;
window.__ISURIA_NON_RP__ = false;
const rpChat = [{ role: 'user', content: '（玩家RP输入）' }];
for (const cb of eventHandlers[tavern_events.CHAT_COMPLETION_PROMPT_READY] || []) cb({ chat: rpChat });
assert('正常生成时【世界动态】照常注入', rpChat.some(m => m.content.includes('【世界动态】')));
assert('正常生成时【伊瑟利亚总结】照常注入', rpChat.some(m => m.content.includes('【伊瑟利亚总结】')));
assert('正常生成时【剧情规划大师】照常注入', rpChat.some(m => m.content.includes('【剧情规划大师】')));
assert('正常生成时【英灵共鸣状态】照常注入', rpChat.some(m => m.content.includes('【英灵共鸣状态】')));

// ============================================================
console.log(`\n========== 测试结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
