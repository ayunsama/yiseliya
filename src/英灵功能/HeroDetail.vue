<template>
  <div class="hero-detail">
    <!-- 顶部：返回 + 英灵名 -->
    <div class="detail-header">
      <button class="back-btn" @click="store.goBack()" title="返回列表">←</button>
      <div class="detail-title">
        <span class="hero-log-icon">{{ hero.log }}</span>
        <span class="hero-name">{{ hero.displayName }}</span>
        <span v-if="sleeping" class="sleep-chip">💤 沉睡</span>
        <span v-else class="awake-chip">✦ 现界</span>
      </div>
    </div>

    <div class="detail-body">
      <!-- 共鸣/羁绊数值卡 -->
      <div class="stat-card">
        <div class="stat-row">
          <span class="stat-label">残响之力</span>
          <span class="stat-val" :class="{ 'stat-full': hallReso >= 100 }">{{ hallReso }}<em>/100</em></span>
        </div>
        <div class="bar-bg"><i class="bar-fill" :style="{ width: Math.min(100, hallReso) + '%' }"></i></div>
        <div class="stat-row stat-row--sub">
          <span class="stat-label">羁绊</span>
          <span class="stat-val">{{ hallBond }}<em>/100</em></span>
          <span class="stat-label stat-label--right">状态</span>
          <span class="stat-val stat-val--status">{{ statusText }}</span>
        </div>
        <div class="stat-row stat-row--sub">
          <span class="stat-label">执念</span>
          <span class="stat-val">
            {{ obsessionText || '尚未显化' }}
            <span v-if="obsessionDone" class="done-chip">已了结</span>
          </span>
        </div>
        <div v-if="passiveNames.length" class="passive-line">
          <span class="stat-label">生效被动</span>
          <span class="passive-tags">
            <span v-for="p in passiveNames" :key="p" class="passive-tag">{{ p }}</span>
          </span>
        </div>
        <div v-if="skillName" class="skill-line">
          <span class="stat-label">英灵技</span>
          <span class="skill-name">{{ skillName }}</span>
          <span v-if="cooldown > 0" class="cooldown-chip">冷却 {{ cooldown }}</span>
        </div>
      </div>

      <!-- 世界书档案片段（从条目内容轻量提取） -->
      <div v-if="sections.length" class="lore-card">
        <div v-for="sec in sections" :key="sec.title" class="lore-sec">
          <div class="lore-title">{{ sec.title }}</div>
          <div class="lore-body">{{ sec.text }}</div>
        </div>
      </div>

      <div v-if="hero.content === '(空)'" class="empty-hint">该英灵在世界书中暂无详细档案</div>

      <!-- 操作 -->
      <div class="detail-actions">
        <button class="action-btn action-btn--primary" :disabled="sleeping" @click="onTalk">
          {{ sleeping ? '💤 沉睡中，无法交谈' : '开始对话' }}
        </button>
        <button class="action-btn" @click="store.openAnecdotes(hero)">
          回忆碎片 {{ store.anecdoteCountOf(hero) }}/{{ MAX_ANECDOTES }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useHeroSpiritStore, type HeroEntry } from './store';

const props = defineProps<{ hero: HeroEntry }>();
const store = useHeroSpiritStore();
const hero = computed(() => props.hero);
const MAX_ANECDOTES = 8;

const hall = computed(() => store.hallInfo(hero.value.displayName));
const sleeping = computed(() => store.isHeroSleeping(hero.value));
const hallReso = computed(() => Number(hall.value?.残响 ?? 0));
const hallBond = computed(() => Number(hall.value?.羁绊 ?? 0));
const statusText = computed(() => (sleeping.value ? '沉睡' : hall.value?.状态 || '苏醒'));

// 契主英灵时优先读运行时（执念进度/被动/英灵技更完整）
const runtime = computed(() => {
  const s = store.spiritRuntime;
  if (!s?.名称) return null;
  return s.名称.includes(hero.value.displayName) || hero.value.displayName.includes(s.名称) ? s : null;
});
const obsessionText = computed(() => String(runtime.value?.执念?.内容 || hall.value?.执念?.内容 || ''));
const obsessionDone = computed(() => !!runtime.value?.执念?.是否完成 || !!hall.value?.执念完成);
const passiveNames = computed(() => Object.keys(runtime.value?.被动效果 || {}));
const skillName = computed(() => String(runtime.value?.英灵技?.名称 || ''));
const cooldown = computed(() => Number(runtime.value?.英灵技?.冷却 || 0));

/** 从世界书条目的 yaml 风格文本里轻量提取档案片段（提取不到就整段跳过） */
const sections = computed<{ title: string; text: string }[]>(() => {
  const content = hero.value.content || '';
  if (content === '(空)') return [];
  const out: { title: string; text: string }[] = [];

  const single = (key: string): string => {
    const m = content.match(new RegExp(`(?:^|\\n)\\s*${key}:\\s*([^\\n]+)`));
    return m ? m[1].trim() : '';
  };
  const list = (key: string): string => {
    const idx = content.search(new RegExp(`\\n\\s*${key}:\\n`));
    if (idx < 0) return '';
    const rest = content.slice(idx + content.slice(idx).indexOf('\n') + 1);
    const lines: string[] = [];
    for (const line of rest.split('\n')) {
      const m = line.match(/^\s{4,}-\s+(.+)$/);
      if (m) lines.push(m[1].trim());
      else if (lines.length) break;
    }
    return lines.join('；');
  };

  const head = single('身份');
  const era = single('时代');
  const death = single('死因');
  const looks = single('外貌');
  const obsession = single('执念');
  const likes = list('爱好');
  const dislikes = list('厌恶');
  const habits = list('习惯');

  if (head || era || death) {
    out.push({ title: '生前', text: [head, era, death].filter(Boolean).join('｜') });
  }
  if (looks) out.push({ title: '外貌', text: looks });
  if (likes) out.push({ title: '所爱', text: likes });
  if (dislikes) out.push({ title: '所厌', text: dislikes });
  if (habits) out.push({ title: '习惯', text: habits });
  if (obsession) out.push({ title: '执念', text: obsession });
  return out;
});

