<template>
  <div
    ref="buttonRef"
    class="st-float-button"
  >
    <span>💬</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { usePhoneContainer } from '../composables/usePhoneContainer';
import { useDrag } from '../composables/useDrag';
import { useAnime } from '../composables/useAnime';

const emit = defineEmits<{
  (e: 'open'): void;
}>();

const buttonRef = ref<HTMLElement | null>(null);
const { getRect, move } = usePhoneContainer();
const { startDrag } = useDrag(move, () => emit('open'));
const { breathe } = useAnime();

let breatheAnim: anime.AnimeInstance | undefined;

function onMouseDown(e: MouseEvent) {
  startDrag(e, getRect);
}

function onTouchStart(e: TouchEvent) {
  startDrag(e, getRect);
}

onMounted(() => {
  buttonRef.value?.addEventListener('mousedown', onMouseDown);
  buttonRef.value?.addEventListener('touchstart', onTouchStart, { passive: false });
  breatheAnim = breathe(buttonRef.value);
});

onUnmounted(() => {
  buttonRef.value?.removeEventListener('mousedown', onMouseDown);
  buttonRef.value?.removeEventListener('touchstart', onTouchStart, { passive: false });
  breatheAnim?.pause();
});
</script>
