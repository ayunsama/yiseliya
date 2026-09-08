<template>
  <div class="plot-workbench">
    <!-- 统计卡行 -->
    <div class="stat-row">
      <div class="stat-card" :class="{ 'stat-card--live': !!store.storyState?.currentGoal }">
        <div class="stat-card__icon">🧭</div>
        <div class="stat-card__body">
          <div class="stat-card__value">{{ store.storyState ? store.storyState.stage + '·' + store.storyState.sequence : '—' }}</div>
          <div class="stat-card__label">当前节拍</div>
        </div>
      </div>
      <div class="stat-card" :class="{ 'stat-card--warn': latestPlanStale }">
        <div class="stat-card__icon">📖</div>
        <div class="stat-card__body">
          <div class="stat-card__value">{{ store.plans.length }}</div>
          <div class="stat-card__label">大纲{{ latestPlanStale ? '·失效' : '' }}</div>
        </div>
      </div>
      <div class="stat-card" :class="{ 'stat-card--live': activeAdvance }">
        <div class="stat-card__icon">🚀</div>
        <div class="stat-card__body">
          <div class="stat-card__value">{{ activeAdvance ? '生效' : '—' }}</div>
          <div class="stat-card__label">推进{{ store.advances.length ? '·' + store.advances.length : '' }}</div>
        </div>
      </div>
      <div class="stat-card" :class="{ 'stat-card--live': latestNpcCount > 0 }">
        <div class="stat-card__icon">🎭</div>
        <div class="stat-card__body">
          <div class="stat-card__value">{{ latestNpcCount || '—' }}</div>
          <div class="stat-card__label">NPC动向</div>
        </div>
      </div>
    </div>

    <!-- 节奏三档选择器 -->
    <div class="rhythm-row">
      <button
        v-for="(r, key) in rhythms"
        :key="key"
        type="button"
        class="rhythm-btn"
        :class="{ 'rhythm-btn--on': store.settings.rhythm === key }"
        @click="onRhythm(key as RhythmKey)"
      >{{ r.label }}</button>
    </div>
    <div class="rhythm-desc">{{ rhythms[store.settings.rhythm]?.desc }}</div>

    <!-- 当前节拍 hero -->
    <section v-if="store.storyState" class="beat-hero">
      <div class="beat-hero__head">
        <span class="beat-hero__stage">{{ store.storyState.stage }}</span>
        <span class="beat-hero__seq">序列 {{ store.storyState.sequence }}</span>
        <span class="beat-hero__time">{{ formatTime(store.storyState.updatedAt) }}</span>
      </div>
      <div class="beat-hero__goal">{{ store.storyState.currentGoal || '（未设定目标）' }}</div>
      <div v-if="store.storyState.nextMove" class="beat-hero__next"><b>下一步</b>{{ store.storyState.nextMove }}</div>
      <div v-if="store.storyState.activeConflicts?.length" class="beat-hero__conflicts">
        <span v-for="c in store.storyState.activeConflicts" :key="c" class="chip chip--conflict">{{ c }}</span>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" :disabled="store.detecting" @click="onDetectStage">
        {{ store.detecting ? '检测中…' : '🧭 重新检测阶段' }}
      </button>
    </section>
    <section v-else class="beat-hero beat-hero--empty">
      <span>还没有进度指针——先「📖 分析剧情」再「🧭 检测阶段」</span>
    </section>

    <!-- 主操作：一键规划 + 生成推进 -->
    <div class="action-grid">
      <button class="btn btn--primary btn--full" type="button" :disabled="planBusy" @click="onRunFullPlan">
        {{ planBusy ? `✦ ${store.planStep || '规划中'}…` : '✦ 一键规划（底稿→节拍→NPC）' }}
      </button>
      <button class="btn btn--danger" type="button" :disabled="store.loading || store.generationBusy" @click="onGenerateAdvance">
        {{ store.loading ? '生成中…' : '🚀 生成推进' }}
      </button>
    </div>

    <!-- 高级：区间补跑 / 自动化 / 整理 / 设置 -->
    <details class="adv-box">
      <summary class="adv-box__summary">⚙ 高级（区间补跑 / 自动化 / 整理 / 设置）</summary>
      <div class="adv-box__body">
        <div class="adv-sec">
          <div class="adv-sec__title">🔁 区间补跑</div>
          <div class="range-row">
            <input v-model.number="rangeFrom" type="number" min="0" class="inp inp--num" placeholder="起" />
            <span class="range-sep">—</span>
            <input v-model.number="rangeTo" type="number" min="0" class="inp inp--num" placeholder="止" />
            <button class="btn btn--ghost btn--sm" type="button" :disabled="store.loading || rangeFrom == null || rangeTo == null || rangeTo < rangeFrom" @click="onRangePlan">补跑该区间</button>
          </div>
        </div>
        <div class="adv-sec">
          <div class="adv-sec__title">🧹 规划整理</div>
          <button class="btn btn--ghost btn--sm" type="button" :disabled="store.loading || store.generationBusy" @click="onConsolidate">
            {{ store.loading ? '处理中…' : '整理当前底稿（合并重复/修正冲突）' }}
          </button>
        </div>
        <div class="adv-sec">
          <div class="adv-sec__title">⚡ 自动化</div>
          <label class="switch-row"><input type="checkbox" :checked="store.settings.autoGenerate" @change="onAutoGenerateToggle" /><span>每 {{ store.settings.autoInterval }} 楼自动规划</span><input v-model.number="store.settings.autoInterval" @change="onSettingsChange" type="number" min="5" max="100" class="inp inp--num inp--tail" /></label>
          <label class="switch-row"><input type="checkbox" :checked="store.settings.autoAdvance" @change="onAutoAdvanceToggle" /><span>每 {{ store.settings.advanceInterval }} 楼自动推进</span><input v-model.number="store.settings.advanceInterval" @change="onSettingsChange" type="number" min="1" max="20" class="inp inp--num inp--tail" /></label>
        </div>
        <div class="adv-sec">
          <div class="adv-sec__title">📥 注入与联动</div>
          <label class="switch-row"><input type="checkbox" :checked="injectAll" @change="onInjectAllToggle" /><span>注入上下文（节拍/底稿/推进/NPC动向）</span></label>
          <label class="switch-row"><input type="checkbox" :checked="store.settings.beatSyncEnabled" @change="onSettingToggle('beatSyncEnabled', $event)" /><span>节拍写入 $flags（纪元触发器联动）</span></label>
          <label class="switch-row"><input type="checkbox" :checked="store.settings.useSummaryContext" @change="onSettingToggle('useSummaryContext', $event)" /><span>联动总结助手（总纲+伏笔回收）</span></label>
          <label class="switch-row"><input type="checkbox" :checked="store.settings.npcEnabled" @change="onNpcEnabledToggle" /><span>一键规划时推演 NPC 动向</span></label>
          <label class="switch-row"><input type="checkbox" :checked="store.settings.npcAutoWithAdvance" @change="onNpcAutoToggle" /><span>生成推进时联动 NPC 动向</span></label>
        </div>
        <div class="adv-sec">
          <div class="adv-sec__title">🎚 深度与名单</div>
          <div class="pair-row">
            <label class="pair-row__item"><span>分析深度</span>
              <select v-model.number="store.settings.analysisDepth" @change="onSettingsChange" class="inp">
                <option v-for="d in depthOptions" :key="d" :value="d">最近 {{ d }} 楼</option>
              </select>
            </label>
            <label class="pair-row__item"><span>推进深度</span>
              <select v-model.number="store.settings.advanceDepth" @change="onSettingsChange" class="inp">
                <option v-for="d in advanceDepthOptions" :key="d" :value="d">最近 {{ d }} 楼</option>
              </select>
            </label>
          </div>
          <input v-model="store.settings.npcList" @change="onSettingsChange" placeholder="手动补充 NPC 名单（逗号分隔，可选）" class="inp" />
        </div>
        <div class="adv-sec">
          <div class="adv-sec__title">🔌 外部 API（可选）</div>
          <div class="pair-row">
            <input v-model="store.settings.apiUrl" @change="onSettingsChange" placeholder="API 地址，留空用酒馆默认" class="inp" />
            <input v-model="store.settings.apiKey" @change="onSettingsChange" type="password" placeholder="密钥" class="inp" />
          </div>
          <div class="model-row">
            <select v-model="store.settings.model" @change="onSettingsChange" class="inp">
              <option value="">模型：留空使用酒馆默认</option>
              <option v-for="m in store.modelList" :key="m" :value="m">{{ m }}</option>
            </select>
            <button class="btn btn--ghost btn--sm" type="button" :disabled="store.fetchingModels || !store.settings.apiUrl" @click="onFetchModels">
              {{ store.fetchingModels ? '获取中' : '⟳' }}
            </button>
          </div>
        </div>
        <div class="adv-sec">
          <div class="adv-sec__title">📝 提示词（点击展开编辑）</div>
          <details v-for="p in promptTabs" :key="p.key" class="prompt-fold">
            <summary class="prompt-fold__summary">{{ p.label }}<button class="btn btn--ghost btn--xs" type="button" @click.stop="p.reset()">恢复默认</button></summary>
            <textarea v-model="store.settings[p.key]" @change="onSettingsChange" rows="6" class="inp inp--area" />
          </details>
        </div>
      </div>
    </details>

    <div v-if="store.error" class="error-bar">⚠ {{ store.error }}</div>

    <!-- 规划历史 -->
    <section class="sec">
      <div class="sec__head">
        <span class="sec__title">📖 规划历史</span>
        <span class="sec__count">{{ store.plans.length }}</span>
      </div>
      <div v-if="store.plans.length === 0" class="empty-tip">还没有大纲。点击「📖 分析剧情」从最近楼层提炼起承转合。</div>
      <div v-for="(p, i) in planHistory" :key="p.generatedAt" class="plan-item" :class="{ 'plan-item--stale': p.stale }">
        <div class="plan-item__head" @click="togglePlan(i)">
          <span class="plan-item__badge" :class="p.stale ? 'badge--stale' : 'badge--ok'">{{ p.stale ? '已失效' : coverageText(p) }}</span>
          <span v-if="p.meta" class="plan-meta">
            <span v-if="p.meta.rhythm" class="badge badge--rhythm">{{ rhythms[p.meta.rhythm as RhythmKey]?.label ?? p.meta.rhythm }}</span>
            <span v-if="p.meta.fate" class="badge" :class="p.meta.fate.range === 'fortune' ? 'badge--fortune' : p.meta.fate.range === 'downfall' ? 'badge--downfall' : 'badge--muted'">🎲{{ p.meta.fate.roll }} {{ p.meta.fate.label }}</span>
            <span v-if="p.meta.prototypes?.length" class="badge badge--proto">{{ p.meta.prototypes.map(x => x.split('：')[0]).join('+') }}</span>
          </span>
          <span class="plan-item__time">{{ formatTime(p.generatedAt) }}</span>
          <span class="plan-item__toggle">{{ expandedPlan === i ? '收起 ▴' : '展开 ▾' }}</span>
        </div>
        <pre v-show="expandedPlan === i" class="plan-item__body">{{ p.content }}</pre>
      </div>
    </section>

    <!-- 推进历史 -->
    <section class="sec">
      <div class="sec__head">
        <span class="sec__title">🚀 推进历史</span>
        <span class="sec__count">{{ store.advances.length }}</span>
      </div>
      <div v-if="store.advances.length === 0" class="empty-tip">还没有推进指令。生成后会在每次请求时注入「当前转折方向」。</div>
      <div v-for="a in advanceHistory" :key="a.generatedAt" class="adv-item" :class="{ 'adv-item--resolved': a.resolved }">
        <span class="adv-item__badge" :class="a.resolved ? 'badge--muted' : 'badge--live'">{{ a.resolved ? '已覆盖' : '生效中' }}</span>
        <span class="adv-item__text">{{ a.content }}</span>
        <span class="adv-item__time">#{{ a.floor }} · {{ formatTime(a.generatedAt) }}</span>
      </div>
    </section>

    <!-- NPC 动向 -->
    <section class="sec">
      <div class="sec__head">
        <span class="sec__title">🎭 NPC 动向</span>
        <span class="sec__count">{{ latestNpcCount }}</span>
      </div>
      <div v-if="!latestNpc" class="empty-tip">还没有 NPC 动向。生成推进时会自动联动，也可单独生成。</div>
      <div class="npc-grid">
        <div v-for="n in latestNpc?.npcs || []" :key="n.name" class="npc-card">
          <div class="npc-card__name">{{ n.name }}</div>
          <div v-if="n.thought" class="npc-field"><span>想法</span>{{ n.thought }}</div>
          <div v-if="n.behavior" class="npc-field"><span>行为</span>{{ n.behavior }}</div>
          <div v-if="n.personality" class="npc-field npc-field--good"><span>性格</span>{{ n.personality }}</div>
          <div v-if="n.likelyAction" class="npc-field npc-field--act"><span>行动</span>{{ n.likelyAction }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RHYTHMS, type RhythmKey, usePlotPlannerStore } from './store';

