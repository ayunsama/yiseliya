<template>
  <div class="st-desktop">
    <div class="st-fluid-bg" ref="bgRef"></div>
    <div class="st-desktop-grid">
      <div class="st-app-icon" @click="emit('open-chat')" ref="chatIconRef">
        <div class="st-app-icon-glass">💬</div>
        <span class="st-app-icon-label">聊天</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import anime from 'animejs';

const emit = defineEmits<{
  (e: 'open-chat'): void;
}>();

const chatIconRef = ref<HTMLElement | null>(null);
const bgRef = ref<HTMLElement | null>(null);
let bgAnim: anime.AnimeInstance | undefined;
let hoverAnim: anime.AnimeInstance | undefined;

function onMouseEnter() {
  if (document.body.classList.contains('st-reduce-motion')) return;
  const glass = chatIconRef.value?.querySelector('.st-app-icon-glass') as HTMLElement | null;
  if (!glass) return;
  hoverAnim = anime({
    targets: glass,
    translateY: -4,
    scale: 1.1,
    boxShadow: '0 12px 32px rgba(74,222,128,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
    duration: 200,
    easing: 'easeOutCubic',
  });
}

function onMouseLeave() {
  if (document.body.classList.contains('st-reduce-motion')) return;
  const glass = chatIconRef.value?.querySelector('.st-app-icon-glass') as HTMLElement | null;
  if (!glass) return;
  hoverAnim?.pause();
  hoverAnim = anime({
    targets: glass,
    translateY: 0,
    scale: 1,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
    duration: 200,
    easing: 'easeOutCubic',
  });
}

onMounted(() => {
  if (bgRef.value && !document.body.classList.contains('st-reduce-motion')) {
    bgAnim = anime({
      targets: bgRef.value,
      translateX: ['0%', '5%', '-5%', '0%'],
      translateY: ['0%', '-5%', '5%', '0%'],
      scale: [1, 1.1, 0.95, 1],
      duration: 12000,
      loop: true,
      easing: 'easeInOutSine',
    });
  }

  chatIconRef.value?.addEventListener('mouseenter', onMouseEnter);
  chatIconRef.value?.addEventListener('mouseleave', onMouseLeave);
});

onUnmounted(() => {
  bgAnim?.pause();
  hoverAnim?.pause();
  chatIconRef.value?.removeEventListener('mouseenter', onMouseEnter);
  chatIconRef.value?.removeEventListener('mouseleave', onMouseLeave);
});
</script>
