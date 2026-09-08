<template>
  <div class="st-chat">
    <div class="st-chat-header">
      <button class="st-chat-back" @click="emit('back')">←</button>
      <div class="st-chat-avatar">{{ contact.name[0] ?? '?' }}</div>
      <div class="st-chat-meta">
        <div class="st-chat-name">{{ contact.name }}</div>
        <div class="st-chat-status">在线</div>
      </div>
    </div>
    <div ref="scrollRef" class="st-chat-messages">
      <div
        v-for="item in displayItems"
        :key="item.id"
        class="st-chat-row"
        :class="item.sender === '<user>' ? 'st-chat-row--user' : 'st-chat-row--contact'"
      >
        <template v-if="item.kind === 'transfer'">
          <div class="st-transfer-card" :class="item.sender === '<user>' ? 'st-transfer-card--user' : 'st-transfer-card--contact'">
            <div class="st-transfer-icon">💰</div>
            <div class="st-transfer-text">{{ item.content }}</div>
            <div class="st-transfer-time">{{ formatTime(item.timestamp) }}</div>
          </div>
        </template>
        <template v-else-if="item.kind === 'voice'">
          <div
            class="st-chat-voice"
            :class="item.sender === '<user>' ? 'st-chat-voice--user' : 'st-chat-voice--contact'"
            @click="toggleVoice(item.id)"
          >
            <div class="st-chat-voice-main">
              <div class="st-chat-voice-icon">🎙</div>
              <div class="st-chat-voice-wave">
                <span v-for="n in 12" :key="n" class="st-chat-voice-bar" />
              </div>
              <div class="st-chat-voice-meta">
                <span class="st-chat-voice-duration">{{ formatVoiceDuration(item.content) }}</span>
                <span class="st-chat-voice-hint">语音转文字</span>
              </div>
            </div>
            <Transition name="st-voice-transcript">
              <div v-if="expandedVoiceId === item.id" class="st-chat-voice-transcript">
                <div class="st-chat-voice-transcript-label">语音转文字：</div>
                <div>{{ item.content }}</div>
              </div>
            </Transition>
            <div class="st-chat-time">{{ formatTime(item.timestamp) }}</div>
          </div>
        </template>
        <template v-else>
          <div
            class="st-chat-bubble"
            :class="item.sender === '<user>' ? 'st-chat-bubble--user' : 'st-chat-bubble--contact'"
          >
            <div>{{ item.content }}</div>
            <div class="st-chat-time">{{ formatTime(item.timestamp) }}</div>
          </div>
        </template>
      </div>
      <div v-if="generating" class="st-chat-row st-chat-row--contact">
        <div class="st-typing" ref="typingRef">
          <div class="st-typing-dot"></div>
          <div class="st-typing-dot"></div>
          <div class="st-typing-dot"></div>
        </div>
      </div>
      <div v-if="lastError" class="st-chat-error">{{ lastError }}</div>
    </div>
    <div class="st-chat-inputbar">
      <input
        v-model="input"
        class="st-chat-input"
        placeholder="输入消息…"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter="send"
      />
      <button
        class="st-chat-transfer"
        :disabled="generating"
        @click="onOpenTransfer"
        aria-label="转账"
      >
        💰
      </button>
      <button
        class="st-chat-send"
        :disabled="!input.trim() || generating"
        @click="send"
        aria-label="发送"
      >
        ➤
      </button>
    </div>

    <!-- 转账金额输入模态窗 -->
    <div v-if="transferOpen" class="st-transfer-modal">
      <div class="st-transfer-backdrop" @click="closeTransfer" />
      <div
        class="st-transfer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="st-transfer-title"
        @click.stop
      >
        <div id="st-transfer-title" class="st-transfer-title">向 {{ contact.name }} 转账</div>
        <input
          ref="transferInputRef"
          v-model="transferAmount"
          type="text"
          inputmode="decimal"
          class="st-transfer-amount"
          placeholder="输入金额"
          @keydown.enter="confirmTransfer"
          @keydown.esc="closeTransfer"
        />
        <div v-if="transferError" class="st-transfer-error">{{ transferError }}</div>
        <div class="st-transfer-actions">
          <button class="st-transfer-btn st-transfer-btn--secondary" @click="closeTransfer">取消</button>
          <button class="st-transfer-btn" :disabled="generating" @click="confirmTransfer">确认转账</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue';
