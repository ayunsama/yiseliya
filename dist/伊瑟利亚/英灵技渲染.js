/**
 * 英灵技渲染脚本
 *
 * 将 AI 回复中的 <英灵技·技能名>...</英灵技> 标签渲染为精美的技能卡片。
 * 加载此脚本后，每次消息渲染时会自动扫描并替换标签内容。
 *
 * 【导入方式】
 *   在酒馆助手脚本库中添加以下内容:
 *   import 'https://your-host/dist/变量结构与状态栏代码/英灵技渲染.js';
 *
 *   或直接复制本脚本内容到酒馆助手脚本库中。
 */

// ============================================================
//  英灵技 CSS 样式（注入到页面）
// ============================================================
const SPIRIT_SKILL_STYLE_ID = 'spirit-skill-style';

function injectSpiritSkillStyles() {
  const css = `
    /* ===== 英灵技招式名横幅（12 种英灵差异化主题 + 特效） ===== */
    .spirit-skill-banner {
      position: relative;
      text-align: center;
      margin: 24px 0;
      padding: 8px 10px;
      overflow: hidden;
      animation: banner-pop 0.6s ease-out both;
    }
    .spirit-skill-banner canvas.skill-particles {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    }
    .spirit-skill-banner .banner-symbols,
    .spirit-skill-banner .banner-row {
      position: relative;
      z-index: 1;
    }
    .spirit-skill-banner .skill-effect {
      position: absolute;
      top: 18px;
      bottom: 18px;
      left: 0;
      right: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
      mix-blend-mode: screen;
    }
    .banner-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .banner-side {
      font-size: 26px;
      line-height: 1;
      animation: side-float 2.4s ease-in-out infinite;
    }
    .banner-side.left { animation-delay: 0s; }
    .banner-side.right { animation-delay: 1.2s; }
    @keyframes side-float {
      0%, 100% { transform: translateY(0) rotate(-5deg); }
      50%      { transform: translateY(-4px) rotate(5deg); }
    }
    /* 两侧符号染色（与各英灵主题契合） */
    .theme-eria .banner-side { color: #d99; text-shadow: 0 0 8px rgba(255, 180, 150, 0.7), 0 0 18px rgba(156, 74, 74, 0.5); }
    .theme-ilia .banner-side { color: #f0d48a; text-shadow: 0 0 8px rgba(255, 225, 150, 0.7), 0 0 18px rgba(201, 161, 59, 0.5); }
    .theme-lilith .banner-side { color: #c99fe0; text-shadow: 0 0 8px rgba(200, 120, 255, 0.7), 0 0 18px rgba(142, 68, 173, 0.55); }
    .theme-koriv .banner-side { color: #d6f4ff; text-shadow: 0 0 8px rgba(220, 250, 255, 0.7), 0 0 18px rgba(174, 232, 255, 0.5); }
    .theme-ren .banner-side { color: #d8b070; text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5), 0 0 8px rgba(216, 176, 112, 0.55); }
    .theme-satira .banner-side { color: #e08a7a; text-shadow: 0 0 8px rgba(255, 130, 110, 0.7), 0 3px 10px rgba(0, 0, 0, 0.5); }
    .theme-liefe .banner-side { color: #9ff0c0; text-shadow: 0 0 8px rgba(120, 255, 170, 0.7), 0 0 18px rgba(46, 204, 113, 0.5); }
    .theme-sophia .banner-side { color: #fff0d0; text-shadow: 0 0 10px rgba(255, 255, 255, 0.85), 0 0 22px rgba(255, 245, 210, 0.55); }
    .theme-iris .banner-side { color: #d8b0f8; text-shadow: 0 0 8px rgba(220, 160, 255, 0.7), 0 0 18px rgba(168, 85, 247, 0.5); }
    .theme-default .banner-side { color: #d4af6a; text-shadow: 0 0 8px rgba(240, 212, 138, 0.6); }
    @keyframes banner-pop {
      0%   { opacity: 0; transform: scale(0.7) translateY(-6px); filter: blur(4px); }
      60%  { opacity: 1; transform: scale(1.06); }
      100% { opacity: 1; transform: scale(1); filter: blur(0); }
    }
    .spirit-skill-banner::before,
    .spirit-skill-banner::after {
      content: '';
      display: block;
      height: 2px;
      margin: 0 auto;
      width: 92%;
      opacity: 0.6;
    }
    .spirit-skill-banner::before { margin-bottom: 8px; }
    .spirit-skill-banner::after { margin-top: 8px; }
    .banner-symbols {
      font-size: 16px;
      letter-spacing: 12px;
      line-height: 1;
      margin-bottom: 2px;
      animation: symbol-float 2.4s ease-in-out infinite;
    }
    @keyframes symbol-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-3px); }
    }
    .banner-name {
      font-weight: 900;
      font-size: 28px;
      letter-spacing: 6px;
      line-height: 1.25;
      font-family: 'Georgia', 'Noto Serif SC', serif;
      text-align: center;
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      position: relative;
    }
    .banner-name::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 45%;
      left: -60%;
      background: linear-gradient(100deg, transparent, rgba(255,255,255,0.7), transparent);
      transform: skewX(-18deg);
      animation: shine-sweep 3s ease-in-out infinite;
      mix-blend-mode: overlay;
    }
    @keyframes shine-sweep {
      0%   { left: -60%; }
      55%  { left: 115%; }
      100% { left: 115%; }
    }

    /* ---------- ① 艾莉卡 · 断钢战损 ---------- */
    .spirit-skill-banner.theme-eria::before,
    .spirit-skill-banner.theme-eria::after {
      background: linear-gradient(90deg, transparent, #9c4a4a, transparent);
    }
    .theme-eria .banner-symbols { color: #9c4a4a; text-shadow: 0 0 6px rgba(156,74,74,0.8); }
    .theme-eria .banner-name {
      background-image: linear-gradient(180deg, #f0d0c0 0%, #d99 45%, #9c4a4a 100%);
      color: #d99;
      -webkit-text-stroke: 1px rgba(156, 74, 74, 0.6);
      text-shadow: 0 0 6px rgba(255, 220, 200, 0.35), 2px 0 0 rgba(156, 74, 74, 0.55);
    }
    .theme-eria .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(156, 74, 74, 0.7), transparent);
    }

    /* ---------- ② 伊利亚 · 贤者秘术 ---------- */
    .spirit-skill-banner.theme-ilia::before,
    .spirit-skill-banner.theme-ilia::after {
      background: linear-gradient(90deg, transparent, #c9a13b, transparent);
    }
    .theme-ilia .banner-symbols { color: #c9a13b; text-shadow: 0 0 8px rgba(201,161,59,0.9); }
    .theme-ilia .banner-name {
      background-image: linear-gradient(180deg, #fff6d8 0%, #f0d48a 45%, #c9a13b 100%);
      color: #f0d48a;
      -webkit-text-stroke: 1px rgba(201, 161, 59, 0.6);
      text-shadow: 0 0 6px rgba(255, 225, 150, 0.5), 0 0 20px rgba(201, 161, 59, 0.4);
    }
    .theme-ilia .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(255, 215, 130, 0.8), transparent);
    }

    /* ---------- ③ 莉莉丝 · 魔女暗影 ---------- */
    .spirit-skill-banner.theme-lilith::before,
    .spirit-skill-banner.theme-lilith::after {
      background: linear-gradient(90deg, transparent, #8e44ad, transparent);
    }
    .theme-lilith .banner-symbols { color: #8e44ad; text-shadow: 0 0 8px rgba(142,68,173,0.9); }
    .theme-lilith .banner-name {
      background-image: linear-gradient(180deg, #e8c8ff 0%, #c99fe0 45%, #8e44ad 100%);
      color: #c99fe0;
      -webkit-text-stroke: 1px rgba(142, 68, 173, 0.6);
      text-shadow: 0 0 6px rgba(200, 120, 255, 0.5), 0 0 18px rgba(142, 68, 173, 0.5);
    }
    .theme-lilith .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(200, 120, 255, 0.75), transparent);
    }

    /* ---------- ④ 科里维坦 · 冰川龙息 ---------- */
    .spirit-skill-banner.theme-koriv::before,
    .spirit-skill-banner.theme-koriv::after {
      background: linear-gradient(90deg, transparent, #aee8ff, transparent);
    }
    .theme-koriv .banner-symbols { color: #aee8ff; text-shadow: 0 0 10px rgba(174,232,255,0.9); }
    .theme-koriv .banner-name {
      background-image: linear-gradient(180deg, #f0ffff 0%, #d6f4ff 45%, #5aa8c8 100%);
      color: #d6f4ff;
      -webkit-text-stroke: 1px rgba(255, 255, 255, 0.5);
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.5), 0 0 22px rgba(174, 232, 255, 0.4);
    }
    .theme-koriv .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(220, 250, 255, 0.85), transparent);
    }

    /* ---------- ⑤ 雷恩 · 街头痞气 ---------- */
    .spirit-skill-banner.theme-ren::before,
    .spirit-skill-banner.theme-ren::after {
      background: linear-gradient(90deg, transparent, #8a5f34, transparent);
    }
    .theme-ren .banner-symbols { color: #8a5f34; text-shadow: 0 0 6px rgba(138,95,52,0.8); }
    .theme-ren .banner-name {
      background-image: linear-gradient(180deg, #f0d0a0 0%, #d8b070 45%, #8a5f34 100%);
      color: #d8b070;
      -webkit-text-stroke: 1px rgba(90, 60, 30, 0.7);
      text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5), -1px -1px 0 rgba(138, 95, 52, 0.4);
    }
    .theme-ren .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(138, 95, 52, 0.6), transparent);
    }

    /* ---------- ⑥ 莎提拉 · 血祭死灵 ---------- */
    .spirit-skill-banner.theme-satira::before,
    .spirit-skill-banner.theme-satira::after {
      background: linear-gradient(90deg, transparent, #c0392b, transparent);
    }
    .theme-satira .banner-symbols { color: #c0392b; text-shadow: 0 0 8px rgba(192,57,43,0.9); }
    .theme-satira .banner-name {
      background-image: linear-gradient(180deg, #f0b0a0 0%, #e08a7a 45%, #c0392b 100%);
      color: #e08a7a;
      -webkit-text-stroke: 1px rgba(140, 30, 20, 0.7);
      text-shadow: 0 0 6px rgba(255, 140, 120, 0.5), 0 3px 10px rgba(0, 0, 0, 0.5);
    }
    .theme-satira .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(255, 130, 110, 0.75), transparent);
    }

    /* ---------- ⑦ 莉耶芙 · 妖精诡趣 ---------- */
    .spirit-skill-banner.theme-liefe::before,
    .spirit-skill-banner.theme-liefe::after {
      background: linear-gradient(90deg, transparent, #27ae60, transparent);
    }
    .theme-liefe .banner-symbols { color: #27ae60; text-shadow: 0 0 8px rgba(46,204,113,0.8); }
    .theme-liefe .banner-name {
      background-image: linear-gradient(180deg, #e0ffe8 0%, #9ff0c0 45%, #27ae60 100%);
      color: #9ff0c0;
      -webkit-text-stroke: 1px rgba(39, 174, 96, 0.6);
      text-shadow: 0 0 6px rgba(120, 255, 170, 0.5), 0 0 16px rgba(46, 204, 113, 0.4);
    }
    .theme-liefe .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(130, 255, 180, 0.75), transparent);
    }

    /* ---------- ⑧ 索菲亚 · 圣光天使 ---------- */
    .spirit-skill-banner.theme-sophia::before,
    .spirit-skill-banner.theme-sophia::after {
      background: linear-gradient(90deg, transparent, #f0d48a, transparent);
    }
    .theme-sophia .banner-symbols { color: #f0d48a; text-shadow: 0 0 12px rgba(240,212,138,0.9); }
    .theme-sophia .banner-name {
      background-image: linear-gradient(180deg, #ffffff 0%, #fff0d0 45%, #f0c870 100%);
      color: #f0d48a;
      -webkit-text-stroke: 1px rgba(255, 250, 235, 0.6);
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.85), 0 0 24px rgba(255, 255, 255, 0.6), 0 0 46px rgba(255, 245, 210, 0.45);
    }
    .theme-sophia .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.9), transparent);
    }

    /* ---------- ⑨ 伊莉丝 · 魔王晶核 ---------- */
    .spirit-skill-banner.theme-iris::before,
    .spirit-skill-banner.theme-iris::after {
      background: linear-gradient(90deg, transparent, #a855f7, transparent);
    }
    .theme-iris .banner-symbols { color: #a855f7; text-shadow: 0 0 8px rgba(168,85,247,0.9); }
    .theme-iris .banner-name {
      background-image: linear-gradient(180deg, #f0e0ff 0%, #d8b0f8 45%, #a855f7 100%);
      color: #d8b0f8;
      -webkit-text-stroke: 1px rgba(168, 85, 247, 0.6);
      text-shadow: 0 0 6px rgba(220, 160, 255, 0.5), 0 0 18px rgba(168, 85, 247, 0.5);
    }
    .theme-iris .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(210, 140, 255, 0.8), transparent);
    }

    /* ⑩ 莉莉娅 · 时间残响（死亡回溯） */
    .spirit-skill-banner.theme-chronos::before,
    .spirit-skill-banner.theme-chronos::after {
      background: linear-gradient(90deg, transparent, #e2b96f, transparent);
    }
    .theme-chronos .banner-symbols { color: #e2b96f; text-shadow: 0 0 8px rgba(226,185,111,0.9); }
    .theme-chronos .banner-name {
      background-image: linear-gradient(180deg, #fff6d8 0%, #f0d48a 45%, #b8860b 100%);
      color: #f0d48a;
      -webkit-text-stroke: 1px rgba(184, 134, 11, 0.6);
      text-shadow: 0 0 6px rgba(255, 225, 150, 0.5), 0 0 20px rgba(226, 185, 111, 0.45);
    }
    .theme-chronos .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(255, 215, 130, 0.8), transparent);
    }
    /* ⑪ 索利昂 · 黎明神恩 */
    .spirit-skill-banner.theme-dawn::before,
    .spirit-skill-banner.theme-dawn::after {
      background: linear-gradient(90deg, transparent, #f0c870, transparent);
    }
    .theme-dawn .banner-symbols { color: #f0c870; text-shadow: 0 0 10px rgba(240,200,112,0.95); }
    .theme-dawn .banner-name {
      background-image: linear-gradient(180deg, #fff8e0 0%, #f5d990 45%, #c89a3c 100%);
      color: #f5d990;
      -webkit-text-stroke: 1px rgba(255, 250, 235, 0.6);
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.85), 0 0 24px rgba(240, 200, 112, 0.55);
    }
    .theme-dawn .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(255, 244, 210, 0.95), transparent);
    }
    /* ⑫ 阿丝茉德 · 魅魔领域 */
    .spirit-skill-banner.theme-venus::before,
    .spirit-skill-banner.theme-venus::after {
      background: linear-gradient(90deg, transparent, #d87ab0, transparent);
    }
    .theme-venus .banner-symbols { color: #d87ab0; text-shadow: 0 0 8px rgba(216,122,176,0.9); }
    .theme-venus .banner-name {
      background-image: linear-gradient(180deg, #ffd0e4 0%, #f09ac8 45%, #a8447a 100%);
      color: #f09ac8;
      -webkit-text-stroke: 1px rgba(168, 68, 122, 0.6);
      text-shadow: 0 0 6px rgba(255, 192, 221, 0.5), 0 0 18px rgba(216, 122, 176, 0.5);
    }
    .theme-venus .banner-name::after {
      background: linear-gradient(100deg, transparent, rgba(255, 192, 221, 0.8), transparent);
    }

    /* ===== 专属特效层（每个英灵一个招牌特效） ===== */
    /* ① 艾莉卡 · 斩击光刃：一道斜光从左侧横扫而过 */
    .theme-eria .skill-effect {
      background: linear-gradient(100deg, transparent 20%, rgba(255,214,190,0.85) 50%, transparent 80%);
      transform: skewX(-16deg);
      transform-origin: left center;
      animation: fx-eria-slash 4.2s ease-in-out infinite;
    }
    @keyframes fx-eria-slash {
      0%, 42% { transform: skewX(-16deg) translateX(-140%); opacity: 0; }
      52%     { transform: skewX(-16deg) translateX(0); opacity: 1; }
      64%     { transform: skewX(-16deg) translateX(140%); opacity: 0.85; }
      72%, 100% { transform: skewX(-16deg) translateX(220%); opacity: 0; }
    }
    /* ② 伊利亚 · 金色法阵：圆环由中心扩散 */
    .theme-ilia .skill-effect {
      background: radial-gradient(circle, transparent 42%, rgba(240,212,138,0.9) 50%, transparent 58%);
      transform-origin: center;
      animation: fx-ilia-ring 4.6s ease-out infinite;
    }
    @keyframes fx-ilia-ring {
      0%, 36% { transform: scale(0.25); opacity: 0; }
      50%     { transform: scale(1); opacity: 1; }
      68%, 100% { transform: scale(1.7); opacity: 0; }
    }
    /* ③ 莉莉丝 · 湮灭漩涡：暗紫向中心收缩吞没 */
    .theme-lilith .skill-effect {
      background: radial-gradient(circle, rgba(142,68,173,0.9) 0%, rgba(91,42,112,0.5) 32%, transparent 62%);
      transform-origin: center;
      animation: fx-lilith-implode 4.2s ease-in-out infinite;
    }
    @keyframes fx-lilith-implode {
      0%, 30% { transform: scale(1.6); opacity: 0; }
      46%     { transform: scale(0.55); opacity: 0.95; }
      62%     { transform: scale(0.25); opacity: 0.5; }
      78%, 100% { transform: scale(1.5); opacity: 0; }
    }
    /* ④ 科里维坦 · 冰川凝结：冰晶从两侧向中间蔓延 */
    .theme-koriv .skill-effect {
      background: linear-gradient(90deg, rgba(174,232,255,0.55), transparent 38%, transparent 62%, rgba(174,232,255,0.55));
      transform-origin: center;
      animation: fx-koriv-frost 4.5s ease-in-out infinite;
    }
    @keyframes fx-koriv-frost {
      0%, 40% { transform: scaleX(0); opacity: 0; }
      55%     { transform: scaleX(1); opacity: 0.9; }
      75%, 100% { transform: scaleX(1.05); opacity: 0; }
    }
    /* ⑤ 雷恩 · 街头冲击：土黄冲击波从中心炸开 */
    .theme-ren .skill-effect {
      background: radial-gradient(circle, rgba(216,176,112,0.9) 0%, rgba(138,95,52,0.4) 35%, transparent 65%);
      transform-origin: center;
      animation: fx-ren-boom 3.9s ease-out infinite;
    }
    @keyframes fx-ren-boom {
      0%, 44% { transform: scale(0.2); opacity: 0; }
      56%     { transform: scale(1); opacity: 1; }
      74%, 100% { transform: scale(1.9); opacity: 0; }
    }
    /* ⑥ 莎提拉 · 血潮涌动：血色雾气自底部翻涌 */
    .theme-satira .skill-effect {
      background: linear-gradient(180deg, transparent 30%, rgba(192,57,43,0.55) 72%, rgba(192,57,43,0.95));
      transform-origin: bottom;
      animation: fx-satira-surge 4.3s ease-in-out infinite;
    }
    @keyframes fx-satira-surge {
      0%, 38% { transform: translateY(105%); opacity: 0; }
      52%     { transform: translateY(0); opacity: 0.9; }
      74%, 100% { transform: translateY(-24%); opacity: 0; }
    }
    /* ⑦ 莉耶芙 · 森之萌发：翠绿辉光自上下两端绽放 */
    .theme-liefe .skill-effect {
      background:
        radial-gradient(ellipse at 50% 0%, rgba(46,204,113,0.65), transparent 45%),
        radial-gradient(ellipse at 50% 100%, rgba(46,204,113,0.65), transparent 45%);
      transform-origin: center;
      animation: fx-liefe-bloom 4.4s ease-in-out infinite;
    }
    @keyframes fx-liefe-bloom {
      0%, 40% { transform: scale(0.4); opacity: 0; }
      54%     { transform: scale(1); opacity: 0.95; }
      72%, 100% { transform: scale(1.35); opacity: 0; }
    }
    /* ⑧ 索菲亚 · 圣光之墙：一堵圣光墙忽然闪现而过（铺满整条横幅） */
    .theme-sophia .skill-effect {
      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 12%, rgba(255,255,255,0.98) 50%, rgba(255,255,255,0.95) 88%, rgba(255,255,255,0) 100%);
      transform-origin: center;
      animation: fx-sophia-wall 4s ease-in-out infinite;
    }
    @keyframes fx-sophia-wall {
      0%, 48% { transform: scaleX(0.05); opacity: 0; }
      56%     { transform: scaleX(1); opacity: 1; }
      66%     { transform: scaleX(1.05); opacity: 0.6; }
      80%, 100% { transform: scaleX(1.1); opacity: 0; }
    }
    /* ⑨ 伊莉丝 · 晶核爆发：紫晶棱光自中心迸发旋转 */
    .theme-iris .skill-effect {
      background: radial-gradient(circle, rgba(168,85,247,0.9) 0%, rgba(168,85,247,0.32) 36%, transparent 64%);
      transform-origin: center;
      animation: fx-iris-crystal 4.1s ease-out infinite;
    }
    @keyframes fx-iris-crystal {
      0%, 32% { transform: scale(0.3) rotate(-8deg); opacity: 0; }
      50%     { transform: scale(1.1) rotate(6deg); opacity: 1; }
      72%, 100% { transform: scale(1.9) rotate(-6deg); opacity: 0; }
    }
    /* ⑩ 莉莉娅 · 时间残响：金色刻盘逆时针倒转 + 倒带光带向左横扫 */
    .theme-chronos .skill-effect {
      background:
        radial-gradient(circle at 50% 50%, transparent 30%, rgba(226,185,111,0.55) 46%, transparent 58%),
        linear-gradient(90deg, transparent 30%, rgba(240,212,138,0.8) 50%, transparent 70%);
      transform-origin: center;
      animation: fx-chronos-rewind 4.4s ease-in-out infinite;
    }
    @keyframes fx-chronos-rewind {
      0%, 36%   { transform: rotate(0deg) translateX(0); opacity: 0; }
      52%       { transform: rotate(-160deg) translateX(-40%); opacity: 0.95; }
      68%       { transform: rotate(-320deg) translateX(20%); opacity: 0.6; }
      84%, 100% { transform: rotate(-540deg) translateX(0); opacity: 0; }
    }
    /* ⑪ 索利昂 · 黎明神恩：圣光柱自底部升起 + 光晕扩散 */
    .theme-dawn .skill-effect {
      background:
        radial-gradient(ellipse at 50% 100%, rgba(255,244,210,0.85) 0%, rgba(240,200,112,0.45) 34%, transparent 62%),
        linear-gradient(180deg, transparent 55%, rgba(255,244,210,0.5) 85%, rgba(255,244,210,0.9));
      transform-origin: center bottom;
      animation: fx-dawn-rise 4.2s ease-in-out infinite;
    }
    @keyframes fx-dawn-rise {
      0%, 40% { transform: scaleY(0.15); opacity: 0; }
      54%     { transform: scaleY(1); opacity: 0.95; }
      70%     { transform: scaleY(1.12); opacity: 0.6; }
      86%, 100% { transform: scaleY(1.2); opacity: 0; }
    }
    /* ⑫ 阿丝茉德 · 魅魔领域：桃心脉冲自中心扩散 + 魅惑波纹 */
    .theme-venus .skill-effect {
      background:
        radial-gradient(circle at 50% 50%, rgba(255,192,221,0.85) 0%, rgba(216,122,176,0.45) 30%, transparent 60%),
        radial-gradient(circle, transparent 40%, rgba(240,154,200,0.5) 52%, transparent 64%);
      transform-origin: center;
      animation: fx-venus-pulse 4.2s ease-in-out infinite;
    }
    @keyframes fx-venus-pulse {
      0%, 38% { transform: scale(0.3); opacity: 0; }
      52%     { transform: scale(1); opacity: 0.95; }
      68%     { transform: scale(1.25); opacity: 0.55; }
      84%, 100% { transform: scale(1.5); opacity: 0; }
    }

    /* 兜底主题 */
    .spirit-skill-banner.theme-default::before,
    .spirit-skill-banner.theme-default::after {
      background: linear-gradient(90deg, transparent, #d4af6a, transparent);
    }
    .theme-default .banner-symbols { color: #d4af6a; }
    .theme-default .banner-name {
      background-image: linear-gradient(180deg, #fff0d0 0%, #f0d48a 45%, #c9a13b 100%);
      color: #f0d48a;
      -webkit-text-stroke: 1px rgba(201, 161, 59, 0.6);
      text-shadow: 0 0 6px rgba(255, 225, 150, 0.5), 0 0 18px rgba(201, 161, 59, 0.4);
    }

    /* ===== 响应式 ===== */
    @media (max-width: 600px) {
      .banner-name {
        font-size: 20px;
        letter-spacing: 3px;
      }
      .banner-symbols {
        font-size: 13px;
        letter-spacing: 8px;
      }
    }

    /* 兼容兜底：浏览器不支持 background-clip:text 时，文字直接以主题色显示（避免名字空白） */
    @supports not ((-webkit-background-clip: text) or (background-clip: text)) {
      .banner-name {
        -webkit-text-fill-color: initial;
      }
    }
  `;
  // 幂等注入：样式已存在（可能是旧版脚本先注入的旧 CSS）时，一律更新为最新内容，
  // 确保新英灵主题（chronos/dawn/venus）必定生效，避免横幅名字因主题缺失而透明空白
  let style = document.getElementById(SPIRIT_SKILL_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = SPIRIT_SKILL_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
  // 复制样式到父/顶层文档（脚本可能运行在酒馆助手 iframe 中，
  // 但消息 DOM 在酒馆主页面，CSS 必须注入到含 #chat 的文档，否则横幅显示为纯文本）
  duplicateSpiritSkillStyles();
}

// 将已注入的样式复制到父/顶层文档（多文档场景，参照招式名脚本 collectChatEls 思路）
function duplicateSpiritSkillStyles() {
  try {
    const src = document.getElementById(SPIRIT_SKILL_STYLE_ID);
    if (!src) return;
    const css = src.textContent;
    const targets = [];
    try {
      if (window.parent && window.parent.document && window.parent.document !== document) {
        targets.push(window.parent.document);
      }
    } catch (e) { /* ignore */ }
    try {
      if (window.top && window.top.document && window.top.document !== document &&
          window.top.document !== (window.parent && window.parent.document)) {
        targets.push(window.top.document);
      }
    } catch (e) { /* ignore */ }
    for (let i = 0; i < targets.length; i++) {
      const d = targets[i];
      try {
        if (!d || !d.head) continue;
        // 存在也更新（与主文档幂等注入保持一致）
        let style = d.getElementById(SPIRIT_SKILL_STYLE_ID);
        if (!style) {
          style = d.createElement('style');
          style.id = SPIRIT_SKILL_STYLE_ID;
          d.head.appendChild(style);
        }
        style.textContent = css;
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
}

// ============================================================
//  英灵技渲染函数
// ============================================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 技能名 → 英灵主题映射（不同英灵渲染截然不同）
const SPIRIT_SKILL_THEMES = {
  '绝境斩杀·残响':  { theme: 'eria',    icon: '🗡️', hero: '断钢的勇者 · 艾莉卡', deco: '⚔', sideL: '✕', sideR: '✕' },
  '万象真理·残响':  { theme: 'ilia',    icon: '🔮', hero: '燃尽的贤者 · 伊利亚', deco: '✧', sideL: '✦', sideR: '✧' },
  '湮灭法则·残响':  { theme: 'lilith',  icon: '🌙', hero: '被夺的魔女 · 莉莉丝', deco: '☾', sideL: '☾', sideR: '☽' },
  '半龙化':          { theme: 'koriv',   icon: '🐉', hero: '末代的神龙 · 科里维坦', deco: '❄', sideL: '❄', sideR: '❄' },
  '绝对零度龙息':    { theme: 'koriv',   icon: '🐉', hero: '末代的神龙 · 科里维坦', deco: '❄', sideL: '❄', sideR: '❄' },
  '不讲武德的痛击':  { theme: 'ren',     icon: '🍺', hero: '初代勇者 · 雷恩', deco: '✕', sideL: '✚', sideR: '✚' },
  '血祭·幽魂之拥':  { theme: 'satira',  icon: '💀', hero: '第四代魔女 · 莎提拉', deco: '☠', sideL: '✶', sideR: '✷' },
  '森之降临':        { theme: 'liefe',   icon: '🧚', hero: '指引妖精 · 莉耶芙', deco: '✿', sideL: '✿', sideR: '✿' },
  '绝境圣壁':        { theme: 'sophia',  icon: '🕊️', hero: '小圣女 · 索菲亚', deco: '✝', sideL: '✝', sideR: '✝' },
  '弱者的反击':      { theme: 'iris',    icon: '👿', hero: '小魔王 · 伊莉丝', deco: '▲', sideL: '▲', sideR: '▲' },
  '死亡回溯':        { theme: 'chronos', icon: '⌛', hero: '盲目的莉莉娅', deco: '✧', sideL: '◐', sideR: '◑' },
  '神恩降临·残响':  { theme: 'dawn',    icon: '☀', hero: '圣光神 · 索利昂', deco: '✦', sideL: '☀', sideR: '☀' },
  '魅魔领域·残响':  { theme: 'venus',   icon: '💋', hero: '深渊的魅魔 · 阿丝茉德', deco: '♡', sideL: '♡', sideR: '♡' },
};

// 解析 <英灵技·技能名>（单标签，无描述）或 <英灵技·技能名> 描述 </英灵技>（旧格式）为招式名横幅 HTML
function parseSpiritSkill(content) {
  if (!content || content.indexOf('<英灵技') === -1) return null;

  let html = '';
  // 同时匹配：单标签 <英灵技·xxx> 与 双标签 <英灵技·xxx>描述</英灵技>
  const regex = /<英灵技·([^>]+)>(?:([\s\S]*?)<\/英灵技>)?/g;
  let match;
  let changed = false;

  while ((match = regex.exec(content)) !== null) {
    const skillName = match[1].trim();
    // 不输出技能描述，只渲染招式名横幅

    const meta = SPIRIT_SKILL_THEMES[skillName] || SPIRIT_SKILL_THEMES[skillName.replace(/[·\s]/g, '')] || { theme: 'default', icon: '⚔', hero: '英灵', deco: '✦' };
    const themeCls = 'theme-' + meta.theme;

    html += `<div class="spirit-skill-banner ${themeCls}">`;
    html += `<canvas class="skill-particles"></canvas>`;
    html += `<div class="skill-effect"></div>`;
    html += `<div class="banner-symbols">${meta.deco} ${meta.deco} ${meta.deco}</div>`;
    html += `<div class="banner-row">`;
    html += `<span class="banner-side left">${meta.sideL || meta.deco}</span>`;
    html += `<span class="banner-name">${escapeHtml(skillName)}</span>`;
    html += `<span class="banner-side right">${meta.sideR || meta.deco}</span>`;
    html += `</div>`;
    html += `</div>`;
    changed = true;
  }

  return changed ? html : null;
}

// ============================================================
//  Canvas 粒子特效引擎（粒子分散在整个横幅内流动）
// ============================================================
// type: 粒子流动类型
//   slash  → 剑气：光刃在横幅内随机位置生成，向右横扫流动（艾莉卡·绝境斩杀）
//   swirl  → 湮灭漩涡：暗紫粒子绕中心旋转流动，分散成漩涡（莉莉丝·湮灭法则）
//   drift  → 金色法阵光点漂浮（伊利亚·万象真理）
//   frost  → 冰晶飘落结霜（科里维坦·半龙化）
//   dust   → 粗粝尘粒缓慢漂浮（雷恩·不讲武德的痛击）
//   rise   → 血色雾气升腾（莎提拉·血祭）
//   spore  → 翠绿孢子漂浮（莉耶芙·森之降临）
//   holy   → 圣光粒子弥漫闪烁（索菲亚·绝境圣壁）
//   shard  → 紫晶碎片漂浮流动（伊莉丝·弱者的反击）
const SPIRIT_PARTICLE_CONF = {
  eria:    { type: 'slash',  count: 45, colors: ['#ffd0c0', '#e8b0a0', '#9c4a4a'], speed: 0.8, size: [1, 2.5], life: [70, 120], sway: true },
  ilia:    { type: 'drift',  count: 36, colors: ['#f0d48a', '#c9a13b', '#fff6d8'], speed: 0.25, size: [1, 2.5], life: [110, 180], twinkle: true },
  lilith:  { type: 'swirl',  count: 60, colors: ['#8e44ad', '#c99fe0', '#5b2a70'], speed: 0.01, size: [1.5, 3], life: [180, 280] },
  koriv:   { type: 'frost',  count: 50, colors: ['#ffffff', '#aee8ff', '#d6f4ff'], speed: 0.3, size: [1.5, 3], life: [120, 190], sway: true },
  ren:     { type: 'dust',   count: 40, colors: ['#8a5f34', '#d8b070', '#4a3520'], speed: 0.2, size: [2, 4], life: [90, 150], sway: true },
  satira:  { type: 'rise',   count: 50, colors: ['#c0392b', '#e08a7a', '#7a1f15'], speed: 0.5, size: [2, 3.5], life: [90, 150], sway: true },
  liefe:   { type: 'spore',  count: 40, colors: ['#27ae60', '#9ff0c0', '#e0ffe8'], speed: 0.25, size: [1.5, 3], life: [110, 180], twinkle: true },
  sophia:  { type: 'holy',   count: 60, colors: ['#ffffff', '#fff6d8', '#ffe9b0'], speed: 0.3, size: [1, 2.5], life: [110, 170], twinkle: true },
  iris:    { type: 'shard',  count: 50, colors: ['#a855f7', '#d8b0f8', '#6a2a9e'], speed: 0.25, size: [1.5, 3], life: [120, 190], sway: true },
  'default': { type: 'drift', count: 30, colors: ['#d4af6a', '#f0d48a'], speed: 0.2, size: [1, 2], life: [90, 140] },
  chronos:  { type: 'swirl', count: 55, colors: ['#f0d48a', '#e2b96f', '#fff6d8'], speed: 0.012, size: [1.2, 2.6], life: [160, 260] },
  dawn:     { type: 'holy',  count: 60, colors: ['#fff8e0', '#f5d990', '#b8cce8'], speed: 0.35, size: [1, 2.4], life: [110, 170], twinkle: true },
  venus:    { type: 'swirl', count: 55, colors: ['#f09ac8', '#ffc0dd', '#a8447a'], speed: 0.012, size: [1.4, 2.8], life: [150, 250] },
};

function startSpiritSkillParticles(canvas) {
  const banner = canvas.closest('.spirit-skill-banner');
  if (!banner) return;
  // 若已有运行中的循环先取消（支持刷新强制重启粒子）
  if (canvas._raf) { cancelAnimationFrame(canvas._raf); canvas._raf = null; }
  const themeCls = Array.from(banner.classList).find(c => c.indexOf('theme-') === 0) || 'theme-default';
  const theme = themeCls.replace('theme-', '');
  const conf = SPIRIT_PARTICLE_CONF[theme] || SPIRIT_PARTICLE_CONF['default'];

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let W = 0, H = 0, raf = null;
  let particles = [];

  // 用 clientWidth/Height（不受 transform 缩放影响），并延迟到 banner-pop 动画结束后测量
  function resize() {
    const cw = banner.clientWidth;
    const ch = banner.clientHeight;
    W = Math.max(cw, 60);
    H = Math.max(ch, 40);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeParticle() {
    const cx = W / 2;
    const cy = H / 2;
    const base = {
      x: 0, y: 0, vx: 0, vy: 0,
      size: conf.size[0] + Math.random() * (conf.size[1] - conf.size[0]),
      color: conf.colors[Math.floor(Math.random() * conf.colors.length)],
      life: 0,
      maxLife: conf.life[0] + Math.random() * (conf.life[1] - conf.life[0]),
      alpha: 1,
      phase: Math.random() * Math.PI * 2,
      swayAmp: 0.5 + Math.random() * 1,
      shape: 0,
      rrX: 0, rrY: 0, ang: 0,
    };
    const t = conf.type;
    // 所有粒子都在整个横幅内分散生成并流动，不聚集在中心
    if (t === 'slash') {
      // 剑气：在横幅内随机位置生成，向右横扫流动
      base.x = Math.random() * W;
      base.y = Math.random() * H;
      base.vx = conf.speed * (0.6 + Math.random() * 0.8);
      base.vy = (Math.random() - 0.5) * 0.3;
      base.shape = 1;
    } else if (t === 'swirl') {
      // 湮灭漩涡：在横幅内椭圆轨道上分布，绕中心旋转流动（铺满整个横幅）
      const a = Math.random() * Math.PI * 2;
      const rrX = W * (0.15 + Math.random() * 0.35);
      const rrY = H * (0.3 + Math.random() * 0.55);
      base.x = cx + Math.cos(a) * rrX;
      base.y = cy + Math.sin(a) * rrY;
      base.rrX = rrX;
      base.rrY = rrY;
      base.ang = a;
    } else if (t === 'holy') {
      // 圣光：光点在整个横幅内缓慢向上飘散闪烁
      base.x = Math.random() * W;
      base.y = H * (0.1 + Math.random() * 0.9);
      base.vx = (Math.random() - 0.5) * 0.4;
      base.vy = -conf.speed * (0.3 + Math.random());
    } else if (t === 'frost') {
      base.x = Math.random() * W;
      base.y = Math.random() * H;
      base.vx = (Math.random() - 0.5) * 0.3;
      base.vy = conf.speed * (0.4 + Math.random());
    } else if (t === 'rise') {
      base.x = Math.random() * W;
      base.y = H + 5;
      base.vy = -conf.speed * (0.5 + Math.random());
    } else if (t === 'spore') {
      base.x = Math.random() * W;
      base.y = Math.random() * H;
      base.vx = (Math.random() - 0.5) * conf.speed;
      base.vy = (Math.random() - 0.5) * conf.speed;
    } else if (t === 'shard') {
      base.x = Math.random() * W;
      base.y = Math.random() * H;
      base.vx = (Math.random() - 0.5) * conf.speed;
      base.vy = (Math.random() - 0.5) * conf.speed;
      base.shape = 2;
    } else if (t === 'dust') {
      base.x = Math.random() * W;
      base.y = Math.random() * H;
      base.vx = (Math.random() - 0.5) * conf.speed;
      base.vy = (Math.random() - 0.5) * conf.speed;
    } else {
      base.x = Math.random() * W;
      base.y = Math.random() * H;
      base.vx = (Math.random() - 0.5) * conf.speed;
      base.vy = (Math.random() - 0.5) * conf.speed;
    }
    return base;
  }

  function update(p) {
    p.life++;
    if (p.life > p.maxLife) return false;
    if (conf.gravity) p.vy += conf.gravity;
    p.x += p.vx;
    p.y += p.vy;
    if (conf.type === 'swirl') {
      // 湮灭漩涡：粒子沿椭圆轨道绕中心缓慢旋转流动，铺满整个横幅
      const cx = W / 2, cy = H / 2;
      p.ang = (p.ang || 0) + 0.01;
      p.x = cx + Math.cos(p.ang) * p.rrX;
      p.y = cy + Math.sin(p.ang) * p.rrY;
    }
    if (conf.sway) {
      p.x += Math.sin((p.life / p.maxLife) * Math.PI * 4 + p.phase) * p.swayAmp;
    }
    if (conf.twinkle) {
      p.alpha = 0.4 + 0.6 * Math.abs(Math.sin(p.phase + p.life * 0.12));
    } else {
      const t = p.life / p.maxLife;
      p.alpha = t < 0.2 ? t / 0.2 : (1 - t) / 0.8;
    }
    return p.x > -30 && p.x < W + 30 && p.y > -30 && p.y < H + 30;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const cy = H / 2;
    for (const p of particles) {
      if (p.alpha <= 0.01) continue;
      ctx.globalAlpha = p.alpha;
      if (p.shape === 1) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5);
        ctx.lineTo(p.x + p.vx * 3, p.y + p.vy * 3);
        ctx.stroke();
      } else if (p.shape === 2) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size * 1.6);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.lineTo(p.x, p.y + p.size * 1.6);
        ctx.lineTo(p.x - p.size, p.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    const target = conf.count;
    while (particles.length < target && Math.random() < 0.75) {
      particles.push(makeParticle());
    }
    particles = particles.filter(update);
    draw();
    raf = requestAnimationFrame(loop);
    canvas._raf = raf;
  }

  // 等 banner-pop 动画(0.6s)结束后再测量尺寸并启动
  setTimeout(() => {
    resize();
    for (let i = 0; i < Math.min(conf.count, 25); i++) particles.push(makeParticle());
    if (!raf) { raf = requestAnimationFrame(loop); canvas._raf = raf; }
  }, 620);

  // 视口可见性优化
  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting;
      if (visible && !raf) {
        raf = requestAnimationFrame(loop);
        canvas._raf = raf;
      } else if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = null;
        canvas._raf = null;
      }
    });
    io.observe(banner);
  }
  // 兜底：延迟后强制 resize 一次（确保 canvas 尺寸匹配 banner）
  setTimeout(() => { if (W === 0 || H === 0) resize(); }, 1000);
}

