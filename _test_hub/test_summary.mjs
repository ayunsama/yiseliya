/**
 * 总结助手集成测试（真实加载 src/总结助手/store.ts）
 * 场景A：20层手动总结（1批）
 * 场景B：100层逐次总结（5批 + 大总结总纲触发）
 * 场景C：自动调度（GENERATION_ENDED → 每20楼自动总结）
 */
import { createPinia, setActivePinia } from 'pinia';

// ============ 环境 stub ============
const toastrStub = { info: () => {}, success: () => {}, warning: () => {}, error: () => {} };
globalThis.toastr = toastrStub;
globalThis.window = globalThis;
globalThis.document = { activeElement: null, body: {} };
globalThis.tavern_events = { GENERATION_ENDED: 'generation_ended', MESSAGE_RECEIVED: 'message_received' };

// ---- 事件监听（捕获回调，供测试手动触发） ----
const eventHandlers = {};
globalThis.eventOn = (evt, cb) => { eventHandlers[evt] = cb; return { stop: () => { delete eventHandlers[evt]; } }; };

// ---- 聊天楼层数据源 ----
const chatMessages = []; // {id, role, name, message}
globalThis.getLastMessageId = () => chatMessages.length ? chatMessages[chatMessages.length - 1].id : -1;
globalThis.getChatMessages = (range, _opts) => {
  const [a, b] = String(range).split('-').map(Number);
  return chatMessages.filter(m => m.id >= a && m.id <= b);
};
globalThis.setChatMessages = async () => {};
globalThis.insertOrAssignVariables = async () => {};
globalThis.getVariables = () => ({});
globalThis.SillyTavern = { getCurrentChatId: () => 'test-chat-001' };

// ---- 伪 AI 总结生成器：按"当前批次楼层消息"生成 <Memory> 双轨分块 ----
globalThis.generateRaw = async ({ ordered_prompts }) => {
  const userInput = ordered_prompts?.[1]?.content || '';
  const batchRe = /本次总结范围\s*第(\d+)-(\d+)楼/;
  const m = userInput.match(batchRe);
  const s = m ? Number(m[1]) : 1;
  const e = m ? Number(m[2]) : 1;
  const batch = chatMessages.filter(x => x.id >= s && x.id <= e);
  const byRole = {};
  for (const msg of batch) {
    const who = msg.role === 'user' ? '主角' : (msg.name || 'AI');
    if (msg.role === 'user') continue; // 主线在下面汇总
    (byRole[who] = byRole[who] || []).push(msg.message);
  }
  const lines = [];
  const mainMsgs = batch.filter(x => x.role !== 'user').map(x => x.message);
  lines.push('【主线总结】');
  lines.push(`圣光历1497年 [测试地] 第${s}-${e}楼 主角与同行者推进剧情：${(mainMsgs[0] || '').slice(0, 40)}…`);
  for (const [who, msgs] of Object.entries(byRole)) {
    lines.push(`【支线总结：${who}】`);
    lines.push(`${msgs.map(t => t.slice(0, 30)).join('；')}（第${s}-${e}楼）`);
  }
  lines.push('【未解决问题】');
  lines.push(`- 第${e}楼的约定待后续兑现`);
  return `<Memory>\n${lines.join('\n')}\n</Memory>`;
};

// ============ 工具：填充楼层 ============
function pushFloors(n, startId) {
  const NAMES = ['艾琳', '格罗姆'];
  for (let i = 0; i < n; i++) {
    const id = startId + i;
    if (i % 2 === 0) {
      chatMessages.push({ id, role: 'user', name: '玩家', message: `玩家第${id}楼：询问关于魔潮的情报并作出决定${id}` });
    } else {
      const who = NAMES[(i / 2) % 2 | 0];
      chatMessages.push({ id, role: 'assistant', name: who, message: `${who}第${id}楼：回应主角并提及魔王动向${id}` });
    }
  }
}

// ============ 断言工具 ============
let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

// ============ 加载真实 store ============
const pinia = createPinia();
setActivePinia(pinia);
const { useSummaryStore } = await import('../src/总结助手/store.ts');
const store = useSummaryStore();
store.initialize('test');

