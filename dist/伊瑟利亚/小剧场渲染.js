/**
 * 小剧场渲染脚本
 *
 * 将 AI 回复中的 <小剧场>...</小剧场> 标签渲染为剧场风格的对话框。
 * 加载此脚本后，每次消息渲染时会自动扫描并替换标签内容。
 *
 * 【导入方式】
 *   在酒馆助手脚本库中添加以下内容:
 *   import 'https://your-host/dist/变量结构与状态栏代码/小剧场渲染.js';
 *
 *   或直接复制本脚本内容到酒馆助手脚本库中。
 */

// ============================================================
//  小剧场 CSS 样式（注入到页面）
// ============================================================
const THEATER_STYLE_ID = 'mini-theater-style';

function injectTheaterStyles() {
  if (document.getElementById(THEATER_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = THEATER_STYLE_ID;
  style.textContent = `
    /* ===== 小剧场整体容器 ===== */
    .mini-theater {
      margin: 12px 0;
      padding: 16px 14px 14px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border: 2px solid #e2b96f;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(226, 185, 111, 0.2);
      position: relative;
      overflow: hidden;
    }
    .mini-theater::before {
      content: '✦ ✦ ✦ 小 剧 场 ✦ ✦ ✦';
      display: block;
      text-align: center;
      color: #e2b96f;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 4px;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1px dashed rgba(226, 185, 111, 0.3);
      font-family: 'Georgia', serif;
    }
    .mini-theater::after {
      content: '✦ ✦ ✦';
      display: block;
      text-align: center;
      color: #e2b96f;
      font-size: 11px;
      letter-spacing: 6px;
      padding-top: 8px;
      margin-top: 8px;
      border-top: 1px dashed rgba(226, 185, 111, 0.3);
    }

    /* ===== 角色台词行 ===== */
    .mini-theater__line {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 6px;
      transition: background 0.2s;
    }
    .mini-theater__line:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .mini-theater__role {
      flex-shrink: 0;
      color: #f0c27a;
      font-weight: bold;
      font-size: 13px;
      min-width: 80px;
      text-align: right;
      padding-right: 8px;
      border-right: 2px solid rgba(226, 185, 111, 0.3);
      font-family: 'Georgia', serif;
    }
    .mini-theater__role::after {
      content: '：';
      color: #e2b96f;
    }

    .mini-theater__dialogue {
      flex: 1;
      color: #d4d4dc;
      font-size: 13px;
      line-height: 1.6;
      word-break: break-word;
    }

    /* ===== 动作/旁白（括号内的内容） ===== */
    .mini-theater__action {
      color: #8899aa;
      font-style: italic;
      font-size: 12px;
    }

    /* ===== 旁白/说明行（非对话行，如场景描述） ===== */
    .mini-theater__narration {
      text-align: center;
      color: #8899aa;
      font-size: 12px;
      font-style: italic;
      padding: 4px 0;
      margin-bottom: 4px;
    }

    /* ===== 响应式 ===== */
    @media (max-width: 600px) {
      .mini-theater {
        padding: 12px 10px;
      }
      .mini-theater__role {
        min-width: 60px;
        font-size: 12px;
      }
      .mini-theater__dialogue {
        font-size: 12px;
      }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
//  小剧场渲染函数
// ============================================================
function parseMiniTheater(content) {
  // 提取 <小剧场>...</小剧场> 之间的内容
  const match = content.match(/<小剧场>([\s\S]*?)<\/小剧场>/i);
  if (!match) return null;

  const innerText = match[1].trim();
  if (!innerText) return null;

  const lines = innerText.split('\n').filter(l => l.trim());
  let html = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过空行
    if (!trimmed) continue;

    // 匹配 "<角色名>: (动作) 台词" 或 "<角色名>: 台词" 格式
    const roleMatch = trimmed.match(/^<([^>]+)>\s*:\s*(.*)$/);
    if (roleMatch) {
      const roleName = roleMatch[1].trim();
      let dialogue = roleMatch[2].trim();

      // 处理动作（括号内的内容）
      let actionHtml = '';
      dialogue = dialogue.replace(/（([^）]*)）/g, (m, action) => {
        actionHtml += `<span class="mini-theater__action">（${action}）</span>`;
        return '';
      }).trim();
      dialogue = dialogue.replace(/\(([^)]*)\)/g, (m, action) => {
        actionHtml += `<span class="mini-theater__action">（${action}）</span>`;
        return '';
      }).trim();

      html += `<div class="mini-theater__line">`;
      html += `<span class="mini-theater__role">${escapeHtml(roleName)}</span>`;
      html += `<span class="mini-theater__dialogue">${actionHtml}${dialogue ? escapeHtml(dialogue) : ''}</span>`;
      html += `</div>`;
    }
    // 纯旁白/场景描述行
    else {
      html += `<div class="mini-theater__narration">${escapeHtml(trimmed)}</div>`;
    }
  }

  if (!html) return null;

  return `<div class="mini-theater">${html}</div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
//  渲染指定消息中的小剧场
// ============================================================
function renderTheaterInMessage(messageId) {
  const $mes = $(`.mes[mesid="${messageId}"]`);
  if (!$mes.length) return;

  const $text = $mes.find('.mes_text');
  if (!$text.length) return;

  const html = $text.html();
  if (!html.includes('<小剧场>')) return;

  const theaterHtml = parseMiniTheater(html);
  if (!theaterHtml) return;

  // 替换 <小剧场> 标签为渲染后的 HTML
  const newHtml = html.replace(/<小剧场>[\s\S]*?<\/小剧场>/i, theaterHtml);
  $text.html(newHtml);
}

// ============================================================
//  扫描并渲染所有已存在的消息
// ============================================================
function renderAllExistingTheaters() {
  $(`.mes`).each(function() {
    const mesId = $(this).attr('mesid');
    if (mesId !== undefined) {
      renderTheaterInMessage(Number(mesId));
    }
  });
}

// ============================================================
//  初始化
// ============================================================
$(() => {
  // 注入样式
  injectTheaterStyles();

  // 渲染已有消息中的小剧场
  renderAllExistingTheaters();

  // 监听新消息渲染完成事件
  if (typeof tavern_events !== 'undefined' && typeof eventOn === 'function') {
    eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, (messageId) => {
      setTimeout(() => renderTheaterInMessage(messageId), 100);
    });

    // 消息更新时也触发
    eventOn(tavern_events.MESSAGE_UPDATED, (messageId) => {
      setTimeout(() => renderTheaterInMessage(messageId), 100);
    });
  }

  // 兜底：监听DOM变化（适用于流式输出）
  const observer = new MutationObserver(() => {
    renderAllExistingTheaters();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
  });

  console.log('✅ [小剧场渲染] 已加载');
});

$(window).on('pagehide', () => {
  console.log('ℹ️ [小剧场渲染] 已卸载');
});
