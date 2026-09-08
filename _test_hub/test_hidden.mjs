/**
 * 总结助手 · 隐藏楼层纳入总结 行为验证
 * 模拟 getChatMessages：hide_state==='all' 时返回含隐藏楼层；'unhidden' 时过滤隐藏。
 * 验证 store 生成总结时会读到隐藏楼层（而非跳过）。
 */
import { createPinia, setActivePinia } from 'pinia';

const toastrStub = { info: () => {}, success: () => {}, warning: () => {}, error: () => {} };
globalThis.toastr = toastrStub;
globalThis.window = globalThis;
globalThis.document = { activeElement: null, body: {} };
globalThis.tavern_events = { GENERATION_ENDED: 'generation_ended', MESSAGE_RECEIVED: 'message_received' };
globalThis.eventOn = () => ({ stop: () => {} });
globalThis.insertOrAssignVariables = async () => {};
globalThis.getVariables = () => ({});
globalThis.SillyTavern = { getCurrentChatId: () => 'chat-hidden' };

// ---- 楼层：部分标记为隐藏（is_hidden） ----
const chatMessages = [];
function pushFloors(n, startId, hiddenIds = []) {
  for (let i = 0; i < n; i++) {
    const id = startId + i;
    chatMessages.push({
      message_id: id, role: i % 2 ? 'assistant' : 'user', name: i % 2 ? '艾琳' : '玩家',
      message: `楼层${id}${hiddenIds.includes(id) ? '（已隐藏的关键剧情）' : ''}`,
      is_hidden: hiddenIds.includes(id),
    });
  }
}
function getLastId() { return chatMessages.length ? chatMessages[chatMessages.length - 1].message_id : -1; }

// ---- 模拟 getChatMessages：按 hide_state 过滤 ----
globalThis.getLastMessageId = getLastId;
globalThis.getChatMessages = (range, opts) => {
  const [a, b] = String(range).split('-').map(Number);
  const mode = opts?.hide_state;
  // 'all' 返回全部（含隐藏）；'hidden' 只返回隐藏；'unhidden'/undefined 只返回未隐藏
  return chatMessages.filter(m => {
    if (m.message_id < a || m.message_id > b) return false;
    if (mode === 'all') return true;
    if (mode === 'hidden') return !!m.is_hidden;
    return !m.is_hidden;
  });
};

// ---- 捕获每次总结实际读到的楼层 ----
const seenFloors = [];
globalThis.generateRaw = async ({ ordered_prompts }) => {
  const userInput = ordered_prompts?.[1]?.content || '';
  console.log('[debug] userInput 前120字:', JSON.stringify(userInput.slice(0, 120)));
  const ids = [...userInput.matchAll(/\[第(\d+)楼\]/g)].map(m => Number(m[1]));
  seenFloors.push(...ids);
  const lines = ['【主线总结】', '圣光历1497年 [测试地] 主角推进剧情', '【未解决问题】', '- 无'];
  return `<Memory>\n${lines.join('\n')}\n</Memory>`;
};

const pinia = createPinia();
setActivePinia(pinia);
const { useSummaryStore } = await import('../src/总结助手/store.ts');
const store = useSummaryStore();
store.initialize('test');
store.updateSettings({ autoGenerate: false });

let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + ' ' + extra); }
}

// 20 楼，其中 2/5/8/11/15 为隐藏关键剧情
pushFloors(20, 1, [2, 5, 8, 11, 15]);
seenFloors.length = 0;
await store.generateSummary(true);

assert('总结读取了全部 20 楼（含隐藏）', seenFloors.length === 20, `实际读到 ${seenFloors.length} 楼`);
assert('隐藏楼层 2/5/8/11/15 均被纳入总结', [2, 5, 8, 11, 15].every(id => seenFloors.includes(id)), '缺失 ' + [2, 5, 8, 11, 15].filter(id => !seenFloors.includes(id)).join(','));
const unique = new Set(seenFloors).size;
assert('楼层无重复（指针按批次推进）', unique === seenFloors.length, `unique=${unique}`);
assert('指针推进到 20', store.pointers.summary === 20, `实际 ${store.pointers.summary}`);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