function initSpiritSkillParticles(root, force) {
  (root || document).querySelectorAll('.spirit-skill-banner canvas.skill-particles').forEach(canvas => {
    if (force || !canvas.dataset.initialized) {
      canvas.dataset.initialized = '1';
      startSpiritSkillParticles(canvas);
    }
  });
}

// 将消息文本中的英灵技标签替换为卡片（兼容 HTML 转义的 &lt;英灵技&gt;）
function renderSpiritSkillsInText(htmlText) {
  if (!htmlText) return htmlText;
  const hasRaw = htmlText.indexOf('<英灵技') !== -1;
  const hasEscaped = htmlText.indexOf('&lt;英灵技') !== -1;
  if (!hasRaw && !hasEscaped) return htmlText;

  let out = htmlText;
  // ① 先处理已被 HTML 转义的标签（&lt;英灵技·xxx&gt;）
  if (hasEscaped) {
    out = out.replace(/&lt;英灵技·([^&<>]+?)&gt;/g, (m, name) => {
      const card = parseSpiritSkill('<英灵技·' + name + '>');
      return card || m;
    });
  }
  // ② 再处理原始尖括号标签（单标签 <英灵技·xxx> 或双标签 <英灵技·xxx>描述</英灵技>）
  if (hasRaw) {
    out = out.replace(/<英灵技·[^>]+>(?:[\s\S]*?<\/英灵技>)?/g, (tag) => {
      const card = parseSpiritSkill(tag);
      return card || tag;
    });
  }
  return out;
}