const store = usePlotPlannerStore();
const rhythms = RHYTHMS;
const depthOptions = [5, 10, 20, 50];
const advanceDepthOptions = [3, 5, 10, 20, 50];
const rangeFrom = ref<number | null>(null);
const rangeTo = ref<number | null>(null);
const expandedPlan = ref<number | null>(0);

const latestPlan = computed(() => store.plans[store.plans.length - 1] || null);
const latestPlanStale = computed(() => latestPlan.value?.stale === true);
const activeAdvance = computed(() => [...store.advances].reverse().find(a => !a.resolved) || null);
const planHistory = computed(() => [...store.plans].reverse());
const advanceHistory = computed(() => [...store.advances].reverse());
const latestNpc = computed(() => store.npcPlans.length ? store.npcPlans[store.npcPlans.length - 1] : null);
const latestNpcCount = computed(() => latestNpc.value?.npcs.length || 0);

/** 一键规划进行中（分析/检测/推演任一步） */
const planBusy = computed(() => !!store.planStep || store.loading || store.detecting || store.npcLoading);
/** 注入总开关：三路全开视为开 */
const injectAll = computed(() =>
  store.settings.injectPlanIntoContext && store.settings.injectPushIntoContext && store.settings.injectNpcIntoContext);

const promptTabs = [
  { key: 'systemPrompt' as const, label: '📖 底稿提示词', reset: () => store.resetSystemPrompt() },
  { key: 'pushPrompt' as const, label: '🚀 推进提示词', reset: () => store.resetPushPrompt() },
  { key: 'npcPrompt' as const, label: '🎭 NPC动向提示词', reset: () => store.resetNpcPrompt() },
];

