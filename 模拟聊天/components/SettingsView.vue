<template>
  <div class="st-settings">
    <div class="st-settings-header">
      <div class="st-settings-title">设置</div>
      <div class="st-settings-subtitle">自定义你的聊天体验</div>
    </div>
    <div class="st-settings-body">
      <div class="st-settings-group">
        <div class="st-settings-item">
          <span class="st-settings-item-icon">✨</span>
          <span class="st-settings-item-label">动画效果</span>
          <button
            class="st-settings-toggle"
            :class="{ 'st-settings-toggle--on': animations }"
            @click="toggleAnimations"
            aria-label="切换动画效果"
          />
        </div>
        <div class="st-settings-item">
          <span class="st-settings-item-icon">🔔</span>
          <span class="st-settings-item-label">消息通知</span>
          <button class="st-settings-toggle st-settings-toggle--on" aria-label="切换消息通知" />
        </div>
      </div>

      <div class="st-settings-group">
        <div class="st-settings-item">
          <span class="st-settings-item-icon">ℹ️</span>
          <span class="st-settings-item-label">关于模拟聊天</span>
          <span class="st-settings-item-value">v1.0</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const animations = ref(true);

function toggleAnimations() {
  animations.value = !animations.value;
  if (animations.value) {
    document.body.classList.remove('st-reduce-motion');
  } else {
    document.body.classList.add('st-reduce-motion');
  }
}

onMounted(() => {
  animations.value = !document.body.classList.contains('st-reduce-motion');
});
</script>
