<template>
  <div ref="frameRef" class="st-phone-frame">
    <div
      ref="headerRef"
      class="st-phone-header"
    >
      <div class="st-phone-header-title">模拟手机</div>
      <button ref="minimizeBtnRef" class="st-phone-header-btn" @click="emit('minimize')">—</button>
    </div>
    <div ref="contentRef" class="st-phone-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useDrag } from '../composables/useDrag';
import { usePhoneContainer } from '../composables/usePhoneContainer';

const emit = defineEmits<{
  (e: 'minimize'): void;
}>();

const headerRef = ref<HTMLElement | null>(null);
const frameRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const minimizeBtnRef = ref<HTMLButtonElement | null>(null);
const { getRect, move } = usePhoneContainer();
const { startDrag } = useDrag(move);

function onMouseDown(e: MouseEvent) {
  startDrag(e, getRect);
}

function onTouchStart(e: TouchEvent) {
  startDrag(e, getRect);
}

function stopPropagation(e: Event) {
  e.stopPropagation();
}

onMounted(() => {
  headerRef.value?.addEventListener('mousedown', onMouseDown);
  headerRef.value?.addEventListener('touchstart', onTouchStart, { passive: false });
  minimizeBtnRef.value?.addEventListener('mousedown', stopPropagation);
  minimizeBtnRef.value?.addEventListener('touchstart', stopPropagation, { passive: false });
});

onUnmounted(() => {
  headerRef.value?.removeEventListener('mousedown', onMouseDown);
  headerRef.value?.removeEventListener('touchstart', onTouchStart, { passive: false });
  minimizeBtnRef.value?.removeEventListener('mousedown', stopPropagation);
  minimizeBtnRef.value?.removeEventListener('touchstart', stopPropagation, { passive: false });
});

defineExpose({ contentRef });
</script>
