---
name: isuria-dev-kit
description: 伊瑟利亚（酒馆助手）角色卡工程规范 —— 前端HTML模板与正则注入安全 / MVU变量 Schema-输出-规则 三件套 / EJS 世界书条目 的写作与修改规则；含防注入、防同步截断、测试与交付清单。修改伊瑟利亚世界卡或同类酒馆世界时参考。
---

# 伊瑟利亚工程开发规范（isuria-dev-kit）

> 本 Skill 沉淀自多次线上踩坑，适用于**酒馆（SillyTavern + TavernHelper）世界卡的直接改文件工作流**：
> 前端渲染模板、MVU 变量体系（Schema / 状态输出 / 更新规则 / 守护脚本）、EJS 世界书条目 三类改动。
> 世界观与数据模型均为**伊瑟利亚**；同类结构的世界可套用。

---

## 0. 工作区地图（先认路再动手）

```
dist\伊瑟利亚\                    ← 部署根：全部直接改，无构建步骤
  ├─ 核心\                        ← 变量体系脚本组
  │   ├─ 伊瑟利亚.json            ← 世界书（319 条目；content 可含 EJS；4空格缩进 CRLF）
  │   ├─ 变量结构脚本             ← stat_data 的 Zod Schema（唯一权威结构）
  │   ├─ 状态变量输出             ← 给 AI 看的上下文 EJS（须与 Schema 同步）
  │   ├─ 变量更新规则             ← 给 AI 的 JSONPatch 操作手册
  │   ├─ 升级代码                 ← VARIABLE_UPDATE_ENDED 守护脚本（等阶/成长/技能点托管）
  │   ├─ 状态栏 / 紧张度 / 纪元触发器 / 首页代码
  └─ <根级>                       ← 前端渲染模板（```html 围栏文件）与 .ejs.txt/.yaml/.md
_test_hub\test_*.mjs              ← 回归测试（_run_all.mjs 自动扫描判绿）
```

**三条铁律**
1. 只改 `dist\伊瑟利亚\`，无构建；改完即产物。
2. 每个改动：Schema ↔ 状态输出 ↔ 更新规则 三处同步；配测试；`_run_all.mjs` 全绿才交付。
3. 交付时**明确告知用户需要把哪些文件重新粘贴同步到酒馆条目 + 硬刷新**（酒馆里跑的是粘贴副本，不是磁盘文件）。

---

## 1. 部署形态与同步（决定你改的到底是谁）

| 文件形态 | 酒馆里的挂载 | 生效方式 |
|---|---|---|
| 根级 ```` ```html ```` 围栏文件（权能前端/战争前端/NPC以及敌人相关规则…） | **正则替换条目**的替换文本 | 改后**整段重新粘贴** + 硬刷新 |
| `核心\首页代码`（完整 HTML，1MB+） | **正则替换条目**的替换文本 | 同上；**超长，粘贴易截断** → 贴完必须验证尾部完整 |
| `核心\伊瑟利亚.json` 条目 | 世界书条目 | 导入/重载世界书；条目须**启用** |
| `核心\*` 脚本（Schema/输出/规则/升级/状态栏） | 酒馆对应 UI 的脚本输入框 | 整段重新粘贴/导入 |

**同步截断事故**（真发生过）：script 后半被截 → 页面能显示、但点任何按钮都 `xxx is not defined`（函数全丢）。
→ 同步后自检：F12 执行 `typeof window.关键函数` 应返回 `"function"`；或搜文件尾部特征文本。

---

## 2. 注入安全（防 SillyTavern 二次处理破坏）★ 最高优先级

正则替换引擎 `public/scripts/extensions/regex/engine.js` 对**替换文本**会做：
```js
replaceString.replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_, num) => 捕获组内容或空串)
substituteParams(replaceWithGroups)   // {{宏}} 展开
```
因此**凡是要粘贴进正则条目的文本（首页代码/前端模板），禁止出现**：
- 字面 `$数字`（`$1`…`$99`）——被展开成捕获组内容：无捕获组→空串（多数无害）；**有捕获组→整段匹配文本注入**，撑破 JS 字符串 → 远处 `Unexpected token '<'` → 整段脚本失效（已发生）。
- `$<name>`、`$&`、`$'`、`$\``（JS replace 引擎序列）
- `{{任意宏}}`（含 `{{match}}`、`{{getvar…}}`）
- HTML/JS 内字面 `</script`、`<!--`（让浏览器提前截断/进特殊态）

