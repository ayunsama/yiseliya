<template>
  <div class="unit-card" :class="{ turn: isTurn }">
    <div class="unit-avatar">
      <img v-if="avatar" :src="avatar" alt="" class="avatar-img" loading="lazy">
      <div v-else class="avatar-fallback">{{ unit.name.slice(0, 1) }}</div>
      <div class="avatar-badge" :class="badgeClass">{{ badgeText }}</div>
    </div>

    <div class="unit-info">
      <div class="unit-name" :class="{ dead }">{{ unit.name }}</div>

      <div class="bar-row" v-if="hasHp">
        <span class="bar-label">HP</span>
        <div class="bar-bg"><div class="bar-fill bar-hp" :style="{ width: hpPct + '%' }"></div></div>
        <span class="bar-num">{{ unit.hpCur }}/{{ unit.hpMax }}</span>
      </div>
      <div class="bar-row" v-if="hasMp">
        <span class="bar-label">MP</span>
        <div class="bar-bg"><div class="bar-fill bar-mp" :style="{ width: mpPct + '%' }"></div></div>
        <span class="bar-num">{{ unit.mpCur }}/{{ unit.mpMax }}</span>
      </div>
      <div class="bar-row" v-if="hasSp">
        <span class="bar-label">SP</span>
        <div class="bar-bg"><div class="bar-fill bar-sp" :style="{ width: spPct + '%' }"></div></div>
        <span class="bar-num">{{ unit.spCur }}/{{ unit.spMax }}</span>
      </div>

      <!-- 英灵专属：残响之力条 + 状态 -->
      <div class="bar-row" v-if="isSpirit">
        <span class="bar-label">残响</span>
        <div class="bar-bg"><div class="bar-fill bar-spirit" :style="{ width: spiritPct + '%' }"></div></div>
        <span class="bar-num">{{ unit.spiritPower || 0 }}/100</span>
      </div>
      <div class="spirit-line" v-if="isSpirit">
        <span class="spirit-chip" :class="unit.spiritStatus === '沉睡' ? 'asleep' : 'awake'">{{ unit.spiritStatus }}</span>
        <span v-if="(unit.spiritPower || 0) >= 100" class="spirit-chip spirit-full">✦ 大招就绪</span>
      </div>

      <div class="unit-meta">
        <span class="meta-def">防 {{ unit.def }}</span>
        <span v-if="unit.rank" class="meta-rank">{{ unit.rank }}</span>
        <span v-if="unit.level" class="meta-rank">Lv.{{ unit.level }}</span>
      </div>

      <!-- 敌人面板信息（来自 <enemy_data>） -->
      <div v-if="side === 'enemy'" class="enemy-panel">
        <div v-if="unit.kind || unit.race" class="ep-line">
          <span v-if="unit.kind" class="ep-chip ep-kind">{{ unit.kind }}</span>
          <span v-if="unit.race" class="ep-chip ep-race">{{ unit.race }}</span>
          <span v-if="unit.speed" class="ep-chip ep-other">速{{ unit.speed }}</span>
        </div>
        <div v-if="unit.weakness && unit.weakness !== '无'" class="ep-line">
          <span class="ep-chip ep-weak">弱点 {{ unit.weakness }}</span>
          <span v-if="unit.resist && unit.resist !== '无'" class="ep-chip ep-resist">抗 {{ unit.resist }}</span>
          <span v-if="unit.immune && unit.immune !== '无'" class="ep-chip ep-immune">免 {{ unit.immune }}</span>
        </div>
        <div v-else-if="unit.resist && unit.resist !== '无'" class="ep-line">
          <span class="ep-chip ep-resist">抗 {{ unit.resist }}</span>
          <span v-if="unit.immune && unit.immune !== '无'" class="ep-chip ep-immune">免 {{ unit.immune }}</span>
        </div>
        <div v-if="unit.attack" class="ep-line ep-atk">
          ⚔ {{ unit.attack.name }}<span v-if="unit.attack.dmg"> {{ unit.attack.dmg }}</span>
          <span v-if="unit.attack.effect" class="ep-chip ep-other">{{ unit.attack.effect }}</span>
        </div>
        <div v-if="unit.ability" class="ep-line ep-ability">✦ {{ unit.ability }}</div>
      </div>

      <!-- 友军面板信息（来自 <ally_data>：种族/性别/年龄/等阶/加护/态度/好感度/攻击/能力/装备等） -->
      <div v-if="side === 'ally' && isFriend" class="enemy-panel">
        <div v-if="unit.race || unit.gender || unit.age || unit.level || unit.rank" class="ep-line">
          <span v-if="unit.race" class="ep-chip ep-race">{{ unit.race }}</span>
          <span v-if="unit.gender" class="ep-chip ep-other">{{ unit.gender }}</span>
          <span v-if="unit.age" class="ep-chip ep-other">{{ unit.age }}岁</span>
          <span v-if="unit.level" class="ep-chip ep-other">Lv.{{ unit.level }}</span>
          <span v-if="unit.rank" class="ep-chip ep-kind">{{ unit.rank }}</span>
        </div>
        <div v-if="unit.blessing && unit.blessing !== '无'" class="ep-line">
          <span class="ep-chip ep-spirit">加护 {{ unit.blessing }}</span>
        </div>
        <div v-if="unit.attitude || unit.affinity" class="ep-line">
          <span v-if="unit.attitude" class="ep-chip" :class="attitudeClass">{{ unit.attitude }}</span>
          <span v-if="unit.affinity !== undefined" class="ep-chip ep-other">好感 {{ unit.affinity }}</span>
          <span v-if="unit.speed" class="ep-chip ep-other">速{{ unit.speed }}</span>
        </div>
        <div v-if="unit.attack" class="ep-line ep-atk">
          ⚔ {{ unit.attack.name }}<span v-if="unit.attack.dmg"> {{ unit.attack.dmg }}</span>
          <span v-if="unit.attack.effect" class="ep-chip ep-other">{{ unit.attack.effect }}</span>
        </div>
        <div v-if="unit.ability" class="ep-line ep-ability">✦ {{ unit.ability }}</div>
        <div v-if="unit.function" class="ep-line ep-ability">🛠 {{ unit.function }}</div>
        <div v-if="unit.equips && unit.equips.length" class="ep-line ep-ability">🎽 {{ unit.equips.join('；') }}</div>
      </div>

      <div v-if="statusList.length" class="unit-status">
        <span v-for="(s, i) in statusList" :key="i" class="status-chip">{{ s }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AllyUnit, EnemyUnit } from './store';