// ============================================================
console.log('\n========== 场景A：20层手动总结 ==========');
pushFloors(20, 1);
await store.generateSummary(true);
assert('指针推进到 20', store.pointers.summary === 20, `实际 ${store.pointers.summary}`);
assert('小总结日志 1 条', store.smallLog.length === 1, `实际 ${store.smallLog.length}`);
assert('主线块已生成', store.blocks.some(b => b.kind === 'main' && b.content.includes('主线总结'.replace('总结', '')) || store.blocks.some(b => b.kind === 'main' && b.content.length > 0)), `主线内容: ${store.blocks.find(b => b.kind === 'main')?.content?.slice(0, 30)}`);
const branchCount = store.blocks.filter(b => b.kind === 'branch').length;
assert('支线按角色归组（艾琳/格罗姆）', branchCount === 2, `实际 ${branchCount} 个支线`);
assert('未解决问题已累积', (store.blocks.find(b => b.kind === 'main')?.unresolved || '').includes('约定待后续兑现'));
console.log(`  主线摘要: ${(store.blocks.find(b => b.kind === 'main')?.content || '').replace(/\n/g, ' ').slice(0, 60)}…`);
console.log(`  支线角色: ${store.blocks.filter(b => b.kind === 'branch').map(b => `${b.character}(${b.content.length}字)`).join('、')}`);

// ============================================================
console.log('\n========== 场景B：100层逐次总结（5批 + 大总结） ==========');
pushFloors(80, 21); // 现在共 100 楼
store.updateSettings({ bigGenerate: true, bigInterval: 100, autoGenerate: false });
await store.generateSummary(true);
assert('指针推进到 100', store.pointers.summary === 100, `实际 ${store.pointers.summary}`);
assert('场景A(1批)+场景B(4批) 共 5 批日志', store.smallLog.length === 5, `实际 ${store.smallLog.length}`);
assert('批次楼层连续无重叠', store.smallLog.every((l, i) => i === 0 || l.floorStart === store.smallLog[i - 1].floorEnd + 1));
const floors = store.smallLog.map(l => `${l.floorStart}-${l.floorEnd}`);
console.log(`  批次: ${floors.join('  /  ')}`);
await new Promise(r => setTimeout(r, 100)); // 等大总结异步触发
assert('大总结已触发（总纲 1 条）', store.bigSummaries.length === 1, `实际 ${store.bigSummaries.length}`);
const big = store.bigSummaries[0];
assert('总纲覆盖 1-100 楼', big.floorEnd === 100 && big.floorStart === 1, `实际 ${big.floorStart}-${big.floorEnd}`);
assert('大总结后 blocks 清空（历史进总纲）', store.blocks.length === 0, `实际 ${store.blocks.length}`);
assert('大总结指针对齐 100', store.pointers.big === 100, `实际 ${store.pointers.big}`);
const inj = store.buildInjectionText();
assert('注入文本含历史总纲', inj && inj.text.includes('【历史总纲 · 截至第100楼】'), inj ? inj.text.slice(0, 40) : 'null');
console.log(`  总纲主线: ${(big.main || '').replace(/\n/g, ' ').slice(0, 50)}…`);

// ============================================================
console.log('\n========== 场景C：自动调度（每20楼自动总结） ==========');
// 重置数据模拟新聊天
store.resetForNewChat('test-chat-002');
chatMessages.length = 0;
store.updateSettings({ autoGenerate: true, autoInterval: 20, bigGenerate: false, autoRunMode: 'silent' });
assert('自动监听已启用', store.settings.autoGenerate === true && !!eventHandlers['generation_ended']);

// 触发第一轮：20 楼 → 生成结束事件 → 自动总结
pushFloors(20, 1);
if (eventHandlers['generation_ended']) eventHandlers['generation_ended']();
await new Promise(r => setTimeout(r, 1800));
assert('第一轮自动总结覆盖 1-20 楼', store.pointers.summary === 20, `实际 ${store.pointers.summary}`);

// 再触发第二轮：追加 20 楼 → 自动总结 21-40
pushFloors(20, 21);
if (eventHandlers['generation_ended']) eventHandlers['generation_ended']();
await new Promise(r => setTimeout(r, 1800));
assert('第二轮自动总结覆盖 21-40 楼', store.pointers.summary === 40, `实际 ${store.pointers.summary}`);
assert('两轮自动日志 2 条', store.smallLog.length === 2, `实际 ${store.smallLog.length}`);
console.log(`  自动批次: ${store.smallLog.map(l => `${l.floorStart}-${l.floorEnd}`).join(' / ')}`);

// 未达阈值不触发
pushFloors(10, 41);
if (eventHandlers['generation_ended']) eventHandlers['generation_ended']();
await new Promise(r => setTimeout(r, 1200));
assert('不足 20 楼不触发（指针仍 40）', store.pointers.summary === 40, `实际 ${store.pointers.summary}`);

// ============================================================
console.log(`\n========== 测试结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
