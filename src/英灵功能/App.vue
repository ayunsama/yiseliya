<template>
  <!-- 折叠状态：精美悬浮球（非截取界面） -->
  <div v-if="!panelState.expanded" class="floating-ball" data-drag-handle="1">
    <div class="ball-outer-ring"></div>
    <div class="ball-glow"></div>
    <div class="ball-core">
      <span class="ball-rune">✦</span>
    </div>
    <div class="ball-sparkle ball-sparkle--1"></div>
    <div class="ball-sparkle ball-sparkle--2"></div>
    <div class="ball-sparkle ball-sparkle--3"></div>
  </div>

  <!-- 展开状态：完整面板 -->
  <div v-else class="parchment-panel">
    <div class="parchment-border-top"></div>

    <div class="panel-header" data-drag-handle="1">
      <div class="header-ornament-left">❧</div>
      <div class="header-title">
        <span class="title-icon">✦</span>
        <span class="title-text">英灵殿</span>
      </div>
      <div class="header-ornament-right">❧</div>
    </div>

    <!-- 标签切换栏 -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': store.activeTab === 'heroes' }"
        @click="store.switchTab('heroes')"
      >
        <span class="tab-icon">✦</span>
        <span class="tab-label">英灵殿</span>
        <span class="tab-count">{{ store.heroes.length }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': store.activeTab === 'companions' }"
        @click="store.switchTab('companions')"
      >
        <span class="tab-icon">🧑</span>
        <span class="tab-label">同伴</span>
        <span class="tab-count">{{ store.companions.length }}</span>
      </button>
    </div>

    <div v-if="store.viewMode === 'list'" class="panel-content">
      <div class="refresh-bar">
        <button class="parchment-btn refresh-btn" @click="onRefresh">
          <span class="btn-icon">⟳</span>
          <span class="btn-text">刷新列表</span>
        </button>
      </div>

      <!-- 英灵殿列表 -->
      <div v-if="store.activeTab === 'heroes'">
        <div class="hero-list">
          <div
            v-for="hero in store.heroes"
            :key="hero.uid"
            class="hero-card"
            :class="{ 'hero-card--disabled': !hero.enabled }"
            @click="store.selectHero(hero)"
          >
            <div class="hero-card-icon">
              <span class="hero-log">{{ hero.log }}</span>
            </div>
            <div class="hero-card-info">
              <div class="hero-card-name">{{ hero.displayName }}</div>
              <div class="hero-card-status">
                <span class="status-badge" :class="hero.enabled ? 'status-on' : 'status-off'">
                  {{ hero.enabled ? '现界' : '沉寂' }}
                </span>
                <span v-if="hallOf(hero)?.状态 === '沉睡'" class="status-badge status-sleep">沉睡</span>
              </div>
              <div class="hero-card-stats">
                <span class="mini-stat" :class="{ 'mini-stat--full': hallOf(hero)?.残响 >= 100 }">
                  残响 {{ hallOf(hero)?.残响 ?? '—' }}
                </span>
                <span class="mini-stat">羁绊 {{ hallOf(hero)?.羁绊 ?? '—' }}</span>
              </div>
            </div>
            <div class="hero-card-arrow">→</div>
          </div>
        </div>
        <div v-if="store.heroes.length === 0" class="empty-state">
          <div class="empty-rune">✙</div>
          <p class="empty-desc">未检测到伊瑟利亚世界书中的英灵条目</p>
          <p class="empty-hint">请确保世界书「伊瑟利亚」已启用并包含英灵条目</p>
        </div>
      </div>

      <!-- 同伴列表 -->
      <div v-else>
        <div class="hero-list">
          <div
            v-for="hero in store.companions"
            :key="hero.uid"
            class="hero-card hero-card--companion"
            @click="store.selectHero(hero)"
          >
            <div class="hero-card-icon">
              <span class="hero-log">{{ hero.log }}</span>
            </div>
            <div class="hero-card-info">
              <div class="hero-card-name">
                {{ hero.displayName }}
                <span class="companion-tag">同伴</span>
              </div>
              <div class="hero-card-status">
                <span class="status-badge status-on">同行</span>
              </div>
            </div>
            <div class="hero-card-arrow">→</div>
          </div>
        </div>
        <div v-if="store.companions.length === 0" class="empty-state">
          <div class="empty-rune">✙</div>
          <p class="empty-desc">暂无同伴</p>
          <p class="empty-hint">stat_data.同伴 中无数据</p>
        </div>
      </div>
    </div>

    <div v-else-if="store.viewMode === 'chat'" class="panel-content panel-content--full">
      <HeroChat />
    </div>

    <div class="panel-footer">
      <span class="footer-text">✦ 英灵殿 · 永世长存 ✦</span>
    </div>
    <div class="parchment-border-bottom"></div>
  </div>
</template>

<script setup lang="ts">
import HeroChat from './HeroChat.vue';
import { useHeroSpiritStore } from './store';

defineProps<{
  panelState: { expanded: boolean; collapsed: boolean };
}>();

const store = useHeroSpiritStore();

/** 查询英灵的英灵殿档案（残响/羁绊/状态） */
function hallOf(hero: { displayName?: string }) {
  return store.hallInfo(hero.displayName || '');
}

async function onRefresh() {
  await store.loadHeroesFromWorldbook();
  store.refreshSpiritRuntime();
}
</script>

<style scoped>
/* ============================================================
   悬浮球 - 精美魔法圆球（折叠状态）
   ============================================================ */

.floating-ball {
  width: 56px;
  height: 56px;
  position: relative;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(245, 222, 179, 0.9), rgba(201, 169, 110, 0.6) 40%, rgba(139, 90, 43, 0.4) 80%, rgba(100, 60, 20, 0.3));
  box-shadow:
    0 6px 24px rgba(139, 90, 43, 0.45),
    0 0 0 3px rgba(201, 169, 110, 0.15),
    inset 0 2px 4px rgba(255, 248, 230, 0.3);
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  display: grid;
  place-items: center;
  transition: box-shadow 0.2s ease;
}
.floating-ball:active {
  cursor: grabbing;
  box-shadow:
    0 3px 12px rgba(139, 90, 43, 0.5),
    0 0 0 3px rgba(201, 169, 110, 0.2),
    inset 0 2px 4px rgba(255, 248, 230, 0.2);
}
.floating-ball {
  touch-action: none;
}

