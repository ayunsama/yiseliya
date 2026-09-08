<template>
  <div class="floating-panel-demo" :class="`theme--${colorTheme}`">
    <div
      class="floating-panel-demo__ball"
      data-fab-ball="1"
      :class="ballClass"
    >
      <div class="floating-panel-demo__ball-glow"></div>
      <div class="floating-panel-demo__ball-core">
        <!-- 书籍图标 -->
        <svg v-if="iconType === 'book'" class="floating-panel-demo__icon" viewBox="0 0 28 28" width="43" height="43" fill="none" aria-hidden="true">
          <path d="M4 3h7a3 3 0 013 3v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zm0 0l10 3.5V23l-10-3.5V3z" fill="currentColor" opacity="0.7"/>
          <path d="M14 3l10 3.5V23l-10-3.5V3z" fill="currentColor"/>
          <path d="M4 3h7a3 3 0 013 3v16a1 1 0 01-1 1H5" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.9"/>
          <line x1="7" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1" opacity="0.5"/>
          <line x1="7" y1="11" x2="11" y2="11" stroke="currentColor" stroke-width="1" opacity="0.5"/>
        </svg>
        <!-- 音乐音符图标（音乐盒） -->
        <svg v-else-if="iconType === 'music'" class="floating-panel-demo__icon" viewBox="0 0 28 28" width="43" height="43" fill="none" aria-hidden="true">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor"/>
          <path d="M20 4l-4 1.2v3.1l4-1.2V4z" fill="currentColor" opacity="0.55"/>
        </svg>
        <!-- 五角星图标 -->
        <svg v-else class="floating-panel-demo__icon" viewBox="0 0 28 28" width="43" height="43" fill="none" aria-hidden="true">
          <path d="M14 2l3.7 7.4 8.3 1.2-6 5.9 1.4 8.3L14 20.5l-7.4 3.9L8 16.5l-6-5.9 8.3-1.2L14 2z" fill="currentColor"/>
        </svg>
      </div>
    </div>
    <div class="floating-panel-demo__content" v-show="isExpanded">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  expanded: boolean;
  collapsed: boolean;
  iconType?: 'star' | 'book' | 'music';
  colorTheme?: 'purple' | 'blue' | 'brown';
  /** 形状：circle 圆形（默认） / square 方形（音乐盒等） */
  shape?: 'circle' | 'square';
  /** 播放动画标记（播放中音符跳动，仅方形生效） */
  animate?: boolean;
}>();

const isExpanded = computed(() => props.expanded);

const ballClass = computed(() => ({
  'is-expanded': props.expanded,
  'is-collapsed': props.collapsed,
  'is-square': props.shape === 'square',
  'is-animating': props.animate === true,
}));
</script>

