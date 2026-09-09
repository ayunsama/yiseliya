<template>
  <div class="roundtable">
    <!-- 选择参与者的阶段 -->
    <template v-if="!store.roundtable">
      <div class="rt-header">
        <button class="back-btn" @click="store.endRoundtable(true)">←</button>
        <div class="rt-title">⚔ 英灵殿圆桌</div>
        <span class="rt-sub">选择参与夜谈的角色（2~4 人）</span>
      </div>      <div class="rt-pick-body">
        <div class="pick-group-title">✦ 英灵</div>
        <div class="pick-grid">
          <button
            v-for="h in pickableHeroes"
            :key="h.uid"
            class="pick-chip"
            :class="{
              'pick-chip--on': picked.has(h.uid),
              'pick-chip--off': !h.enabled || store.isHeroSleeping(h),
            }"
            :disabled="!h.enabled || store.isHeroSleeping(h)"
            @click="togglePick(h)"
          >
            <span class="chip-log">{{ h.log }}</span>
            <span class="chip-name">{{ h.displayName }}</span>
            <span v-if="store.isHeroSleeping(h)" class="chip-mark">💤</span>
            <span v-else-if="!h.enabled" class="chip-mark">沉寂</span>
          </button>
        </div>
        <div class="pick-group-title">🧑 同伴</div>
        <div class="pick-grid">
          <button
            v-for="h in pickableCompanions"
            :key="h.uid"
            class="pick-chip"
            :class="{ 'pick-chip--on': picked.has(h.uid) }"
            @click="togglePick(h)"
          >
            <span class="chip-log">{{ h.log }}</span>
            <span class="chip-name">{{ h.displayName }}</span>
          </button>
        </div>
      </div>
      <div class="rt-footer">
        <button class="start-btn" :disabled="picked.size < 2" @click="onStart">
          开始夜谈（{{ picked.size }}/4）
        </button>
      </div>
    </template>

    <!-- 圆桌谈话阶段 -->
    <template v-else>
      <div class="rt-header">
        <button class="back-btn" @click="store.endRoundtable(true)" title="保留会话返回列表">←</button>
        <div class="rt-title">⚔ 圆桌夜谈</div>
        <button class="dissolve-btn" @click="onDissolve" title="解散本次圆桌（清空记录）">解散</button>
        <div class="rt-chips">
          <span v-for="p in store.roundtable.participants" :key="p.key" class="rt-chip">
            {{ p.log }} {{ p.name }}
          </span>
        </div>
      </div>

      <div class="rt-messages" ref="rtRef">
        <div v-if="store.roundtable.messages.length === 0" class="rt-empty">
          <div class="rt-empty-seal">⚔</div>
          <p>英灵殿的灯火燃起，众人围坐……</p>
          <p class="rt-empty-hint">说点什么，开启这场夜谈吧</p>
        </div>
        <div
          v-for="(msg, idx) in store.roundtable.messages"
          :key="idx"
          class="rt-row"
          :class="msg.role === 'user' ? 'rt-row--user' : 'rt-row--round'"
        >
          <!-- 用户发言 -->
          <div v-if="msg.role === 'user'" class="rt-bubble rt-bubble--user">{{ msg.text }}</div>
          <!-- 圆桌发言（多段） -->
          <div v-else class="rt-turns">
            <div v-for="(t, ti) in msg.turns" :key="ti" class="rt-turn">
              <span class="rt-turn-name">{{ t.name }}</span>
              <span v-if="t.mood" class="rt-turn-mood">{{ t.mood }}</span>
              <div class="rt-bubble rt-bubble--round">{{ t.text }}</div>
            </div>
          </div>
        </div>
        <div v-if="store.rtLoading" class="rt-row rt-row--round">
          <div class="rt-turns">
            <div class="rt-turn">
              <span class="rt-turn-name">圆桌</span>
              <div class="rt-bubble rt-bubble--round">
                <span class="rt-dots"><i>·</i><i>·</i><i>·</i></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="rt-input-area">
        <textarea
          v-model="inputText"
          class="rt-input"
          placeholder="对圆桌说点什么…"
          rows="2"
          :disabled="store.rtLoading"
          @keydown.enter.prevent="onSend"
        ></textarea>
        <button class="rt-send" :disabled="store.rtLoading || !inputText.trim()" @click="onSend">
          {{ store.rtLoading ? '…' : '✉' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useHeroSpiritStore, type HeroEntry } from './store';

const store = useHeroSpiritStore();
const picked = ref<Set<string>>(new Set());
const inputText = ref('');
const rtRef = ref<HTMLElement | null>(null);

const pickableHeroes = computed(() => store.heroes);
const pickableCompanions = computed(() => store.companions);

function togglePick(h: HeroEntry) {
  if (!h.uid) return;
  const key = (h.isCompanion ? 'c:' : 'h:') + h.uid;
  if (picked.value.has(key)) {
    picked.value.delete(key);
  } else {
    if (picked.value.size >= 4) {
      toastr.info('圆桌最多 4 人', '英灵殿');
      return;
    }
    picked.value.add(key);
  }
  // 触发响应式
  picked.value = new Set(picked.value);
}

function onStart() {
  const all = [...store.heroes, ...store.companions];
  const participants = all.filter(h => picked.value.has((h.isCompanion ? 'c:' : 'h:') + h.uid));
  store.startRoundtable(participants);
}

function onDissolve() {
  if (window.confirm('解散本次圆桌并清空谈话记录？')) {
    store.endRoundtable(false);
  }
}

async function onSend() {
  if (!inputText.value.trim() || store.rtLoading) return;
  const text = inputText.value;
  inputText.value = '';
  await store.sendRoundtable(text);
  await nextTick();
  scrollToBottom();
}

function scrollToBottom() {
  if (rtRef.value) rtRef.value.scrollTop = rtRef.value.scrollHeight;
}

onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.roundtable {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: 'Georgia', 'Times New Roman', serif;
  color: #3c2415;
}
.rt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(139, 90, 43, 0.3);
  background: linear-gradient(180deg, rgba(245, 222, 179, 0.4), transparent);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.back-btn {
  border: 1px solid rgba(139, 90, 43, 0.3);
  background: rgba(245, 222, 179, 0.5);
  color: #5c3a1e;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}
.rt-title { font-size: 15px; font-weight: 700; letter-spacing: 1px; }
.dissolve-btn {
  border: 1px solid rgba(180, 80, 80, 0.3);
  background: rgba(180, 80, 80, 0.1);
  color: #8a3030;
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 10px;
  font-family: 'Georgia', serif;
  margin-left: auto;
  flex-shrink: 0;
}
.dissolve-btn:hover { background: rgba(180, 80, 80, 0.2); }
.rt-sub { font-size: 10px; color: #8b7355; margin-left: auto; font-style: italic; }
.rt-chips { display: flex; flex-wrap: wrap; gap: 4px; width: 100%; }
.rt-chip {
  font-size: 10px;
  color: #5c3a1e;
  background: rgba(201, 169, 110, 0.2);
  border: 1px solid rgba(139, 90, 43, 0.25);
  border-radius: 999px;
  padding: 1px 8px;
}

.rt-pick-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  min-height: 0;
}
.pick-group-title { font-size: 11px; font-weight: 700; color: #8b6914; letter-spacing: 2px; margin: 8px 0 6px; }
.pick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
.pick-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border: 1px solid rgba(139, 90, 43, 0.25);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.6), rgba(240, 220, 190, 0.4));
  color: #3c2415;
  font-family: 'Georgia', serif;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.pick-chip:hover:not(:disabled) { border-color: rgba(139, 90, 43, 0.5); }
.pick-chip--on {
  background: linear-gradient(135deg, rgba(201, 169, 110, 0.4), rgba(139, 90, 43, 0.25));
  border-color: #8a5f34;
  box-shadow: 0 0 0 1px rgba(138, 95, 52, 0.3);
}
.pick-chip--off { opacity: 0.5; cursor: not-allowed; }
.chip-log { font-size: 13px; }
.chip-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip-mark { font-size: 9px; color: #8b7355; }

.rt-footer { padding: 8px 12px 12px; border-top: 1px solid rgba(139, 90, 43, 0.2); flex-shrink: 0; }
.start-btn {
  width: 100%;
  font-family: 'Georgia', serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #3c2415;
  background: linear-gradient(180deg, #f5deb3, #d8b070);
  border: 1px solid #8a5f34;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}
.start-btn:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(240, 212, 138, 0.45); }
.start-btn:disabled { filter: grayscale(0.6) brightness(0.9); cursor: not-allowed; }

.rt-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.rt-messages::-webkit-scrollbar { width: 6px; }
.rt-messages::-webkit-scrollbar-thumb { background: rgba(139, 90, 43, 0.4); border-radius: 3px; }
.rt-empty { text-align: center; padding: 24px 10px; color: #8b7355; }
.rt-empty-seal { font-size: 28px; opacity: 0.4; margin-bottom: 6px; }
.rt-empty-hint { font-size: 10px; font-style: italic; margin-top: 4px; }

.rt-row { display: flex; }
.rt-row--user { justify-content: flex-end; }
.rt-row--round { justify-content: flex-start; }
.rt-turns { display: flex; flex-direction: column; gap: 6px; max-width: 92%; }
.rt-turn { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; }
.rt-turn-name { font-size: 10px; font-weight: 700; color: #8b6914; }
.rt-turn-mood {
  font-size: 9px;
  color: #8b6914;
  background: rgba(201, 169, 110, 0.15);
  border: 1px solid rgba(201, 169, 110, 0.25);
  border-radius: 4px;
  padding: 0 5px;
}
.rt-bubble {
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 10px;
  background: rgba(245, 222, 179, 0.6);
  border: 1px solid rgba(139, 90, 43, 0.2);
  font-size: 12.5px;
  line-height: 1.5;
  color: #3c2415;
  word-break: break-word;
  white-space: pre-wrap;
  flex-basis: 100%;
}
.rt-bubble--user { background: rgba(200, 170, 120, 0.5); border-color: rgba(139, 90, 43, 0.3); align-self: flex-end; }
.rt-dots i {
  font-style: normal;
  animation: rtDot 1.4s ease-in-out infinite;
  margin: 0 1px;
}
.rt-dots i:nth-child(2) { animation-delay: 0.2s; }
.rt-dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes rtDot { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }

.rt-input-area {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid rgba(139, 90, 43, 0.3);
  flex-shrink: 0;
}
.rt-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid rgba(139, 90, 43, 0.3);
  border-radius: 8px;
  background: rgba(255, 248, 230, 0.7);
  color: #3c2415;
  font-family: 'Georgia', serif;
  font-size: 13px;
  resize: none;
  outline: none;
}
.rt-input:focus { border-color: #a0845c; }
.rt-send {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(139, 90, 43, 0.3);
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a96e, #a6844a);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  flex-shrink: 0;
}
.rt-send:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 480px) {
  .rt-header { padding: 5px 8px; }
  .rt-title { font-size: 13px; }
}
</style>
