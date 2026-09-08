<template>
  <div class="example-extension-settings">
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <div class="panel-title-wrap">
          <div class="panel-badge">📖</div>
          <div class="panel-title-stack">
            <div class="panel-title">剧情规划大师</div>
            <div class="panel-subtitle">
              <span class="pill" :class="store.settings.autoGenerate ? 'pill-on' : ''">{{ store.settings.autoGenerate ? '规划自动' : '规划手动' }}</span>
              <span class="pill" :class="store.settings.autoAdvance ? 'pill-on' : ''">{{ store.settings.autoAdvance ? '推进自动' : '推进手动' }}</span>
              <span class="pill" :class="store.settings.injectPlanIntoContext ? 'pill-on' : ''">{{ store.settings.injectPlanIntoContext ? '规划注入' : '规划不注' }}</span>
              <span class="pill" :class="store.settings.injectPushIntoContext ? 'pill-on' : ''">{{ store.settings.injectPushIntoContext ? '推进注入' : '推进不注' }}</span>
            </div>
          </div>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" type="button" @click.stop="collapsed = !collapsed">{{ collapsed ? '展开' : '收起' }}</button>
          <button class="ghost-btn" type="button" @click.stop="onResetPrompt">重置提示词</button>
        </div>
      </div>

      <div v-show="!collapsed" class="inline-drawer-content">
        <div class="panel-grid">
          <div class="panel-card">
            <label class="field-label">分析深度</label>
            <select v-model.number="store.settings.analysisDepth" @change="onSettingsChange" class="field-input">
              <option v-for="d in depthOptions" :key="d" :value="d">最近 {{ d }} 条消息</option>
            </select>
          </div>

          <div class="panel-card">
            <label class="field-label">推进深度</label>
            <select v-model.number="store.settings.advanceDepth" @change="onSettingsChange" class="field-input">
              <option v-for="d in advanceDepthOptions" :key="d" :value="d">最近 {{ d }} 条消息</option>
            </select>
          </div>
        </div>

        <div class="panel-grid">
          <div class="panel-card">
            <label class="field-label">注入设置</label>
            <label class="toggle-row">
              <input type="checkbox" :checked="store.settings.injectPlanIntoContext" @change="onContextInjectToggle" />
              <span>规划注入上下文</span>
            </label>
            <label class="toggle-row">
              <input type="checkbox" :checked="store.settings.injectPushIntoContext" @change="onPushInjectToggle" />
              <span>推进注入上下文</span>
            </label>
            <label class="toggle-row">
              <input type="checkbox" :checked="store.settings.injectNpcIntoContext" @change="onNpcInjectToggle" />
              <span>NPC动向注入上下文</span>
            </label>
          </div>
          <div class="panel-card">
            <label class="field-label">联动设置</label>
            <label class="toggle-row">
              <input type="checkbox" :checked="store.settings.npcOnSceneOnly" @change="onSettingToggle('npcOnSceneOnly', $event)" />
              <span>NPC动向只注入同场景角色</span>
            </label>
            <label class="toggle-row">
              <input type="checkbox" :checked="store.settings.beatSyncEnabled" @change="onSettingToggle('beatSyncEnabled', $event)" />
              <span>节拍写入 $flags.剧情节拍</span>
            </label>
            <label class="toggle-row">
              <input type="checkbox" :checked="store.settings.useSummaryContext" @change="onSettingToggle('useSummaryContext', $event)" />
              <span>联动总结助手（总纲+伏笔回收）</span>
            </label>
          </div>
        </div>

        <!-- 区间补跑：跳过的楼层/重开的线手动补分析 -->
        <div class="panel-card panel-card--wide">
          <div class="field-head">
            <label class="field-label">🔁 区间补跑（对指定楼层区间重新分析大纲）</label>
          </div>
          <div class="range-row">
            <input v-model.number="rangeFrom" type="number" min="0" class="field-input field-input--short" placeholder="起" />
            <span class="range-sep">—</span>
            <input v-model.number="rangeTo" type="number" min="0" class="field-input field-input--short" placeholder="止" />
            <button class="ghost-btn ghost-btn--small" type="button" :disabled="store.loading || rangeFrom < 0 || rangeTo < rangeFrom" @click="onRangePlan">
              {{ store.loading ? '分析中...' : '补跑该区间' }}
            </button>
          </div>
        </div>

        <!-- 当前剧情节拍（进度指针） -->
        <div v-if="store.storyState" class="panel-card panel-card--wide">
          <div class="field-head">
            <span class="field-label">🧭 当前剧情节拍</span>
            <span class="preview-time">{{ formatTime(store.storyState.updatedAt) }}</span>
          </div>
          <div class="beat-box">
            <div class="beat-stage">【{{ store.storyState.stage }} · 序列{{ store.storyState.sequence }}】{{ store.storyState.currentGoal }}</div>
            <div v-if="store.storyState.nextMove" class="beat-line"><b>下一步：</b>{{ store.storyState.nextMove }}</div>
            <div v-if="store.storyState.activeConflicts && store.storyState.activeConflicts.length" class="beat-line"><b>进行中冲突：</b>{{ store.storyState.activeConflicts.join('；') }}</div>
          </div>
          <button class="menu_button" type="button" :disabled="store.detecting" @click="onDetectStage" style="margin-top:6px">
            {{ store.detecting ? '检测中...' : '🧭 重新检测当前阶段' }}
          </button>
        </div>

        <!-- NPC 动向规划设置 -->
        <div class="panel-card panel-card--wide">
          <div class="field-head">
            <label class="field-label">🎭 NPC 动向规划</label>
          </div>
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.npcEnabled" @change="onNpcEnabledToggle" />
            <span>启用 NPC 动向（想法/行为/积极面/阴暗面 + 可能行动）</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.npcAutoWithAdvance" @change="onNpcAutoToggle" />
            <span>🚀 生成推进时联动生成 NPC 动向</span>
          </label>
          <label class="field-label" style="margin-top:8px">手动补充 NPC 名单（逗号分隔；自动读取 stat_data 主要NPC/同伴/英灵）</label>
          <input v-model="store.settings.npcList" @change="onSettingsChange" placeholder="如：白娅, 络络, 导师" class="field-input" />
        </div>

        <div class="panel-card panel-card--wide">
          <div class="field-head">
            <label class="field-label">📖 剧情规划提示词</label>
            <button class="ghost-btn ghost-btn--small" type="button" @click="onResetPrompt">恢复默认</button>
          </div>
          <textarea v-model="store.settings.systemPrompt" @change="onSettingsChange" rows="6" class="prompt-textarea" />
        </div>

        <div class="panel-card panel-card--wide">
          <div class="field-head">
            <label class="field-label">🚀 主动推进提示词</label>
            <button class="ghost-btn ghost-btn--small" type="button" @click="onResetPushPrompt">恢复默认</button>
          </div>
          <textarea v-model="store.settings.pushPrompt" @change="onSettingsChange" rows="6" class="prompt-textarea" />
        </div>

        <div class="panel-card panel-card--wide">
          <div class="field-head">
            <label class="field-label">🎭 NPC 动向提示词</label>
            <button class="ghost-btn ghost-btn--small" type="button" @click="onResetNpcPrompt">恢复默认</button>
          </div>
          <textarea v-model="store.settings.npcPrompt" @change="onSettingsChange" rows="6" class="prompt-textarea" />
        </div>

        <div class="panel-grid">
          <div class="panel-card">
            <label class="field-label">API 地址（可选）</label>
            <input v-model="store.settings.apiUrl" @change="onSettingsChange" placeholder="留空使用酒馆默认" class="field-input" />
          </div>
          <div class="panel-card">
            <label class="field-label">API 密钥</label>
            <input v-model="store.settings.apiKey" @change="onSettingsChange" type="password" placeholder="外部 API 密钥" class="field-input" />
          </div>
        </div>

        <div class="panel-card panel-card--wide">
          <div class="field-head">
            <label class="field-label">模型（外部 API 使用）</label>
            <button
              class="ghost-btn ghost-btn--small"
              type="button"
              :disabled="store.fetchingModels || !store.settings.apiUrl"
              @click="onFetchModels"
            >
              {{ store.fetchingModels ? '获取中...' : '⟳ 刷新列表' }}
            </button>
          </div>
          <div class="model-select-row">
            <select
              v-model="store.settings.model"
              @change="onSettingsChange"
              class="field-input"
            >
              <option value="">留空使用酒馆默认</option>
              <option
                v-for="m in store.modelList"
                :key="m"
                :value="m"
              >{{ m }}</option>
            </select>
            <span class="model-count" v-if="store.modelList.length > 0">
              {{ store.modelList.length }}
            </span>
          </div>
        </div>

        <div class="panel-card">
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.autoGenerate" @change="onAutoGenerateToggle" />
            <span>📖 每 {{ store.settings.autoInterval }} 楼自动规划</span>
          </label>
          <div v-if="store.settings.autoGenerate" class="auto-row">
            <label class="field-label">规划间隔</label>
            <input v-model.number="store.settings.autoInterval" @change="onSettingsChange" type="number" min="5" max="100" class="field-input field-input--short" />
          </div>
        </div>

        <div class="panel-card">
          <label class="toggle-row">
            <input type="checkbox" :checked="store.settings.autoAdvance" @change="onAutoAdvanceToggle" />
            <span>🚀 每 {{ store.settings.advanceInterval }} 楼自动推进</span>
          </label>
          <div v-if="store.settings.autoAdvance" class="auto-row">
            <label class="field-label">推进间隔</label>
            <input v-model.number="store.settings.advanceInterval" @change="onSettingsChange" type="number" min="1" max="20" class="field-input field-input--short" />
          </div>
        </div>

        <div class="panel-card panel-card--action">
          <button class="menu_button" type="button" :disabled="store.loading" @click="onGeneratePlan">
            {{ store.loading ? '分析中...' : '📖 分析剧情' }}
          </button>
          <button class="menu_button" type="button" :disabled="store.loading" @click="onGenerateAdvance" style="margin-top:6px;background:linear-gradient(135deg,#f09819,#ff512f)">
            {{ store.loading ? '分析中...' : '🚀 生成推进（联动NPC）' }}
          </button>
          <button class="menu_button" type="button" :disabled="store.detecting" @click="onDetectStage" style="margin-top:6px;background:linear-gradient(135deg,#22c55e,#0ea5e9)">
            {{ store.detecting ? '检测中...' : '🧭 检测当前阶段' }}
          </button>
          <button class="menu_button" type="button" :disabled="store.npcLoading" @click="onGenerateNpcPlan" style="margin-top:6px;background:linear-gradient(135deg,#7c3aed,#a855f7)">
            {{ store.npcLoading ? '生成中...' : '🎭 生成 NPC 动向' }}
          </button>
          <button class="menu_button" type="button" :disabled="store.loading" @click="onConsolidate" style="margin-top:6px;background:linear-gradient(135deg,#64748b,#334155)">
            {{ store.loading ? '处理中...' : '🧹 整理规划（合并重复/修正冲突）' }}
          </button>
        </div>

        <div v-if="store.error" class="panel-error">{{ store.error }}</div>

        <div v-if="store.plans.length > 0" class="panel-card panel-card--preview">
          <div class="field-head">
            <span class="field-label">📖 最近规划</span>
            <span class="preview-time">
              <span v-if="latestPlan?.stale" class="badge badge--stale">已失效·请重新分析</span>
              <span v-else-if="latestPlan?.coverage" class="badge">第{{ latestPlan.coverage.start }}-{{ latestPlan.coverage.end }}楼</span>
              {{ latestPlan ? formatTime(latestPlan.generatedAt) : '' }}
            </span>
          </div>
          <div class="preview-body">{{ latestPlan?.content }}</div>
        </div>

        <div v-if="store.advances.length > 0" class="panel-card panel-card--preview">
          <div class="field-head">
            <span class="field-label">🚀 最近推进</span>
            <span class="preview-time">
              <span v-if="latestAdvance?.resolved" class="badge badge--stale">已覆盖</span>
              <span v-else class="badge badge--live">生效中</span>
              {{ latestAdvance ? formatTime(latestAdvance.generatedAt) : '' }}
            </span>
          </div>
          <div class="preview-body">{{ latestAdvance?.content }}</div>
        </div>

        <div v-if="store.npcPlans.length > 0" class="panel-card panel-card--preview">
          <div class="field-head">
            <span class="field-label">🎭 最近 NPC 动向</span>
            <span class="preview-time">{{ formatTime(store.npcPlans[store.npcPlans.length - 1].generatedAt) }}</span>
          </div>
          <div class="preview-body">
            <div v-for="n in store.npcPlans[store.npcPlans.length - 1].npcs" :key="n.name" class="npc-plan-row">
              <b>{{ n.name }}</b>
              <div v-if="n.thought">想法：{{ n.thought }}</div>
              <div v-if="n.behavior">行为：{{ n.behavior }}</div>
              <div v-if="n.positive">积极面：{{ n.positive }}</div>
              <div v-if="n.darkSide">阴暗面：{{ n.darkSide }}</div>
              <div v-if="n.likelyAction">可能行动：{{ n.likelyAction }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.example-extension-settings {
  width: 100%;
  color: #f4f7ff;
}
.inline-drawer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.inline-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
}
.panel-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 18px;
  background: linear-gradient(135deg, rgba(92, 180, 255, 0.4), rgba(120, 255, 208, 0.25));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
}
.panel-title-stack {
  min-width: 0;
}
.panel-title {
  font-weight: 700;
  letter-spacing: 0.3px;
}
.panel-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
  font-size: 11px;
}
.pill {
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
}
.pill-on {
  color: #8fe0ff;
  background: rgba(70, 178, 255, 0.22);
}
.panel-actions {
  display: flex;
  gap: 6px;
}
.ghost-btn {
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.08);
  color: #f4f7ff;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}
