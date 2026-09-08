<template>
  <div class="st-phone-root">
    <FloatingButton v-if="!expanded" @open="open" />
    <PhoneFrame v-else @minimize="minimize" ref="phoneRef">
      <div v-if="error" class="st-error-overlay">
        <div class="st-error-text">{{ error }}</div>
      </div>
      <DesktopView v-if="view === 'desktop'" @open-chat="enterApp" />
      <PhoneApp v-else :contacts="contacts" :save-contact="saveContact" :ensure-contact="ensureContact" />
    </PhoneFrame>
  </div>
</template>

<script setup lang="ts">
import type anime from 'animejs';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import DesktopView from './components/DesktopView.vue';
import FloatingButton from './components/FloatingButton.vue';
import PhoneApp from './components/PhoneApp.vue';
import PhoneFrame from './components/PhoneFrame.vue';
import { useAnime } from './composables/useAnime';
import { useContacts } from './composables/useContacts';
import { usePhoneContainer } from './composables/usePhoneContainer';

type View = 'desktop' | 'app';
const expanded = ref(false);
const view = ref<View>('desktop');
const { getContainer, resize } = usePhoneContainer();
const { contacts, error, loadContacts, saveContact, ensureContact } = useContacts();
const { expandFromButton, collapseToButton } = useAnime();

const phoneRef = ref<InstanceType<typeof PhoneFrame> | null>(null);

let transitionAnim: anime.AnimeInstance | anime.AnimeTimelineInstance | undefined;

function open() {
  expanded.value = true;
  view.value = 'desktop';
  resize('350px', '680px');
  loadContacts();
  if (document.body.classList.contains('st-reduce-motion')) return;
  nextTick(() => {
    const container = getContainer();
    const content = phoneRef.value?.$el.querySelector('.st-phone-content') as HTMLElement | null;
    transitionAnim?.pause();
    transitionAnim = expandFromButton(container, content);
  });
}

function enterApp() {
  view.value = 'app';
  loadContacts();
}

function minimize() {
  if (document.body.classList.contains('st-reduce-motion')) {
    expanded.value = false;
    resize('64px', '64px');
    view.value = 'desktop';
    return;
  }
  const container = getContainer();
  transitionAnim?.pause();
  transitionAnim = collapseToButton(container, () => {
    expanded.value = false;
    resize('64px', '64px');
    view.value = 'desktop';
  });
}

watch(expanded, (value) => {
  if (!value) {
    resize('64px', '64px');
  }
}, { immediate: true });

onMounted(() => {
  loadContacts();
});

onUnmounted(() => {
  transitionAnim?.pause();
});
</script>