// ============================================================
//  处理单个消息楼层中的英灵技（核心，参照招式名脚本：DOM级精准替换）
//  只遍历文本节点原地替换，不重建 .mes_text 的 innerHTML，
//  避免破坏酒馆其它结构（思维链、TH-render 前端界面等）。
// ============================================================
function processSpiritMes($mes) {
  if (!$mes || !$mes.length) return;
  $mes.each(function() {
    const $el = $(this);
    if (!$el.length) return;
    $el.find('.mes_text').each(function() {
      const textEl = this;
      const $t = $(textEl);
      // 跳过思维链容器（已自动解析的 reasoning 块）
      if ($t.closest('.mes_reasoning, .mes_reasoning_details').length) return;
      // 只有真正渲染出了横幅才算完成；若有标记但无横幅则清除并重试
      if (textEl.getAttribute('data-ss-done') && $t.find('.spirit-skill-banner').length > 0) return;
      textEl.removeAttribute('data-ss-done');

      let replacedAny = false;
      // 收集文本节点（按文档顺序）
      // 用 textEl.ownerDocument 而非全局 document：横幅可能位于主页面，
      // 而脚本运行在 iframe，跨文档创建节点会导致样式不生效/行为异常
      const doc = textEl.ownerDocument || document;
      const pendingNodes = [];
      const walker = doc.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) pendingNodes.push(walker.currentNode);

      for (let ni = 0; ni < pendingNodes.length; ni++) {
        const node = pendingNodes[ni];
        const text = node.nodeValue || '';

        // 保护思维链包裹区域（<思维链>...</思维链> 等），其中的 <英灵技> 不参与渲染
        const segs = [];
        const reGuardText = /<(思维链|reasoning|think|思考|思想|推理)\s*>[\s\S]*?<\/\1\s*>/g;
        let last = 0;
        let gm;
        reGuardText.lastIndex = 0;
        while ((gm = reGuardText.exec(text)) !== null) {
          if (gm.index > last) segs.push({ t: 'n', s: text.slice(last, gm.index) });
          segs.push({ t: 'g', s: gm[0] });
          last = gm.index + gm[0].length;
        }
        if (last < text.length) segs.push({ t: 'n', s: text.slice(last) });
        if (!segs.length) segs.push({ t: 'n', s: text });

        // 对非保护段做英灵技替换（用占位符标记），保护段原样保留
        let newText = '';
        let hasRepl = false;
        // 同时匹配两种形式：
        //   ① 原始尖括号 <英灵技·xxx>（DOM 文本节点中已还原为 <）
        //   ② HTML 转义 &lt;英灵技·xxx&gt;（酒馆消息可能以转义形式存储）
        const RE_SKILL = /<英灵技·([^>]+)>(?:[\s\S]*?<\/英灵技>)?|&lt;英灵技·([^&<>]+?)&gt;/g;
        for (let si = 0; si < segs.length; si++) {
          if (segs[si].t === 'g') {
            newText += segs[si].s;
          } else {
            newText += segs[si].s.replace(RE_SKILL, (mm, g1, g2) => {
              hasRepl = true;
              return '\u0000SS\u0000' + (g1 || g2) + '\u0000SS\u0000';
            });
          }
        }

        if (hasRepl) {
          // 用占位符分割，交替为 [普通文本, 英灵技名, ...]，原地替换该文本节点
          const parts = newText.split('\u0000SS\u0000');
          const frag = doc.createDocumentFragment();
          let isName = false;
          for (let pi = 0; pi < parts.length; pi++) {
            if (isName) {
              const skillName = parts[pi].trim();
              const meta = SPIRIT_SKILL_THEMES[skillName] || SPIRIT_SKILL_THEMES[skillName.replace(/[·\s]/g, '')] || { theme: 'default', icon: '⚔', hero: '英灵', deco: '✦' };
              const div = doc.createElement('div');
              div.className = 'spirit-skill-banner theme-' + meta.theme;
              div.innerHTML =
                `<canvas class="skill-particles"></canvas>` +
                `<div class="skill-effect"></div>` +
                `<div class="banner-symbols">${meta.deco} ${meta.deco} ${meta.deco}</div>` +
                `<div class="banner-row">` +
                `<span class="banner-side left">${meta.sideL || meta.deco}</span>` +
                `<span class="banner-name">${escapeHtml(skillName)}</span>` +
                `<span class="banner-side right">${meta.sideR || meta.deco}</span>` +
                `</div>`;
              frag.appendChild(div);
            } else if (parts[pi]) {
              frag.appendChild(doc.createTextNode(parts[pi]));
            }
            isName = !isName;
          }
          node.parentNode.replaceChild(frag, node);
          replacedAny = true;
        }
      }

      // 只在成功替换后才标记，流式中标签未完整时不会误标，稍后自动重试
      if (replacedAny) {
        textEl.setAttribute('data-ss-done', '1');
        // 初始化粒子特效（强制刷新：让粒子/特效动画重新播放）
        initSpiritSkillParticles(textEl, true);
      }
    });
  });
}

