<template>
  <div class="hero-chat">
    <!-- 顶部：英灵信息栏 -->
    <div class="chat-header">
      <button class="back-btn" @click="store.goBack()" title="返回列表">←</button>
      <div class="hero-info">
        <span class="hero-log-icon">{{ store.selectedHero?.log }}</span>
        <span class="hero-status-dot" :class="onlineClass"></span>
        <span class="hero-name">{{ store.selectedHero?.displayName }}</span>
        <span v-if="currentMood" class="hero-mood">{{ currentMood }}</span>
      </div>
      <button class="recall-btn" @click="onRecall" title="撤回上一条" :disabled="store.messages.length === 0">↩</button>
      <button class="clear-btn" @click="store.clearChat()" title="清空对话">🗑</button>
    </div>

    <!-- 共鸣状态条（英灵共鸣系统 v2：残响/羁绊/执念/被动/英灵技） -->
    <div v-if="!store.selectedHero?.isCompanion" class="resonance-panel">
      <div class="resonance-head">
        <span class="resonance-title">✦ 残响之力</span>
        <span class="resonance-val">{{ resonance }}<em>/100</em></span>
        <span class="resonance-status" :class="'status-' + spiritStatusClass">{{ spiritStatusText }}</span>
        <span v-if="cooldown > 0" class="resonance-cooldown">冷却 {{ cooldown }}</span>
      </div>
      <div class="resonance-bar-bg">
        <div
          class="resonance-bar-fill"
          :class="{ 'resonance-bar-full': resonance >= 100 }"
          :style="{ width: Math.min(100, resonance) + '%' }"
        ></div>
      </div>
      <div class="resonance-sub">
        <span class="sub-item">羁绊 {{ bond }}
          <span class="sub-bar"><i :style="{ width: Math.min(100, bond) + '%' }"></i></span>
        </span>
        <span class="sub-item" :title="obsessionDesc">执念 {{ obsession }}%</span>
        <span class="sub-item" v-if="releasedCount > 0">已释放 ×{{ releasedCount }}</span>
      </div>
      <div v-if="passiveNames.length" class="passive-tags">
        <span v-for="p in passiveNames" :key="p" class="passive-tag">{{ p }}</span>
      </div>
      <div class="skill-row">
        <button class="skill-btn" :disabled="!canRelease" :title="skillBtnTitle" @click="onReleaseSkill">
          {{ skillName || '英灵技' }}
        </button>
        <span v-if="releaseMsg" class="release-msg">{{ releaseMsg }}</span>
        <span v-else-if="!canRelease" class="release-hint">{{ skillBtnTitle }}</span>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesRef">
      <div v-if="store.messages.length === 0" class="chat-empty">
        <div class="empty-seal">✧</div>
        <p class="empty-text">与{{ store.selectedHero?.displayName }}的对话即将开始…</p>
        <p class="empty-hint">在下方输入你的第一句话</p>
      </div>
      <div
        v-for="(msg, idx) in store.messages"
        :key="idx"
        class="message-row"
        :class="msg.role === 'user' ? 'message-user' : 'message-assistant'"
        @mouseenter="hoveredIdx = idx"
        @mouseleave="hoveredIdx = -1"
      >
        <div class="message-bubble">
          <div class="message-label">{{ msg.role === 'user' ? '你' : store.selectedHero?.displayName }}</div>

          <!-- 编辑模式 -->
          <div v-if="editingIdx === idx" class="message-edit-area">
            <textarea
              v-model="editingText"
              class="message-edit-input"
              rows="3"
              ref="editTextareaRef"
              @keydown.enter.ctrl="onSaveEdit(idx)"
            ></textarea>
            <div class="message-edit-actions">
              <button class="edit-action-btn edit-save" @click="onSaveEdit(idx)">✓ 保存</button>
              <button class="edit-action-btn edit-cancel" @click="onCancelEdit">✗ 取消</button>
            </div>
          </div>

          <!-- 普通显示模式 -->
          <div v-else class="message-content">{{ msg.content }}</div>

          <!-- 消息操作按钮（悬停显示） -->
          <div v-if="hoveredIdx === idx && editingIdx !== idx" class="message-actions">
            <button class="msg-action-btn" @click="startEdit(idx, msg.content)" title="编辑">✏️</button>
            <button class="msg-action-btn" @click="onDelete(idx)" title="删除">🗑️</button>
            <button v-if="msg.role === 'assistant'" class="msg-action-btn" @click="onRegenerate(idx)" title="重新生成">🔄</button>
          </div>
        </div>
      </div>
      <div v-if="store.loading" class="message-row message-assistant">
        <div class="message-bubble message-loading">
          <div class="message-label">{{ store.selectedHero?.displayName }}</div>
          <div class="loading-dots">
            <span class="dot">·</span>
            <span class="dot">·</span>
            <span class="dot">·</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input-area">
      <textarea
        v-model="inputText"
        class="chat-input"
        placeholder="输入你的话语…"
        @keydown.enter.prevent="onSend"
        :disabled="store.loading"
        rows="2"
      ></textarea>
      <button class="send-btn" @click="onSend" :disabled="store.loading || !inputText.trim()">
        {{ store.loading ? '…' : '✉' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useHeroSpiritStore } from './store';

const store = useHeroSpiritStore();
const inputText = ref('');
const messagesRef = ref<HTMLElement | null>(null);
const hoveredIdx = ref(-1);
const editingIdx = ref(-1);
const editingText = ref('');
const editTextareaRef = ref<HTMLElement | null>(null);
const releaseMsg = ref('');

const onlineClass = 'is-online';

// ---- 英灵共鸣数据（stat_data.英灵） ----
const runtime = computed(() => store.spiritRuntime);
const resonance = computed(() => Number(runtime.value?.残响之力 || 0));
const bond = computed(() => Number(runtime.value?.羁绊值 || 0));
const obsession = computed(() => Number(runtime.value?.执念?.进度 || 0));
const obsessionDesc = computed(() => String(runtime.value?.执念?.内容 || ''));
const cooldown = computed(() => Number(runtime.value?.英灵技?.冷却 || 0));
const releasedCount = computed(() => Number(runtime.value?.英灵技?.已释放 || 0));
const spiritStatus = computed(() => String(runtime.value?.状态 || '苏醒'));
const spiritStatusClass = computed(() => (spiritStatus.value === '苏醒' ? 'awake' : spiritStatus.value === '沉睡' ? 'asleep' : 'weak'));
const spiritStatusText = computed(() => spiritStatus.value);
const skillName = computed(() => String(runtime.value?.英灵技?.名称 || '英灵技'));
const passiveNames = computed(() => Object.keys(runtime.value?.被动效果 || {}));
const canRelease = computed(() => resonance.value >= 100 && spiritStatus.value === '苏醒' && cooldown.value === 0);
const skillBtnTitle = computed(() => {
  if (cooldown.value > 0) return `冷却中（剩余 ${cooldown.value}）`;
  if (spiritStatus.value !== '苏醒') return `英灵处于「${spiritStatus.value}」状态`;
  if (resonance.value < 100) return `残响之力不足（${resonance.value}/100）`;
  return '点击释放英灵技（残响清空并沉睡）';
});

async function onReleaseSkill() {
  const r = await store.releaseSpiritSkill();
  releaseMsg.value = r.msg;
  setTimeout(() => { releaseMsg.value = ''; }, 5000);
}

onMounted(() => {
  store.refreshSpiritRuntime();
});

/** 取最新一条英灵消息的态度 */
const currentMood = computed(() => {
  for (let i = store.messages.length - 1; i >= 0; i--) {
    const m = store.messages[i];
    if (m.role === 'assistant' && m.mood) return m.mood;
  }
  return '';
});

async function onSend() {
  if (!inputText.value.trim() || store.loading) return;
  const text = inputText.value;
  inputText.value = '';
  await store.sendMessage(text);
  await nextTick();
  scrollToBottom();
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
}

// ---- 消息操作 ----

function startEdit(idx: number, content: string) {
  editingIdx.value = idx;
  editingText.value = content;
  nextTick(() => {
    if (editTextareaRef.value) {
      editTextareaRef.value.focus();
    }
  });
}

function onCancelEdit() {
  editingIdx.value = -1;
  editingText.value = '';
}

function onSaveEdit(idx: number) {
  if (!editingText.value.trim()) return;
  store.editMessage(idx, editingText.value.trim());
  editingIdx.value = -1;
  editingText.value = '';
}

function onDelete(idx: number) {
  store.deleteMessage(idx);
}

function onRecall() {
  store.recallLast();
}

function onRegenerate(idx: number) {
  store.regenerateMessage(idx);
}
</script>

<style scoped>
.hero-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  font-family: 'Georgia', 'Times New Roman', serif;
  color: #3c2415;
}