function coverageText(p: { coverage: { start: number; end: number } | null }) {
  return p.coverage ? `第${p.coverage.start}-${p.coverage.end}楼` : '全区间';
}
function togglePlan(i: number) {
  expandedPlan.value = expandedPlan.value === i ? null : i;
}

function onRhythm(key: RhythmKey) {
  store.updateSettings({ rhythm: key });
}

async function onRunFullPlan() {
  const r = await store.runFullPlan();
  if (r.plan) {
    const bits: string[] = ['底稿已生成'];
    if (r.stage) bits.push(`阶段 ${r.stage.stage}·序列${r.stage.sequence}`);
    if (r.npc) bits.push(`${r.npc.npcs.length} 个NPC动向`);
    toastr.success(bits.join('，'), '一键规划');
  } else if (store.error) {
    toastr.error(store.error, '一键规划失败');
  }
}
async function onRangePlan() {
  if (rangeFrom.value == null || rangeTo.value == null || rangeTo.value < rangeFrom.value) {
    toastr.warning('请填写有效楼层区间（起 ≤ 止）', '剧情规划大师');
    return;
  }
  const r = await store.generatePlan(false, { from: rangeFrom.value, to: rangeTo.value });
  if (r) toastr.success(`区间 ${rangeFrom.value}-${rangeTo.value} 补跑完成`, '剧情规划大师');
}
async function onConsolidate() {
  const r = await store.consolidatePlan();
  if (r) toastr.success('底稿已整理', '剧情规划大师');
}
async function onGenerateAdvance() {
  const r = await store.generateAdvance();
  if (r) toastr.success('推进指令已生成', '剧情规划大师');
}
async function onFetchModels() { await store.fetchModels(); }