// ============================================================
//  渲染指定消息中的英灵技（按 messageId，参照招式名脚本用 retrieveDisplayedMessage）
// ============================================================
function renderSpiritSkillInMessage(messageId) {
  let $mes = null;
  // 优先用酒馆 API 获取消息 DOM
  if (typeof retrieveDisplayedMessage === 'function') {
    try { $mes = $(retrieveDisplayedMessage(messageId)); } catch (e) { $mes = null; }
  }
  // 备选：多文档遍历查找 .mes[mesid]
  if (!$mes || !$mes.length) {
    const chatEls = collectChatEls();
    for (let i = 0; i < chatEls.length; i++) {
      try {
        const el = chatEls[i];
        if (!el) continue;
        const $found = $(el).find('.mes[mesid="' + messageId + '"]');
        if ($found.length) { $mes = $found; break; }
      } catch (e) { /* ignore */ }
    }
  }
  if (!$mes || !$mes.length) {
    try { $mes = $(`.mes[mesid="${messageId}"]`); } catch (e) { $mes = null; }
  }
  processSpiritMes($mes);
}

// ============================================================
//  扫描并渲染所有已存在的消息（多文档定位，确保覆盖主页面 #chat）
// ============================================================
function renderAllExistingSpiritSkills(root) {
  const chatEls = root ? [root] : collectChatEls();
  let processed = false;
  for (let i = 0; i < chatEls.length; i++) {
    try {
      const el = chatEls[i];
      if (!el) continue;
      const $mes = $(el).find('.mes');
      if ($mes.length) {
        processSpiritMes($mes);
        processed = true;
      }
    } catch (e) { /* ignore */ }
  }
  // 兜底：直接尝试当前 document 的 .mes
  if (!processed) {
    try { processSpiritMes($('.mes')); } catch (e) { /* ignore */ }
  }
  // 确保所有已渲染横幅的粒子都已启动
  setTimeout(() => initSpiritSkillParticles(document, false), 100);
}