<style scoped>
.floating-panel-demo {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.floating-panel-demo__ball {
  position: relative;
  width: 68px;
  height: 68px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid rgba(180, 100, 255, 0.5);
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  box-shadow:
    0 8px 28px rgba(139, 92, 246, 0.5),
    0 0 0 4px rgba(180, 100, 255, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  display: grid;
  place-items: center;
  cursor: grab;
  touch-action: none;
  transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}
@media (max-width: 640px) {
  .floating-panel-demo__ball {
    width: 52px;
    height: 52px;
    box-shadow:
      0 6px 20px rgba(139, 92, 246, 0.45),
      0 0 0 3px rgba(180, 100, 255, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}
.floating-panel-demo__ball:active {
  cursor: grabbing;
  transform: scale(0.92);
}
.floating-panel-demo__ball.is-expanded {
  transform: scale(1.08);
  box-shadow:
    0 12px 36px rgba(139, 92, 246, 0.55),
    0 0 0 6px rgba(180, 100, 255, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.floating-panel-demo__ball.is-collapsed {
  transform: scale(0.88);
  box-shadow:
    0 4px 16px rgba(139, 92, 246, 0.35),
    0 0 0 3px rgba(180, 100, 255, 0.12);
}
.floating-panel-demo__ball-glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.25) 0%, transparent 60%);
  pointer-events: none;
}
.floating-panel-demo__ball-core {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
@media (max-width: 640px) {
  .floating-panel-demo__ball-core {
    width: 40px;
    height: 40px;
  }
  .floating-panel-demo__icon {
    width: 28px;
    height: 28px;
  }
}
.floating-panel-demo__icon {
  display: block;
  color: rgba(216, 180, 254, 0.95);
  filter: drop-shadow(0 1px 4px rgba(0,0,0,0.4));
  transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.is-expanded .floating-panel-demo__icon {
  transform: rotate(45deg) scale(1.1);
}
.is-collapsed .floating-panel-demo__icon {
  transform: rotate(0deg) scale(0.95);
}
.floating-panel-demo__content {
  margin-top: 12px;
  width: 360px;
  max-width: calc(100vw - 40px);
  border-radius: 22px;
  padding: 14px;
  background: rgba(8, 20, 40, 0.78);
  border: 1px solid rgba(180, 100, 255, 0.2);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
}
@media (max-width: 640px) {
  .floating-panel-demo__content {
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    padding: 12px;
    border-radius: 16px;
    margin-top: 8px;
  }
}

/* ===== 蓝色主题（剧情规划大师） ===== */
.theme--blue .floating-panel-demo__ball {
  border-color: rgba(59, 130, 246, 0.5);
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow:
    0 8px 28px rgba(37, 99, 235, 0.5),
    0 0 0 4px rgba(59, 130, 246, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
@media (max-width: 640px) {
  .theme--blue .floating-panel-demo__ball {
    box-shadow:
      0 6px 20px rgba(37, 99, 235, 0.45),
      0 0 0 3px rgba(59, 130, 246, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}
.theme--blue .floating-panel-demo__ball.is-expanded {
  box-shadow:
    0 12px 36px rgba(37, 99, 235, 0.55),
    0 0 0 6px rgba(59, 130, 246, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.theme--blue .floating-panel-demo__ball.is-collapsed {
  box-shadow:
    0 4px 16px rgba(37, 99, 235, 0.35),
    0 0 0 3px rgba(59, 130, 246, 0.12);
}
.theme--blue .floating-panel-demo__icon {
  color: rgba(191, 219, 254, 0.95);
}
.theme--blue .floating-panel-demo__content {
  border-color: rgba(59, 130, 246, 0.2);
}

/* ===== 棕灰八音盒主题（音乐盒） ===== */
.theme--brown .floating-panel-demo__ball {
  border-color: rgba(212, 175, 55, 0.55);
  background: linear-gradient(135deg, #8a6a52, #5f4435);
  box-shadow:
    0 8px 28px rgba(80, 55, 35, 0.55),
    0 0 0 4px rgba(212, 175, 55, 0.14),
    inset 0 1px 0 rgba(255, 220, 160, 0.28);
}
@media (max-width: 640px) {
  .theme--brown .floating-panel-demo__ball {
    box-shadow:
      0 6px 20px rgba(80, 55, 35, 0.5),
      0 0 0 3px rgba(212, 175, 55, 0.12),
      inset 0 1px 0 rgba(255, 220, 160, 0.25);
  }
}
.theme--brown .floating-panel-demo__ball.is-expanded {
  box-shadow:
    0 12px 36px rgba(80, 55, 35, 0.6),
    0 0 0 6px rgba(212, 175, 55, 0.18),
    inset 0 1px 0 rgba(255, 220, 160, 0.32);
}
.theme--brown .floating-panel-demo__ball.is-collapsed {
  box-shadow:
    0 4px 16px rgba(80, 55, 35, 0.4),
    0 0 0 3px rgba(212, 175, 55, 0.1),
    inset 0 1px 0 rgba(255, 220, 160, 0.22);
}
.theme--brown .floating-panel-demo__ball-core {
  background: rgba(255, 220, 160, 0.1);
  border-color: rgba(240, 212, 138, 0.35);
}
.theme--brown .floating-panel-demo__icon {
  color: rgba(240, 212, 138, 0.95);
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.45));
}
.theme--brown .floating-panel-demo__content {
  border-color: rgba(212, 175, 55, 0.22);
  background: rgba(36, 26, 19, 0.88);
}

/* ===== 方形（音乐盒辨识度） ===== */
.floating-panel-demo__ball.is-square {
  border-radius: 16px;
}
.is-square .floating-panel-demo__ball-glow {
  border-radius: 16px;
}
.is-square .floating-panel-demo__ball-core {
  border-radius: 12px;
}
/* 播放中：音符跳动 */
.floating-panel-demo__ball.is-square.is-animating .floating-panel-demo__icon {
  animation: fabNoteBounce 1.1s ease-in-out infinite;
}
@keyframes fabNoteBounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-3px) scale(1.12);
  }
}
</style>