/* ---- 顶部栏 ---- */
.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(139, 90, 43, 0.3);
  background: linear-gradient(180deg, rgba(245, 222, 179, 0.4), transparent);
  flex-shrink: 0;
}

.back-btn, .clear-btn {
  border: 1px solid rgba(139, 90, 43, 0.3);
  background: rgba(245, 222, 179, 0.5);
  color: #5c3a1e;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background 0.2s;
}
.back-btn:hover, .clear-btn:hover {
  background: rgba(200, 160, 100, 0.4);
}

.hero-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hero-log-icon {
  font-size: 16px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.12));
}

.hero-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7a7a7a;
  flex-shrink: 0;
}
.hero-status-dot.is-online {
  background: #4a7c3f;
  box-shadow: 0 0 6px rgba(74, 124, 63, 0.5);
}

.hero-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #3c2415;
}

.hero-mood {
  font-size: 10px;
  color: #8b6914;
  background: rgba(201, 169, 110, 0.15);
  border: 1px solid rgba(201, 169, 110, 0.25);
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

/* ---- 共鸣状态条（英灵共鸣系统 v2） ---- */
.resonance-panel {
  flex-shrink: 0;
  margin: 6px 10px 2px;
  padding: 8px 10px 10px;
  background: linear-gradient(160deg, rgba(60, 36, 21, 0.9), rgba(90, 58, 30, 0.92));
  border: 1px solid rgba(201, 169, 110, 0.5);
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(60, 36, 21, 0.25), inset 0 0 18px rgba(245, 222, 179, 0.06);
}

.resonance-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.resonance-title {
  font-size: 12px;
  font-weight: 700;
  color: #f0d48a;
  letter-spacing: 1px;
}
.resonance-val {
  font-size: 14px;
  font-weight: 700;
  color: #ffe9b0;
  margin-left: auto;
}
.resonance-val em {
  font-size: 10px;
  font-style: normal;
  opacity: 0.6;
}
.resonance-status {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 8px;
  border: 1px solid;
  letter-spacing: 0.5px;
}
.resonance-status.status-awake {
  color: #9fdf9f;
  border-color: rgba(120, 200, 120, 0.5);
  background: rgba(120, 200, 120, 0.12);
}
.resonance-status.status-asleep {
  color: #b0a8c8;
  border-color: rgba(160, 150, 200, 0.45);
  background: rgba(160, 150, 200, 0.12);
}
.resonance-status.status-weak {
  color: #e8a878;
  border-color: rgba(232, 168, 120, 0.5);
  background: rgba(232, 168, 120, 0.12);
}
.resonance-cooldown {
  font-size: 10px;
  color: #e8a878;
  border: 1px dashed rgba(232, 168, 120, 0.5);
  border-radius: 8px;
  padding: 1px 7px;
}

.resonance-bar-bg {
  height: 9px;
  border-radius: 5px;
  background: rgba(20, 12, 6, 0.6);
  border: 1px solid rgba(201, 169, 110, 0.3);
  overflow: hidden;
}
.resonance-bar-fill {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #8a5f34, #d8b070, #f0d48a);
  transition: width 0.6s ease;
}
.resonance-bar-fill.resonance-bar-full {
  background: linear-gradient(90deg, #d8b070, #ffe9b0, #fff6d8);
  box-shadow: 0 0 8px rgba(255, 233, 176, 0.7);
  animation: resonancePulse 1.6s ease-in-out infinite;
}
@keyframes resonancePulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.25); }
}

