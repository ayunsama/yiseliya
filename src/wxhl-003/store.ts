import { defineStore } from 'pinia';
import { reactive, ref, watch } from 'vue';

const SETTINGS_KEY = 'wxhl003_settings';

export interface ApiConfig {
  url: string;
  apiKey: string;
  model: string;
  timeout: number;
  maxRetries: number;
}

export interface Settings {
  apiMode: 'single' | 'multi';
  primary: ApiConfig;
  secondary: ApiConfig;
  selectedWorldbooks: string[];
  wallpaper: string;
}

export interface Thread {
  id: number;
  section: string;
  title: string;
  preview: string;
  author: string;
  replies: number;
  time: string;
  hotComment: string;
  hotAuthor: string;
  hotLikes: number;
  posts?: Post[];
}

export interface Post {
  id: number;
  floor: number;
  author: string;
  time: string;
  content: string;
  depth: number;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        apiMode: data.apiMode || 'single',
        primary: { url: '', apiKey: '', model: '', timeout: 30000, maxRetries: 3, ...data.primary },
        secondary: { url: '', apiKey: '', model: '', timeout: 30000, maxRetries: 3, ...data.secondary },
        selectedWorldbooks: data.selectedWorldbooks || [],
        wallpaper: data.wallpaper || '',
      };
    }
  } catch { /* ignore */ }
  return {
    apiMode: 'single',
    primary: { url: '', apiKey: '', model: '', timeout: 30000, maxRetries: 3 },
    secondary: { url: '', apiKey: '', model: '', timeout: 30000, maxRetries: 3 },
    selectedWorldbooks: [],
    wallpaper: '',
  };
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

function getActiveApi(settings: Settings): ApiConfig {
  return settings.apiMode === 'multi' && settings.secondary.url
    ? settings.secondary
    : settings.primary;
}

async function callApi(
  cfg: ApiConfig,
  prompt: string,
  retries = 3,
): Promise<string> {
  if (!cfg.url || !cfg.apiKey) throw new Error('API 未配置');
  let lastError = '';
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await generateRaw({
        user_input: prompt,
        custom_api: {
          apiurl: cfg.url,
          key: cfg.apiKey,
          model: cfg.model,
          source: 'openai',
        },
        ordered_prompts: ['user_input'],
        should_silence: true,
        max_chat_history: 0,
      });
      return typeof result === 'string' ? result : (result.content || '');
    } catch (e: any) {
      lastError = e.message || String(e);
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw new Error(lastError || '生成失败');
}