/* 外层光环 */
.ball-outer-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1.5px solid rgba(201, 169, 110, 0.2);
  pointer-events: none;
  animation: ballRingPulse 3s ease-in-out infinite;
}
@keyframes ballRingPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.04); }
}

/* 发光层 */
.ball-glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, rgba(255, 248, 230, 0.35) 0%, transparent 60%);
  pointer-events: none;
}

/* 核心 */
.ball-core {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 35% 30%, rgba(245, 222, 179, 0.6), rgba(200, 160, 100, 0.3));
  border: 1px solid rgba(255, 248, 230, 0.3);
  box-shadow: inset 0 1px 3px rgba(255,255,255,0.2);
  z-index: 1;
  pointer-events: none;
}

.ball-rune {
  font-size: 20px;
  line-height: 1;
  color: #c9a96e;
  text-shadow:
    0 0 8px rgba(201, 169, 110, 0.5),
    0 1px 2px rgba(0,0,0,0.2);
  animation: ballRuneGlow 2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes ballRuneGlow {
  0%, 100% { text-shadow: 0 0 8px rgba(201, 169, 110, 0.5), 0 1px 2px rgba(0,0,0,0.2); }
  50% { text-shadow: 0 0 16px rgba(201, 169, 110, 0.8), 0 0 24px rgba(201, 169, 110, 0.3), 0 1px 2px rgba(0,0,0,0.2); }
}

/* 闪烁光点 */
.ball-sparkle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 248, 230, 0.6);
  pointer-events: none;
  animation: sparkleFloat 3s ease-in-out infinite;
}
.ball-sparkle--1 { top: 8px; left: 10px; animation-delay: 0s; }
.ball-sparkle--2 { top: 14px; right: 8px; animation-delay: 1s; width: 3px; height: 3px; }
.ball-sparkle--3 { bottom: 10px; left: 14px; animation-delay: 2s; }

@keyframes sparkleFloat {
  0%, 100% { opacity: 0; transform: translateY(0); }
  30% { opacity: 1; }
  60% { opacity: 0.6; }
  100% { opacity: 0; transform: translateY(-4px); }
}

/* ============================================================
   羊皮纸风格面板 - 日式西幻主题
   ============================================================ */