// ============================================================
//  多文档定位 #chat（脚本可能运行在酒馆页面或酒馆助手 iframe 中，
//  window.parent / window.top 不一定指向酒馆自身，因此观察多个候选文档）
// ============================================================
function collectChatEls() {
  const els = [];
  const seen = {};
  const docs = [];
  try { docs.push(document); } catch (e) { /* ignore */ }
  try { if (window.parent && window.parent.document) docs.push(window.parent.document); } catch (e) { /* ignore */ }
  try { if (window.top && window.top.document) docs.push(window.top.document); } catch (e) { /* ignore */ }
  for (let i = 0; i < docs.length; i++) {
    try {
      const el = docs[i].getElementById('chat');
      if (el && !seen[el.id]) {
        seen[el.id] = 1;
        els.push(el);
      }
    } catch (e) { /* ignore */ }
  }
  return els;
}

// 处理一个新增/变化的 DOM 节点
function processNode(node) {
  try {
    const $n = $(node);
    if ($n.closest('.mes_reasoning, .mes_reasoning_details').length) return;
    if ($n.is('.mes_text') || $n.find('.mes_text').length > 0) {
      processSpiritMes($n.closest('.mes'));
    } else if ($n.is('.mes')) {
      processSpiritMes($n);
    }
  } catch (e) { /* ignore */ }
}