function onSettingsChange() { store.updateSettings(); }
function onSettingToggle(key: 'beatSyncEnabled' | 'useSummaryContext', e: Event) {
  store.updateSettings({ [key]: (e.target as HTMLInputElement).checked });
}
function onInjectAllToggle(e: Event) {
  const on = (e.target as HTMLInputElement).checked;
  store.updateSettings({ injectPlanIntoContext: on, injectPushIntoContext: on, injectNpcIntoContext: on });
}
function onAutoGenerateToggle(e: Event) { store.updateSettings({ autoGenerate: (e.target as HTMLInputElement).checked }); }
function onAutoAdvanceToggle(e: Event) { store.updateSettings({ autoAdvance: (e.target as HTMLInputElement).checked }); }
function onNpcEnabledToggle(e: Event) { store.updateSettings({ npcEnabled: (e.target as HTMLInputElement).checked }); }
function onNpcAutoToggle(e: Event) { store.updateSettings({ npcAutoWithAdvance: (e.target as HTMLInputElement).checked }); }
function onResetPrompt() { store.resetSystemPrompt(); toastr.info('已恢复为默认提示词模板', '剧情规划大师'); }
function onResetPushPrompt() { store.resetPushPrompt(); toastr.info('已恢复为默认推进提示词', '剧情规划大师'); }
function onResetNpcPrompt() { store.resetNpcPrompt(); toastr.info('已恢复为默认NPC动向提示词', '剧情规划大师'); }