export const useForumStore = defineStore('forum', () => {
  // Load settings
  const settings = reactive<Settings>(loadSettings());

  // Auto-save settings on change
  watch(
    () => settings,
    (val) => saveSettings({ ...val }),
    { deep: true },
  );

  // State
  const threads = ref<Thread[]>(getInitialThreads());
  const selectedThread = ref<Thread | null>(null);
  const activeSection = ref('complaints');
  const rankIndex = ref(0);
  const refreshing = ref(false);
  const generating = ref(false);
  const replying = ref(false);
  const lastError = ref('');
  const lastErrorSection = ref('');
  const testing = ref(false);
  const testResult = ref('');
  const models = ref<string[]>([]);
  const loadingModels = ref(false);
  const allWorldbookNames = ref<string[]>([]);
  const worldbookLoaded = ref(false);

  function init() {
    loadWorldbookList();
  }

  function loadWorldbookList() {
    try {
      allWorldbookNames.value = getWorldbookNames?.() ?? [];
      worldbookLoaded.value = true;
    } catch {
      allWorldbookNames.value = [];
    }
  }

  async function fetchModels(cfg: ApiConfig) {
    if (!cfg.url || !cfg.apiKey) {
      testResult.value = '请先填写 API URL 和 Key';
      return;
    }
    loadingModels.value = true;
    try {
      const list = await getModelList({ apiurl: cfg.url, key: cfg.apiKey });
      models.value = list.length > 0 ? list : (cfg.model ? [cfg.model] : []);
      testResult.value = `✅ 获取到 ${models.value.length} 个模型`;
    } catch (e: any) {
      if (cfg.model) models.value = [cfg.model];
      testResult.value = `⚠️ ${e.message || e}（已使用手动输入的模型名）`;
    } finally {
      loadingModels.value = false;
    }
  }

  async function testConnection(cfg: ApiConfig) {
    if (!cfg.url || !cfg.apiKey) {
      testResult.value = '请先填写 API URL 和 Key';
      return;
    }
    testing.value = true;
    testResult.value = '';
    try {
      const result = await callApi(cfg, '请回复"连接成功"这四个字，不要任何其他内容。', 0);
      testResult.value = `✅ 连接成功 → "${result.slice(0, 80)}"`;
    } catch (e: any) {
      testResult.value = `❌ ${e.message || e}`;
    } finally {
      testing.value = false;
    }
  }

  async function getWorldbookContent(): Promise<string> {
    const selected = settings.selectedWorldbooks;
    if (selected.length === 0) return '';
    const parts: string[] = [];
    for (const name of selected) {
      try {
        const entries = await getWorldbook(name);
        if (entries && entries.length > 0) {
          const text = entries
            .filter(e => e.enabled !== false)
            .map(e => e.content)
            .filter(Boolean)
            .join('\n\n');
          if (text) parts.push(`【${name}】\n${text}`);
        }
      } catch { /* ignore */ }
    }
    return parts.join('\n\n');
  }

  async function refreshSection(section: string) {
    const cfg = getActiveApi(settings);
    if (!cfg.url || !cfg.apiKey) {
      lastError.value = '请先在设置中配置API';
      return;
    }
    refreshing.value = true;
    lastError.value = '';
    try {
      const wbContent = await getWorldbookContent();
      const sectionLabels: Record<string, string> = {
        complaints: '契约者吐槽区',
        intel: '势力情报分享区',
        dungeon: '副本经历分享区',
        build: '构筑分享区',
        trade: '装备道具交易区',
      };
      const sectionStyles: Record<string, string> = {
        complaints: '契约者对遇到的情况的吐槽，语气接地气、情绪化，有共鸣感',
        intel: '契约者对各大势力的研究、情报和分析',
        dungeon: '契约者通关副本的情报分享，含具体副本名称、敌人特点和通关技巧',
        build: '契约者对构筑路线的思路与实战测试，含具体职业、装备、属性配置路线',
        trade: '契约者售卖装备道具，含具体物品名称、属性、价格（UP币）',
      };
      const prompt = `根据世界观生成8条「${sectionLabels[section] || section}」新帖子。风格：${sectionStyles[section] || ''}
JSON: title(15-30字), preview(20-40字), author, hotComment(最热回复15-40字), hotAuthor, hotLikes(数字)
世界观：${wbContent || '无限回廊是契约者生存竞技空间。势力：特管局、恶魔旅团、方舟集团、瑞辰基金会、神圣教会、零号局、OETA、APJC、EJSSA。'}
只返回JSON数组：[{"title":"...","preview":"...","author":"...","hotComment":"...","hotAuthor":"...","hotLikes":123}]`;

      const result = await callApi(cfg, prompt);
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI回复中未找到JSON数组');
      const newThreads = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(newThreads) || newThreads.length === 0) throw new Error('生成的帖子为空');

      // Remove old threads of this section, add new ones
      threads.value = threads.value.filter(t => t.section !== section);
      const maxId = Math.max(...threads.value.map(t => t.id), 0);
      threads.value.push(...newThreads.map((t: any, i: number) => ({
        id: maxId + i + 1,
        section,
        title: t.title || '无标题',
        preview: t.preview || '',
        author: t.author || '匿名',
        replies: Math.floor(Math.random() * 80) + 10,
        time: '刚刚',
        hotComment: t.hotComment || '',
        hotAuthor: t.hotAuthor || '匿名',
        hotLikes: t.hotLikes || 0,
      })));
    } catch (e: any) {
      lastError.value = e.message || '刷新失败';
    } finally {
      refreshing.value = false;
    }
  }

  async function generateThreadDetail(thread: Thread) {
    const cfg = getActiveApi(settings);
    if (!cfg.url || !cfg.apiKey) {
      lastError.value = '请先在设置中配置API';
      return;
    }
    generating.value = true;
    lastError.value = '';
    try {
      const wbContent = await getWorldbookContent();
      const sectionName: Record<string, string> = {
        complaints: '契约者吐槽区', intel: '势力情报分享区',
        dungeon: '副本经历分享区', build: '构筑分享区', trade: '装备道具交易区',
      };
      const prompt = `「无限回廊」论坛「${sectionName[thread.section] || '论坛'}」帖子：
标题：${thread.title}  预览：${thread.preview}  发帖人：${thread.author}  已有${thread.replies}条回复

请生成完整帖子内容和评论JSON：
{"fullContent":"楼主完整内容300-600字，语气真实自然",
 "comments":[{"author":"评论者","content":"评论50-200字","replies":[{"author":"回复者","content":"回复30-150字"}]}]}
要求：fullContent详细具体、comments生成4-6条、每条最多1-2条子回复、昵称内容符合世界观${wbContent ? `\n世界观：\n${wbContent}` : ''}
只返回JSON`;

      const result = await callApi(cfg, prompt);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI回复中未找到JSON对象');
      const data = JSON.parse(jsonMatch[0]);
      const posts: Post[] = [];
      let floor = 1;
      const now = Date.now();
      const fmt = (offset: number) => {
        const d = new Date(now - 60000 * offset);
        return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };
      posts.push({ id: now, floor: floor++, author: thread.author, time: fmt(0), content: data.fullContent || thread.preview, depth: 0 });
      for (const comment of data.comments || []) {
        posts.push({ id: now + floor, floor: floor++, author: comment.author || '匿名', time: fmt(3 * floor), content: comment.content || '', depth: 1 });
        for (const reply of comment.replies || []) {
          posts.push({ id: now + floor, floor: floor++, author: reply.author || '匿名', time: fmt(3 * floor), content: reply.content || '', depth: 2 });
        }
      }
      thread.posts = posts;
      thread.replies = posts.length - 1;
    } catch (e: any) {
      lastError.value = e.message || '生成失败';
    } finally {
      generating.value = false;
    }
  }

  async function generateReplies(thread: Thread) {
    const cfg = getActiveApi(settings);
    if (!cfg.url || !cfg.apiKey || !thread.posts || thread.posts.length === 0) return;
    replying.value = true;
    lastError.value = '';
    try {
      const history = thread.posts.map(p =>
        `[#${p.floor} ${p.author}${p.depth > 0 ? '(回复)' : '(楼主)'}]: ${p.content.slice(0, 300)}`
      ).join('\n');
      const wbContent = await getWorldbookContent();
      const prompt = `无限回廊帖子「${thread.title}」当前讨论：
${history}

有契约者刚刚发表了新回复（上面最后一条）。请以帖子里已出现的其他契约者身份（不要扮演楼主和刚回复的那位），生成2-3条对新回复的回应。
返回JSON数组：[{"author":"已有评论者昵称","content":"回应内容50-150字"}]
要求：只使用上面讨论中已出现的昵称、语气符合角色、内容有针对性${wbContent ? `\n世界观：\n${wbContent}` : ''}
只返回JSON数组`;

      const result = await callApi(cfg, prompt);
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return;
      const replies = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(replies)) return;

      const now = Date.now();
      const fmt = (offset: number) => {
        const d = new Date(now - 60000 * offset);
        return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };
      let lastFloor = thread.posts.length + 1;
      for (const r of replies) {
        thread.posts.push({
          id: now + lastFloor,
          floor: lastFloor++,
          author: r.author || '匿名',
          time: fmt(2 * lastFloor),
          content: r.content || '',
          depth: 1,
        });
      }
      thread.replies = thread.posts.length - 1;
    } catch { /* ignore */ }
    finally {
      replying.value = false;
    }
  }

  return {
    settings, threads, selectedThread, activeSection, rankIndex,
    refreshing, generating, replying, lastError, lastErrorSection,
    testing, testResult, models, loadingModels, allWorldbookNames, worldbookLoaded,
    init, loadWorldbookList, fetchModels, testConnection,
    refreshSection, generateThreadDetail, generateReplies,
  };
});

