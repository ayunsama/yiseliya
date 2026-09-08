<template>
  <Transition name="st-modal-fade">
    <div v-if="visible" class="st-modal-backdrop" @click.self="emit('update:visible', false)">
      <div class="st-modal-card" role="dialog" aria-modal="true" aria-labelledby="st-modal-title">
        <header class="st-modal-header">
          <button class="st-modal-back" @click="goBack" aria-label="返回">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div class="st-modal-heading">
            <div id="st-modal-title" class="st-modal-title">{{ title }}</div>
            <div class="st-modal-subtitle">{{ subtitle }}</div>
          </div>
          <button class="st-modal-close" @click="emit('update:visible', false)" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="st-modal-body">
          <!-- 选项菜单 -->
          <div v-if="step === 'menu'" class="st-modal-menu">
            <button class="st-modal-option" @click="startCustom">
              <span class="st-modal-option-icon">✏️</span>
              <span class="st-modal-option-text">
                <span class="st-modal-option-title">A. 完全自定义</span>
                <span class="st-modal-option-desc">手动填写联系人的全部信息</span>
              </span>
            </button>
            <button class="st-modal-option" @click="startAi">
              <span class="st-modal-option-icon">✨</span>
              <span class="st-modal-option-text">
                <span class="st-modal-option-title">B. AI 来填表</span>
                <span class="st-modal-option-desc">输入一段描述，让 AI 生成联系人信息</span>
              </span>
            </button>
            <button class="st-modal-option" @click="startImport">
              <span class="st-modal-option-icon">🎭</span>
              <span class="st-modal-option-text">
                <span class="st-modal-option-title">C. 从角色卡导入</span>
                <span class="st-modal-option-desc">选择已导入的角色卡及其世界书条目</span>
              </span>
            </button>
          </div>

          <!-- 表单（A/B 共用） -->
          <div v-else-if="step === 'form' || step === 'ai-form'" class="st-modal-form">
            <div v-if="step === 'ai-form'" class="st-modal-ai-section">
              <label class="st-modal-label">描述一下这个联系人</label>
              <textarea
                v-model="aiDescription"
                class="st-modal-textarea"
                rows="3"
                placeholder="例如：她是一个性格冷淡的青梅竹马，黑发，平时叫你哥哥..."
              />
              <button
                class="st-modal-ai-btn"
                :disabled="!aiDescription.trim() || generating"
                @click="generatePersona"
              >
                <span v-if="generating">生成中…</span>
                <span v-else">✨ AI 生成信息</span>
              </button>
            </div>

            <!-- 分页指示器 -->
            <div class="st-modal-page-dots">
              <span
                v-for="p in 3"
                :key="p"
                class="st-modal-page-dot"
                :class="{ 'st-modal-page-dot--active': formPage === p }"
              />
            </div>

            <!-- 第 1 页：基础关系 -->
            <div v-if="formPage === 1" class="st-modal-page">
              <div class="st-modal-field st-modal-field--required">
                <label class="st-modal-label">联系人名称</label>
                <input v-model="formData.realName" type="text" class="st-modal-input" placeholder="必填" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">关系类型</label>
                <select v-model="formData.relationship" class="st-modal-select">
                  <option v-for="opt in relationshipOptions" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">因为什么有你的好友</label>
                <select v-model="formData.reason" class="st-modal-select">
                  <option v-for="opt in reasonOptions" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">什么时候有的好友</label>
                <select v-model="formData.whenAdded" class="st-modal-select">
                  <option v-for="opt in whenOptions" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
            </div>

            <!-- 第 2 页：个人资料 -->
            <div v-else-if="formPage === 2" class="st-modal-page">
              <div class="st-modal-field">
                <label class="st-modal-label">备注名</label>
                <input v-model="formData.nickname" type="text" class="st-modal-input" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">网名</label>
                <input v-model="formData.onlineName" type="text" class="st-modal-input" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">性别</label>
                <input v-model="formData.gender" type="text" class="st-modal-input" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">年龄</label>
                <input v-model="formData.age" type="text" class="st-modal-input" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">对你的称呼</label>
                <input v-model="formData.callYou" type="text" class="st-modal-input" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">好感度</label>
                <input v-model="formData.affection" type="text" class="st-modal-input" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">性格</label>
                <textarea v-model="formData.personality" class="st-modal-textarea" rows="2" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">外貌</label>
                <textarea v-model="formData.appearance" class="st-modal-textarea" rows="2" placeholder="暂时还不了解" />
              </div>
            </div>

            <!-- 第 3 页：故事与备注 -->
            <div v-else-if="formPage === 3" class="st-modal-page">
              <div class="st-modal-field">
                <label class="st-modal-label">背景故事</label>
                <textarea v-model="formData.backgroundStory" class="st-modal-textarea" rows="4" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">当前状态</label>
                <textarea v-model="formData.currentStatus" class="st-modal-textarea" rows="3" placeholder="暂时还不了解" />
              </div>
              <div class="st-modal-field">
                <label class="st-modal-label">备注</label>
                <textarea v-model="formData.notes" class="st-modal-textarea" rows="2" placeholder="可选" />
              </div>
            </div>

            <div v-if="error" class="st-modal-error">{{ error }}</div>

            <div class="st-modal-actions">
              <button
                v-if="formPage > 1"
                class="st-modal-action-btn st-modal-action-btn--secondary"
                @click="formPage--"
              >
                上一步
              </button>
              <button
                v-if="formPage < 3"
                class="st-modal-action-btn"
                @click="formPage++"
              >
                下一步
              </button>
              <button
                v-if="formPage === 3"
                class="st-modal-action-btn"
                :disabled="submitting"
                @click="createFromForm"
              >
                <span v-if="submitting">创建中…</span>
                <span v-else">创建联系人</span>
              </button>
            </div>
          </div>

          <!-- 角色卡列表 -->
          <div v-else-if="step === 'characters'" class="st-modal-list">
            <div class="st-modal-search">
              <svg class="st-modal-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                v-model="charQuery"
                type="text"
                class="st-modal-input"
                placeholder="搜索角色卡名称"
              />
            </div>
            <div
              v-for="char in filteredCharacters"
              :key="char.name"
              class="st-modal-list-item"
              @click="selectCharacter(char)"
            >
              <div class="st-modal-list-avatar">{{ char.name[0] }}</div>
              <div class="st-modal-list-info">
                <div class="st-modal-list-name">{{ char.name }}</div>
                <div class="st-modal-list-desc">{{ char.data?.creator || char.personality || '暂无描述' }}</div>
              </div>
            </div>
            <div v-if="filteredCharacters.length === 0" class="st-modal-empty">
              {{ charQuery ? '未找到匹配的角色卡' : '当前没有导入任何角色卡' }}
            </div>
          </div>

          <!-- 世界书条目列表 -->
          <div v-else-if="step === 'worldbooks'" class="st-modal-list">
            <div v-if="loadingWorldbook" class="st-modal-empty">加载中…</div>
            <div class="st-modal-search">
              <svg class="st-modal-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                v-model="wbQuery"
                type="text"
                class="st-modal-input"
                placeholder="搜索世界书条目"
              />
            </div>
            <div
              v-for="entry in filteredWorldbookEntries"
              :key="entry.uid"
              class="st-modal-list-item st-modal-list-item--multiline"
              @click="selectEntry(entry)"
            >
              <div class="st-modal-list-info">
                <div class="st-modal-list-name">{{ entry.name || '未命名条目' }}</div>
                <div class="st-modal-list-desc">{{ entry.content }}</div>
              </div>
            </div>
            <div v-if="!loadingWorldbook && filteredWorldbookEntries.length === 0" class="st-modal-empty">
              {{ wbQuery ? '未找到匹配的条目' : '该角色卡绑定的主世界书为空' }}
            </div>
          </div>

          <!-- 仅输入名称（C 最后一步） -->
          <div v-else-if="step === 'name-only'" class="st-modal-form">
            <div class="st-modal-field st-modal-field--required">
              <label class="st-modal-label">联系人名称</label>
              <input v-model="importName" type="text" class="st-modal-input" placeholder="必填" />
            </div>

            <div class="st-modal-field">
              <label class="st-modal-label">将要导入的内容预览</label>
              <div class="st-modal-preview">{{ selectedEntry?.content || '无内容' }}</div>
            </div>

            <div v-if="error" class="st-modal-error">{{ error }}</div>

            <button class="st-modal-submit" :disabled="submitting" @click="createFromImport">
              <span v-if="submitting">创建中…</span>
              <span v-else">创建联系人</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Contact } from '../composables/useContacts';
