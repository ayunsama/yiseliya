// ============================================================
// 战斗轮 —— 前端内完整游玩（单层楼战斗）
// 开战楼层挂载完整战斗界面：
//   - 顶部：羊皮纸快照（我方左/敌方右/中央先攻）
//   - 中部：推演区（玩家输入 + AI 叙述/结算，滚动）
//   - 底部：输入框（玩家在前端内 RP，generateRaw 静默推演）
// 整场战斗在一层楼内完成；战斗结束将结果注入上下文（新楼层 + 变量数据）
// ============================================================

import { mountStreamingMessages } from '@util/streaming';
import App from './App.vue';

$(() => {
  try {
    // 只挂载「开战楼层」（含 ⚔️战斗轮 关键词）为完整战斗界面
    const { unmount } = mountStreamingMessages(() => createApp(App), {
      host: 'div',
      filter: (message_id, message) => {
        return message.includes('⚔️战斗轮') || message.includes('【战斗开始】');
      },
    });

    $(window).on('pagehide', () => unmount());

    console.log('[战斗轮] 前端内战斗界面已就绪');
    if (typeof toastr !== 'undefined') {
      toastr.success('战斗轮已就绪（检测到 ⚔️战斗轮 即开启战斗界面）', '加载成功');
    }
  } catch (e: any) {
    console.error('[战斗轮] 加载失败:', e?.message || e);
    if (typeof toastr !== 'undefined') {
      toastr.error('战斗轮加载失败：' + (e?.message || e), '战斗轮');
    }
  }
});