function onTalk() {
  store.selectHero(hero.value);
}
</script>

<style scoped>
.hero-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: 'Georgia', 'Times New Roman', serif;
  color: #3c2415;
}
.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(139, 90, 43, 0.3);
  background: linear-gradient(180deg, rgba(245, 222, 179, 0.4), transparent);
  flex-shrink: 0;
}
.back-btn {
  border: 1px solid rgba(139, 90, 43, 0.3);
  background: rgba(245, 222, 179, 0.5);
  color: #5c3a1e;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.detail-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.hero-log-icon { font-size: 16px; }
.hero-name { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.sleep-chip {
  font-size: 9px; color: #7a6a9a; background: rgba(120, 100, 160, 0.15);
  border: 1px solid rgba(120, 100, 160, 0.25); border-radius: 999px; padding: 1px 8px;
}
.awake-chip {
  font-size: 9px; color: #4a7c3f; background: rgba(74, 124, 63, 0.12);
  border: 1px solid rgba(74, 124, 63, 0.2); border-radius: 999px; padding: 1px 8px;
}
.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.detail-body::-webkit-scrollbar { width: 3px; }
.detail-body::-webkit-scrollbar-thumb { background: rgba(139, 90, 43, 0.25); border-radius: 2px; }

.stat-card {
  background: linear-gradient(160deg, rgba(60, 36, 21, 0.9), rgba(90, 58, 30, 0.92));
  border: 1px solid rgba(201, 169, 110, 0.5);
  border-radius: 10px;
  padding: 10px 12px;
  color: #e8d5ad;
  box-shadow: 0 2px 10px rgba(60, 36, 21, 0.2), inset 0 0 18px rgba(245, 222, 179, 0.05);
}
.stat-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.stat-row--sub { margin-bottom: 3px; }
.stat-label { font-size: 11px; color: #c8b08a; letter-spacing: 1px; }
.stat-label--right { margin-left: auto; }
.stat-val { font-size: 13px; font-weight: 700; color: #ffe9b0; }
.stat-val em { font-size: 9px; font-style: normal; opacity: 0.6; }
.stat-full { color: #f6d96a; }
.stat-val--status { font-size: 11px; }
.bar-bg { height: 8px; border-radius: 4px; background: rgba(20, 12, 6, 0.6); border: 1px solid rgba(201, 169, 110, 0.3); overflow: hidden; margin-bottom: 6px; }
.bar-fill { display: block; height: 100%; background: linear-gradient(90deg, #8a5f34, #d8b070, #f0d48a); border-radius: 4px; transition: width 0.6s ease; }
.done-chip { font-size: 9px; color: #9fdf9f; border: 1px solid rgba(120, 200, 120, 0.5); border-radius: 999px; padding: 0 6px; margin-left: 4px; }
.passive-line, .skill-line { display: flex; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.passive-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.passive-tag { font-size: 9px; color: #f0d48a; background: rgba(201, 169, 110, 0.14); border: 1px solid rgba(201, 169, 110, 0.35); border-radius: 9px; padding: 1px 8px; }
.skill-name { font-size: 12px; font-weight: 700; color: #ffe9b0; }
.cooldown-chip { font-size: 9px; color: #e8a878; border: 1px dashed rgba(232, 168, 120, 0.5); border-radius: 8px; padding: 0 6px; }

.lore-card {
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.6), rgba(240, 220, 190, 0.4));
  border: 1px solid rgba(139, 90, 43, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lore-title { font-size: 11px; font-weight: 700; color: #8b6914; letter-spacing: 2px; }
.lore-body { font-size: 12px; line-height: 1.6; color: #4a2e14; white-space: pre-wrap; }
.empty-hint { font-size: 11px; color: #b8a58a; font-style: italic; text-align: center; padding: 8px 0; }

.detail-actions { display: flex; gap: 8px; margin-top: 2px; }
.action-btn {
  flex: 1;
  font-family: 'Georgia', serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #3c2415;
  background: linear-gradient(180deg, #f5deb3, #d8b070);
  border: 1px solid #8a5f34;
  border-radius: 8px;
  padding: 7px 10px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
}
.action-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(240, 212, 138, 0.4); }
.action-btn--primary { background: linear-gradient(180deg, #e6c98f, #c9a96e); }
.action-btn:disabled { filter: grayscale(0.6) brightness(0.9); cursor: not-allowed; }

@media (max-width: 480px) {
  .detail-header { padding: 5px 8px; }
  .hero-name { font-size: 13px; }
}
</style>