// ============================================================
//  初始化（三层保险监听，参照招式名脚本）
// ============================================================
$(() => {
  // 注入样式（含复制到父/顶层文档）
  injectSpiritSkillStyles();

  // 初次扫描当前已渲染的楼层（多文档定位）
  try { renderAllExistingSpiritSkills(); } catch (e) { /* ignore */ }

  // ① MutationObserver：观察 #chat（多文档），监听新增节点与文本变化（流式输出）
  const chatEls = collectChatEls();
  for (let ci = 0; ci < chatEls.length; ci++) {
    try {
      (function(el) {
        const observer = new MutationObserver((mutations) => {
          for (let k = 0; k < mutations.length; k++) {
            const m = mutations[k];
            if (m.addedNodes) {
              for (let j = 0; j < m.addedNodes.length; j++) {
                const node = m.addedNodes[j];
                if (node && node.nodeType === 1) processNode(node);
              }
            }
            if (m.type === 'characterData' && m.target && m.target.nodeType === 3) {
              // 思维链（reasoning）内的文本变化不处理
              if ($(m.target).closest('.mes_reasoning, .mes_reasoning_details').length) continue;
              const $mes = $(m.target).closest('.mes');
              if ($mes.length) processSpiritMes($mes);
            }
          }
        });
        observer.observe(el, { childList: true, subtree: true, characterData: true });
      })(chatEls[ci]);
    } catch (e) { /* ignore */ }
  }

  // ② 轮询兜底：每 0.8 秒扫描所有楼层（多文档定位，与初次扫描一致，绝对可靠）
  setInterval(function() {
    try { renderAllExistingSpiritSkills(); } catch (e) { /* ignore */ }
  }, 800);

  // ③ 酒馆事件（能触发则补充处理）
  try {
    eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, (messageId) => {
      setTimeout(() => renderSpiritSkillInMessage(messageId), 100);
    });
    eventOn(tavern_events.USER_MESSAGE_RENDERED, (messageId) => {
      setTimeout(() => renderSpiritSkillInMessage(messageId), 100);
    });
    eventOn(tavern_events.MESSAGE_RECEIVED, (messageId) => {
      setTimeout(() => renderSpiritSkillInMessage(messageId), 100);
    });
    eventOn(tavern_events.MESSAGE_UPDATED, (messageId) => {
      setTimeout(() => renderSpiritSkillInMessage(messageId), 100);
    });
  } catch (e) { /* ignore */ }

  console.log('✅ [英灵技渲染] 已加载');
});