**JS 里确实需要 `'$1'` 时**（如 JSON 尾逗号清理）：
```js
// ✗ 会被展开注入
s.replace(/,\s*([\]}])/g, '$1');
// ✓ 函数式回调，无字面 $
s.replace(/,\s*([\]}])/g, (m, g1) => g1);
// 或字符串拼接（$ 后非数字不匹配展开）
'$' + '1'
```

**扫锚点**（交付前对将粘贴的全文跑一遍）：
`\$[0-9]+` | `\$<` | `\{\{` | `</script` | `<!--` → 均应 0。

---

## 3. 前端模板写作（```html 围栏 / 正则注入 $1）

### 3.1 标准骨架
````markdown
```html
<!DOCTYPE html>…<body><div id="面板容器"></div>
<script>
  function getRawText() {           // 取注入数据：优先 #rawData($1 占位)，否则读当前楼层
    var el = document.getElementById('rawData');
    if (el) { var t = el.innerText || el.textContent || '';
      if (t && t.trim() && t.indexOf('$1') === -1) return t; }
    …getCurrentMessageId / getChatMessages 兜底…
  }
  function parseAndRender(raw) { …仅渲染数据块… }
  $(function(){ init(); });         // 入口
</script>
```
````

### 3.2 数据提取（避免"吞正文"事故 ★）
- **必须做块级提取**：只渲染 `<(你的标签)>…</(标签)>` 内容：
  ```js
  var blocks = raw.match(/<(标签A|标签B)>[\s\S]*?<\/(标签A|标签B)>/g);  // [\s\S] 含换行
  ```
- **协议标签名要对准**：前端匹配的标签必须与世界书协议模板写的标签一致（曾因协议写 `<战争结算>`、前端只匹配 `<国战结算>` → 全落空）。
- **严禁"无包裹就整段渲染"兜底**：那会把战报前后的正文叙事一起塞进面板。
  正确兜底：从特征锚点（如 `{国战总览`/`{城战结算`/`| 战争:`）截取，并**剔除纯散文行**（只保留 `{块}`/`[小节]`/`| 数据行`）；毫无特征 → 显示「未检测到…」占位。
- 键值行解析：单值 `[键|值]` 用 match；可重复项（攻击/能力/奥义/战利品…）用 **全局 exec 循环** push 数组。
- 宽容解析 AI 输出（单对象 JSON）：括号配对找 `{`…`}`（跳过字符串与转义）→ 失败再走注释/尾逗号/裸换行清理（见 5 节模式）；**不要把"数组优先"的启发式用在"单对象"任务上**。

### 3.3 样式体系（伊瑟利亚既有约定）
- 小标题统一 `◈` 前缀（NPC/权能前端）；战斗类 `◆`；段落用 ✦/✧ 分隔。
- 层级配色已有约定：普通/超凡/精英/史诗/传说 徽章色；权能 ❖ 紫金块、奥义 ✧ 金块（`.power-block`/`.ougi-block`）。
- 面板主题类：npc/召唤物/契约兽/集群 各自风格类；契约兽按元素上色（elem-*）。
- 若 UI 按钮触发写入 stat_data（如"一键写入状态栏"）：用 TavernHelper `helper.insertOrAssignVariables`，`showResult` 反馈。

### 3.4 前端自检（vm 编译通过 ≠ 浏览器可用）
- JS 语法（`new vm.Script`）＋ CSS `{ }` 平衡 ＋ HTML 容器标签配对（忽略 script/style/select 系内部）。
- **Edge/Chrome headless 真实加载探针**（HTML/iframe 类必须）：
  ```powershell
  msedge --headless=new --disable-gpu --dump-dom "file:///…/页面.html"
  # 在文件末尾注入探针 <script>document.title=…typeof window.关键函数…</script> 读 title
  ```
- 无 `</script`/`<!--`/危险 `$` 序列（见 §2）。

---

## 4. MVU 变量层（Schema / 输出 / 规则 / 守护脚本）