const props = defineProps<{
  unit: AllyUnit | EnemyUnit;
  avatar: string;
  isTurn: boolean;
  /** 阵营：ally=我方 / enemy=敌方（决定徽章与敌人面板显示） */
  side: 'ally' | 'enemy';
}>();

const hasHp = computed(() => (props.unit.hpMax || 0) > 0);
const hasMp = computed(() => (props.unit.mpMax || 0) > 0);
const hasSp = computed(() => (props.unit.spMax || 0) > 0);
const isSpirit = computed(() => 'kind' in props.unit && props.unit.kind === '英灵');
const isFriend = computed(() => 'kind' in props.unit && props.unit.kind === '友军');
const attitudeClass = computed(() => {
  const a = props.unit.attitude || '';
  if (a.includes('友好')) return 'att-friend';
  if (a.includes('中立')) return 'att-neutral';
  if (a.includes('警惕')) return 'att-wary';
  if (a.includes('敌对')) return 'att-hostile';
  return 'att-neutral';
});
const spiritPct = computed(() => pct(props.unit.spiritPower || 0, 100));
const dead = computed(() => hasHp.value && (props.unit.hpCur || 0) <= 0);
const hpPct = computed(() => pct(props.unit.hpCur, props.unit.hpMax));
const mpPct = computed(() => pct(props.unit.mpCur, props.unit.mpMax));
const spPct = computed(() => pct(props.unit.spCur, props.unit.spMax));

function pct(cur: number, max: number): number {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round(((cur || 0) / max) * 100)));
}

const badgeText = computed(() => {
  if (isSpirit.value) return '英灵';
  return props.side === 'ally' ? ('kind' in props.unit ? props.unit.kind : '友') : '敌';
});
const badgeClass = computed(() => (isSpirit.value ? 'spirit' : props.side === 'ally' ? 'ally' : 'enemy'));

const statusList = computed(() => {
  const st = props.unit.status || {};
  return Object.keys(st).map(k => (typeof st[k] === 'object' && st[k] !== null ? (st[k] as any).描述 || k : k)).slice(0, 3);
});
</script>