.resonance-sub {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  font-size: 10px;
  color: #c8b08a;
}
.sub-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.sub-bar {
  display: inline-block;
  width: 46px;
  height: 5px;
  border-radius: 3px;
  background: rgba(20, 12, 6, 0.6);
  border: 1px solid rgba(201, 169, 110, 0.25);
  overflow: hidden;
  vertical-align: middle;
}
.sub-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #8a5f34, #d8b070);
  border-radius: 3px;
  transition: width 0.6s ease;
}

.passive-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 7px;
}
.passive-tag {
  font-size: 9px;
  color: #f0d48a;
  background: rgba(201, 169, 110, 0.14);
  border: 1px solid rgba(201, 169, 110, 0.35);
  border-radius: 9px;
  padding: 1px 8px;
  letter-spacing: 0.3px;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.skill-btn {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #3c2415;
  background: linear-gradient(180deg, #f5deb3, #d8b070);
  border: 1px solid #8a5f34;
  border-radius: 8px;
  padding: 5px 16px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, filter 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.skill-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(240, 212, 138, 0.45);
}
.skill-btn:disabled {
  filter: grayscale(0.7) brightness(0.8);
  cursor: not-allowed;
}
.release-msg {
  font-size: 10px;
  color: #9fdf9f;
  line-height: 1.4;
  flex: 1;
}
.release-hint {
  font-size: 10px;
  color: #8b7355;
  line-height: 1.4;
  flex: 1;
}

/* ---- 消息区域 ---- */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
  min-height: 0;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #8b7355;
}
.empty-seal {
  font-size: 32px;
  color: #a0845c;
  opacity: 0.5;
}
.empty-text {
  font-size: 14px;
  margin: 0;
  font-style: italic;
}
.empty-hint {
  font-size: 12px;
  margin: 0;
  opacity: 0.7;
}

.message-row {
  display: flex;
}
.message-user {
  justify-content: flex-end;
}
.message-assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(245, 222, 179, 0.6);
  border: 1px solid rgba(139, 90, 43, 0.2);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.message-user .message-bubble {
  background: rgba(200, 170, 120, 0.5);
  border-color: rgba(139, 90, 43, 0.3);
}

.message-label {
  font-size: 10px;
  font-weight: 700;
  color: #8b6914;
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.message-content {
  font-size: 13px;
  line-height: 1.5;
  color: #3c2415;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-loading .message-content {
  display: none;
}

.loading-dots {
  display: flex;
  gap: 2px;
  font-size: 20px;
  color: #8b6914;
  line-height: 1;
}
.dot {
  animation: dotPulse 1.4s ease-in-out infinite;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotPulse {
  0%, 60%, 100% { opacity: 0.3; }
  30% { opacity: 1; }
}

/* ---- 输入区域 ---- */
.chat-input-area {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid rgba(139, 90, 43, 0.3);
  background: linear-gradient(0deg, rgba(245, 222, 179, 0.4), transparent);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid rgba(139, 90, 43, 0.3);
  border-radius: 8px;
  background: rgba(255, 248, 230, 0.7);
  color: #3c2415;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 13px;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}
.chat-input:focus {
  border-color: #a0845c;
  background: rgba(255, 248, 230, 0.9);
}
.chat-input::placeholder {
  color: #b8a58a;
  font-style: italic;
}

.send-btn {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(139, 90, 43, 0.3);
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a96e, #a6844a);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(139, 90, 43, 0.2);
}
.send-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #dbb97e, #b8944a);
  transform: scale(1.05);
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- 滚动条美化 ---- */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(139, 90, 43, 0.4);
  border-radius: 3px;
}
.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 90, 43, 0.6);
}

/* ---- 撤回按钮 ---- */
.recall-btn {
  border: 1px solid rgba(139, 90, 43, 0.3);
  background: rgba(245, 222, 179, 0.5);
  color: #5c3a1e;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background 0.2s;
  flex-shrink: 0;
}
.recall-btn:hover:not(:disabled) {
  background: rgba(200, 160, 100, 0.4);
}
.recall-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- 消息操作按钮（悬停显示） ---- */
.message-bubble {
  position: relative;
}

.message-actions {
  position: absolute;
  top: -22px;
  right: 4px;
  display: flex;
  gap: 2px;
  background: rgba(245, 222, 179, 0.95);
  border: 1px solid rgba(139, 90, 43, 0.25);
  border-radius: 6px;
  padding: 2px 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 10;
  opacity: 0;
  animation: actionsFadeIn 0.15s ease forwards;
}
@keyframes actionsFadeIn {
  to { opacity: 1; }
}

.msg-action-btn {
  border: none;
  background: transparent;
  color: #5c3a1e;
  font-size: 12px;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.15s;
}
.msg-action-btn:hover {
  background: rgba(139, 90, 43, 0.15);
}

/* ---- 编辑模式 ---- */
.message-edit-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message-edit-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid rgba(139, 90, 43, 0.4);
  border-radius: 6px;
  background: rgba(255, 248, 230, 0.9);
  color: #3c2415;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 13px;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  min-height: 60px;
}
.message-edit-input:focus {
  border-color: #a0845c;
}

