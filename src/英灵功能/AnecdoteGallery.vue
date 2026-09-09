<template>
  <div class="gallery-overlay" @click.self="store.closeAnecdotes()">
    <div class="gallery-panel">
      <div class="gallery-header">
        <button class="gallery-back" @click="store.closeAnecdotes()" title="关闭">✕</button>
        <div class="gallery-title">
          <span class="gallery-log">{{ hero.log }}</span>
          <span>回忆碎片 · {{ hero.displayName }}</span>
          <span class="gallery-count">{{ list.length }}/{{ MAX_ANECDOTES }}</span>
        </div>
      </div>

      <div class="gallery-body">
        <!-- 已解锁 -->
        <div
          v-for="(a, i) in list"
          :key="i"
          class="frag-card"
          :class="{ 'frag-card--open': openIdx === i }"
          @click="openIdx = openIdx === i ? -1 : i"
        >
          <div class="frag-head">
            <span class="frag-title">《{{ a.title }}》</span>
            <span class="frag-angle">{{ a.angle }}</span>
          </div>
          <div v-if="openIdx === i" class="frag-text">{{ a.text }}</div>
          <div v-else class="frag-veil">点开细读…</div>
        </div>

        <!-- 未解锁（剪影槽位） -->
        <div v-for="n in (MAX_ANECDOTES - list.length)" :key="'lock' + n" class="frag-card frag-card--locked">
          <div class="frag-lock">✦</div>
          <div class="frag-lock-text">羁绊更深时，她会讲起这段过往…</div>
        </div>

        <div v-if="list.length === 0" class="gallery-empty">
          <div class="empty-seal">✧</div>
          <p>她还没向你提起过任何往事。</p>
          <p class="empty-hint">点击下方按钮，听她讲一段生前记忆</p>
        </div>
      </div>

      <div class="gallery-footer">
        <button
          class="listen-btn"
          :disabled="store.anecdoteLoading || list.length >= MAX_ANECDOTES || store.isHeroSleeping(hero)"
          @click="onListen"
        >
          {{ store.anecdoteLoading ? '… 她正在回忆' : list.length >= MAX_ANECDOTES ? '碎片已集齐' : '✦ 听一段往事' }}
        </button>
        <div v-if="bondTip" class="bond-tip">{{ bondTip }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useHeroSpiritStore, type HeroEntry } from './store';

const props = defineProps<{ hero: HeroEntry }>();
const store = useHeroSpiritStore();
const hero = computed(() => props.hero);
const MAX_ANECDOTES = 8;

const openIdx = ref(-1);
const list = computed(() => store.anecdoteListOf(hero.value));

const bondTip = computed(() => {
  const tier = store.bondTierOf(hero.value);
  if (tier === 0) return '羁绊尚浅 · 只能听到日常趣事';
  if (tier === 1) return '羁绊渐深 · 她开始谈起故人与遗憾';
  return '羁绊深厚 · 她愿意说出心底的秘密';
});

async function onListen() {
  const r = await store.generateAnecdote(hero.value);
  if (!r.ok && r.msg) store.closeAnecdotes(); // 失败/异常时收起画廊，错误经 toastr 提示
}
</script>

<style scoped>
.gallery-overlay {
  position: absolute;
  inset: 0;
  background: rgba(30, 20, 10, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  border-radius: 14px;
}
.gallery-panel {
  width: 88%;
  max-width: 420px;
  max-height: 86%;
  background:
    radial-gradient(ellipse at 50% 20%, rgba(255, 235, 200, 0.2), transparent 60%),
    linear-gradient(180deg, #f5e8c8, #e8dbb0);
  border: 2px solid rgba(139, 90, 43, 0.4);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Georgia', 'Times New Roman', serif;
  color: #3c2415;
}
.gallery-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px;
  flex-shrink: 0;
}
.gallery-back {
  border: 1px solid rgba(139, 90, 43, 0.3);
  background: rgba(245, 222, 179, 0.5);
  color: #5c3a1e;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
}
.gallery-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
}
.gallery-log { font-size: 15px; }
.gallery-count {
  font-size: 10px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(139, 90, 43, 0.15);
  color: #8b7355;
  margin-left: auto;
}
.gallery-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 0;
}
.gallery-body::-webkit-scrollbar { width: 3px; }
.gallery-body::-webkit-scrollbar-thumb { background: rgba(139, 90, 43, 0.3); border-radius: 2px; }

.frag-card {
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.75), rgba(240, 220, 190, 0.5));
  border: 1px solid rgba(139, 90, 43, 0.25);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.frag-card:hover { border-color: rgba(139, 90, 43, 0.5); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.frag-head { display: flex; align-items: center; gap: 8px; }
.frag-title { font-size: 13px; font-weight: 700; color: #5c3a1e; }
.frag-angle { font-size: 9px; color: #8b7355; background: rgba(201, 169, 110, 0.15); border-radius: 4px; padding: 0 6px; }
.frag-veil { font-size: 10px; color: #b8a58a; font-style: italic; margin-top: 4px; }
.frag-text {
  font-size: 12px;
  line-height: 1.65;
  color: #4a2e14;
  white-space: pre-wrap;
  margin-top: 6px;
  border-top: 1px dashed rgba(139, 90, 43, 0.25);
  padding-top: 6px;
}
.frag-card--locked {
  background: repeating-linear-gradient(45deg, rgba(200, 175, 140, 0.12) 0 8px, rgba(200, 175, 140, 0.04) 8px 16px);
  border-style: dashed;
  cursor: default;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}
.frag-card--locked:hover { border-color: rgba(139, 90, 43, 0.3); box-shadow: none; }
.frag-lock { font-size: 13px; color: #a0845c; opacity: 0.5; }
.frag-lock-text { font-size: 10px; color: #a78d6a; font-style: italic; }

.gallery-empty { text-align: center; padding: 18px 8px; color: #8b7355; }
.empty-seal { font-size: 26px; color: #a0845c; opacity: 0.4; margin-bottom: 6px; }
.empty-hint { font-size: 10px; font-style: italic; margin-top: 4px; }

.gallery-footer {
  padding: 8px 12px 12px;
  border-top: 1px solid rgba(139, 90, 43, 0.2);
  flex-shrink: 0;
}
.listen-btn {
  width: 100%;
  font-family: 'Georgia', serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #3c2415;
  background: linear-gradient(180deg, #f5deb3, #d8b070);
  border: 1px solid #8a5f34;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
}
.listen-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(240, 212, 138, 0.45); }
.listen-btn:disabled { filter: grayscale(0.6) brightness(0.9); cursor: not-allowed; }
.bond-tip { font-size: 10px; color: #8b7355; text-align: center; margin-top: 6px; font-style: italic; }
</style>
