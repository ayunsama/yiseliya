<template>
  <FloatingPanelDemo :expanded="panelState.expanded" :collapsed="panelState.collapsed">
    <div class="isuria-panel-shell">
      <SettingsPanel />
    </div>
  </FloatingPanelDemo>
</template>

<script setup lang="ts">
import FloatingPanelDemo from '../悬浮按钮/FloatingPanelDemo.vue';
import SettingsPanel from './App.vue';

defineProps<{
  panelState: { expanded: boolean; collapsed: boolean };
}>();
</script>

<style scoped>
.isuria-panel-shell {
  width: 100%;
  overflow: hidden;
}

.isuria-panel-shell :deep(.isuria-settings) {
  width: 100%;
}

.isuria-panel-shell :deep(.inline-drawer-content) {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 2px;
}
@media (max-width: 640px) {
  .isuria-panel-shell :deep(.inline-drawer-content) {
    max-height: 50vh;
  }
}
</style>
