<template>
  <div class="snap-wrap">
    <div class="mbx-roller mbx-roller-top"><span class="mbx-cap c-l"></span><span class="mbx-cap c-r"></span></div>
    <div class="snap-header">
      <span class="snap-title">⚔ 战斗轮</span>
      <span class="snap-sub">
        第 {{ snap.round }} 轮
        <template v-if="snap.environment">· {{ snap.environment }}</template>
        <template v-if="snap.surprise">· 突袭：{{ snap.surprise }}</template>
      </span>
    </div>

    <div class="battle-field">
      <!-- 左：我方 -->
      <div class="side side-left">
        <div class="side-title">◆ 我方</div>
        <div class="unit-list">
          <UnitCard v-for="u in allies" :key="'A-' + u.name" :unit="u" :avatar="u.avatar" :is-turn="snap.turn === u.name" side="ally" />
          <div v-if="!allies.length" class="side-empty">暂无我方角色</div>
        </div>
      </div>

      <!-- 中：先攻/当前行动 -->
      <div class="side side-center">
        <div class="center-box">
          <div class="center-label">当前行动</div>
          <div class="center-turn">{{ snap.turn || '—' }}</div>
          <div class="center-label" style="margin-top:8px">先攻序列</div>
          <div class="init-list">
            <span v-for="(n, i) in snap.initiative" :key="i" class="init-item" :class="{ on: n === snap.turn }">{{ i + 1 }}. {{ n }}</span>
            <span v-if="!snap.initiative.length" class="side-empty">待定</span>
          </div>
        </div>
      </div>

      <!-- 右：敌方 -->
      <div class="side side-right">
        <div class="side-title">◆ 敌方</div>
        <div class="unit-list">
          <UnitCard v-for="u in enemies" :key="'E-' + u.name" :unit="u" :avatar="u.avatar" :is-turn="snap.turn === u.name" side="enemy" />
          <div v-if="!enemies.length" class="side-empty">暂无敌方</div>
        </div>
      </div>
    </div>

    <div class="log-section" v-if="snap.log.length">
      <div class="log-title">✒ 战斗日志</div>
      <div class="log-list">
        <div v-for="(l, i) in snap.log.slice(-4).reverse()" :key="i" class="log-item">· {{ l }}</div>
      </div>
    </div>
    <div class="mbx-roller mbx-roller-bottom"><span class="mbx-cap c-l"></span><span class="mbx-cap c-r"></span></div>
  </div>
</template>

<script setup lang="ts">
import UnitCard from './UnitCard.vue';
import type { AllyUnit, BattleSnapshot, EnemyUnit } from './store';

defineProps<{
  snap: BattleSnapshot;
  allies: AllyUnit[];
  enemies: EnemyUnit[];
}>();
</script>

<style scoped>
.snap-wrap {
  position: relative;
  width: 100%;
  margin-bottom: 8px;
  padding: 14px 14px 16px;
  background:
    radial-gradient(ellipse at center, transparent 52%, rgba(96, 60, 20, 0.14) 100%),
    repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(140, 100, 50, 0.04) 24px, rgba(140, 100, 50, 0.04) 25px),
    #f3e8cd;
  border: 1px solid #a07840;
  border-top: 3px double #5a3a1a;
  border-bottom: 3px double #5a3a1a;
  border-radius: 3px;
  color: #33220f;
}

/* 木质滚轴 */
.mbx-roller {
  position: absolute;
  left: -2px;
  right: -2px;
  height: 10px;
  background: linear-gradient(180deg, #8a5a2a, #6b3f1c 45%, #8a5a2a 92%);
  border-radius: 5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  z-index: 2;
}
.mbx-roller-top {
  top: -5px;
}
.mbx-roller-bottom {
  bottom: -5px;
}
.mbx-cap {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 13px;
  height: 18px;
  background: linear-gradient(90deg, #7a4a22, #54300f 60%, #7a4a22);
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.mbx-cap.c-l {
  left: -7px;
}
.mbx-cap.c-r {
  right: -7px;
}

.snap-header {
  text-align: center;
  margin-bottom: 10px;
}
.snap-title {
  font-size: 1.15em;
  font-weight: 800;
  letter-spacing: 4px;
  color: #4a2f08;
}
.snap-sub {
  display: block;
  font-size: 0.72em;
  color: #8a6a3a;
  margin-top: 2px;
}

.battle-field {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.side {
  min-width: 0;
}
.side-left {
  flex: 1 1 38%;
}
.side-center {
  flex: 0 0 100px;
}
.side-right {
  flex: 1 1 38%;
}
.side-title {
  font-size: 0.72em;
  letter-spacing: 2px;
  color: #8a6a3a;
  border-bottom: 1px dashed #c4a050;
  padding-bottom: 3px;
  margin-bottom: 6px;
  text-align: center;
}
.unit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.side-empty {
  font-size: 0.68em;
  color: #a09070;
  text-align: center;
  padding: 8px 0;
  border: 1px dashed rgba(160, 120, 64, 0.3);
  border-radius: 4px;
}

.center-box {
  background: linear-gradient(135deg, rgba(232, 214, 178, 0.35), rgba(232, 214, 178, 0.2));
  border: 1px solid rgba(160, 120, 64, 0.3);
  border-radius: 4px;
  padding: 8px 6px;
  height: 100%;
  text-align: center;
}
.center-label {
  font-size: 0.64em;
  color: #8a6a3a;
  letter-spacing: 1px;
}
.center-turn {
  font-size: 0.92em;
  font-weight: 800;
  color: #8a2a10;
  margin: 3px 0;
}
.init-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 3px;
}
.init-item {
  font-size: 0.64em;
  color: #6a5430;
  padding: 1px 3px;
  border-radius: 3px;
}
.init-item.on {
  background: rgba(212, 175, 55, 0.35);
  color: #5a3a08;
  font-weight: 700;
}

.log-section {
  border-top: 1px dashed #c4a050;
  padding-top: 6px;
  margin-top: 8px;
}
.log-title {
  font-size: 0.68em;
  letter-spacing: 2px;
  color: #8a6a3a;
  margin-bottom: 3px;
}
.log-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.log-item {
  font-size: 0.68em;
  color: #5a4a30;
  line-height: 1.45;
}

@media (max-width: 560px) {
  .battle-field {
    flex-direction: column;
  }
  .side-center {
    flex: none;
    order: -1;
  }
  .center-box {
    height: auto;
  }
}
</style>
