<template>
  <FloatingPanelDemo :expanded="panelState.expanded" :collapsed="panelState.collapsed" icon-type="book" color-theme="blue">
    <div class="plot-planner-panel-shell">
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
.plot-planner-panel-shell {
  width: 100%;
  overflow: hidden;
}

.plot-planner-panel-shell :deep(.example-extension-settings) {
  width: 100%;
}

.plot-planner-panel-shell :deep(.inline-drawer-content) {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 2px;
}
</style>