### 4.1 stat_data 结构地图与路径分层 ★ 最易写错
```
stat_data.
  世界     .日期/时间/当前位置/四传奇觉醒/世界见闻/追踪记录…
  主角     .基础信息{姓名,种族,魔力回路,资质} .等阶 .基础属性 .基础状态 .防御值
           .资产与能力{货币,物品栏,装备栏(5槽),角色技能,魔法栏,神术栏,加护,权能,奥义}
           .任务
  英灵     .名称/残响之力/羁绊值/被动效果/执念/英灵技/英灵殿
  主要NPC  .{名}: {好感度,心里话,出生年月日,身份,关系…}
  同伴     .{名}: {…, 基础属性, 基础状态, 技能, 物品栏, 权能, 奥义, 装备栏, 资质, 防御值}
  召唤物   .{名}: z.any() 宽容
  契约兽   .{名}: {…, 基础状态, 攻击[], 能力[], 吐息}
  领地     .{名}: {规模等级,人口,军队,科技…}
  $ 前缀   = AI 不可见不可写（如 $customSkillTrees、$flags）——状态栏/脚本专用
```
**血泪分层**（写 EJS/规则时极易混）：
- 主角的权能/奥义在 `主角.资产与能力.权能/.奥义`（**嵌套**）。
- 同伴的权能/奥义在 `同伴.{名}.权能/.奥义`（**顶层扁平**，Schema 中没有 `同伴.资产与能力`）。
- 契约兽招式是**数组** `攻击[]/能力[]`（整体 replace 数组操作），不是 Record。

### 4.2 Schema（核心\变量结构脚本）
- 用 `registerMvuSchema(Schema)` 包裹（`registerVariableSchema` 会注册错层级、把 stat_data 塌成 true）。
- **Zod 嵌套 z.object 默认 strip**：AI/脚本写入未声明的嵌套字段会被剥掉。
  → **新增任何字段必须显式声明**，且注意：
  - 装备栏 5 槽、`grantedLv/grantedSp`、`_属性锁定`、`_锁定`、`风格` 等"脚本/UI 专用"字段要声明防剥（否则丢失/重复补发）。
  - 旧档兼容：`z.preprocess`/`prefault({})`/宽松预处理（六维、资质字符串→对象）。
- 宽松工具：`str()/safeNum()/clampNum()`、`基础属性块/基础状态块`（主角/同伴/契约兽共用）。

### 4.3 状态变量输出（核心\状态变量输出，EJS）
- **与 Schema 严格同步**：Schema 加容器 → 输出必须加段（主角段读 `V.主角.资产与能力?.X`；**同伴段读顶层** `_.get(comp,'X',{})`），否则 AI 看不见 → 重复触发觉醒/写丢失。
- 读变量用 `V.主角…` 或 `_.get`；`print(...)` 输出；空容器输出「无」占位。
- 年龄等派生值只读（出生年月日 + eraAge 计算），禁止让 AI 写年龄。

### 4.4 变量更新规则（给 AI 的 JSONPatch 手册）
- 新增字段三处补：Schema、状态输出、更新规则（type 声明 + 主角/同伴**分层路径** + insert/remove/replace/delta 操作语义）。
- 硬性：Record 容器改条目用精确 replace；新增 insert / 删除 remove；整体 replace 仅批量重置。
- AI 禁改：总等级、经验值.升级所需、待分配职业等级/未分配点数/技能点（只减不增）、HP/MP/SP 最大值（升级脚本托管；主角另有状态栏命令层 `_` 前缀硬拦截）。
- 经验值.当前 只能 `delta` 增；经验仅在有经验获取途径时发放，每轮一次。

### 4.5 写入 API 语义
- 楼层变量：`Mvu.getMvuData({type:'message',message_id:'latest'})` → 改 → `replaceMvuData`。
- **chat 级双写**（状态栏经 getAllVariables 读 chat 级）：`updateVariablesWith(v => {…; return v;}, {type:'chat'})`。
- 跨聊天持久存档：**角色卡变量** `getVariables({type:'character'})` + `replaceVariables`（存档点列表/快照导入导出）。
- 守护脚本（升级代码/状态栏）在 iframe 中：函数要暴露给 UI 用 `window.xxx=xxx`（IIFE 内不会自动挂全局）+ `initializeGlobal`。
- MVU 事件：`Mvu.events.VARIABLE_UPDATE_ENDED` 挂守护；注意**防重入锁**（改 stat_data 又触发事件死循环）。

