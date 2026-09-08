const fs = require('fs');
const f = 'dist/伊瑟利亚/核心/状态栏';
let c = fs.readFileSync(f, 'utf8');
const NL = '\r\n';

// 1) HTML：tab-advanced 顶部插入设置块
const htmlOld = '        <div id="tab-advanced" class="jrpg-tab-content">';
const htmlNew = '        <div id="tab-advanced" class="jrpg-tab-content">' + NL +
'            <div class="jrpg-box">' + NL +
'                <div class="jrpg-box-title">🧬 资质 & 魔法回路·三维上限 <span style="font-weight:normal;font-size:11px;color:#8b6b4a;">（资质默认平庸（低劣/普通/优秀/卓越/天才）；回路三维上限类似装备面板效果，保存即写入并热加载）</span></div>' + NL +
'                <div style="margin-top:6px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">' + NL +
'                    <div><label style="font-size:11px;color:#6b4e31;">资质</label><select id="talent-sel" style="font-size:12px;padding:3px 6px;background:#fff;border:1px solid #8b6b4a;border-radius:4px;">' + NL +
'                        <option value="低劣">低劣</option><option value="普通">普通</option><option value="优秀">优秀</option><option value="卓越">卓越</option><option value="天才">天才</option></select> <span id="talent-cur" style="font-size:11px;color:#7f8c8d;"></span></div>' + NL +
'                </div>' + NL +
'                <div style="margin:8px 0 4px;font-size:11px;color:#6b4e31;">魔法回路·三维上限（六维，0=不额外加成）</div>' + NL +
'                <div style="display:flex;gap:6px;flex-wrap:wrap;">' + NL +
'                    <div><label style="font-size:10px;color:#6b4e31;">力量</label><input id="rc-力量" type="number" class="vt-input" style="width:52px;font-size:12px;padding:3px;"></div>' + NL +
'                    <div><label style="font-size:10px;color:#6b4e31;">敏捷</label><input id="rc-敏捷" type="number" class="vt-input" style="width:52px;font-size:12px;padding:3px;"></div>' + NL +
'                    <div><label style="font-size:10px;color:#6b4e31;">体质</label><input id="rc-体质" type="number" class="vt-input" style="width:52px;font-size:12px;padding:3px;"></div>' + NL +
'                    <div><label style="font-size:10px;color:#6b4e31;">智力</label><input id="rc-智力" type="number" class="vt-input" style="width:52px;font-size:12px;padding:3px;"></div>' + NL +
'                    <div><label style="font-size:10px;color:#6b4e31;">感知</label><input id="rc-感知" type="number" class="vt-input" style="width:52px;font-size:12px;padding:3px;"></div>' + NL +
'                    <div><label style="font-size:10px;color:#6b4e31;">魅力</label><input id="rc-魅力" type="number" class="vt-input" style="width:52px;font-size:12px;padding:3px;"></div>' + NL +
'                </div>' + NL +
'                <div style="margin-top:8px;"><button id="btn-save-talent" class="jrpg-btn" style="background:#8e44ad;color:#fff;border-color:#6a308a;">💾 保存</button></div>' + NL +
'            </div>';
c = c.split(htmlOld).join(htmlNew);

// 2) JS：注入保存/读取（在"同伴详情模态框事件"前）
const js = fs.readFileSync('_test_hub/talent_js.js', 'utf8');
if (!c.includes('function saveTalentState')) {
  const anchor = '            // 同伴详情模态框事件';
  const i = c.indexOf(anchor);
  if (i > -1) c = c.slice(0, i) + js + c.slice(i);
}

fs.writeFileSync(f, c);
console.log('HTML设置块:', c.includes('id="talent-sel"'), ' JS注入:', c.includes('function saveTalentState'));
