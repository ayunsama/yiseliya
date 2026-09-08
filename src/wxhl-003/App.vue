<template>
  <!-- ============ FLOATING BUTTON ============ -->
  <div
    v-show="!expanded"
    ref="btnRef"
    class="float-btn"
    :class="{ dragging: isDragging }"
    @mousedown.prevent="onBtnMouseDown"
    @touchstart.prevent="onBtnTouchStart"
  >
    <div class="btn-core">
      <svg class="btn-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M3 21V3h6l3 4 3-4h6v18H3z" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="9" y1="12" x2="15" y2="12" stroke-linecap="round" opacity="0.6" />
        <line x1="9" y1="16" x2="13" y2="16" stroke-linecap="round" opacity="0.4" />
      </svg>
    </div>
    <div class="btn-halo" />
  </div>

  <!-- ============ PANEL ============ -->
  <Transition name="panel">
    <div v-if="expanded" ref="panelRef" class="panel-overlay" @click.self="closePanel">
      <div ref="phoneRef" class="phone-frame" :style="phoneFrameStyle">
        <!-- Status bar / drag handle -->
        <div
          class="status-bar"
          @mousedown="onHeaderMouseDown"
          @touchstart.prevent="onHeaderTouchStart"
        >
          <span class="status-time">{{ currentTime }}</span>
          <span class="status-label">◆ 回廊终端</span>
        </div>
        <button class="minimize-btn" @click.stop="closePanel"><span /></button>

        <!-- ============ DESKTOP ============ -->
        <div v-if="view === 'desktop'" class="desktop-view" :style="wallpaperBg">
          <template v-if="!store.settings.wallpaper">
            <div class="corridor-bg">
              <div class="corridor-ceiling" />
              <div class="corridor-left" />
              <div class="corridor-right" />
              <div class="corridor-floor" />
              <div class="corridor-end" />
            </div>
          </template>
          <div class="app-grid">
            <div class="app-icon-wrapper" @click="openForum">
              <div class="app-icon forum-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="14" rx="2" />
                  <path d="M7 7h10M7 11h8M7 15h4" />
                </svg>
              </div>
              <span class="app-label">回廊论坛</span>
            </div>
            <div class="app-icon-wrapper" @click="openSettings">
              <div class="app-icon settings-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </div>
              <span class="app-label">终端设置</span>
            </div>
          </div>
          <div class="desktop-footer">◆ 无 限 回 廊 ◆</div>
        </div>

        <!-- ============ FORUM ============ -->
        <div v-else-if="view === 'forum'" class="app-page">
          <div class="app-header">
            <button class="hdr-btn" @click="goDesktop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg></button>
            <span class="hdr-title">{{ selectedThread ? selectedThread.title : '回廊论坛' }}</span>
            <span class="hdr-spacer" />
          </div>

          <!-- Thread detail -->
          <template v-if="selectedThread">
            <div v-if="store.generating" class="gen-overlay">
              <div class="gen-spinner" />
              <span>AI 生成帖子内容...</span>
            </div>
            <div v-else-if="store.lastError && selectedThread" class="refresh-err">
              {{ store.lastError }} <button class="retry-link" @click="openThread(selectedThread)">重试</button>
            </div>
            <template v-else>
              <div class="scroll-area">
                <div v-for="(post, i) in (selectedThread.posts || [])" :key="i" class="d-post" :class="{ nest1: post.depth === 1, nest2: post.depth === 2 }">
                  <div class="dp-head">
                    <span class="dp-author">{{ post.author }}</span>
                    <span class="dp-floor">#{{ post.floor }}</span>
                    <span class="dp-time">{{ post.time }}</span>
                  </div>
                  <div class="dp-content">{{ post.content }}</div>
                </div>
              </div>
              <div class="reply-bar">
                <span v-if="store.replying" class="reply-wait">AI 回复中...</span>
                <input v-model="replyText" class="reply-input" placeholder="写下回复..." :disabled="store.replying" @keyup.enter="sendReply" />
                <button class="reply-btn" :disabled="!replyText.trim() || store.replying" @click="sendReply">发送</button>
              </div>
            </template>
          </template>

          <!-- Section list -->
          <template v-else>
            <div class="section-tabs">
              <button v-for="tab in sections" :key="tab.key" class="section-tab" :class="{ active: store.activeSection === tab.key }" @click="store.activeSection = tab.key">
                <span class="tab-icon">{{ tab.icon }}</span>
                <span class="tab-label">{{ tab.label }}</span>
              </button>
              <button v-if="store.activeSection !== 'rank'" class="section-tab refresh-tab" :disabled="store.refreshing" @click="refreshSection">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: store.refreshing }">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span class="tab-label">{{ store.refreshing ? '生成中...' : '刷新' }}</span>
              </button>
            </div>

            <!-- Rankings -->
            <template v-if="store.activeSection === 'rank'">
              <div class="rank-tabs">
                <button v-for="(rank, ri) in rankData" :key="rank.key" class="rank-tab" :class="{ active: store.rankIndex === ri }" @click="store.rankIndex = ri">{{ rank.key }}</button>
              </div>
              <div class="scroll-area">
                <div class="rank-board">
                  <div class="rank-title">{{ rankData[store.rankIndex].title }}</div>
                  <div class="rank-hdr">
                    <span class="rh-rank">#</span>
                    <span class="rh-name">契约者</span>
                    <span class="rh-lv">Lv</span>
                    <span class="rh-team">所属</span>
                  </div>
                  <div v-for="item in rankData[store.rankIndex].items" :key="item.rank" class="rank-row" :class="{ top3: Number(item.rank) <= 3 }">
                    <span class="ri-rank" :class="'r' + item.rank">{{ item.rank }}</span>
                    <span class="ri-name">{{ item.name }}</span>
                    <span class="ri-lv">{{ item.lv }}</span>
                    <span class="ri-team">{{ item.team }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Thread list -->
            <template v-else>
              <div class="scroll-area">
                <div v-if="store.lastError && store.lastErrorSection === store.activeSection" class="refresh-err">{{ store.lastError }}</div>
                <div v-for="thread in filteredThreads" :key="thread.id" class="thread-card" @click="openThread(thread)">
                  <div class="tc-top">
                    <span class="tc-title">{{ thread.title }}</span>
                    <span class="tc-replies">{{ thread.replies }}回</span>
                  </div>
                  <div class="tc-preview">{{ thread.preview }}</div>
                  <div class="tc-meta">
                    <span>{{ thread.author }}</span>
                    <span>{{ thread.time }}</span>
                  </div>
                  <div class="tc-hot">
                    <span class="hot-label">🔥</span>
                    <span class="hot-author">{{ thread.hotAuthor }}</span>: {{ thread.hotComment }}
                    <span class="hot-likes">👍{{ thread.hotLikes }}</span>
                  </div>
                </div>
                <div v-if="filteredThreads.length === 0" class="empty-msg">暂无帖子 · 点击「刷新」由AI生成</div>
              </div>
            </template>
          </template>
        </div>

        <!-- ============ SETTINGS MENU ============ -->
        <div v-else-if="view === 'settings'" class="app-page">
          <div class="app-header">
            <button class="hdr-btn" @click="goDesktop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg></button>
            <span class="hdr-title">终端设置</span>
            <span class="hdr-spacer" />
          </div>
          <div class="scroll-area settings-menu">
            <button class="menu-btn" @click="settingsSub = 'api'">
              <span class="menu-icon">🔌</span>
              <span>API 设置</span>
              <span class="menu-arrow">›</span>
            </button>
            <button class="menu-btn" @click="settingsSub = 'worldbook'">
              <span class="menu-icon">📖</span>
              <span>世界书设置</span>
              <span class="menu-arrow">›</span>
            </button>
            <button class="menu-btn" @click="settingsSub = 'wallpaper'">
              <span class="menu-icon">🖼️</span>
              <span>壁纸设置</span>
              <span class="menu-arrow">›</span>
            </button>
          </div>
        </div>

        <!-- ============ SETTINGS SUB-PAGES ============ -->
        <div v-else-if="view === 'settings' && settingsSub === 'api'" class="app-page">
          <div class="app-header">
            <button class="hdr-btn" @click="settingsSub = ''"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg></button>
            <span class="hdr-title">API 设置</span>
            <span class="hdr-spacer" />
          </div>
          <div class="scroll-area settings-inner">
            <div class="set-block">
              <div class="set-label">API 模式</div>
              <div class="set-row">
                <button class="mode-btn" :class="{ active: store.settings.apiMode === 'single' }" @click="store.settings.apiMode = 'single'">单 API</button>
                <button class="mode-btn" :class="{ active: store.settings.apiMode === 'multi' }" @click="store.settings.apiMode = 'multi'">多 API</button>
              </div>
            </div>
            <div class="set-block">
              <div class="set-label">主 API</div>
              <ApiFields :cfg="store.settings.primary" :models="store.models" :loading="store.loadingModels" @fetch-models="store.fetchModels(store.settings.primary)" />
              <button class="test-btn" :disabled="store.testing" @click="store.testConnection(store.settings.primary)">{{ store.testing ? '测试中...' : '测试连接' }}</button>
            </div>
            <div v-if="store.settings.apiMode === 'multi'" class="set-block">
              <div class="set-label">副 API</div>
              <ApiFields :cfg="store.settings.secondary" :models="store.models" :loading="store.loadingModels" @fetch-models="store.fetchModels(store.settings.secondary)" />
              <button class="test-btn" :disabled="store.testing" @click="store.testConnection(store.settings.secondary)">{{ store.testing ? '测试中...' : '测试连接' }}</button>
            </div>
            <div v-if="store.testResult" class="test-msg" :class="{ ok: store.testResult.startsWith('✅') }">{{ store.testResult }}</div>
          </div>
        </div>

        <!-- ============ WORLDBOOK SETTINGS ============ -->
        <div v-else-if="view === 'settings' && settingsSub === 'worldbook'" class="app-page">
          <div class="app-header">
            <button class="hdr-btn" @click="settingsSub = ''"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg></button>
            <span class="hdr-title">世界书设置</span>
            <span class="hdr-spacer" />
          </div>
          <div class="scroll-area settings-inner">
            <div class="set-block">
              <div class="set-label">选择用于AI生成的世界书</div>
              <button class="wb-load-btn" @click="store.loadWorldbookList()">🔄 刷新列表</button>
              <div v-if="store.allWorldbookNames.length === 0" class="set-hint">未检测到世界书</div>
              <div v-for="wb in store.allWorldbookNames" :key="wb" class="wb-row" @click="toggleWorldbook(wb)">
                <span class="wb-check" :class="{ on: store.settings.selectedWorldbooks.includes(wb) }">{{ store.settings.selectedWorldbooks.includes(wb) ? '☑' : '☐' }}</span>
                <span class="wb-name">{{ wb }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ WALLPAPER SETTINGS ============ -->
        <div v-else-if="view === 'settings' && settingsSub === 'wallpaper'" class="app-page">
          <div class="app-header">
            <button class="hdr-btn" @click="settingsSub = ''"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg></button>
            <span class="hdr-title">壁纸设置</span>
            <span class="hdr-spacer" />
          </div>
          <div class="scroll-area settings-inner">
            <div class="set-block">
              <div class="set-label">当前壁纸</div>
              <div class="wp-preview" :style="previewStyle" />
              <button v-if="store.settings.wallpaper" class="wp-clear-btn" @click="store.settings.wallpaper = ''">清除壁纸（恢复长廊）</button>
            </div>
            <div class="set-block">
              <div class="set-label">上传自定义壁纸</div>
              <label class="wp-upload-btn">
                <input type="file" accept="image/*" hidden @change="onWallpaperUpload" />
                📁 选择图片文件
              </label>
            </div>
            <div class="set-block">
              <div class="set-label">预设壁纸</div>
              <div class="wp-grid">
                <div v-for="(preset, pi) in wallpaperPresets" :key="pi" class="wp-preset" :class="{ selected: store.settings.wallpaper === preset.url }" @click="store.settings.wallpaper = preset.url">
                  <div class="wp-preset-img" :style="{ backgroundImage: 'url(' + preset.url + ')' }" />
                  <span class="wp-preset-label">{{ preset.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { getContainer, getContainerRect, moveContainer } from '../util/container';
import ApiFields from './ApiFields.vue';
import { useForumStore } from './store';

// ==================== STORE ====================
const store = useForumStore();

// ==================== STATE ====================
const expanded = ref(false);
const view = ref<'desktop' | 'forum' | 'settings'>('desktop');
const settingsSub = ref('');
const replyText = ref('');
const isDragging = ref(false);
const currentTime = ref('');

// Refs
const btnRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const phoneRef = ref<HTMLElement | null>(null);

// ==================== COMPUTED ====================
const phoneFrameStyle = computed(() => ({}));

const wallpaperBg = computed(() => {
  if (!store.settings.wallpaper) return {};
  return { background: `url(${store.settings.wallpaper}) center/cover no-repeat` };
});

const previewStyle = computed(() => {
  if (!store.settings.wallpaper) return { background: 'var(--bg)' };
  return {
    backgroundImage: `url(${store.settings.wallpaper})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
});

// ==================== DATA ====================
const sections = [
  { key: 'complaints', label: '契约者吐槽区', icon: '💬' },
  { key: 'intel', label: '势力情报分享区', icon: '🔍' },
  { key: 'dungeon', label: '副本经历分享区', icon: '⚔️' },
  { key: 'build', label: '构筑分享区', icon: '📐' },
  { key: 'trade', label: '装备道具交易区', icon: '💰' },
  { key: 'rank', label: '契约者排行榜', icon: '🏆' },
];

const initialThreads = [
  { id: 1, section: 'complaints', title: '刚进准备区就被恶魔旅团三个二阶堵门收保护费', preview: '卡在传送门外不交50UP就威胁弄死你，特管局呢？', author: '血泪萌新', replies: 247, time: '8分钟前', hotComment: '特管局不管一阶区，自求多福吧兄弟', hotAuthor: '过来人', hotLikes: 89 },
  { id: 2, section: 'complaints', title: '有人遇到过02号雌小鬼引导员吗', preview: '杂鱼杂鱼叫个不停，要不是主城禁武早把她头拧了', author: '碎骨者', replies: 502, time: '1小时前', hotComment: '我觉得挺可爱的啊（小声）', hotAuthor: '匿名列兵', hotLikes: 234 },
  { id: 3, section: 'complaints', title: '医疗中心修断腿要100UP通关才拿180UP', preview: '这游戏是人玩的？我现在单腿跳着走', author: '断腿列兵', replies: 156, time: '3小时前', hotComment: '找方舟集团外勤买黑市接骨药水只要40UP', hotAuthor: '省钱达人', hotLikes: 312 },
  { id: 11, section: 'intel', title: '一阶新人必看：CR3.0观察态度下敌人强化实测', preview: '基准等级+1不是开玩笑，杂兵都比你高一级', author: '退役指导员', replies: 89, time: '1小时前', hotComment: '我CR4.0了还没死，是不是该骄傲一下', hotAuthor: '作死选手', hotLikes: 56 },
  { id: 12, section: 'intel', title: '恶魔旅团收保护费的固定时间段整理', preview: '凌晨2点到6点他们不在，趁这时候出门', author: '匿名好心人', replies: 312, time: '4小时前', hotComment: '谢谢你救了我的命和钱包', hotAuthor: '感恩的新人', hotLikes: 201 },
  { id: 19, section: 'dungeon', title: '从咒术回战活着回来了', preview: '诅咒师领域展开困住差点当场暴毙，太恶心了', author: '幸存者', replies: 178, time: '20分钟前', hotComment: '咒术回战出的技能卷轴品质贼高，值得冒险', hotAuthor: '赏金猎人', hotLikes: 98 },
  { id: 27, section: 'build', title: '一阶纯STR近战流心得', preview: '前期伤害高但脆，CON至少拉到8保命', author: '力量白痴', replies: 56, time: '4小时前', hotComment: 'STR10力量极限拳王，打杂兵一拳一个真爽', hotAuthor: '暴力美学', hotLikes: 45 },
  { id: 35, section: 'trade', title: '出蓝色一阶长剑强化+3', preview: 'STR主属性加成8，副属性AGI加成3，伤害骰1d8，开价180UP', author: '卖剑书生', replies: 12, time: '20分钟前', hotComment: '150UP收，多了不要', hotAuthor: '砍价王', hotLikes: 3 },
];

const rankData = [
  { key: '人榜', title: '人榜（一阶 Lv.1~20）· 第21赛季', items: [
    { rank: '1', name: '"无距之刃"', lv: '20', team: '特管局' },
    { rank: '2', name: '"镀金笼"', lv: '20', team: 'APJC' },
    { rank: '3', name: '"试剂品"', lv: '20', team: '瑞辰基金会' },
    { rank: '4', name: '"红线瞄准"', lv: '20', team: 'OETA' },
    { rank: '5', name: '"殉道之焰"', lv: '20', team: '神圣教会' },
    { rank: '6', name: '"碎齿"', lv: '20', team: '恶魔旅团' },
    { rank: '7', name: '"毒牙"', lv: '18', team: '恶魔旅团' },
    { rank: '8', name: '"肉盾"', lv: '17', team: '恶魔旅团' },
    { rank: '9', name: '"催债人"', lv: '16', team: '恶魔旅团' },
    { rank: '10', name: '"走狗"', lv: '15', team: '恶魔旅团' },
  ]},
  { key: '黄榜', title: '黄榜（二阶 Lv.21~40）· 第21赛季', items: [
    { rank: '1', name: '"超新星"', lv: '40', team: 'OETA' },
    { rank: '2', name: '"红色绞肉机"', lv: '40', team: '零号局' },
    { rank: '3', name: '"寸劲"', lv: '40', team: '特管局' },
    { rank: '4', name: '"公式解"', lv: '40', team: 'EJSSA' },
    { rank: '5', name: '"潜行者"', lv: '40', team: '方舟集团' },
    { rank: '6', name: '"噬魂"', lv: '34', team: '恶魔旅团' },
    { rank: '7', name: '"铁蹄"', lv: '33', team: '恶魔旅团' },
    { rank: '8', name: '"蛛网"', lv: '32', team: '恶魔旅团' },
    { rank: '9', name: '"裂地"', lv: '31', team: '恶魔旅团' },
    { rank: '10', name: '"血债"', lv: '30', team: '恶魔旅团' },
  ]},
  { key: '玄榜', title: '玄榜（三阶 Lv.41~60）· 第21赛季', items: [
    { rank: '1', name: '"雷切"', lv: '60', team: 'APJC' },
    { rank: '2', name: '"黄金猎犬"', lv: '60', team: '瑞辰基金会' },
    { rank: '3', name: '"暴风突击"', lv: '60', team: 'OETA' },
    { rank: '4', name: '"铁壁"', lv: '60', team: '特管局' },
    { rank: '5', name: '"圣盾之矛"', lv: '60', team: '神圣教会' },
    { rank: '6', name: '"屠夫"', lv: '60', team: '恶魔旅团' },
    { rank: '7', name: '"锁链"', lv: '60', team: '恶魔旅团' },
    { rank: '8', name: '"腐蚀"', lv: '60', team: '恶魔旅团' },
    { rank: '9', name: '"碎骨"', lv: '59', team: '恶魔旅团' },
    { rank: '10', name: '"暗刺"', lv: '58', team: '恶魔旅团' },
  ]},
  { key: '地榜', title: '地榜（四阶 Lv.61~80）· 第21赛季', items: [
    { rank: '1', name: '"铁幕先驱"', lv: '80', team: 'OETA' },
    { rank: '2', name: '"白骨沙皇"', lv: '80', team: '零号局' },
    { rank: '3', name: '"无声令"', lv: '80', team: '特管局' },
    { rank: '4', name: '"一刀两断"', lv: '80', team: 'APJC' },
    { rank: '5', name: '"灰烬审判"', lv: '80', team: '神圣教会' },
    { rank: '6', name: '"献祭之犬"', lv: '80', team: '恶魔旅团' },
    { rank: '7', name: '"血色合同"', lv: '80', team: '瑞辰基金会' },
    { rank: '8', name: '"千面行者"', lv: '80', team: '独立散人' },
    { rank: '9', name: '"临界观测"', lv: '78', team: 'EJSSA' },
    { rank: '10', name: '"方舟守门人"', lv: '77', team: '方舟集团' },
  ]},
  { key: '天榜', title: '天榜（五阶 Lv.81~100）· 第21赛季', items: [
    { rank: '1', name: '"天榜之首·执剑镇国"', lv: '100', team: '特管局' },
    { rank: '2', name: '"机械之神"', lv: '100', team: 'OETA' },
    { rank: '3', name: '"永夜真祖"', lv: '100', team: '瑞辰基金会' },
    { rank: '4', name: '"根源窥视者"', lv: '100', team: 'EJSSA' },
    { rank: '5', name: '"绝对零度"', lv: '100', team: '零号局' },
    { rank: '6', name: '"忍术之神"', lv: '100', team: 'APJC' },
    { rank: '7', name: '"圣裁之翼"', lv: '100', team: '神圣教会' },
    { rank: '8', name: '"堕落晨星"', lv: '100', team: '恶魔旅团' },
    { rank: '9', name: '"病毒君王"', lv: '99', team: '方舟集团' },
    { rank: '10', name: '"征服者"', lv: '99', team: '非盟特委会' },
  ]},
];

const wallpaperPresets = [
  { name: '预设壁纸 1', url: '' },
  { name: '预设壁纸 2', url: '' },
  { name: '预设壁纸 3', url: '' },
];

const filteredThreads = computed(() => {
  return store.threads.filter(t => t.section === store.activeSection);
});

const selectedThread = computed(() => {
  return store.selectedThread;
});

// ==================== DRAG LOGIC (基于最外层容器) ====================
let dragStartX = 0;
let dragStartY = 0;
let dragStartLeft = 0;
let dragStartTop = 0;
let wasDragging = false;

function startContainerDrag(e: MouseEvent | TouchEvent) {
  const evt = 'touches' in e ? e.touches[0] : e;
  const rect = getContainerRect();
  dragStartX = evt.clientX;
  dragStartY = evt.clientY;
  dragStartLeft = rect?.left ?? 0;
  dragStartTop = rect?.top ?? 0;
  wasDragging = false;

  const doc = getContainer()?.ownerDocument ?? document;
  doc.addEventListener('mousemove', onDocMouseMove);
  doc.addEventListener('mouseup', onDocMouseUp);
  doc.addEventListener('touchmove', onDocTouchMove, { passive: false });
  doc.addEventListener('touchend', onDocTouchEnd);
}

function onDocMouseMove(e: MouseEvent) {
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (!wasDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    wasDragging = true;
    isDragging.value = true;
  }
  if (wasDragging) {
    moveContainer(dragStartLeft + dx, dragStartTop + dy);
  }
}

function onDocTouchMove(e: TouchEvent) {
  if (e.touches.length === 0) return;
  const touch = e.touches[0];
  const dx = touch.clientX - dragStartX;
  const dy = touch.clientY - dragStartY;
  if (!wasDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    wasDragging = true;
    isDragging.value = true;
  }
  if (wasDragging) {
    moveContainer(dragStartLeft + dx, dragStartTop + dy);
    e.preventDefault();
  }
}

function onDocMouseUp() {
  cleanupDrag();
  if (wasDragging) {
    // position already saved by moveContainer
  } else {
    openPanel();
  }
}

function onDocTouchEnd() {
  cleanupDrag();
  if (wasDragging) {
    // position already saved by moveContainer
  } else {
    openPanel();
  }
}

function cleanupDrag() {
  const doc = getContainer()?.ownerDocument ?? document;
  doc.removeEventListener('mousemove', onDocMouseMove);
  doc.removeEventListener('mouseup', onDocMouseUp);
  doc.removeEventListener('touchmove', onDocTouchMove);
  doc.removeEventListener('touchend', onDocTouchEnd);
  isDragging.value = false;
}

function onBtnMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  startContainerDrag(e);
}

function onBtnTouchStart(e: TouchEvent) {
  startContainerDrag(e);
}

/** 展开时通过状态栏拖拽手机 */
function onHeaderMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('button')) return;
  startContainerDrag(e);
}

function onHeaderTouchStart(e: TouchEvent) {
  if ((e.target as HTMLElement).closest('button')) return;
  startContainerDrag(e);
}

// ==================== NAVIGATION ====================
function openPanel() {
  expanded.value = true;
  view.value = 'desktop';
  replyText.value = '';
  store.init();
}

function closePanel() {
  expanded.value = false;
  view.value = 'desktop';
  selectedThread.value = null;
  settingsSub.value = '';
}

function openForum() {
  view.value = 'forum';
  selectedThread.value = null;
}

function openSettings() {
  view.value = 'settings';
  settingsSub.value = '';
}

function goDesktop() {
  view.value = 'desktop';
  selectedThread.value = null;
  settingsSub.value = '';
}

async function openThread(thread: any) {
  store.selectedThread = thread;
  if (!thread.posts || thread.posts.length <= 1) {
    await store.generateThreadDetail(thread);
  }
}

async function sendReply() {
  if (!replyText.value.trim() || !selectedThread.value) return;
  const now = new Date();
  const timeStr = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  selectedThread.value.posts.push({
    id: Date.now(),
    floor: selectedThread.value.posts.length + 1,
    author: '我',
    time: timeStr,
    content: replyText.value.trim(),
    depth: 1,
  });
  selectedThread.value.replies++;
  replyText.value = '';
  await store.generateReplies(selectedThread.value);
}

async function refreshSection() {
  store.lastErrorSection = store.activeSection;
  await store.refreshSection(store.activeSection);
}

function toggleWorldbook(name: string) {
  const idx = store.settings.selectedWorldbooks.indexOf(name);
  if (idx >= 0) {
    store.settings.selectedWorldbooks.splice(idx, 1);
  } else {
    store.settings.selectedWorldbooks.push(name);
  }
}

function onWallpaperUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    store.settings.wallpaper = reader.result as string;
  };
  reader.readAsDataURL(file);
}

function updateTime() {
  const now = new Date();
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function clampPanelPosition() {
  btnBottom.value = clampPosition(btnBottom.value, 0, ownerWin.innerHeight - 64);
  btnRight.value = clampPosition(btnRight.value, 0, ownerWin.innerWidth - 64);
}

// ==================== LIFECYCLE ====================
onMounted(() => {
  updateTime();
  const interval = window.setInterval(updateTime, 30000);

  onUnmounted(() => {
    window.clearInterval(interval);
    cleanupDrag();
  });
});
</script>

<style scoped>
/* ============ FLOAT BTN ============ */
.float-btn {
  --bg: #100c09; --bg2: #1a1410; --bg3: #221a14;
  --rust: #4a2010; --rust-l: #6a3020;
  --blood: #6a1818; --blood-b: #901e1e;
  --amber: #f0d080; --amber-d: #c8a860;
  --chalk: #eee8e0; --chalk-d: #b0a090;
  --iron: #4a4440; --iron-d: #2a2825;

  position: absolute;
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(145deg, #2a2520, #141210);
  border: 2px solid rgba(200,160,100,0.2);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(220,180,120,0.1);
  user-select: none; -webkit-user-select: none;
  touch-action: none;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
.float-btn:hover {
  transform: scale(1.06);
  border-color: rgba(240,208,128,0.4);
  box-shadow: 0 6px 32px rgba(0,0,0,0.7), 0 0 0 6px rgba(180,40,40,0.2);
}
.float-btn.dragging {
  transform: scale(1.1); cursor: grabbing;
  border-color: rgba(240,208,128,0.6);
  box-shadow: 0 8px 40px rgba(0,0,0,0.7), 0 0 0 10px rgba(180,40,40,0.3);
  transition: none;
}
.btn-core { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; }
.btn-glyph { width: 30px; height: 30px; color: var(--amber-d); transition: color 0.2s; }
.float-btn:hover .btn-glyph { color: var(--amber); }
.btn-halo {
  position: absolute; inset: -5px; border-radius: 50%;
  border: 2px solid rgba(180,40,40,0.25);
  animation: bloodPulse 3s ease-in-out infinite;
}
.float-btn:hover .btn-halo { border-color: rgba(180,40,40,0.55); animation-duration: 1.5s; }
.float-btn.dragging .btn-halo { border-color: rgba(180,40,40,0.7); animation-duration: 1s; }

@keyframes bloodPulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.07); }
}

/* ============ PANEL / PHONE ============ */
.panel-overlay {
  position: fixed; inset: 0;
  z-index: 2147483630;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.panel-enter-active { transition: opacity 0.35s; }
.panel-enter-active .phone-frame { transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s; }
.panel-leave-active { transition: opacity 0.25s; }
.panel-leave-active .phone-frame { transition: transform 0.3s ease-in, opacity 0.2s; }
.panel-enter-from { opacity: 0; }
.panel-enter-from .phone-frame { transform: scale(0.1); opacity: 0; }
.panel-leave-to { opacity: 0; }
.panel-leave-to .phone-frame { transform: scale(0.1); opacity: 0; }

.phone-frame {
  width: 320px; height: 640px;
  border-radius: 42px;
  background: linear-gradient(180deg, #1a1510, #100c09);
  border: 2px solid rgba(140,100,60,0.2);
  box-shadow: 0 0 0 6px #2a2520, 0 0 0 8px rgba(80,40,20,0.3), 0 30px 80px rgba(0,0,0,0.7);
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
}

/* ============ STATUS BAR ============ */
.status-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 28px 0; height: 32px; flex-shrink: 0;
  font-size: 11px; color: var(--amber-d);
  font-family: "Courier New", monospace;
  cursor: grab;
  user-select: none;
}
.status-bar:active { cursor: grabbing; }
.status-label { font-size: 10px; letter-spacing: 2px; color: var(--blood-b); }

.minimize-btn {
  position: absolute; top: 36px; right: 16px; z-index: 20;
  width: 26px; height: 26px; border-radius: 50%;
  border: 1.5px solid rgba(200,160,100,0.25);
  background: rgba(20,14,10,0.8);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.minimize-btn span {
  display: block; width: 10px; height: 1.5px;
  background: rgba(240,208,128,0.7); border-radius: 1px;
}
.minimize-btn:hover { background: rgba(180,40,40,0.25); border-color: rgba(180,40,40,0.5); }

/* ============ DESKTOP ============ */
.desktop-view { flex: 1; display: flex; flex-direction: column; position: relative; }
.corridor-bg { position: absolute; inset: 0; overflow: hidden; background: #0a0806; }
.corridor-ceiling {
  position: absolute; top: 0; left: 0; right: 0; height: 30%;
  background: linear-gradient(180deg, #181410, #100c09 60%, #0c0806);
  border-bottom: 1px solid rgba(80,40,20,0.35);
}
.corridor-ceiling::after {
  content: ''; position: absolute; bottom: 0; left: 20%; right: 20%; height: 1px;
  background: rgba(200,40,30,0.35); box-shadow: 0 0 8px rgba(200,40,30,0.25);
}
.corridor-left {
  position: absolute; top: 30%; left: 0; bottom: 25%; width: 25%;
  background: linear-gradient(90deg, rgba(30,15,8,0.9), rgba(15,8,4,0.4));
  clip-path: polygon(0 0, 100% 8%, 100% 92%, 0 100%);
}
.corridor-left::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 40% 30%, rgba(80,20,12,0.45), transparent 60%),
              radial-gradient(ellipse at 60% 70%, rgba(50,14,8,0.35), transparent 50%);
  animation: fleshPulse 4s ease-in-out infinite;
}
.corridor-right {
  position: absolute; top: 30%; right: 0; bottom: 25%; width: 25%;
  background: linear-gradient(270deg, rgba(30,15,8,0.9), rgba(15,8,4,0.4));
  clip-path: polygon(0 8%, 100% 0, 100% 100%, 0 92%);
}
.corridor-right::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 60% 40%, rgba(80,20,12,0.4), transparent 55%),
              radial-gradient(ellipse at 30% 60%, rgba(50,14,8,0.35), transparent 50%);
  animation: fleshPulse 4.5s ease-in-out infinite 1s;
}
.corridor-floor {
  position: absolute; bottom: 0; left: 0; right: 0; height: 25%;
  background: linear-gradient(0deg, #0e0a06, #0a0805 60%, transparent);
  background-image: linear-gradient(90deg, rgba(60,35,20,0.25) 1px, transparent 1px),
                    linear-gradient(0deg, rgba(60,35,20,0.2) 1px, transparent 1px);
  background-size: 30px 30px;
  border-top: 1px solid rgba(70,35,20,0.35);
}
.corridor-end {
  position: absolute; top: 30%; left: 25%; right: 25%; bottom: 25%;
  background: radial-gradient(ellipse at center, rgba(200,40,25,0.2), transparent 70%);
  animation: endBreathe 3s ease-in-out infinite;
}
@keyframes fleshPulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
@keyframes endBreathe { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.03)} }

.app-grid {
  position: relative; z-index: 2;
  display: flex; justify-content: center; gap: 36px; padding-top: 80px;
}
.app-icon-wrapper {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; cursor: pointer; transition: transform 0.15s;
}
.app-icon-wrapper:active { transform: scale(0.88); }
.app-icon {
  width: 60px; height: 60px; border-radius: 15px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(0,0,0,0.5); transition: box-shadow 0.2s;
}
.app-icon-wrapper:hover .app-icon { box-shadow: 0 8px 30px rgba(0,0,0,0.7), 0 0 20px rgba(180,40,40,0.35); }
.app-icon svg { width: 28px; height: 28px; color: var(--amber-d); }
.forum-icon { background: linear-gradient(135deg, #3a1a10, #201008); border: 1.5px solid rgba(240,208,128,0.25); }
.settings-icon { background: linear-gradient(135deg, #2a2825, #181410); border: 1.5px solid rgba(200,140,100,0.25); }
.app-label { font-size: 11px; color: var(--chalk-d); letter-spacing: 2px; }
.desktop-footer {
  position: absolute; bottom: 30px; left: 0; right: 0;
  text-align: center; z-index: 2;
  font-size: 10px; color: var(--amber-d); letter-spacing: 4px; opacity: 0.6;
}

/* ============ APP PAGE ============ */
.app-page {
  flex: 1; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #1a1410, #100c09);
  position: relative; z-index: 5; min-height: 0;
}
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; height: 44px; flex-shrink: 0;
  background: rgba(30,20,14,0.95);
  border-bottom: 1px solid rgba(80,40,20,0.35);
}
.hdr-btn {
  width: 36px; height: 36px; border: none; background: transparent;
  color: var(--amber-d); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  border-radius: 50%; flex-shrink: 0;
}
.hdr-btn svg { width: 18px; height: 18px; }
.hdr-btn:hover { background: rgba(255,255,255,0.05); }
.hdr-title {
  font-size: 13px; font-weight: 600; color: var(--chalk);
  letter-spacing: 1px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; max-width: 200px; text-align: center;
}
.hdr-spacer { width: 36px; flex-shrink: 0; }

/* ============ SCROLL ============ */
.scroll-area {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;
}
.scroll-area::-webkit-scrollbar { width: 3px; }
.scroll-area::-webkit-scrollbar-thumb { background: rgba(120,80,40,0.4); border-radius: 3px; }

/* ============ SECTION TABS ============ */
.section-tabs {
  display: flex; gap: 2px; padding: 6px 4px; flex-shrink: 0;
  overflow-x: auto; flex-wrap: wrap;
}
.section-tabs::-webkit-scrollbar { height: 2px; }
.section-tabs::-webkit-scrollbar-thumb { background: rgba(120,80,40,0.4); }

.section-tab {
  flex-shrink: 0; display: flex; align-items: center; gap: 3px;
  padding: 5px 8px; border: 1px solid transparent; background: transparent;
  color: var(--chalk-d); font-size: 10px; cursor: pointer;
  border-radius: 4px; transition: all 0.2s; white-space: nowrap;
}
.section-tab:hover { color: var(--chalk); border-color: rgba(120,80,40,0.25); }
.section-tab.active { color: var(--amber); background: rgba(180,40,40,0.12); border-color: rgba(180,40,40,0.3); }
.tab-icon { font-size: 12px; }
.tab-label { font-size: 10px; }

.refresh-tab { border-color: rgba(100,140,180,0.3); color: #8ab4d8; }
.refresh-tab:hover { border-color: rgba(100,140,180,0.6); color: #a0c8e8; }
.refresh-tab:disabled { opacity: 0.4; }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

/* ============ THREAD CARDS ============ */
.thread-card {
  padding: 10px 12px; cursor: pointer;
  border-bottom: 1px solid rgba(80,40,20,0.18); transition: background 0.1s;
}
.thread-card:hover { background: rgba(255,255,255,0.03); }
.tc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.tc-title { font-size: 12.5px; color: var(--chalk); font-weight: 500; flex: 1; margin-right: 8px; line-height: 1.3; }
.tc-replies { font-size: 10px; color: var(--amber-d); white-space: nowrap; flex-shrink: 0; }
.tc-preview { font-size: 11px; color: var(--chalk-d); margin-bottom: 4px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tc-meta { display: flex; gap: 10px; font-size: 10px; color: var(--chalk-d); margin-bottom: 4px; }
.tc-hot {
  font-size: 10px; color: var(--amber-d);
  background: rgba(180,40,40,0.08); padding: 4px 8px;
  border-radius: 4px; line-height: 1.4;
  border-left: 2px solid rgba(180,40,40,0.35);
}
.hot-label { margin-right: 4px; }
.hot-author { color: var(--amber); font-weight: 500; }
.hot-likes { margin-left: 6px; color: var(--chalk-d); }

/* ============ RANKINGS ============ */
.rank-tabs { display: flex; gap: 4px; padding: 6px 8px; flex-shrink: 0; }
.rank-tab {
  flex: 1; padding: 5px 0; border: 1px solid rgba(80,40,20,0.3);
  background: transparent; color: var(--chalk-d); font-size: 10px;
  cursor: pointer; border-radius: 4px; text-align: center; transition: all 0.2s;
}
.rank-tab:hover { color: var(--chalk); }
.rank-tab.active { color: var(--amber); border-color: rgba(180,40,40,0.5); background: rgba(180,40,40,0.12); }
.rank-board { padding: 8px; }
.rank-title { text-align: center; font-size: 13px; color: var(--amber); margin-bottom: 10px; letter-spacing: 1px; }
.rank-hdr { display: flex; padding: 4px 8px; font-size: 10px; color: var(--chalk-d); border-bottom: 1px solid rgba(80,40,20,0.35); margin-bottom: 4px; }
.rh-rank { width: 24px; }
.rh-name { flex: 1; }
.rh-lv { width: 36px; text-align: center; }
.rh-team { width: 72px; text-align: right; }
.rank-row { display: flex; align-items: center; padding: 6px 8px; font-size: 11px; color: var(--chalk); border-bottom: 1px solid rgba(80,40,20,0.1); }
.rank-row:hover { background: rgba(255,255,255,0.03); }
.rank-row.top3 { background: rgba(180,40,40,0.06); }
.ri-rank { width: 24px; font-weight: 700; color: var(--chalk-d); }
.ri-rank.r1 { color: #f0c040; }
.ri-rank.r2 { color: silver; }
.ri-rank.r3 { color: #cd7f32; }
.ri-name { flex: 1; }
.ri-lv { width: 36px; text-align: center; color: var(--amber-d); }
.ri-team { width: 72px; text-align: right; font-size: 10px; color: var(--chalk-d); }

/* ============ THREAD DETAIL ============ */
.d-post { padding: 10px 14px; border-bottom: 1px solid rgba(80,40,20,0.18); }
.dp-head { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.dp-author { font-size: 11px; color: var(--amber); font-weight: 600; }
.dp-floor { font-size: 10px; color: var(--chalk-d); font-family: "Courier New", monospace; }
.dp-time { font-size: 10px; color: var(--chalk-d); margin-left: auto; }
.dp-content { font-size: 12px; color: var(--chalk); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }

.reply-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; flex-shrink: 0;
  background: rgba(30,20,14,0.95);
  border-top: 1px solid rgba(80,40,20,0.3);
}
.reply-input {
  flex: 1; padding: 7px 10px; background: rgba(16,12,8,0.7);
  border: 1px solid rgba(80,40,20,0.35); border-radius: 6px;
  color: var(--chalk); font-size: 11px; outline: none;
}
.reply-input::placeholder { color: var(--chalk-d); opacity: 0.5; }
.reply-input:focus { border-color: rgba(180,40,40,0.5); }
.reply-btn {
  flex-shrink: 0; padding: 7px 14px;
  background: rgba(180,40,40,0.25);
  border: 1px solid rgba(180,40,40,0.4);
  color: var(--amber); font-size: 11px; border-radius: 6px; cursor: pointer;
}
.reply-btn:hover { background: rgba(180,40,40,0.4); }
.reply-btn:disabled { opacity: 0.3; cursor: default; }
.reply-wait { font-size: 10px; color: var(--amber-d); white-space: nowrap; }

.gen-overlay {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  color: var(--amber-d); font-size: 12px;
}
.gen-spinner { width: 32px; height: 32px; border: 3px solid rgba(180,40,40,0.2); border-top-color: var(--amber); border-radius: 50%; animation: spin 0.8s linear infinite; }

.d-post.nest1 { margin-left: 16px; border-left: 2px solid rgba(100,140,180,0.3); }
.d-post.nest2 { margin-left: 32px; border-left: 2px solid rgba(140,100,60,0.25); }
.retry-link { background: transparent; border: none; color: var(--amber); cursor: pointer; text-decoration: underline; font-size: 11px; }

/* ============ SETTINGS ============ */
.settings-menu { padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
.menu-btn {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 14px 16px; background: rgba(30,18,12,0.5);
  border: 1px solid rgba(80,40,20,0.25); border-radius: 10px;
  color: var(--chalk); font-size: 13px; cursor: pointer; transition: all 0.2s;
}
.menu-btn:hover { background: rgba(180,40,40,0.08); border-color: rgba(180,40,40,0.3); }
.menu-icon { font-size: 18px; width: 28px; text-align: center; }
.menu-arrow { margin-left: auto; color: var(--chalk-d); font-size: 18px; }

.settings-inner { padding: 8px 12px; }
.set-block { margin-bottom: 14px; }
.set-label { font-size: 11px; color: var(--amber); margin-bottom: 6px; letter-spacing: 1px; }
.set-row { display: flex; gap: 8px; }
.set-hint { font-size: 10px; color: var(--chalk-d); opacity: 0.6; padding: 4px 0; }

.mode-btn {
  flex: 1; padding: 8px; background: rgba(16,12,8,0.7);
  border: 1px solid rgba(80,40,20,0.3);
  color: var(--chalk-d); font-size: 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s;
}
.mode-btn:hover { color: var(--chalk); }
.mode-btn.active { color: var(--amber); border-color: rgba(180,40,40,0.5); background: rgba(180,40,40,0.15); }

.test-btn {
  display: block; width: 100%; margin-top: 8px; padding: 8px;
  background: rgba(60,100,140,0.2); border: 1px solid rgba(80,120,160,0.4);
  color: #90c0e0; font-size: 11px; border-radius: 6px; cursor: pointer; transition: all 0.2s;
}
.test-btn:hover { background: rgba(60,100,140,0.35); }
.test-btn:disabled { opacity: 0.4; }

.test-msg {
  margin-top: 6px; padding: 6px 10px;
  background: rgba(180,40,40,0.1); border: 1px solid rgba(180,40,40,0.3);
  border-radius: 4px; font-size: 10px; color: var(--blood-b); word-break: break-all;
}
.test-msg.ok { background: rgba(40,140,80,0.1); border-color: rgba(40,140,80,0.3); color: #60d080; }

.wb-load-btn {
  display: block; width: 100%; margin-bottom: 6px; padding: 6px;
  background: rgba(100,80,40,0.15); border: 1px solid rgba(140,100,40,0.3);
  color: var(--amber-d); font-size: 10px; border-radius: 4px; cursor: pointer;
}
.wb-load-btn:hover { background: rgba(100,80,40,0.25); }
.wb-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: pointer; border-radius: 4px; transition: background 0.1s; }
.wb-row:hover { background: rgba(255,255,255,0.03); }
.wb-check { font-size: 12px; color: var(--chalk-d); }
.wb-check.on { color: var(--amber); }
.wb-name { font-size: 11px; color: var(--chalk); }

/* ============ WALLPAPER ============ */
.wp-preview { width: 100%; height: 120px; border-radius: 8px; border: 1px solid rgba(80,40,20,0.35); margin-bottom: 8px; background: var(--bg); }
.wp-clear-btn { display: block; width: 100%; padding: 6px; background: rgba(180,40,40,0.15); border: 1px solid rgba(180,40,40,0.3); color: var(--amber-d); font-size: 10px; border-radius: 4px; cursor: pointer; }
.wp-clear-btn:hover { background: rgba(180,40,40,0.25); }
.wp-upload-btn { display: block; width: 100%; padding: 10px; background: rgba(60,100,140,0.15); border: 1px solid rgba(80,120,160,0.3); color: #90c0e0; font-size: 12px; border-radius: 6px; cursor: pointer; text-align: center; transition: all 0.2s; }
.wp-upload-btn:hover { background: rgba(60,100,140,0.25); }
.wp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.wp-preset { cursor: pointer; text-align: center; transition: transform 0.15s; }
.wp-preset:hover { transform: scale(1.03); }
.wp-preset.selected .wp-preset-img { border-color: var(--amber); box-shadow: 0 0 12px rgba(240,208,128,0.3); }
.wp-preset-img { width: 100%; aspect-ratio: 9/16; border-radius: 6px; border: 2px solid rgba(80,40,20,0.3); background-size: cover; background-position: center; background-color: var(--bg); }
.wp-preset-label { font-size: 10px; color: var(--chalk-d); margin-top: 4px; display: block; }

/* ============ MISC ============ */
.set-err { margin-top: 8px; padding: 8px 12px; background: rgba(180,40,40,0.12); border: 1px solid rgba(180,40,40,0.35); border-radius: 6px; font-size: 11px; color: var(--blood-b); }
.refresh-err { padding: 8px 12px; margin: 4px 8px; background: rgba(180,40,40,0.12); border: 1px solid rgba(180,40,40,0.3); border-radius: 6px; font-size: 10px; color: var(--blood-b); }
.empty-msg { text-align: center; padding: 30px 0; color: var(--chalk-d); font-size: 12px; opacity: 0.7; }
</style>