### 4.6 数值体系锚点（勿自行发明）
- 等阶 RANK_LEVELS：普通1-4 / 超凡5-8 / 精英9-12 / **史诗13-16** / **传说17-20** / 神话21-25。
- 升级脚本 HP 成长 =（职业HP骰 + 体质修正）× 等阶倍率（1 / 1.2 / 1.4 / 1.6 / 1.8 / 2.0）。
- 觉醒阈值：奥义=史诗(13) / 权能=传说(17) / 权能可进化=神话(22)。
- 职业成长表 `职业每级成长`：HP/MP/SP 骰面 + sp/级；契约兽 sp=0 无技能点。
- 数值风格：修正用固定值 `+N/-N`（禁超 +5）；伤害用固定骰/骰面升阶（禁超 2d10）；**禁百分比**（暴击改"范围 20→19-20"，减伤改固定值，冷却改轮数）。

---

## 5. EJS 世界书条目（content 直接写 <% %>）

### 5.1 定位与生效
- 先按 **comment 精确核对该条目**（近似名事故：`[战斗轮交互协议]`≠`[NPC角色/敌人输出规则]`——曾改错条目还误动了开关）。核对 uid + content 特征再改。
- 条目要生效：`constant=true` 且 `disable=false`（禁用条目写了不生效）。
- 修改 `伊瑟利亚.json`：JSON.stringify(null,4) 保持缩进，**CRLF 保留**；条目数/合法性入测试。

### 5.2 EJS 骨架（检测/觉醒类必须幂等）
```ejs
<%
const _X = getvar('stat_data.目标容器', { defaults: {} });   // 或 _.get
function _empty(rec){ return !rec || typeof rec!=='object' || !Object.keys(rec).length; }
function _lvl(a){ return _.get(a,'基础状态.总等级',0)||0; }
// 达标 && 尚无 → 才输出指令（防止每轮重复觉醒）
%>
<觉醒检测>
<% …print('<觉醒 目标=… 路径=…>…')… %>
</觉醒检测>
```
- 沙箱可用全局有限：`getvar / _ / print / getvar` 家族；**不要依赖 DOM**。
- 输出携带：写入路径（主角 `/主角/资产与能力/奥义/名` vs 同伴 `/同伴/{名}/奥义/名` **顶层**）、生成依据（职业/最高属性）、`<标签>` 详情（前端渲染）、禁止事项。
- 阈值对齐 §4.6；`{defaults:{}}` 兜底空档。

### 5.3 与前端联动
- 觉醒/结算输出标签（`<奥义觉醒>`、`<权能>`、`<战争结算>`…）由前端 `parseAndRender` 消费——**标签名必须两端一致**（曾因 `<战争结算>` vs `<国战结算>` 不匹配全线崩溃）。
- EJS 只在世界书注入上下文运行；"点击按钮写入变量"要交给前端模板 + TavernHelper API，别指望世界书条目能响应点击。

---

## 6. 测试规范（_test_hub）

- `test_*.mjs`（`_run_all.mjs` 自动扫描判绿；退出码 0 且无 ❌）。判断绿依据：输出含「0 失败/全部通过」。
- 三种手法：
  1. **静态断言**：`script.includes(...)` 片段存在性（注意 CRLF，正则用 `\r?\n`）。
  2. **vm 沙箱**：mock `document.getElementById/querySelectorAll`、`window`、`$`、`generateRaw` 等后整段跑 script（首页等大脚本顶层 IIFE 多 → 易崩）。
  3. **切段执行**（大脚本最稳）：`new Function(脚本.slice(起点,终点) + 前缀依赖, 'return {fn…}')` —— 只切纯函数，避开顶层 IIFE/环境依赖。
- EJS 逻辑：剥离 `<% %>` 后用 mock `getvar/_/print` 执行代码块断言输出。
- 组件级验证补 **Edge headless 探针**（§3.4）与标签配对脚本。

---

## 7. 交付检查清单（改完必查）