async function onDetectStage() {
  const r = await store.detectStage();
  if (r) toastr.success(`当前阶段：${r.stage} · 序列${r.sequence}`, '剧情规划大师');
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>


<style scoped>
.plot-workbench {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #3a2c15;
}

/* ── 统计卡 ── */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 10px;
  background: rgba(255, 252, 243, 0.75);
  border: 1px solid rgba(122, 90, 44, 0.28);
  box-shadow: 0 1px 3px rgba(90, 62, 20, 0.08);
  min-width: 0;
}
.stat-card--live { border-color: rgba(184, 134, 11, 0.6); background: linear-gradient(160deg, rgba(255, 240, 200, 0.9), rgba(255, 228, 160, 0.65)); }
.stat-card--warn { border-color: rgba(200, 60, 40, 0.55); }
.stat-card__icon { font-size: 15px; }
.stat-card__body { min-width: 0; }
.stat-card__value { font-weight: 800; font-size: 13px; line-height: 1.1; white-space: nowrap; }
.stat-card__label { font-size: 10px; color: rgba(109, 88, 54, 0.8); white-space: nowrap; }

/* ── 节拍 hero ── */
.beat-hero {
  padding: 10px 12px;
  border-radius: 12px;
  background: linear-gradient(150deg, #5d4322, #7a5a2c 70%, #8a6a36);
  color: #ffedc4;
  border: 1px solid rgba(184, 134, 11, 0.65);
  box-shadow: 0 4px 12px rgba(90, 62, 20, 0.3), inset 0 1px 0 rgba(255, 235, 180, 0.25);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.beat-hero--empty {
  background: rgba(255, 252, 243, 0.6);
  color: rgba(109, 88, 54, 0.85);
  border: 1px dashed rgba(122, 90, 44, 0.4);
  box-shadow: none;
  font-size: 12px;
  align-items: center;
}
.beat-hero__head { display: flex; align-items: baseline; gap: 8px; }
.beat-hero__stage {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  color: #ffd97a;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.beat-hero__seq { font-size: 12px; font-weight: 700; color: #ffe9b8; }
.beat-hero__time { margin-left: auto; font-size: 10px; color: rgba(255, 237, 196, 0.65); }
.beat-hero__goal { font-size: 14px; font-weight: 700; line-height: 1.45; }
.beat-hero__next { font-size: 12px; line-height: 1.5; }
.beat-hero__next b {
  display: inline-block;
  padding: 0 5px;
  margin-right: 6px;
  border-radius: 5px;
  background: rgba(255, 217, 122, 0.25);
  font-size: 10px;
}
.beat-hero__conflicts { display: flex; flex-wrap: wrap; gap: 4px; }

.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.4;
}
.chip--conflict { background: rgba(220, 90, 60, 0.3); color: #ffd9c9; border: 1px solid rgba(255, 160, 130, 0.4); }

/* ── 节奏三档 ── */
.rhythm-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.rhythm-btn {
  padding: 7px 4px;
  border-radius: 9px;
  border: 1px solid rgba(122, 90, 44, 0.35);
  background: rgba(255, 252, 243, 0.7);
  color: #5d4322;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.rhythm-btn:hover { background: rgba(255, 240, 200, 0.9); }
.rhythm-btn--on {
  background: linear-gradient(160deg, #5d4322, #7a5a2c);
  color: #ffe9b8;
  border-color: rgba(184, 134, 11, 0.6);
  box-shadow: 0 2px 6px rgba(90, 62, 20, 0.3), inset 0 1px 0 rgba(255, 235, 180, 0.25);
}
.rhythm-desc {
  margin-top: -4px;
  padding: 0 2px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(109, 88, 54, 0.85);
}
.btn--full { grid-column: 1 / -1; background: linear-gradient(135deg, #b8860b, #d9a83c); color: #2c1e08; }
/* ── 按钮 ── */
.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.btn {
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 8px 10px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  color: #fff8e8;
  transition: filter 0.15s ease, transform 0.1s ease;
}
.btn:active:not(:disabled) { transform: scale(0.98); }
.btn:disabled { opacity: 0.55; cursor: wait; }
.btn--primary { background: linear-gradient(135deg, #8a6a36, #a5823f); border-color: rgba(122, 90, 44, 0.6); }
.btn--danger { background: linear-gradient(135deg, #b4552d, #cf7440); }
.btn--accent { background: linear-gradient(135deg, #5b4a8a, #7a63b0); }
.btn--slate { background: linear-gradient(135deg, #5a5245, #746a58); }
.btn--ghost {
  background: rgba(255, 252, 243, 0.7);
  color: #5d4322;
  border-color: rgba(122, 90, 44, 0.4);
  font-weight: 600;
}
.btn--ghost:hover:not(:disabled) { background: rgba(255, 240, 200, 0.9); }
.btn--sm { padding: 4px 8px; font-size: 12px; border-radius: 8px; width: auto !important; }
.btn--xs { padding: 1px 6px; font-size: 10px; border-radius: 6px; width: auto !important; }

/* ── 高级折叠 ── */
.adv-box {
  border: 1px solid rgba(122, 90, 44, 0.3);
  border-radius: 10px;
  background: rgba(255, 252, 243, 0.55);
  overflow: hidden;
}
.adv-box__summary {
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  color: #6d5836;
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.adv-box__summary::before { content: '▸ '; }
.adv-box[open] .adv-box__summary::before { content: '▾ '; }
.adv-box__summary:hover { background: rgba(184, 134, 11, 0.08); }
.adv-box__body { padding: 2px 10px 10px; display: flex; flex-direction: column; gap: 10px; }
.adv-sec__title { font-size: 11px; font-weight: 800; color: #8a6a36; margin-bottom: 5px; letter-spacing: 0.5px; }
.adv-sec { display: flex; flex-direction: column; }

.switch-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  padding: 2px 0;
  color: #4a3418;
}
.switch-row input[type="checkbox"] { accent-color: #8a6a36; }
.inp--tail { margin-left: auto; width: 58px; }

.pair-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pair-row__item { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #6d5836; }
.model-row { display: flex; gap: 6px; margin-top: 6px; }
.model-row .inp { flex: 1; }
.range-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.range-sep { color: rgba(109, 88, 54, 0.6); }

.inp {
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(122, 90, 44, 0.35);
  background: rgba(255, 253, 246, 0.9);
  color: #3a2c15;
  font-size: 12px;
  box-sizing: border-box;
  font-family: inherit;
}
.inp--num { width: 64px; }
.inp--area { min-height: 130px; resize: vertical; line-height: 1.5; }
.inp:focus { outline: 2px solid rgba(184, 134, 11, 0.35); }

.prompt-fold { border-top: 1px dashed rgba(122, 90, 44, 0.25); padding-top: 6px; margin-top: 6px; }
.prompt-fold:first-of-type { border-top: 0; margin-top: 0; padding-top: 0; }
.prompt-fold__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #5d4322;
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.prompt-fold__summary::before { content: '▸ '; color: #8a6a36; }
.prompt-fold[open] .prompt-fold__summary::before { content: '▾ '; }

/* ── 错误条 ── */
.error-bar {
  padding: 7px 10px;
  border-radius: 9px;
  background: rgba(200, 60, 40, 0.12);
  border: 1px solid rgba(200, 60, 40, 0.4);
  color: #8c2f1d;
  font-size: 12px;
  line-height: 1.5;
}

/* ── 分区 ── */
.sec { display: flex; flex-direction: column; gap: 6px; }
.sec__head { display: flex; align-items: center; gap: 6px; }
.sec__title { font-size: 13px; font-weight: 800; color: #5d4322; letter-spacing: 0.5px; }
.sec__count {
  min-width: 20px;
  padding: 0 6px;
  text-align: center;
  border-radius: 999px;
  background: rgba(122, 90, 44, 0.16);
  color: #5d4322;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
}
.empty-tip {
  padding: 9px 11px;
  border: 1px dashed rgba(122, 90, 44, 0.35);
  border-radius: 9px;
  background: rgba(255, 252, 243, 0.5);
  color: rgba(109, 88, 54, 0.85);
  font-size: 12px;
  line-height: 1.55;
}

/* ── 规划历史 ── */
.plan-item {
  border: 1px solid rgba(122, 90, 44, 0.3);
  border-radius: 10px;
  background: rgba(255, 252, 243, 0.72);
  overflow: hidden;
}
.plan-item--stale { opacity: 0.72; border-style: dashed; }
.plan-item__head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  cursor: pointer;
  user-select: none;
  font-size: 11px;
}
.plan-item__head:hover { background: rgba(184, 134, 11, 0.08); }
.plan-item__time { color: rgba(109, 88, 54, 0.75); }
.plan-item__toggle { margin-left: auto; color: #8a6a36; font-weight: 700; }
.plan-item__body {
  margin: 0;
  padding: 9px 11px;
  border-top: 1px solid rgba(122, 90, 44, 0.2);
  background: rgba(255, 253, 246, 0.85);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: inherit;
  max-height: 320px;
  overflow-y: auto;
}
.badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.badge--ok { background: rgba(90, 130, 60, 0.16); color: #4a6a2a; }
.badge--stale { background: rgba(200, 60, 40, 0.14); color: #a03322; }
.badge--live { background: rgba(184, 134, 11, 0.18); color: #8a6a10; }
.badge--muted { background: rgba(122, 90, 44, 0.14); color: rgba(93, 67, 34, 0.8); }
.badge--rhythm { background: rgba(91, 74, 138, 0.14); color: #5b4a8a; }
.badge--fortune { background: rgba(184, 134, 11, 0.2); color: #8a6a10; }
.badge--downfall { background: rgba(200, 60, 40, 0.14); color: #a03322; }
.badge--proto { background: rgba(70, 130, 120, 0.14); color: #2f6a5e; }
.plan-meta { display: inline-flex; gap: 4px; flex-wrap: wrap; min-width: 0; }

/* ── 推进历史 ── */
.adv-item {
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 6px 9px;
  border: 1px solid rgba(122, 90, 44, 0.26);
  border-radius: 9px;
  background: rgba(255, 252, 243, 0.72);
  font-size: 12px;
}
.adv-item--resolved { opacity: 0.65; }
.adv-item__text { flex: 1; min-width: 0; line-height: 1.5; }
.adv-item__time { font-size: 10px; color: rgba(109, 88, 54, 0.7); white-space: nowrap; }

/* ── NPC 卡片 ── */
.npc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 7px;
}
.npc-card {
  padding: 8px 10px;
  border-radius: 10px;
  background: linear-gradient(165deg, rgba(255, 252, 243, 0.92), rgba(248, 240, 220, 0.85));
  border: 1px solid rgba(122, 90, 44, 0.32);
  box-shadow: 0 1px 4px rgba(90, 62, 20, 0.1);
}
.npc-card__name {
  font-weight: 800;
  font-size: 13px;
  color: #5d4322;
  padding-bottom: 5px;
  margin-bottom: 5px;
  border-bottom: 1px solid rgba(184, 134, 11, 0.3);
}
.npc-field {
  display: flex;
  gap: 5px;
  font-size: 11px;
  line-height: 1.55;
  padding: 2px 0;
  color: #4a3418;
}
.npc-field > span {
  flex: 0 0 auto;
  margin-top: 1px;
  padding: 0 5px;
  height: 16px;
  line-height: 16px;
  border-radius: 5px;
  font-size: 9.5px;
  font-weight: 700;
  background: rgba(122, 90, 44, 0.14);
  color: #6d5836;
}
.npc-field--good > span { background: rgba(90, 130, 60, 0.16); color: #4a6a2a; }
.npc-field--dark > span { background: rgba(140, 60, 90, 0.14); color: #8c3a5a; }
.npc-field--act > span { background: rgba(184, 134, 11, 0.2); color: #8a6a10; }
</style>
