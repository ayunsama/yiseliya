<template>
  <div class="archive-dossier">
    <section class="dossier-hero">
      <div class="hero-badge-wrap">
        <div class="hero-badge">📜</div>
        <div class="hero-copy">
          <h2>伊瑟利亚档案卷</h2>
          <p>把人物线、支线与未解决问题收纳为一份可追溯的剧情档案。</p>
        </div>
      </div>
      <div class="hero-status">
        <span class="hero-pill" :class="store.settings.autoGenerate ? 'hero-pill--on' : ''">
          {{ store.settings.autoGenerate ? '自动摘要已开' : '手动摘要' }}
        </span>
        <span class="hero-pill hero-pill--accent">{{ statusLabel }}</span>
        <button class="hero-action" type="button" @click.stop="collapsed = !collapsed">
          {{ collapsed ? '展开档案' : '收起档案' }}
        </button>
      </div>
    </section>

    <div v-show="!collapsed" class="dossier-body">
      <aside class="dossier-sidebar">
        <section class="dossier-card dossier-card--strong">
          <div class="section-title">档案入口</div>
          <div class="action-stack">
            <button class="primary-action" type="button" :disabled="store.loading" @click="onGenerateSummary">
              {{ store.loading ? '整理中...' : '📜 生成剧情总结' }}
            </button>
            <button class="secondary-action" type="button" :disabled="store.bigLoading || store.blocks.length === 0" @click="onGenerateBigSummary">
              {{ store.bigLoading ? '归档中...' : '📚 生成历史总纲' }}
            </button>
          </div>
          <div class="meta-list">
            <div class="meta-row">
              <span>当前指针</span>
              <strong>第 {{ store.pointers.summary }} 楼</strong>
            </div>
            <div class="meta-row">
              <span>总纲指针</span>
              <strong>第 {{ store.pointers.big }} 楼</strong>
            </div>
            <div class="meta-row">
              <span>已收录分块</span>
              <strong>{{ store.blocks.length }} 份</strong>
            </div>
          </div>
        </section>

        <section class="dossier-card">
          <div class="section-title">摘要配置</div>
          <div class="field-block">
            <label class="field-label">总结范围</label>
            <select v-model.number="store.settings.analysisDepth" @change="onSettingsChange" class="field-input">
              <option v-for="d in depthOptions" :key="d" :value="d">每批 {{ d }} 楼</option>
            </select>
          </div>
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.autoGenerate" @change="onAutoToggle" />
            <span>自动小总结 · 每 {{ store.settings.autoInterval }} 楼</span>
          </label>
          <div v-if="store.settings.autoGenerate" class="inline-form">
            <input v-model.number="store.settings.autoInterval" @change="onSettingsChange" type="number" min="5" max="200" class="field-input field-input--short" />
            <label class="toggle-row toggle-inline">
              <input type="checkbox" :checked="store.settings.autoRunMode === 'confirm'" @change="onRunModeToggle" />
              <span>需确认</span>
            </label>
          </div>
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.bigGenerate" @change="onBigToggle" />
            <span>自动大总结 · 每 {{ store.settings.bigInterval }} 楼</span>
          </label>
          <div v-if="store.settings.bigGenerate" class="inline-form">
            <input v-model.number="store.settings.bigInterval" @change="onSettingsChange" type="number" min="20" max="500" class="field-input field-input--short" />
          </div>
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.hideFloors" @change="onHideFloorsToggle" />
            <span>总结后隐藏楼层</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.plannerLink" @change="onPlannerLinkToggle" />
            <span>联动剧情规划</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.incrementalMode" @change="onIncrementalToggle" />
            <span>逐层增量总结</span>
          </label>
        </section>

        <section class="dossier-card">
          <div class="section-title">归档状态</div>
          <div class="status-box">
            <div class="status-line">注入模式 · 不构建世界书</div>
            <div class="status-line">主线 {{ mainBlocks.length }} · 支线 {{ branchBlocks.length }}</div>
            <div class="status-line" v-if="store.bigSummaries.length > 0">历史总纲 {{ store.bigSummaries.length }} 份</div>
          </div>
        </section>
      </aside>

      <main class="dossier-main">
        <section class="dossier-card dossier-card--wide">
          <div class="section-title">提示词与模型</div>
          <div class="field-block">
            <label class="field-label">总结提示词</label>
            <div class="inline-actions">
              <button class="ghost-btn" type="button" @click="onResetPrompt">恢复默认</button>
            </div>
            <textarea v-model="store.settings.systemPrompt" @change="onSettingsChange" rows="6" class="prompt-textarea" />
          </div>
          <div class="api-grid">
            <div class="field-block">
              <label class="field-label">API 地址（可选）</label>
              <input v-model="store.settings.apiUrl" @change="onSettingsChange" placeholder="留空使用酒馆默认" class="field-input" />
            </div>
            <div class="field-block">
              <label class="field-label">API 密钥</label>
              <input v-model="store.settings.apiKey" @change="onSettingsChange" type="password" placeholder="外部 API 密钥" class="field-input" />
            </div>
            <div class="field-block field-block--full">
              <div class="inline-actions">
                <label class="field-label">模型</label>
                <button class="ghost-btn" type="button" :disabled="store.fetchingModels || !store.settings.apiUrl" @click="onFetchModels">
                  {{ store.fetchingModels ? '获取中...' : '⟳ 刷新' }}
                </button>
              </div>
              <div class="model-select-row">
                <select v-model="store.settings.model" @change="onSettingsChange" class="field-input">
                  <option value="">留空使用酒馆默认</option>
                  <option v-for="m in store.modelList" :key="m" :value="m">{{ m }}</option>
                </select>
                <span class="model-count" v-if="store.modelList.length > 0">{{ store.modelList.length }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="dossier-card dossier-card--wide">
          <div class="section-title">归档范围</div>
          <div class="range-row">
            <input v-model.number="rangeFrom" type="number" min="1" class="field-input field-input--short" placeholder="从" />
            <span class="range-sep">~</span>
            <input v-model.number="rangeTo" type="number" min="1" class="field-input field-input--short" placeholder="到" />
            <button class="ghost-btn" type="button" :disabled="store.loading" @click="onSummarizeRange">📌 总结该范围</button>
            <button class="ghost-btn" type="button" :disabled="store.loading || coverage.unsummarized <= 0" @click="onSummarizeAll">🔄 总结全部未总结</button>
          </div>
          <label class="toggle-row">
            <input type="checkbox" v-model="rangeOverwrite" />
            <span>覆盖重写已总结楼层</span>
          </label>
          <div class="status-line status-line--muted">已总结至第 {{ coverage.covered }} 楼 · 最新第 {{ coverage.lastId < 0 ? '—' : coverage.lastId }} 楼 · 未总结 {{ coverage.unsummarized }} 楼</div>
        </section>

        <section v-if="store.smallLog.length > 0" class="dossier-card dossier-card--wide">
          <div class="section-title">最近小总结</div>
          <div class="small-summary-list">
            <div v-for="s in store.smallLog.slice(-5).reverse()" :key="s.floorStart + '-' + s.floorEnd" class="small-summary-item">
              <span class="ss-floor">第{{ s.floorStart }}-{{ s.floorEnd }}楼</span>
              <span class="ss-text">{{ s.preview ? truncate(s.preview, 50) : ('支线 ' + s.branchCount + ' 条') }}</span>
              <button class="ghost-btn ghost-btn--mini" type="button" :disabled="store.loading" @click="onRegenerate(s.floorStart)">↻ 重总结</button>
            </div>
          </div>
        </section>

        <section v-if="store.blocks.length > 0" class="dossier-card dossier-card--wide">
          <div class="section-title">剧情档案</div>
          <div class="archive-shell">
            <div class="archive-timeline">
              <div v-for="b in store.blocks" :key="b.id" class="timeline-item">
                <div class="timeline-meta">
                  <div class="timeline-floor">第{{ b.floorStart }}-{{ b.floorEnd }}楼</div>
                  <div class="timeline-type">{{ b.kind === 'main' ? '主线' : '支线' }}</div>
                </div>
              </div>
            </div>
            <div class="archive-content">
              <div v-for="b in store.blocks" :key="b.id" class="archive-card">
                <div class="archive-card-head">
                  <span class="archive-badge">{{ b.kind === 'main' ? '主线' : '支线' }}</span>
                  <span class="archive-title">{{ b.kind === 'main' ? '【主线总结】' : '【支线总结：' + b.character + '】' }}</span>
                </div>
                <div class="archive-text">{{ b.content }}</div>
                <div v-if="b.unresolved" class="archive-unresolved">⚠ {{ b.unresolved }}</div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="store.bigSummaries.length > 0" class="dossier-card dossier-card--wide">
          <div class="section-title">最新历史总纲</div>
          <div class="preview-body">{{ bigSummaryText }}</div>
        </section>

        <div v-if="store.error" class="panel-error">{{ store.error }}</div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* 总结助手 · 羊皮纸主题（与工作台壳统一） */
.archive-dossier {
  width: 100%;
  color: #3a2c15;
  display: flex;
  flex-direction: column;
  gap: 10px;
  container-type: inline-size;
}
.dossier-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #5d4322, #7a5a2c 75%, #8a6a36);
  border: 1px solid rgba(184, 134, 11, 0.65);
  box-shadow: 0 4px 12px rgba(90, 62, 20, 0.3), inset 0 1px 0 rgba(255, 235, 180, 0.25);
  color: #ffedc4;
}
.hero-badge-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.hero-badge {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 21px;
  background: rgba(255, 217, 122, 0.18);
  border: 1px solid rgba(255, 217, 122, 0.4);
  flex: 0 0 auto;
}
.hero-copy h2 {
  margin: 0;
  font-size: 17px;
  color: #ffd97a;
  letter-spacing: 1px;
}
.hero-copy p {
  margin: 3px 0 0;
  font-size: 11px;
  color: rgba(255, 237, 196, 0.75);
}
.hero-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.hero-pill {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(255, 237, 196, 0.12);
  color: rgba(255, 237, 196, 0.85);
  border: 1px solid rgba(255, 237, 196, 0.22);
}
.hero-pill--on {
  color: #ffe9b8;
  background: rgba(255, 217, 122, 0.22);
  border-color: rgba(255, 217, 122, 0.45);
}
.hero-pill--accent {
  color: #ffd97a;
  background: rgba(255, 200, 70, 0.16);
  border-color: rgba(255, 217, 122, 0.4);
}
.hero-action,
.ghost-btn,
.primary-action,
.secondary-action {
  border: 0;
  cursor: pointer;
  font-size: 11px;
  border-radius: 999px;
}
.hero-action {
  padding: 6px 11px;
  color: #3a2c15;
  background: #ffd97a;
  font-weight: 700;
}
.hero-action:hover { filter: brightness(1.06); }
.dossier-body {
  display: grid;
  grid-template-columns: minmax(200px, 232px) minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.dossier-sidebar,
.dossier-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dossier-card {
  padding: 11px 12px 12px;
  border-radius: 12px;
  background: rgba(255, 252, 243, 0.75);
  border: 1px solid rgba(122, 90, 44, 0.28);
  box-shadow: 0 1px 4px rgba(90, 62, 20, 0.08);
}
.dossier-card--strong {
  background: linear-gradient(160deg, rgba(255, 240, 200, 0.95), rgba(250, 226, 168, 0.8));
  border-color: rgba(184, 134, 11, 0.45);
}
.dossier-card--wide {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #8a6a36;
}
.action-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.primary-action,
.secondary-action {
  width: 100%;
  padding: 8px 10px;
  color: #fff8e8;
  font-weight: 700;
  border-radius: 9px;
  transition: filter 0.15s ease;
}
.primary-action:hover,
.secondary-action:hover { filter: brightness(1.07); }
.primary-action { background: linear-gradient(135deg, #8a6a36, #a5823f); }
.secondary-action { background: linear-gradient(135deg, #5b4a8a, #7a63b0); }
.meta-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(109, 88, 54, 0.9);
}
.meta-row strong { color: #5d4322; }
.field-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field-block--full {
  grid-column: 1 / -1;
}
.field-label {
  font-size: 10px;
  color: rgba(109, 88, 54, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 700;
}
.field-input,
.prompt-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(122, 90, 44, 0.35);
  background: rgba(255, 253, 246, 0.92);
  color: #3a2c15;
  font-size: 12px;
  font-family: inherit;
}
.field-input:focus,
.prompt-textarea:focus { outline: 2px solid rgba(184, 134, 11, 0.35); }
.field-input--short {
  width: 70px;
}
.prompt-textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.5;
}
.toggle-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: #4a3418;
  padding: 2px 0;
}
.toggle-row input[type="checkbox"] { accent-color: #8a6a36; }
.inline-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 18px;
}
.inline-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ghost-btn {
  padding: 4px 9px;
  color: #5d4322;
  background: rgba(255, 252, 243, 0.8);
  border: 1px solid rgba(122, 90, 44, 0.35);
  font-weight: 600;
  border-radius: 8px;
  width: auto !important;
}
.ghost-btn:hover:not(:disabled) { background: rgba(255, 240, 200, 0.95); }
.ghost-btn:disabled { opacity: 0.5; cursor: wait; }
.api-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.model-select-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.model-select-row .field-input { flex: 1; }
.model-count {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  background: rgba(184, 134, 11, 0.16);
  color: #8a6a10;
  font-weight: 700;
}
.range-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.range-row .ghost-btn { padding: 5px 8px; }
.range-sep {
  color: rgba(109, 88, 54, 0.6);
}
.status-line {
  font-size: 11px;
  color: #6d5836;
}
.status-line--muted {
  color: rgba(109, 88, 54, 0.7);
}
.small-summary-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.small-summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  padding: 6px 9px;
  border-radius: 9px;
  background: rgba(255, 253, 246, 0.8);
  border: 1px solid rgba(122, 90, 44, 0.2);
}
.ss-floor {
  color: #8a6a10;
  font-weight: 700;
  flex-shrink: 0;
}
.ss-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4a3418;
}
.archive-shell {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.archive-timeline {
  border-left: 1.5px solid rgba(184, 134, 11, 0.4);
  padding-left: 8px;
}
.timeline-item {
  padding: 6px 0;
}
.timeline-item::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  margin-right: 6px;
  background: linear-gradient(135deg, #d9a83c, #8a5a2c);
  box-shadow: 0 0 0 2px rgba(217, 168, 60, 0.2);
}
.timeline-floor {
  font-size: 10px;
  color: #8a6a10;
  font-weight: 700;
}
.timeline-type {
  font-size: 10px;
  color: rgba(109, 88, 54, 0.75);
  letter-spacing: 0.5px;
}
.archive-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.archive-card {
  padding: 9px 11px;
  border-radius: 10px;
  background: rgba(255, 253, 246, 0.88);
  border: 1px solid rgba(122, 90, 44, 0.26);
  box-shadow: 0 1px 3px rgba(90, 62, 20, 0.07);
}
.archive-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  padding-bottom: 4px;
  border-bottom: 1px dashed rgba(184, 134, 11, 0.35);
}
.archive-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 700;
  background: rgba(184, 134, 11, 0.16);
  color: #8a6a10;
}
.archive-title {
  font-size: 12px;
  font-weight: 700;
  color: #5d4322;
}
.archive-text,
.preview-body {
  font-size: 12px;
  color: #4a3418;
  line-height: 1.62;
  white-space: pre-wrap;
}
.archive-unresolved {
  margin-top: 6px;
  padding: 5px 8px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.55;
  color: #8c4a1d;
  background: rgba(220, 120, 60, 0.1);
  border: 1px dashed rgba(200, 110, 50, 0.4);
}
.preview-body {
  max-height: 240px;
  overflow-y: auto;
  padding: 8px 10px;
  border-radius: 9px;
  background: rgba(255, 253, 246, 0.85);
  border: 1px solid rgba(122, 90, 44, 0.22);
}
.panel-error {
  font-size: 11px;
  color: #a03322;
  padding: 6px 9px;
  border-radius: 8px;
  background: rgba(200, 60, 40, 0.1);
  border: 1px solid rgba(200, 60, 40, 0.35);
}
/* 容器自适应：窗口变窄时侧栏/时间线折叠（容器查询，随面板宽度而非视口） */
@container (max-width: 620px) {
  .dossier-body {
    grid-template-columns: 1fr;
  }
  .dossier-hero {
    flex-direction: column;
    align-items: flex-start;
  }
  .api-grid {
    grid-template-columns: 1fr;
  }
  .archive-shell {
    grid-template-columns: 1fr;
  }
  .archive-timeline {
    display: none;
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSummaryStore } from './store';

const store = useSummaryStore();
const depthOptions = [10, 20, 30, 50, 100];
const collapsed = ref(false);

const statusLabel = computed(() => {
  const p = store.pointers;
  return `截至第${p.summary}楼`;
});

const coverage = computed(() => store.getCoverageInfo());
const rangeFrom = ref<number | null>(null);
const rangeTo = ref<number | null>(null);
const rangeOverwrite = ref(false);

const mainBlocks = computed(() => store.blocks.filter(b => b.kind === 'main'));
const branchBlocks = computed(() => store.blocks.filter(b => b.kind === 'branch'));
const blockStart = computed(() => store.blocks.length ? Math.min(...store.blocks.map(b => b.floorStart)) : 0);
const blockEnd = computed(() => store.blocks.length ? Math.max(...store.blocks.map(b => b.floorEnd)) : 0);
const bigSummaryText = computed(() => {
  const big = store.bigSummaries[store.bigSummaries.length - 1];
  if (!big) return '';
  const parts: string[] = [];
  if (big.main) parts.push(`【主线总结】\n${big.main}`);
  for (const br of big.branches) parts.push(`【支线总结：${br.character}】\n${br.content}`);
  if (big.unresolved) parts.push(`【未解决问题】\n${big.unresolved}`);
  return parts.join('\n\n');
});

async function onGenerateSummary() {
  const result = await store.generateSummary(false);
  if (result) toastr.success('总结完成！', '伊瑟利亚总结助手');
}

async function onSummarizeRange() {
  const from = rangeFrom.value || coverage.value.covered + 1;
  const to = rangeTo.value || coverage.value.lastId;
  if (from < 1 || to < from) { toastr.warning('请填写有效的楼层范围', '总结助手'); return; }
  const result = await store.generateSummary(false, { from, to }, rangeOverwrite.value);
  if (result) toastr.success(rangeOverwrite.value ? `已覆盖重写第 ${from}-${to} 楼` : `已总结第 ${from}-${to} 楼`, '总结助手');
}

async function onSummarizeAll() {
  const c = coverage.value;
  if (c.unsummarized <= 0) { toastr.info('没有未总结的楼层', '总结助手'); return; }
  const depth = store.settings.analysisDepth;
  let from = c.covered + 1;
  let total = 0;
  while (from <= c.lastId) {
    const to = Math.min(from + depth - 1, c.lastId);
    const result = await store.generateSummary(true, { from, to }, false);
    if (!result) { toastr.error(`第 ${from}-${to} 楼总结失败，已停止`, '总结助手'); break; }
    total += to - from + 1;
    from = to + 1;
  }
  if (total > 0) toastr.success(`已分批总结 ${total} 楼（每批 ${depth} 楼）`, '总结助手');
}

async function onRegenerate(floor: number) {
  const result = await store.regenerateFrom(floor);
  if (result) toastr.success(`已从第 ${floor} 楼起重新总结`, '总结助手');
}

async function onGenerateBigSummary() {
  const result = await store.generateBigSummary(false);
  if (result) toastr.success('历史总纲生成完成！', '伊瑟利亚总结助手');
}

function onSettingsChange() {
  store.saveToVariables();
}

function onAutoToggle(e: Event) {
  store.updateSettings({ autoGenerate: (e.target as HTMLInputElement).checked });
}

function onBigToggle(e: Event) {
  store.updateSettings({ bigGenerate: (e.target as HTMLInputElement).checked });
}

function onRunModeToggle(e: Event) {
  store.updateSettings({ autoRunMode: (e.target as HTMLInputElement).checked ? 'confirm' : 'silent' });
}

function onHideFloorsToggle(e: Event) {
  store.updateSettings({ hideFloors: (e.target as HTMLInputElement).checked });
}

function onPlannerLinkToggle(e: Event) {
  store.updateSettings({ plannerLink: (e.target as HTMLInputElement).checked });
}

function onIncrementalToggle(e: Event) {
  store.updateSettings({ incrementalMode: (e.target as HTMLInputElement).checked });
}

async function onFetchModels() {
  await store.fetchModels();
}

function onResetPrompt() {
  store.resetSystemPrompt();
  toastr.info('已恢复为默认总结提示词', '伊瑟利亚总结助手');
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

function extractPreview(content: string): string {
  // 尝试提取 Memory 标签内内容
  const match = content.match(/<Memory>([\s\S]*?)<\/Memory>/);
  const text = match ? match[1].trim() : content;
  return text.length > 300 ? text.slice(0, 300) + '…' : text;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>