- [ ] 语法：JS `new vm.Script`；CSS `{`=`}`；HTML 容器标签配对无未闭合
- [ ] 编码/行尾：CRLF 文件保持 CRLF；无异常控制字符
- [ ] 注入锚点（将粘贴进正则条目的内容）：`$数字 / $< / {{ / </script / <!--` 全 0
- [ ] 真实浏览器：HTML/iframe 类文件过 Edge headless 探针（关键函数 typeof OK）
- [ ] 三件套同步：Schema ↔ 状态变量输出 ↔ 变量更新规则 同字段同路径同分层
- [ ] 路径分层正确：主角嵌套 vs 同伴顶层（权能/奥义）
- [ ] 幂等：觉醒/升级检测无重复输出
- [ ] 新增/改动配了 `_test_hub` 测试，`_run_all.mjs` 全绿
- [ ] 交付说明写清：改了哪些文件 / 酒馆里要重新粘贴同步哪些条目 / 硬刷新

---

## 8. 常见坑速查

| 症状 | 根因 | 解法 |
|---|---|---|
| 点按钮全 `not defined` | 粘贴截断 / 函数定义丢失 / 注入被引擎破坏 | 核对 `typeof window.fn`；重贴全文；查 `$数字`/`{{` |
| `Unexpected token '<'` 远行号 | `$数字` 被展开成消息文本注入 JS | 函数式替换替代 `'$1'` |
| 正文被吞进前端面板 | 无包裹标签时整段渲染兜底 | 特征锚点截取 + 剔散文行 + 占位 |
| 前端什么都不显示 | 标签名与协议不一致 | 两端统一 `<战争结算>` 式标签 |
| 写入字段被剥 | Zod strip 未声明字段 | Schema 显式声明（含 `_` 内部字段） |
| 同伴权能写不进/反复觉醒 | 写进了不存在的 `同伴.资产与能力` | 顶层 `同伴.{名}.权能` |
| 世界书改动不生效 | 条目 disable=true | constant=true + disable=false |
| 存档/跨页丢资质回路 | 回填缺字段 / 无条件覆盖 | 导入回填 + dirty 标记防覆盖 |
| 修改 NPC 误伤其它条目 | 只看近似名没核对 | 先核 comment/uid/content 再改 |
| 觉醒/进化每轮重复 | 检测非幂等 | 达标且容器为空才输出 |

---

## 附：常用可复用片段

**JSON 尾逗号/尾逗号清理（防注入写法）**
```js
s = s.replace(/,\s*([\]}])/g, (m, g1) => g1);
```

**宽容单对象 JSON 解析（AI 输出）**
```js
function parseAiJson(text){            // 剥围栏 → 标准 parse → {…}配对 → 宽松清理
  var s=String(text==null?'':text);
  var fm=s.match(/(?:```|~~~)(?:json)?\s*([\s\S]*?)(?:```|~~~)/i); if(fm) s=fm[1];
  try{return unwrap(JSON.parse(s));}catch(e0){}
  var start=findObjStart(s); if(start<0) throw new Error('未找到 {');
  var end=findObjEnd(s,start); if(end<0) throw new Error('括号未闭合');
  var c=s.slice(start,end+1);
  try{return unwrap(JSON.parse(c));}catch(e1){ return unwrap(JSON.parse(looseClean(c))); }
}
```
（`findObjStart/End` 跳过字符串与 `\` 转义；`looseClean` 去 `//`、`/* */` 注释、尾逗号、字符串内裸换行；`unwrap` 数组取首个对象。）

**输出段骨架（状态变量输出 EJS）**
```ejs
    新容器:
<%
const rec = V.主角.资产与能力?.新容器 || {};
if (Object.keys(rec).length===0) { print('      无\n'); }
else { for (const [k,d] of Object.entries(rec)) print('      - '+k+(d.描述?('：'+d.描述):'')+'\n'); }
%>
```
（同伴段记得改读 `_.get(comp,'新容器',{})`。）

**Schema 显式声明样板**
```js
新容器: z.record(z.string().describe('名'), z.object({
  描述: str(''),
  消耗SP: safeNum(0),
  消耗MP: safeNum(0)
}).prefault({})).prefault({})
```