<style scoped>
.unit-card {
  display: flex;
  gap: 8px;
  background: #fbf3e2;
  border: 1px solid rgba(160, 120, 64, 0.4);
  border-radius: 4px;
  padding: 6px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.unit-card:hover {
  background: #f6ead0;
  border-color: #c4a050;
}
.unit-card.turn {
  border: 2px solid #d4af37;
  box-shadow: 0 0 6px rgba(212, 175, 55, 0.35);
  background: #f9edc8;
}

.unit-avatar {
  position: relative;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
}
.avatar-img {
  width: 42px;
  height: 42px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid #a07840;
  background: #f0e2c0;
}
.avatar-fallback {
  width: 42px;
  height: 42px;
  border-radius: 4px;
  border: 1px solid #a07840;
  background: linear-gradient(135deg, #d9c08a, #b09050);
  color: #5a3a08;
  font-size: 1.2em;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  font-size: 0.58em;
  padding: 1px 5px;
  border-radius: 8px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.6);
}
.avatar-badge.ally {
  background: #3a6a2a;
}
.avatar-badge.enemy {
  background: #8a2a1a;
}
.avatar-badge.spirit {
  background: linear-gradient(135deg, #6a3a9a, #4a1e6a);
}

.unit-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.unit-name {
  font-size: 0.88em;
  font-weight: 800;
  color: #3a2718;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.unit-name.dead {
  color: #8a2020;
  text-decoration: line-through;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.bar-label {
  flex-shrink: 0;
  font-size: 0.6em;
  font-weight: 800;
  color: #6a5430;
  width: 20px;
}
.bar-bg {
  flex: 1;
  height: 7px;
  border-radius: 4px;
  background: rgba(90, 60, 30, 0.18);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}
.bar-hp { background: linear-gradient(90deg, #b04030, #d06040); }
.bar-mp { background: linear-gradient(90deg, #2a5a9a, #4070c0); }
.bar-sp { background: linear-gradient(90deg, #9a6a20, #c09030); }
.bar-spirit { background: linear-gradient(90deg, #7a3aa0, #a860d0); }
.bar-num {
  flex-shrink: 0;
  font-size: 0.6em;
  color: #5a4a30;
}

/* 英灵专属 */
.spirit-line {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.spirit-chip {
  font-size: 0.58em;
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid;
}
.spirit-chip.awake {
  color: #5a2a8a;
  background: rgba(120, 60, 160, 0.12);
  border-color: rgba(120, 60, 160, 0.3);
}
.spirit-chip.asleep {
  color: #6a6a6a;
  background: rgba(120, 120, 120, 0.12);
  border-color: rgba(120, 120, 120, 0.28);
}
.spirit-chip.spirit-full {
  color: #8a6a08;
  background: rgba(212, 175, 55, 0.18);
  border-color: rgba(212, 175, 55, 0.4);
  font-weight: 700;
  animation: spirit-pulse 1.2s ease-in-out infinite;
}
@keyframes spirit-pulse {
  0%, 100% { box-shadow: 0 0 0 rgba(212, 175, 55, 0); }
  50% { box-shadow: 0 0 6px rgba(212, 175, 55, 0.55); }
}

.unit-meta {
  display: flex;
  gap: 6px;
  font-size: 0.64em;
  color: #8a6a3a;
}
.meta-def {
  background: rgba(160, 120, 64, 0.15);
  padding: 0 5px;
  border-radius: 3px;
}
.meta-rank {
  background: rgba(90, 120, 160, 0.15);
  padding: 0 5px;
  border-radius: 3px;
}

.unit-status {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.status-chip {
  font-size: 0.58em;
  color: #7a2030;
  background: rgba(160, 40, 60, 0.12);
  border: 1px solid rgba(160, 40, 60, 0.25);
  padding: 0 4px;
  border-radius: 3px;
}

/* 敌人面板 */
.enemy-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ep-line {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: center;
}
.ep-chip {
  font-size: 0.58em;
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid;
}
.ep-kind {
  color: #6a4a1a;
  background: rgba(160, 120, 64, 0.15);
  border-color: rgba(160, 120, 64, 0.3);
}
.ep-race {
  color: #4a5a2a;
  background: rgba(90, 130, 50, 0.12);
  border-color: rgba(90, 130, 50, 0.28);
}
.ep-weak {
  color: #8a2a1a;
  background: rgba(180, 60, 40, 0.12);
  border-color: rgba(180, 60, 40, 0.3);
}
.ep-resist {
  color: #2a4a8a;
  background: rgba(50, 90, 160, 0.12);
  border-color: rgba(50, 90, 160, 0.28);
}
.ep-immune {
  color: #5a3a6a;
  background: rgba(120, 70, 150, 0.12);
  border-color: rgba(120, 70, 150, 0.28);
}
.ep-other {
  color: #6a6a5a;
  background: rgba(120, 120, 100, 0.1);
  border-color: rgba(120, 120, 100, 0.25);
}
.ep-spirit {
  color: #5a2a8a;
  background: rgba(120, 60, 160, 0.1);
  border-color: rgba(120, 60, 160, 0.28);
}
.att-friend {
  color: #2a6a2a;
  background: rgba(60, 140, 60, 0.12);
  border-color: rgba(60, 140, 60, 0.3);
}
.att-neutral {
  color: #6a6a5a;
  background: rgba(120, 120, 100, 0.1);
  border-color: rgba(120, 120, 100, 0.25);
}
.att-wary {
  color: #8a5a10;
  background: rgba(190, 130, 40, 0.12);
  border-color: rgba(190, 130, 40, 0.3);
}
.att-hostile {
  color: #8a1f1f;
  background: rgba(180, 50, 50, 0.12);
  border-color: rgba(180, 50, 50, 0.3);
}
.ep-atk {
  font-size: 0.62em;
  color: #4a2a10;
}
.ep-ability {
  font-size: 0.58em;
  color: #6a4a2a;
  font-style: italic;
}
</style>