.message-edit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.edit-action-btn {
  border: 1px solid rgba(139, 90, 43, 0.3);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  font-family: 'Georgia', 'Times New Roman', serif;
  transition: background 0.15s;
}
.edit-save {
  background: rgba(74, 124, 63, 0.2);
  color: #2d5a1e;
}
.edit-save:hover {
  background: rgba(74, 124, 63, 0.35);
}
.edit-cancel {
  background: rgba(180, 80, 80, 0.15);
  color: #7a3030;
}
.edit-cancel:hover {
  background: rgba(180, 80, 80, 0.3);
}

/* ---- 手机端适配 ---- */
@media (max-width: 480px) {
  .chat-header {
    padding: 5px 8px;
    gap: 5px;
  }
  .hero-name {
    font-size: 13px;
  }
  .hero-log-icon {
    font-size: 14px;
  }
  .hero-mood {
    font-size: 9px;
    padding: 0 4px;
  }
  .chat-messages {
    padding: 8px 6px;
    gap: 6px;
  }
  .message-bubble {
    max-width: 92%;
    padding: 6px 10px;
  }
  .message-content {
    font-size: 12px;
  }
  .message-actions {
    top: -20px;
    right: 2px;
    padding: 1px 3px;
  }
  .msg-action-btn {
    font-size: 10px;
    padding: 1px 3px;
  }
  .message-edit-input {
    font-size: 12px;
  }
  .chat-input-area {
    padding: 5px 8px;
  }
  .chat-input {
    font-size: 12px;
    padding: 6px 8px;
  }
  .send-btn {
    width: 34px;
    height: 34px;
    font-size: 14px;
  }
}
</style>