import {
  makeEmptyPersonaInfo,
  normalizePersonaInfo,
  type PersonaInfo,
} from '../utils/parser';

const props = defineProps<{
  visible: boolean;
  contacts: Contact[];
  ensureContact: (name: string) => Promise<Contact | null>;
  saveContact: (contact: Contact) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'created', contact: Contact): void;
}>();

type Step = 'menu' | 'form' | 'ai-form' | 'characters' | 'worldbooks' | 'name-only';

const relationshipOptions = [
  '暂时还不了解',
  '纯网友',
  '普通朋友',
  '知己',
  '青梅竹马',
  '恋人',
  '夫妻',
  '仇人',
  '债主（你欠钱）',
  '同事',
  'ETC',
];

const reasonOptions = [
  '暂时还不了解',
  '同学',
  '乱加到的',
  '工作原因',
  '社交网络',
  '线下联谊',
  '游戏',
  '比赛',
  '娱乐',
];

const whenOptions = [
  '暂时还不了解',
  '刚刚',
  '十天半个月前',
  '已经很久很久',
];

const step = ref<Step>('menu');
const formPage = ref(1);
const formData = ref<PersonaInfo>(makeEmptyPersonaInfo(''));
const aiDescription = ref('');
const importName = ref('');
const error = ref('');
const submitting = ref(false);
const generating = ref(false);
const loadingWorldbook = ref(false);
const characters = ref<SillyTavern.v1CharData[]>(getSillyTavernCharacters());
const charQuery = ref('');
const selectedChar = ref<SillyTavern.v1CharData | null>(null);
const worldbookEntries = ref<WorldbookEntry[]>([]);
const wbQuery = ref('');
const selectedEntry = ref<WorldbookEntry | null>(null);