function getInitialThreads(): Thread[] {
  return [
    { id: 1, section: 'complaints', title: '刚进准备区就被恶魔旅团三个二阶堵门收保护费', preview: '卡在传送门外不交50UP就威胁弄死你，特管局呢？', author: '血泪萌新', replies: 247, time: '8分钟前', hotComment: '特管局不管一阶区，自求多福吧兄弟', hotAuthor: '过来人', hotLikes: 89 },
    { id: 2, section: 'complaints', title: '有人遇到过02号雌小鬼引导员吗', preview: '杂鱼杂鱼叫个不停，要不是主城禁武早把她头拧了', author: '碎骨者', replies: 502, time: '1小时前', hotComment: '我觉得挺可爱的啊（小声）', hotAuthor: '匿名列兵', hotLikes: 234 },
    { id: 11, section: 'intel', title: '一阶新人必看：CR3.0观察态度下敌人强化实测', preview: '基准等级+1不是开玩笑，杂兵都比你高一级', author: '退役指导员', replies: 89, time: '1小时前', hotComment: '我CR4.0了还没死，是不是该骄傲一下', hotAuthor: '作死选手', hotLikes: 56 },
    { id: 19, section: 'dungeon', title: '从咒术回战活着回来了', preview: '诅咒师领域展开困住差点当场暴毙，太恶心了', author: '幸存者', replies: 178, time: '20分钟前', hotComment: '咒术回战出的技能卷轴品质贼高，值得冒险', hotAuthor: '赏金猎人', hotLikes: 98 },
    { id: 27, section: 'build', title: '一阶纯STR近战流心得', preview: '前期伤害高但脆，CON至少拉到8保命', author: '力量白痴', replies: 56, time: '4小时前', hotComment: 'STR10力量极限拳王，打杂兵一拳一个真爽', hotAuthor: '暴力美学', hotLikes: 45 },
    { id: 35, section: 'trade', title: '出蓝色一阶长剑强化+3', preview: 'STR主属性加成8，副属性AGI加成3，伤害骰1d8，开价180UP', author: '卖剑书生', replies: 12, time: '20分钟前', hotComment: '150UP收，多了不要', hotAuthor: '砍价王', hotLikes: 3 },
  ];
}