.parchment-panel {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(ellipse at 50% 30%, rgba(255, 235, 200, 0.25) 0%, transparent 60%),
    radial-gradient(ellipse at 30% 20%, rgba(255, 248, 230, 0.5) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(230, 200, 160, 0.3) 0%, transparent 50%),
    linear-gradient(180deg,
      #f5e8c8 0%,
      #ede0b8 25%,
      #e8dbb0 50%,
      #ede0b8 75%,
      #f0e0b8 100%
    );
  border: 2px solid rgba(139, 90, 43, 0.3);
  border-radius: 14px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.2),
    0 0 0 4px rgba(139, 90, 43, 0.08),
    inset 0 0 50px rgba(139, 90, 43, 0.1);
  position: relative;
  color: #3c2415;
  font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 顶部/底部羊皮纸卷边装饰 */
.parchment-border-top,
.parchment-border-bottom {
  height: 8px;
  flex-shrink: 0;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 4px,
      rgba(139, 90, 43, 0.12) 4px,
      rgba(139, 90, 43, 0.12) 6px
    ),
    linear-gradient(
      90deg,
      rgba(139, 90, 43, 0.15) 0%,
      rgba(139, 90, 43, 0.04) 20%,
      rgba(139, 90, 43, 0.04) 80%,
      rgba(139, 90, 43, 0.15) 100%
    );
}
.parchment-border-top {
  border-radius: 12px 12px 0 0;
}
.parchment-border-bottom {
  border-radius: 0 0 12px 12px;
}

/* ---- 标题栏 ---- */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 12px 4px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}
.panel-header:active {
  cursor: grabbing;
}
.panel-header {
  touch-action: none;
}

.header-ornament-left,
.header-ornament-right {
  font-size: 14px;
  color: #a0845c;
  opacity: 0.6;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-icon {
  font-size: 18px;
  color: #c9a96e;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.title-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #3c2415;
  text-shadow: 0 1px 1px rgba(255,255,255,0.3);
}

/* ---- 副标题 ---- */
.panel-subtitle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px 4px;
  flex-shrink: 0;
}
.subtitle-line {
  width: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(139, 90, 43, 0.3));
}
.subtitle-text {
  font-size: 9px;
  color: #8b7355;
  letter-spacing: 2px;
  white-space: nowrap;
  font-style: italic;
}

/* ---- 内容区（圆形内部滚动） ---- */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 12px;
  scroll-behavior: smooth;
  min-height: 0;
}
.panel-content--full {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-content::-webkit-scrollbar {
  width: 3px;
}
.panel-content::-webkit-scrollbar-track {
  background: transparent;
}
.panel-content::-webkit-scrollbar-thumb {
  background: rgba(139, 90, 43, 0.25);
  border-radius: 2px;
}

/* ---- 刷新按钮 ---- */
.refresh-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.parchment-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border: 1px solid rgba(139, 90, 43, 0.3);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(245, 222, 179, 0.8), rgba(220, 190, 150, 0.6));
  color: #5c3a1e;
  font-family: 'Georgia', serif;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.parchment-btn:hover {
  background: linear-gradient(180deg, rgba(250, 230, 190, 0.9), rgba(230, 200, 160, 0.7));
  border-color: rgba(139, 90, 43, 0.5);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}
.btn-icon {
  font-size: 14px;
}

/* ---- 英灵卡片列表 ---- */
.hero-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(139, 90, 43, 0.2);
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.6), rgba(240, 220, 190, 0.4));
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.hero-card:hover {
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.8), rgba(240, 220, 190, 0.6));
  border-color: rgba(139, 90, 43, 0.4);
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.hero-card--disabled {
  opacity: 0.5;
  cursor: default;
}
.hero-card--disabled:hover {
  transform: none;
  box-shadow: none;
}
.hero-card--companion .hero-card-icon {
  background: linear-gradient(135deg, rgba(160,180,220,0.3), rgba(100,130,180,0.15));
  border-color: rgba(100,130,180,0.3);
}
.companion-tag {
  display: inline-block;
  font-size: 8px;
  padding: 0 5px;
  border-radius: 4px;
  background: rgba(100,130,180,0.15);
  color: #5a7a9a;
  border: 1px solid rgba(100,130,180,0.2);
  margin-left: 4px;
  vertical-align: middle;
  letter-spacing: 0.5px;
}