const filteredCharacters = computed(() => {
  if (!charQuery.value.trim()) return characters.value;
  const q = charQuery.value.trim().toLowerCase();
  return characters.value.filter(c => c.name.toLowerCase().includes(q));
});

const filteredWorldbookEntries = computed(() => {
  if (!wbQuery.value.trim()) return worldbookEntries.value;
  const q = wbQuery.value.trim().toLowerCase();
  return worldbookEntries.value.filter(e =>
    (e.name || '').toLowerCase().includes(q) ||
    e.content.toLowerCase().includes(q)
  );
});

function getSillyTavernCharacters(): SillyTavern.v1CharData[] {
  try {
    return (window as any).SillyTavern?.characters || [];
  } catch {
    return [];
  }
}

function getGlobal<T extends (...args: any[]) => any>(name: string, fn?: T): T | undefined {
  try {
    return fn || (window as any)[name] as T;
  } catch {
    return undefined;
  }
}

const title = computed(() => {
  switch (step.value) {
    case 'menu': return '添加联系人';
    case 'form': return '填写联系人信息';
    case 'ai-form': return 'AI 生成联系人';
    case 'characters': return '选择角色卡';
    case 'worldbooks': return '选择世界书条目';
    case 'name-only': return '确认联系人名称';
    default: return '';
  }
});

const subtitle = computed(() => {
  switch (step.value) {
    case 'menu': return '请选择一种添加方式';
    case 'characters': return '从已导入的角色卡中选择一个';
    case 'worldbooks': return '选择该角色卡主世界书中的一条';
    case 'form':
    case 'ai-form':
      return `第 ${formPage.value}/3 页，未填写项将使用“暂时还不了解”`;
    default: return '所有非必填项留空时将使用“暂时还不了解”';
  }
});

watch(() => props.visible, (value) => {
  if (value) {
    reset();
  }
});

function reset() {
  step.value = 'menu';
  formPage.value = 1;
  formData.value = makeEmptyPersonaInfo('');
  aiDescription.value = '';
  importName.value = '';
  error.value = '';
  submitting.value = false;
  generating.value = false;
  loadingWorldbook.value = false;
  characters.value = getSillyTavernCharacters();
  charQuery.value = '';
  selectedChar.value = null;
  worldbookEntries.value = [];
  wbQuery.value = '';
  selectedEntry.value = null;
}

function goBack() {
  error.value = '';
  if (step.value === 'form' || step.value === 'ai-form') {
    if (formPage.value > 1) {
      formPage.value--;
    } else {
      step.value = 'menu';
    }
  } else if (step.value === 'characters') {
    step.value = 'menu';
  } else if (step.value === 'worldbooks') {
    step.value = 'characters';
  } else if (step.value === 'name-only') {
    step.value = 'worldbooks';
  }
}

function startCustom() {
  formData.value = makeEmptyPersonaInfo('');
  formPage.value = 1;
  step.value = 'form';
}

function startAi() {
  formData.value = makeEmptyPersonaInfo('');
  aiDescription.value = '';
  formPage.value = 1;
  step.value = 'ai-form';
}

function startImport() {
  characters.value = getSillyTavernCharacters();
  selectedChar.value = null;
  worldbookEntries.value = [];
  step.value = 'characters';
}

function selectCharacter(char: SillyTavern.v1CharData) {
  selectedChar.value = char;
  loadWorldbookEntries(char);
}