import type anime from 'animejs';
import type { Contact } from '../composables/useContacts';
import { useAnime } from '../composables/useAnime';
import { useTransfer } from '../composables/useTransfer';
import { parseMessageItems } from '../utils/parser';

const props = defineProps<{
  contact: Contact;
  generating: boolean;
  lastError: string | null;
}>();

interface DisplayItem {
  sender: string;
  timestamp: string;
  kind: 'text' | 'voice' | 'transfer';
  content: string;
  transferInfo?: { from: string; to: string; amount: string };
  id: string;
}

const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = [];
  props.contact.data.messages.forEach((msg, msgIndex) => {
    const renderItems = parseMessageItems(msg.content);
    renderItems.forEach((item, itemIndex) => {
      const base: Omit<DisplayItem, 'kind' | 'content' | 'transferInfo'> = {
        sender: msg.sender,
        timestamp: msg.timestamp,
        id: `${msg.timestamp}-${msgIndex}-${itemIndex}`,
      };
      if (item.kind === 'transfer') {
        items.push({ ...base, kind: 'transfer', content: formatTransferText(item.info), transferInfo: item.info });
      } else if (item.kind === 'voice') {
        items.push({ ...base, kind: 'voice', content: item.transcript });
      } else {
        items.push({ ...base, kind: 'text', content: item.content });
      }
    });
  });
  return items;
});

const expandedVoiceId = ref<string | null>(null);

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'send', content: string): void;
}>();

const input = ref('');
const scrollRef = ref<HTMLElement | null>(null);
const typingRef = ref<HTMLElement | null>(null);
const transferInputRef = ref<HTMLInputElement | null>(null);
const { popInMessage, typingDots } = useAnime();
const { isOpen: transferOpen, amount: transferAmount, error: transferError, open: openTransfer, close: closeTransfer, validate: validateTransfer, formatTransferMessage } = useTransfer();

let typingAnim: anime.AnimeInstance | undefined;

function send() {
  const text = input.value.trim();
  if (!text || props.generating) return;
  input.value = '';
  emit('send', text);
}

function onOpenTransfer() {
  if (props.generating) return;
  openTransfer();
}

function confirmTransfer() {
  if (!validateTransfer(transferAmount.value)) return;
  const text = formatTransferMessage(props.contact.name, transferAmount.value);
  closeTransfer();
  emit('send', text);
}

function formatTransferText(info: { from: string; to: string; amount: string }): string {
  return `${info.from} 向 ${info.to} 转账 ${info.amount}`;
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

function formatVoiceDuration(text: string): string {
  const seconds = Math.max(1, Math.ceil(text.length / 4));
  return `${seconds}"`;
}

function toggleVoice(id: string) {
  expandedVoiceId.value = expandedVoiceId.value === id ? null : id;
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  });
}

function animateLatest() {
  if (document.body.classList.contains('st-reduce-motion')) {
    scrollToBottom();
    return;
  }
  nextTick(() => {
    if (!scrollRef.value) return;
    const rendered = scrollRef.value.querySelectorAll('.st-chat-bubble, .st-chat-voice, .st-transfer-card') as NodeListOf<HTMLElement>;
    const last = rendered[rendered.length - 1];
    if (last) {
      popInMessage(last);
    }
    scrollToBottom();
  });
}

watch(() => props.contact.data.messages.length, animateLatest);

watch(() => transferOpen.value, (value) => {
  if (value) {
    nextTick(() => transferInputRef.value?.focus());
  }
});

watch(() => props.generating, (value) => {
  if (value) {
    scrollToBottom();
    nextTick(() => {
      if (!props.generating || !typingRef.value) return;
      typingAnim?.pause();
      typingAnim = undefined;
      typingAnim = typingDots(typingRef.value.querySelectorAll('.st-typing-dot'));
    });
  } else {
    typingAnim?.pause();
    typingAnim = undefined;
  }
});

onMounted(scrollToBottom);
onUnmounted(() => typingAnim?.pause());
</script>