.hero-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(201, 169, 110, 0.3), rgba(139, 90, 43, 0.15));
  border: 1px solid rgba(139, 90, 43, 0.2);
  flex-shrink: 0;
}
.hero-log {
  font-size: 18px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));
}

.hero-card-info {
  flex: 1;
  min-width: 0;
}
.hero-card-name {
  font-size: 14px;
  font-weight: 700;
  color: #3c2415;
  letter-spacing: 0.5px;
}
.hero-card-status {
  margin-top: 2px;
}
.status-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1px;
}
.status-on {
  background: rgba(74, 124, 63, 0.15);
  color: #4a7c3f;
  border: 1px solid rgba(74, 124, 63, 0.2);
}
.status-off {
  background: rgba(120, 120, 120, 0.15);
  color: #7a7a7a;
  border: 1px solid rgba(120, 120, 120, 0.2);
}
.status-sleep {
  background: rgba(120, 100, 160, 0.15);
  color: #7a6a9a;
  border: 1px solid rgba(120, 100, 160, 0.25);
}

/* 英灵殿档案迷你数值（英灵共鸣系统 v2） */
.hero-card-stats {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.mini-stat {
  font-size: 9px;
  color: #8b7355;
  background: rgba(201, 169, 110, 0.1);
  border: 1px solid rgba(139, 90, 43, 0.18);
  border-radius: 4px;
  padding: 0 6px;
  line-height: 1.6;
  letter-spacing: 0.3px;
}
.mini-stat--full {
  color: #8a6a10;
  background: rgba(240, 212, 138, 0.25);
  border-color: rgba(201, 169, 110, 0.5);
  font-weight: 700;
}

.hero-card-arrow {
  font-size: 14px;
  color: #a0845c;
  opacity: 0.4;
}

/* ---- 空状态 ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px;
  text-align: center;
}
.empty-rune {
  font-size: 28px;
  color: #a0845c;
  opacity: 0.3;
  margin-bottom: 8px;
}
.empty-desc {
  font-size: 13px;
  color: #8b7355;
  margin: 0;
}
.empty-hint {
  font-size: 11px;
  color: #b8a58a;
  margin: 4px 0 0;
  font-style: italic;
}

/* ---- 标签切换栏 ---- */
.tab-bar {
  display: flex;
  gap: 6px;
  padding: 4px 12px 0;
  flex-shrink: 0;
}
.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(139, 90, 43, 0.2);
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, rgba(245, 222, 179, 0.3), rgba(220, 190, 150, 0.15));
  color: #6a4a2a;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.tab-btn:hover {
  background: linear-gradient(180deg, rgba(245, 222, 179, 0.5), rgba(220, 190, 150, 0.3));
}
.tab-btn--active {
  background: linear-gradient(180deg, rgba(255, 248, 235, 0.9), rgba(245, 222, 179, 0.6));
  border-color: rgba(139, 90, 43, 0.35);
  border-bottom-color: transparent;
  font-weight: 700;
  color: #3c2415;
  box-shadow: 0 -2px 6px rgba(139, 90, 43, 0.08);
}
.tab-icon {
  font-size: 15px;
  line-height: 1;
}
.tab-count {
  font-size: 10px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(139, 90, 43, 0.12);
  color: #8b7355;
  line-height: 1.6;
  min-width: 16px;
  text-align: center;
}
.tab-btn--active .tab-count {
  background: rgba(139, 90, 43, 0.2);
  color: #5c3a1e;
}

/* ---- 底部 ---- */
.panel-footer {
  text-align: center;
  padding: 2px 12px 8px;
  flex-shrink: 0;
}
.footer-text {
  font-size: 8px;
  color: #a0845c;
  letter-spacing: 2px;
  opacity: 0.4;
}

/* ============================================================
   手机端响应式适配
   ============================================================ */
@media (max-width: 480px) {
  .panel-header {
    padding: 6px 8px 2px;
    gap: 8px;
  }
  .title-text {
    font-size: 14px;
    letter-spacing: 2px;
  }
  .header-ornament-left,
  .header-ornament-right {
    font-size: 10px;
  }
  .panel-subtitle {
    padding: 0 10px 2px;
  }
  .subtitle-text {
    font-size: 8px;
  }
  .panel-content {
    padding: 0 12px 8px;
  }
  .hero-card {
    padding: 8px 10px;
  }
  .panel-footer {
    padding: 2px 8px 4px;
  }
}
</style>