async function loadWorldbookEntries(char: SillyTavern.v1CharData) {
  loadingWorldbook.value = true;
  worldbookEntries.value = [];
  try {
    const getBound = getGlobal<typeof getCharWorldbookNames>('getCharWorldbookNames');
    if (!getBound) {
      throw new Error('当前环境不支持读取角色卡世界书');
    }
    const bound = getBound(char.name);
    const primary = bound?.primary;
    if (!primary) {
      worldbookEntries.value = [];
      return;
    }
    const getWb = getGlobal<typeof getWorldbook>('getWorldbook');
    if (!getWb) {
      throw new Error('当前环境不支持读取世界书');
    }
    worldbookEntries.value = await getWb(primary);
  } catch (e) {
    error.value = `读取世界书失败：${String(e)}`;
  } finally {
    loadingWorldbook.value = false;
  }
  step.value = 'worldbooks';
}

function selectEntry(entry: WorldbookEntry) {
  selectedEntry.value = entry;
  importName.value = '';
  step.value = 'name-only';
}

async function generatePersona() {
  if (!aiDescription.value.trim()) return;
  error.value = '';
  generating.value = true;
  try {
    const schema = {
      name: 'persona_info',
      description: '联系人信息表',
      value: {
        type: 'object',
        properties: {
          realName: { type: 'string', description: '联系人名称' },
          nickname: { type: 'string', description: '备注名' },
          onlineName: { type: 'string', description: '网名' },
          gender: { type: 'string', description: '性别' },
          age: { type: 'string', description: '年龄' },
          callYou: { type: 'string', description: '对你的称呼' },
          affection: { type: 'string', description: '好感度' },
          relationship: { type: 'string', description: '关系类型' },
          reason: { type: 'string', description: '因为什么有你的好友' },
          whenAdded: { type: 'string', description: '什么时候有的好友' },
          personality: { type: 'string', description: '性格' },
          appearance: { type: 'string', description: '外貌' },
          backgroundStory: { type: 'string', description: '背景故事' },
          currentStatus: { type: 'string', description: '当前状态' },
          notes: { type: 'string', description: '备注' },
        },
        required: ['realName'],
      },
    };

    const generate = getGlobal<typeof generateRaw>('generateRaw');
    if (!generate) {
      throw new Error('当前环境不支持 AI 生成');
    }

    const result = await generate({
      user_input: aiDescription.value.trim(),
      should_silence: true,
      json_schema: schema,
      ordered_prompts: [
        { role: 'system', content: '请根据用户提供的描述，填写一份联系人信息表。必须返回所有字段，如果某项信息无法从描述中推断，请填写“暂时还不了解”。必须以 JSON 格式输出。' },
        { role: 'user', content: aiDescription.value.trim() },
      ],
    });

    const parsed = JSON.parse(result as string) as Partial<PersonaInfo>;
    if (!parsed.realName) {
      throw new Error('AI 未返回联系人名称');
    }
    const empty = makeEmptyPersonaInfo(parsed.realName);
    formData.value = normalizePersonaInfo({ ...empty, ...parsed });
  } catch (e) {
    error.value = `生成失败：${String(e)}`;
  } finally {
    generating.value = false;
  }
}

function findExisting(name: string): Contact | undefined {
  return props.contacts.find(c => c.name === name.trim());
}

async function createFromForm() {
  const name = formData.value.realName.trim();
  if (!name) {
    error.value = '联系人名称不能为空';
    formPage.value = 1;
    return;
  }
  if (findExisting(name)) {
    error.value = '该联系人已存在';
    return;
  }

  error.value = '';
  submitting.value = true;
  try {
    const contact = await props.ensureContact(name);
    if (!contact) {
      throw new Error('创建联系人失败，请检查世界书是否已绑定');
    }
    contact.data.persona = normalizePersonaInfo(formData.value);
    await props.saveContact(contact);
    emit('created', contact);
    emit('update:visible', false);
  } catch (e) {
    error.value = String(e);
  } finally {
    submitting.value = false;
  }
}

async function createFromImport() {
  const name = importName.value.trim();
  if (!name) {
    error.value = '联系人名称不能为空';
    return;
  }
  if (!selectedEntry.value) {
    error.value = '未选择世界书条目';
    return;
  }
  if (findExisting(name)) {
    error.value = '该联系人已存在';
    return;
  }

  error.value = '';
  submitting.value = true;
  try {
    const contact = await props.ensureContact(name);
    if (!contact) {
      throw new Error('创建联系人失败，请检查世界书是否已绑定');
    }

    const persona = makeEmptyPersonaInfo(name);
    persona.backgroundStory = selectedEntry.value.content;
    contact.data.persona = normalizePersonaInfo(persona);
    await props.saveContact(contact);
    emit('created', contact);
    emit('update:visible', false);
  } catch (e) {
    error.value = String(e);
  } finally {
    submitting.value = false;
  }
}
</script>
