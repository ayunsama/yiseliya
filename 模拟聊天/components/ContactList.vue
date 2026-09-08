<template>
  <div class="st-contact-list">
    <div class="st-contact-list-header">
      <div class="st-contact-list-header-left">
        <button v-if="showBack" class="st-chat-back" @click="emit('back')">←</button>
        <div>
          <div class="st-contact-list-title">联系人</div>
          <div class="st-contact-list-subtitle">{{ contacts.length }} 位联系人</div>
        </div>
      </div>
      <button
        class="st-contact-add"
        aria-label="添加联系人"
        @click="emit('add')"
      >
        +
      </button>
    </div>
    <div class="st-contact-list-body" ref="listRef">
      <div
        v-for="(contact, index) in contacts"
        :key="contact.uid"
        class="st-contact-item"
        @click="onSelect(contact)"
      >
        <div class="st-contact-avatar" :style="avatarStyle(index)">{{ contact.name[0] ?? '?' }}</div>
        <div class="st-contact-info">
          <div class="st-contact-name">{{ contact.name }}</div>
          <div class="st-contact-preview">{{ preview(contact) }}</div>
        </div>
      </div>
      <div v-if="contacts.length === 0" class="st-contact-empty">
        世界书中没有联系人条目<br />请添加以 `联系人-` 开头的世界书条目
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import type { Contact } from '../composables/useContacts';
import { useAnime } from '../composables/useAnime';
import type anime from 'animejs';

const props = withDefaults(defineProps<{
  contacts: Contact[];
  showBack?: boolean;
}>(), {
  showBack: true,
});

const emit = defineEmits<{
  (e: 'select', contact: Contact): void;
  (e: 'back'): void;
  (e: 'add'): void;
}>();

const listRef = ref<HTMLElement | null>(null);
const { staggerContacts } = useAnime();
let staggerAnim: anime.AnimeInstance | undefined;

const gradients = [
  'linear-gradient(135deg, #38bdf8, #818cf8)',
  'linear-gradient(135deg, #f472b6, #db2777)',
  'linear-gradient(135deg, #4ade80, #22c55e)',
  'linear-gradient(135deg, #fbbf24, #f97316)',
];

function avatarStyle(index: number) {
  return { background: gradients[index % gradients.length] };
}

function preview(contact: Contact): string {
  const last = contact.data.messages[contact.data.messages.length - 1];
  return last ? last.content : '暂无消息';
}

function onSelect(contact: Contact) {
  emit('select', contact);
}

function animateItems() {
  if (!listRef.value || document.body.classList.contains('st-reduce-motion')) return;
  const items = listRef.value.querySelectorAll('.st-contact-item') as NodeListOf<HTMLElement>;
  if (items.length === 0) return;
  items.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
  });
  staggerAnim?.pause();
  nextTick(() => {
    if (!listRef.value) return;
    const liveItems = listRef.value.querySelectorAll('.st-contact-item') as NodeListOf<HTMLElement>;
    if (liveItems.length === 0) return;
    staggerAnim = staggerContacts(liveItems);
  });
}

onMounted(animateItems);
onUnmounted(() => {
  staggerAnim?.pause();
});
</script>