.ghost-btn--small {
  padding: 2px 7px;
}
.inline-drawer-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 2px;
}
.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.panel-card {
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
}
.panel-card--wide {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-card--action {
  display: flex;
  justify-content: center;
}
.panel-card--preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.model-select-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.model-select-row .field-input {
  flex: 1;
}
.model-count {
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  flex-shrink: 0;
}
.field-label {
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.2px;
  text-transform: uppercase;
}
.field-input {
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(8, 14, 24, 0.4);
  color: #f4f7ff;
  box-sizing: border-box;
}
.field-input--short {
  width: 70px;
}
.prompt-textarea {
  width: 100%;
  min-height: 140px;
  padding: 8px;
  resize: vertical;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(8, 14, 24, 0.4);
  color: #f4f7ff;
  box-sizing: border-box;
  line-height: 1.45;
}
.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.auto-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.menu_button {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #3f9cff, #31c5d3);
  color: #08111f;
  font-weight: 700;
  cursor: pointer;
}
.menu_button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.panel-error {
  color: #ff7f8b;
  font-size: 12px;
  padding: 4px 0;
}
.preview-time {
  font-size: 11px;
  color: rgba(255,255,255,0.72);
}
.preview-body {
  font-size: 12px;
  max-height: 180px;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.5;
  color: rgba(255,255,255,0.92);
}
.beat-box {
  font-size: 12px;
  line-height: 1.55;
  color: rgba(255,255,255,0.92);
}
.beat-stage {
  font-weight: 700;
  color: #ffd97a;
}
.beat-line {
  margin-top: 3px;
}
.beat-line b {
  color: rgba(255,255,255,0.65);
}
.npc-plan-row {
  padding: 6px 0;
  border-bottom: 1px dashed rgba(255,255,255,0.12);
  font-size: 12px;
  line-height: 1.5;
}
.npc-plan-row:last-child {
  border-bottom: 0;
}
.npc-plan-row > b {
  color: #a78bfa;
}
.range-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.range-sep {
  color: rgba(255, 255, 255, 0.55);
}
.badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  margin-right: 4px;
  background: rgba(70, 178, 255, 0.18);
  color: #8fe0ff;
}
.badge--stale {
  background: rgba(255, 127, 139, 0.18);
  color: #ff9aa4;
}
.badge--live {
  background: rgba(74, 222, 128, 0.16);
  color: #86efac;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePlotPlannerStore } from './store';

const store = usePlotPlannerStore();
const depthOptions = [5, 10, 20, 50];
const advanceDepthOptions = [3, 5, 10, 20, 50];
const collapsed = ref(false);
const rangeFrom = ref<number | null>(null);
const rangeTo = ref<number | null>(null);

const latestPlan = computed(() => store.plans[store.plans.length - 1] || null);
const latestAdvance = computed(() => store.advances[store.advances.length - 1] || null);

async function onGeneratePlan() {
  const result = await store.generatePlan();
  if (result) toastr.success('分析完成！', '剧情规划大师');
}

async function onRangePlan() {
  if (rangeFrom.value == null || rangeTo.value == null || rangeTo.value < rangeFrom.value) {
    toastr.warning('请填写有效的楼层区间（起 ≤ 止）', '剧情规划大师');
    return;
  }
  const result = await store.generatePlan(false, { from: rangeFrom.value, to: rangeTo.value });
  if (result) toastr.success(`区间 ${rangeFrom.value}-${rangeTo.value} 补跑完成！`, '剧情规划大师');
}

async function onConsolidate() {
  const result = await store.consolidatePlan();
  if (result) toastr.success('规划已整理！', '剧情规划大师');
}

async function onGenerateAdvance() {
  const result = await store.generateAdvance();
  if (result) toastr.success('推进生成完成！', '剧情规划大师');
}

async function onFetchModels() {
  await store.fetchModels();
}

function onSettingsChange() { store.updateSettings(); }
function onSettingToggle(key: 'npcOnSceneOnly' | 'beatSyncEnabled' | 'useSummaryContext', e: Event) {
  store.updateSettings({ [key]: (e.target as HTMLInputElement).checked });
}
function onAutoGenerateToggle(e: Event) { store.updateSettings({ autoGenerate: (e.target as HTMLInputElement).checked }); }
function onAutoAdvanceToggle(e: Event) { store.updateSettings({ autoAdvance: (e.target as HTMLInputElement).checked }); }
function onContextInjectToggle(e: Event) { store.updateSettings({ injectPlanIntoContext: (e.target as HTMLInputElement).checked }); }
function onPushInjectToggle(e: Event) { store.updateSettings({ injectPushIntoContext: (e.target as HTMLInputElement).checked }); }
function onNpcInjectToggle(e: Event) { store.updateSettings({ injectNpcIntoContext: (e.target as HTMLInputElement).checked }); }
function onNpcEnabledToggle(e: Event) { store.updateSettings({ npcEnabled: (e.target as HTMLInputElement).checked }); }
function onNpcAutoToggle(e: Event) { store.updateSettings({ npcAutoWithAdvance: (e.target as HTMLInputElement).checked }); }
function onResetPrompt() { store.resetSystemPrompt(); toastr.info('已恢复为默认提示词模板', '剧情规划大师'); }
function onResetPushPrompt() { store.resetPushPrompt(); toastr.info('已恢复为默认推进提示词', '剧情规划大师'); }
function onResetNpcPrompt() { store.resetNpcPrompt(); toastr.info('已恢复为默认NPC动向提示词', '剧情规划大师'); }

async function onDetectStage() {
  const r = await store.detectStage();
  if (r) toastr.success(`当前阶段：${r.stage} · 序列${r.sequence}`, '剧情规划大师');
}

async function onGenerateNpcPlan() {
  const r = await store.generateNpcPlan();
  if (r) toastr.success(`已生成 ${r.npcs.length} 个角色的动向`, '剧情规划大师');
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>