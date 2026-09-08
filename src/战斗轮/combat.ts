// ============================================================
// 战斗轮 · 核心逻辑：规则注入、变量更新解析、结束检测
// ============================================================

/** 完整战斗规则（注入 generateRaw；照搬伊瑟利亚「战斗轮结算」的 [战斗协议] + 交互要求） */
export const BATTLE_RULES = `[战斗协议]战斗结算规则（完整版）
核心指令: 仅当至少一方明确表达交战意图，且GM判定战斗不可避免时激活。其余非战斗情境禁止触发。所有掷骰必须使用 {{roll:}} 宏，严禁自己生成骰值。<战斗结算>标签必须包裹在<content>里面（无 content 时直接输出）。

# 第一阶段: 战况总览
  逻辑与规则:
    1. 触发: 战斗开始或每轮开始时输出。
    2. 内容: 环境地形及距离、突袭状态、地形高差与优劣骰、掩体、先攻序列、双方状态（HP/MP/SP/防御值/状态）。
    3. 突袭判定: 若一方未察觉，突袭方获得一个完整额外回合。被突袭方在此轮内防御劣化，不可动作/反应。
    4. 地形规则:
       - 优势/惩罚骰: 高处攻击低处获优势骰（投两次取高）；低处仰攻获惩罚骰（投两次取低）。任意数量的优势与劣势同时存在时互相抵消。
       - 掩体判定: 半掩体（矮墙、栅栏、树丛等）目标防御值+2；四分之三掩体（箭垛、厚重石柱等）防御值+5；全掩体不可被直接瞄准攻击。
       - 困难地形: 泥沼、碎石坡、密林、浅水区等使移速减半。
       - 地形变更: 若角色用法术或技能改变地形（油腻术、荆棘丛生等），在战况总览中注明变更范围与持续时间。
    5. 频率: 每轮（6秒）开始时输出一次战况总览，地形变更时同步更新。
  面板模板:
  <战斗结算>
    {战况总览 - 第[X]轮}
    | 环境: [简述环境地形及距离] | 突袭状态: [无 / 某方被突袭] |
    | 地形高差: [角色A]处于[高/低/平地] | 优势方: [角色名](优势骰) / 劣势方: [角色名](惩罚骰) |
    | 掩体: [角色A掩体状况] | 先攻序列: [角色A]([先攻值]) -> [角色B]([先攻值]) -> ... |
    | 队伍状态: [角色A] HP [当前/最大] | MP [当前/最大] | SP [当前/最大] | [角色B] ... |
    | 敌人状态: [敌A] HP [当前/最大] | [敌B] HP [当前/最大] | ... |
  </战斗结算>
  格式说明: 「队伍状态/敌人状态」为紧凑写法（推荐）：「名字 HP 当前/最大 MP 当前/最大 SP 当前/最大」，前端把每个角色渲染为小框，HP/MP/SP 数值按体系着色（HP红/MP蓝/SP绿）。数值必须为「当前/最大」形式。
  叙事指导: (白描当前的对峙局势、环境氛围、角色的位置关系与外貌状态，为本轮战斗定调)

# 第二阶段: 行动执行 (单轮结构)
  逻辑与规则:
    1. 资源限制: 每个角色在自身回合内可执行：移动 + 1个动作 + 1个附赠动作 + 自由行动（不限）。
    2. 移动: 基础速度（人类30尺/短腿25尺/兽人35尺）。困难地形移速减半。
    3. 动作类型: 攻击 / 施法 / 武技 / 疾走(移速翻倍) / 脱离(不触发借机) / 防御(防御值+4) / 协助 / 隐藏 / 使用物品 / 稳定 / 准备行动。
    3.5. 咏唱前摇（施法者强制规则，见【魔法·咏唱前摇规则】）:
      - 施法者分「无咏唱」与「咏唱」两类：无咏唱（角色设定/命格/加护注明"无需咏唱"）直接瞬发；未注明的普通施法者一律需咏唱。
      - 咏唱施法：先花费 1 个完整动作（1 回合）吟唱（本轮只咏唱不释放），法术于施法者下一回合开始完成释放；吟唱期间受击按施法打断规则检定，失败则咏唱中断、法术失败（不扣完整 MP）。
      - 【必须念诵术式语言】咏唱必须在 RP 中念出具体咒文（主角由玩家输入咏唱内容，同伴/敌人由 GM 叙事写出咏唱片段），禁止不咏唱直接"释放XX术式"；咒文风格须与学派匹配（元素咒言/圣光祷言/暗能低语/亡者祷文/契约真名/刻印诵句/律动咏调）。
      - 简化咏唱：技能/装备注明"咏唱缩短/瞬发法术"的可压缩咏唱为附赠动作；符文系预先铭刻激活无需咏唱。
    4. 附赠动作: 双持副手攻击 / 特定技能（狂暴/元素附魔等） / 喝自备药剂。每轮限1次。
    5. 反应: 回合外限1次（借机攻击 / 法术反制 / 闪避本能 / 反击 / 护盾等）。
    6. 资源消耗规则:
       - 武技系主动技能消耗SP（具体值参照职业技能树）；魔法系/神术系主动技能消耗MP；混合系可能SP+MP。
       - SP耗尽时：武技系主动技能无法使用，但普通攻击和被动技能不受影响。
       - MP耗尽时：魔法/神术无法施放，但物理攻击不受影响。
       - 基础攻击（普攻）永远免费，不消耗SP或MP。
  面板模板:
  <战斗结算>
    {行动执行}
    | 角色: [行动者] | 移动: [移动描述] |
    | 动作: [执行的动作] | 附赠动作: [如：无 / 激活元素附魔(SP1+MP2)] |
    | 资源消耗: [如：SP-1 MP-2 / 无] | 效果: [如：恢复1d8 HP / 防御值+4持续一轮] |
  </战斗结算>
  叙事指导: (直接描述角色的走位、使用道具或采取防御的具体动作)

# 第三阶段: 攻击与施法结算 (核心循环)
  逻辑与规则:
    1. 命中检定:
       - 近战: d20 + 力量/敏捷修正 + 熟练加值 vs 目标防御值
       - 远程: d20 + 敏捷/智力修正 + 熟练加值 vs 目标防御值（长射程或近战受干扰时检定劣化）
    2. 地形优劣势骰: 若攻击方具有优势骰（居高临下），命中检定时投掷两次d20取较高值；若具有惩罚骰（仰攻高处），投掷两次取较低值。优劣势与夹击等其他效果叠加时遵循"优势+劣势=抵消"原则。
    3. 部位补正: 攻击方可宣言瞄准特定部位：
       - 头部: 命中DC+4（目标防御值+4），伤害×1.5（向下取整），暴击时附加1轮"眩晕"（目标下回合动作劣化）。
       - 躯干: 命中DC+0，伤害×1.0，无附加效果。
       - 手臂/前肢: 命中DC+2，伤害×0.8（向下取整），命中后武器50%概率脱手（d100≤50）或施法手势受干扰（专注检定DC+2）。
       - 腿部/下肢: 命中DC+2，伤害×0.8，命中后移动速度减半持续1轮。
       - 翅膀/飞行肢: 命中DC+3，伤害×0.8，命中后飞行生物必须落地或坠落。
       - 特殊生物: 构装体头部/躯干效果减半；无定型生物部位补正不适用；攻击比自身小两级及以上目标时部位DC额外+2，大两级及以上时额外-2。
    4. 特殊掷骰: 自然20必定命中，触发暴击（所有伤害骰×2）及附加效果；自然1必定未命中，触发大失败（武器脱手/误伤等）。
    5. 伤害结算: 武器伤害骰 + 对应属性修正 × 部位伤害倍率。应用目标抗性（伤害÷2）或弱点（伤害×2）。
    6. 施法打断与专注: 施法/维持专注时若受击，需进行 智力(魔法)/感知(神术) 检定，DC=10+所受伤害/2，失败则法术打断/结束。法力瞄准部位：法术攻击也可宣言部位，使用相同部位DC修正，伤害倍率仅对直接伤害法术生效，范围法术不适用部位补正。
    7. 特殊机制判定: 记录是否触发借机攻击、夹击（检定优势）、冲锋（命中+1）、压制或缴械。
    8. 资源消耗时机: 武技/魔法/神术的SP/MP在宣言使用时立即扣除，无论命中与否；若SP/MP不足以支付技能消耗，该技能无法使用，角色必须选择其他动作。
  面板模板 (武技/战技/魔法/神术 — 统一结构，用「类型」字段驱动前端着色):
  <战斗结算>
    {武技结算}              ← 近战/远程物理攻击与武技系技能（耗SP）
    | 角色: [行动者] | 目标: [受击者] | 类型: 武技 | 动作: [普攻(武器名) / 武技名] |
    | 瞄准部位: [头部/躯干/手臂/腿部/翅膀] | 地形修正: [优势骰 / 惩罚骰 / 无] |
    | 资源消耗: [如：无(普攻) / SP-2] |
    | 命中检定: {{roll:1d20+修正}} vs 防御/DC [数值](含部位DC+[X]) |
    | 判定结果: [命中 / 未命中 / 暴击(自然20) / 大失败(自然1)] |
    | 伤害结算: [伤害骰结果] + [属性修正] = [基础伤害] × 部位倍率 = [最终伤害] |
    | 弱点/抗性: [目标抗性或弱点] | 状态变更: [目标] HP [旧值] -> [新值] |
    | 资源剩余: [行动者] SP [新值/最大] | MP [新值/最大] |
  </战斗结算>
  （战技结算/魔法结算/神术结算 同结构：战技=通用战技战术动作；魔法=法术系耗MP（类型: 魔法(火系/水系/风系/雷系/冰系/土系)）；神术=神术系耗MP，命中检定用感知。）
  类型字段说明（前端按「类型」整块染色，请严格按规范值填写）:
    - 规范值：武技 / 战技 / 魔法 / 神术；识别不到规范值时结算块不染色。
    - 区块名 {武技结算}/{战技结算}/{魔法结算}/{神术结算} 决定区块基础配色与图标：武技=⚔️、战技=🛡、魔法=✦、神术=✧。

# 第四阶段: 生死与状态变更
  逻辑与规则:
    1. 濒死触发: HP归零时，角色倒地，失去意识，进入濒死状态。
    2. 瞬间死亡: 单次承受的过量伤害绝对值 ≥ 最大HP，直接死亡。
    3. 死亡豁免: 濒死角色在每轮自身回合开始时投d20（无修正）。自然1（2次失败），2-9（1次失败），10-19（1次成功），自然20（恢复1HP苏醒）。
    4. 濒死受击: 受击计1次失败，暴击计2次失败。累计3次成功则稳定昏迷，累计3次失败则死亡。
  面板模板:
  <战斗结算>
    {生死判定}
    | 角色: [濒死者] | 触发: HP降至0 |
    | 死亡豁免: 掷骰 {{roll:1d20}} -> [结果：1次成功/1次失败/2次失败/恢复1HP] |
    | 累计状态: [成功X次 / 失败Y次] | 最终结果: [继续濒死 / 稳定昏迷 / 死亡 / 瞬间死亡] |
  </战斗结算>
  叙事指导: (客观描述角色的倒下、流血情况，或豁免成功时的微弱呼吸，避免过度渲染情感)

# 第五阶段: 战斗结束与结算
  逻辑与规则:
    1. 触发: 一方全灭、投降或成功逃脱。
    2. 经验值结算: 严格按经验获取规则计算：单体EXP = 目标Lv × 目标等阶战斗系数；判断等阶压制（超出1阶无收益）；计算集群衰减。
    3. 状态转化: 清除仅在战斗中生效的临时增益，保留持续性创伤或诅咒。
    4. 资源保留: 战斗结束后HP/MP/SP保持当前值不自动恢复，需通过短休或长休恢复。
  面板模板:
  <战斗结算>
    {战斗结束结算}
    | 结果: [胜利 / 撤退 / 失败] | 战果简述: [如：全歼哥布林营地] |
    | EXP计算: [目标名] Lv[X] × 系数[Y] = [基础EXP] | 等阶压制/衰减: [若适用] |
    | 最终获得EXP: [数值] | 经验值更新: [主角名] 经验值 [旧值] -> [新值]/[升级所需] |
    | 资源剩余: HP [当前/最大] | MP [当前/最大] | SP [当前/最大] | 状态保留: [持续性状态] |
  </战斗结算>
  叙事指导: (白描战斗结束后的战场残骸、角色的疲惫状态，以及搜刮战利品的行为)

[战斗轮交互要求]（前端按此解析美化；格式要求优先于世界书中其他[战斗协议]的书写习惯）
  1. 掷骰宏: 所有检定/伤害/豁免必须用 {{roll:表达式}}（{{roll:1d20}} / {{roll:1d20+5}} / {{roll:2d6+3}} / {{roll:3d6kh2}}优势 / {{roll:2d20kl}}劣势 / {{roll:(1d8+2)*2}}），严禁自编骰值。
  2. 输出格式: 战斗数据放入 <战斗结算> 标签块，块内每行以「| 」开头（| 键: 值），禁止输出不带 | 前缀的键值行；角色扮演叙事、系统提示写在块外。
  3. 状态变更: 每次造成伤害/消耗必须用「状态变更: 角色名 HP 旧值 -> 新值」，新值为具体数字；严禁"视掷骰结果扣减""待下一轮结算"等模糊表述——宏掷出的结果就是最终结果。
  4. 敌我面板: 敌人信息用 <enemy_data> 块输出（开战时必须，战斗中有变化时更新）；同行队友（临时友军/结盟NPC/契约英灵实体化）必须用 <ally_data> 块输出，字段：名称/种族/性别/年龄/等阶/等级/加护/HP(当前|最大)/防御值/移动速度/先攻修正/属性/攻击(名|类型|命中修正|伤害骰|特效)/能力(名|描述)/态度/好感度/状态/装备，[键|值] 每行一个、多值用 | 分隔、每人一块、务必闭合 </ally_data>；开战时队友同行即输出，新队友加入时输出。
  5. 回合呈现: 每个单位行动前输出「X 的回合」（如「莉娜的回合」），随后以该单位视角叙述其行动。
  6. 强制一回合一人: 每次回复只允许「当前行动者」执行行动与结算（<战斗结算> 块内攻击方必须为当前行动者）；其他单位一律等待，严禁在同一回复中让多个单位行动。
  7. 同伴与友军由 GM 叙述其自主行动（符合角色性格与战术）；玩家仅操作主角。
  8. 变量更新: 战斗中的敌我数值变化（HP/MP/SP/残响之力/状态）一律用「状态变更: 角色名 字段 旧值 -> 新值」行报告（新值为具体数字），由前端维护战斗快照（$flags.战斗快照，含友方三维/技能/装备与敌方数据）；战斗中禁止直接更新 stat_data 的角色数值，战斗结束后前端会把快照统一打包回写 stat_data 并生成 $flags.战斗结果。非战斗类变量（剧情/任务/地点/金钱等）仍可输出 <UpdateVariable> 块（内含 <JSONPatch>，标准 JSON Patch，路径相对 stat_data）。
  9. 禁止使用 <!-- --> HTML 注释（会被前端屏蔽）。
  10. 叙事: 每回合以角色扮演口吻叙述动作与战况，白描为主；叙事写在 <战斗结算> 块之外。
  11. 上下文: 战斗中可参考世界书与本轮聊天上下文（角色信息、之前剧情），但战斗判定一律按本协议规则执行。
  12. 力量清单（强制）: 每轮行动前，必须从【当前战斗快照】中的该角色「技能/装备」明细里选定至少一项作为本轮行动依据——写明所用技能（类型/MP消耗/效果）或已装备武器的面板效果/词条/特别机制；确实无合适技能/装备时必须明示"改用普通攻击"并给出一句理由。严禁在技能与装备齐备的情况下只因省事而全程平砍。

[英灵规则]（契约英灵存在时生效，英灵位显示在我方；无契约英灵时整段忽略）
  1. 定位: 英灵不占独立行动轮，不参与先攻序列，随主角战局活动；每轮结算时顺带判断英灵状态。契约英灵实体化/临时队友同行时，必须按交互要求第4条用 <ally_data> 块输出其面板（快照左侧显示）。
  2. 残响之力（0~100）: 我方击杀敌人时英灵汲取源质增加残响（击杀 +10~20 视敌人强度，重伤敌方 +5）；残响增减用「状态变更: 英灵名 残响之力 旧值 -> 新值」与 <UpdateVariable> 同步。
  3. 微弱干涉（残响 < 100）: 英灵可进行低代价干涉（修正攻击轨迹、预警背后攻击、小规模守护），每次消耗 5~10 残响，AI 按战局酌情触发，不能喧宾夺主。
  4. 实质干涉·大招（残响 = 100 满）: 本轮英灵必须根据战局自动释放大招（招式名与效果严格取自下方【英灵世界书条目】中的实质干涉/满残响技能）；释放时在叙事中单独输出招式名标签 <英灵技·技能名>（禁止附描述文字）；使用后残响清空为 0、英灵状态变为「沉睡」；沉睡期间英灵无法进行任何干涉，仅可对话。
  5. 苏醒: 英灵沉睡后，战斗结束时或按英灵世界书条目的苏醒条件判断是否苏醒。
  6. 对话: 英灵发言直接用「英灵名（神态，表情）:【发言内容】」格式（如：断钢的勇者·艾莉卡（冷酷）:【握剑的手太松。左侧暴露了。】），神态表情写在名字后的括号内，禁止使用 <英灵名|表情> 标签格式。
  7. 资料: 英灵的定义/性格/大招/干涉方式/苏醒条件一律以【英灵世界书条目】内容为准，严禁自行编造招式。`;

/** 战斗系统提示词（注入 generateRaw 的 system）；spiritText = 英灵世界书条目内容（无则忽略英灵段） */
export function buildBattleSystemPrompt(snapshotText: string, spiritText = ''): string {
  const spirit = spiritText.trim()
    ? `\n【英灵世界书条目】（契约英灵的资料，英灵的一切行动严格以此为准）\n${spiritText.trim()}\n`
    : '';
  return `${BATTLE_RULES}${spirit}

【当前战斗快照】
${snapshotText || '（暂无快照，请以开战信息为准）'}

【你的职责】
你是战斗主持人+叙述者：根据玩家的操作，按上述规则结算（用宏掷骰），输出符合要求的
叙事与 <战斗结算> 数据块；结算后如角色变量发生变化（HP/MP/SP/状态/物品等），输出
<UpdateVariable> 块（内含 <JSONPatch>）。全程保持角色扮演风格叙事。

【战斗思维链（必须先思考，再输出）】
每次回复严格按以下结构输出：
<thinking>
1. 战术意图：当前行动者（[X]）的意图、可选行动与目标选择（优劣势/部位考量）
2. 数据召回：当前快照关键数据（双方 HP/MP/SP/防御/状态、先攻位置、地形优劣）
3. 检定推导：命中公式（d20+修正 vs 防御/DC）、优劣势骰判定、部位补正、目标抗性/弱点
4. 风险预估：暴击/大失败概率、部位选择收益、资源消耗、濒死风险与死亡豁免
5. 决策：本轮行动与理由（必须且仅限当前行动者行动）
（可引用宏预估，如 {{roll:1d20+5}} 会在显示时掷出真实结果）
</thinking>
<output>
角色扮演叙事（以 X 的回合视角）+ <战斗结算> 数据块 + （如需）<UpdateVariable> 变量更新
</output>
要求：<thinking> 只做推理不写叙事；<output> 只写叙事与数据不重复推理。`;
}

/** 从 AI 回复中提取 <UpdateVariable> 的 JSONPatch 并应用（相对 stat_data 路径） */
export function applyUpdateVariable(text: string, stat: any): { applied: boolean; patches: any[] } {
  const m = String(text || '').match(/<UpdateVariable>[\s\S]*?<JSONPatch>([\s\S]*?)<\/JSONPatch>[\s\S]*?<\/UpdateVariable>/);
  if (!m) return { applied: false, patches: [] };
  try {
    const patches = JSON.parse(m[1].trim());
    if (!Array.isArray(patches)) return { applied: false, patches: [] };
    patches.forEach((p: any) => {
      try {
        if (!p || typeof p.path !== 'string') return;
        // /主角/基础状态/HP/当前 → 主角.基础状态.HP.当前
        const path = p.path.replace(/^\//, '').replace(/\//g, '.');
        if (p.op === 'replace' || p.op === 'add' || p.op === 'insert') {
          _.set(stat, path, p.value);
        } else if (p.op === 'remove') {
          _.unset(stat, path);
        }
      } catch { /* 单条失败跳过 */ }
    });
    return { applied: true, patches };
  } catch {
    return { applied: false, patches: [] };
  }
}

/** 判断是否战斗结束（严格：必须是明确的结束信号，排除「第1轮结束」「{战斗结束}块标题」等误触发） */
export function isBattleEnd(text: string): boolean {
  const t = String(text || '');
  // 明确结束标记：【战斗结束】
  if (/【\s*战斗结束\s*】/.test(t)) return true;
  // 「战斗结束 结果:胜利/失败/撤退…」同行
  if (/战斗结束[\s\S]{0,80}?(?:结果[:：])?\s*[胜利失败撤退全灭击退]/.test(t)) return true;
  // {战斗结束} 块内出现明确结果词
  if (/\{战斗结束\}[\s\S]{0,300}?(胜利|失败|撤退|战败|全灭|击退|溃散)/.test(t)) return true;
  // 已注入的结束日志标记（手动结束）
  if (/【战斗轮结束】/.test(t)) return true;
  return false;
}

/** 提取战斗结果（胜利/撤退/失败） */
export function extractBattleResult(text: string): string {
  const m = String(text || '').match(/战斗结束[\s\S]{0,80}?(?:结果[:：])?\s*([胜利撤退失败]+)/);
  if (m) return m[1];
  const m2 = String(text || '').match(/结果[:：]\s*([胜利撤退失败]+)/);
  return m2 ? m2[1] : '结束';
}

/** 已知字段键名（用于把「键行 + 值行」的分行格式归一化为「键: 值」） */
const FIELD_KEYS = /^(攻击方|施法者|目标|角色|类型|动作|瞄准部位|地形修正|资源消耗|掷骰|检定|判定结果|命中检定\d*|命中|伤害结算\d*|伤害检定\d*|伤害计算|伤害|附加效果|效果|弱点|抗性|状态变更|附加状态|当前状态|资源剩余|移动|附赠动作|位置|结果|战况提示|行动提示|提示|轮次|回合|环境|突袭|地形|战况|参战方|先攻|防御值|防御|HP|MP|SP|剩余|等级|等阶|EXP|经验值|战利品|外貌|状态|名称)$/;

/** 归一化：AI 可能把键值写成两行（键行 + 值行），合并为「键: 值」同行 */
export function normalizeKeyValue(text: string): string {
  const lines = String(text || '').split('\n');
  const out: string[] = [];
  const isBlockTitle = (s: string) => /^(战况总览|行动执行|武技结算|战技结算|魔法结算|神术结算|生死判定|攻击结算|施法结算|生产结算|锻造结算|炼金结算|工艺结算|附魔结算|战斗结束)/.test(s);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { out.push(''); continue; }
    const isKey = FIELD_KEYS.test(line) && !line.includes(':') && !line.includes('|') && !line.includes('→') && !line.includes('->');
    if (isKey) {
      const next = (lines[i + 1] || '').trim();
      // 下一行是「值」（非空、非键、非块标题、非另一行结算行）→ 合并
      const nextIsValue = !!next && !FIELD_KEYS.test(next) && !isBlockTitle(next);
      if (nextIsValue) {
        out.push(`${line}: ${next}`);
        i++;
        continue;
      }
      out.push(line);
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

/** 提取数据块（<enemy_data>/<ally_data>）：兼容 AI 漏写闭合标签（未闭合块解析到下一个开标签或文本末尾） */
export function extractDataBlocks(text: string, tag: string): string[] {
  const re = new RegExp('<' + tag + '>([\\s\\S]*?)(?:</' + tag + '>|(?=<' + tag + '>)|$)', 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = String(m[1] || '');
    if (!body.trim()) continue;
    out.push('<' + tag + '>' + body + (m[0].trimEnd().endsWith('</' + tag + '>') ? '</' + tag + '>' : ''));
  }
  return out;
}

/** 解析数据块（<enemy_data>/<ally_data> 通用）→ { 名称, 面板信息 }（无块时返回 null；兼容 HTML 转义与未闭合标签） */
export function parseEnemyDataBlock(text: string): { name: string; info: Record<string, any> } | null {
  const raw = String(text || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const edM = raw.match(/<(?:enemy_data|ally_data)>([\s\S]*?)(?:<\/(?:enemy_data|ally_data)>|$)/);
  if (!edM) return null;
  let name = '';
  const info: Record<string, any> = {};
  String(edM[1]).split('\n').forEach(line => {
    // 键名不含 |（兼容 [HP|当前|最大]、[攻击|名|类型|...] 等多竖线行）
    const m = line.trim().match(/^\[([^\]|]+)\|(.+)\]$/);
    if (!m) return;
    const key = String(m[1]).trim();
    const val = String(m[2]).trim();
    if (key === '名称' || key === '姓名') name = val;
    else if (key === 'HP') {
      const p = val.split('|');
      info.hp = [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0];
    } else if (key === 'MP') {
      const p = val.split('|');
      info.mp = [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0];
    } else if (key === 'SP') {
      const p = val.split('|');
      info.sp = [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0];
    } else if (key === '防御值') info.def = parseInt(val, 10) || 10;
    else if (key === '等阶') info.rank = val;
    else if (key === '种类') info.kind = val;
    else if (key === '种族') info.race = val;
    else if (key === '等级') info.level = parseInt(val, 10) || 1;
    else if (key === '状态') info.statusText = val;
    else if (key === '移动速度') info.speed = val;
    else if (key === '先攻修正') info.speedInit = val;
    else if (key === '性别') info.gender = val;
    else if (key === '年龄') info.age = val;
    else if (key === '身份') info.identity = val;
    else if (key === '所属势力') info.faction = val;
    else if (key === '加护') info.blessing = val;
    else if (key === '态度') info.attitude = val;
    else if (key === '好感度') info.affinity = val;
    else if (key === '功能') info.function = val;
    else if (key === '背景故事') info.background = val;
    else if (key === '外貌') info.appearance = val;
    else if (key === '性格') info.personality = val;
    else if (key === '弱点') info.weakness = val;
    else if (key === '抗性') info.resist = val;
    else if (key === '免疫') info.immune = val;
    else if (key === '属性') info.attrs = val;
    else if (key === '攻击') {
      const ap = val.split('|');
      info.attack = { name: ap[0], type: ap[1], hit: ap[2], dmg: ap[3], effect: ap[4] || '' };
    } else if (key === '能力') info.ability = val;
    else if (key === '装备') {
      if (!info.equips) info.equips = [];
      info.equips.push(val);
    } else if (key === '随身物品') {
      if (!info.carried) info.carried = [];
      info.carried.push(val);
    } else if (key === '战利品') {
      if (!info.loots) info.loots = [];
      info.loots.push(val);
    }
  });
  return name ? { name, info } : null;
}

/** 合并敌人面板到快照敌人表。
 * AI 的 <enemy_data> 名称可能用种族名（如「复苏的行尸」）而非触发行个体名（如「行尸A」），
 * 此时映射到第一个尚未被面板覆盖的触发敌人。 */
export function mergeEnemyData(enemies: Record<string, any>, ed: { name: string; info: Record<string, any> }): void {
  if (!enemies || !ed) return;
  let target = ed.name;
  if (!enemies[target]) {
    const keys = Object.keys(enemies);
    const uncovered = keys.find(k => !enemies[k] || !enemies[k]._panelCovered);
    if (uncovered) target = uncovered;
  }
  const base = enemies[target] || { hp: [0, 0], mp: [0, 0], sp: [0, 0], def: 10, status: {}, avatar: '' };
  enemies[target] = Object.assign(base, ed.info);
  enemies[target]._panelCovered = true;
}

/** 从开战楼层消息解析战斗快照（⚔️战斗轮 行 + <enemy_data> 块 + <ally_data> 块；兼容 HTML 转义标签） */
export function parseBattleStart(text: string): any {
  // 兼容 AI 输出 &lt;enemy_data&gt; 等转义形式
  const raw = String(text || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const snap: any = {
    active: true,
    round: 1,
    environment: '',
    surprise: '',
    turn: '',
    initiative: [],
    enemies: {},
    extraAllies: {},
    log: [],
  };
  const parseField = (key: string): string => {
    const m = raw.match(new RegExp(key + '[:：]\\s*([^，,。\\s]+)'));
    return m ? m[1] : '';
  };
  snap.round = parseInt(parseField('轮次'), 10) || 1;
  snap.environment = parseField('环境') || '';
  snap.surprise = parseField('突袭') || '';

  const initM = raw.match(/先攻[:：]\s*([^\n]+)/);
  if (initM) snap.initiative = initM[1].split(/[,，、\s]+/).filter(Boolean);

  // 敌人名单（⚔️战斗轮 行内；兼容「狼A HP 30/30 防御12」与「狼A（HP 30/30 防御12）」）
  const enemies: Record<string, any> = {};
  const enM = raw.match(/敌人[:：]\s*([^\n]+)/);
  if (enM) {
    String(enM[1]).split(/[|｜]/).forEach(p => {
      const seg = p.trim();
      let mm = seg.match(
        /^([^\s（(【]+)\s*(?:（([^）]*)）)?\s*HP\s*(\d+)\s*\/\s*(\d+)(?:\s*MP\s*(\d+)\s*\/\s*(\d+))?(?:\s*SP\s*(\d+)\s*\/\s*(\d+))?(?:\s*防御\s*(\d+))?/i
      );
      if (!mm) {
        // 括号内数值写法：狼A（HP 30/30 防御12）
        mm = seg.match(
          /^([^\s（(【]+)\s*（\s*(?:HP\s*)?(\d+)\s*\/\s*(\d+)(?:\s*MP\s*(\d+)\s*\/\s*(\d+))?(?:\s*SP\s*(\d+)\s*\/\s*(\d+))?(?:\s*防御\s*(\d+))?\s*）/i
        );
      }
      if (mm) {
        enemies[mm[1]] = {
          hp: [parseInt(mm[3], 10) || 0, parseInt(mm[4], 10) || 0],
          mp: mm[5] ? [parseInt(mm[5], 10) || 0, parseInt(mm[6], 10) || 0] : [0, 0],
          sp: mm[7] ? [parseInt(mm[7], 10) || 0, parseInt(mm[8], 10) || 0] : [0, 0],
          def: parseInt(mm[9], 10) || 10,
          status: {},
          avatar: '',
        };
      }
    });
  }
  // <enemy_data> 块详情（完整敌人面板；支持多个块、未闭合标签、名称映射）
  extractDataBlocks(raw, 'enemy_data').forEach(block => {
    const ed = parseEnemyDataBlock(block);
    if (ed) mergeEnemyData(enemies, ed);
  });
  // <ally_data> 友方单位（临时友军/结盟NPC），显示在快照左侧
  extractDataBlocks(raw, 'ally_data').forEach(block => {
    const ad = parseEnemyDataBlock(block);
    if (ad) mergeEnemyData(snap.extraAllies, ad);
  });
  snap.enemies = enemies;
  if (!snap.turn && snap.initiative.length) snap.turn = snap.initiative[0];
  snap.log.push(`⚔️ 战斗开始 · 第${snap.round}轮 · 敌人 ${Object.keys(enemies).length} 个`);
  console.log('[战斗轮] 开战解析：敌人=' + Object.keys(enemies).join(',') +
    ' | 友军=' + Object.keys(snap.extraAllies).join(',') +
    ' | 环境=' + snap.environment + ' | 先攻=' + snap.initiative.join(','));
  return snap;
}

/**
 * 从战斗结算文本中提取状态变更并应用 stat_data（前端主动同步快照）。
 * 三层解析：
 *   1. 状态变更: [目标] HP [旧值] -> [新值]（最优先，直接取新值）
 *   2. 资源剩余: [行动者] SP [新值/最大] | MP [新值/最大]
 *   3. 伤害推导兜底：无明确状态变更时，从「命中检定 + 伤害结算 + 目标」计算扣血
 *      （命中值 >= 防御 视为命中，目标 HP 当前值 -= 伤害）
 * 目标名匹配：主角 / 玩家 / 同伴 / 契约兽
 */
export function extractStateChanges(text: string, stat: any, enemyNames: string[] = []): { applied: number } {
  let applied = 0;
  if (!stat) return { applied };
  // 归一化分行格式（键行 + 值行 → 键: 值）
  const normalized = normalizeKeyValue(text);
  const findActor = (name: string): any => {
    const n = String(name || '').trim();
    if (!n) return null;
    if (stat.同伴 && stat.同伴[n]) return stat.同伴[n];
    if (stat.契约兽 && stat.契约兽[n]) return stat.契约兽[n];
    if (n === '主角' || n === '玩家' || n === '[USER]' || n === '你') return stat.主角;
    // 兜底：非敌人名的目标视为主角（AI 常用角色名，如「亚伦」）
    if (stat.主角 && enemyNames.length > 0 && !enemyNames.includes(n)) return stat.主角;
    return null;
  };
  const applyResource = (actor: any, res: string, value: number) => {
    if (!actor) return;
    const base = actor.基础状态 || (actor.基础状态 = {});
    const r = base[res];
    if (r && typeof r === 'object' && value >= 0) {
      const max = Number(r.最大) || 0;
      r.当前 = Math.max(0, Math.min(value, max || value));
      applied++;
    }
  };

  const lines = normalized.split('\n');
  // 已通过「状态变更」直接设置过 HP 的目标（避免伤害兜底重复扣血）
  const hpAppliedTargets = new Set<any>();

  lines.forEach(line => {
    const t = line.trim();
    if (!t) return;
    // 1) 状态变更: [名] HP 12 -> 9 | 附加状态: ...
    const scM = t.match(/状态变更[:：]\s*([^\s|]+)\s+(HP|MP|SP)\s*[\d]+\s*->\s*(\d+)/i);
    if (scM) {
      const actor = findActor(scM[1]);
      applyResource(actor, scM[2].toUpperCase(), parseInt(scM[3], 10));
      if (actor && /^hp$/i.test(scM[2])) hpAppliedTargets.add(actor);
      return;
    }
    // 2) 资源剩余: [名] SP 22/30 | MP 18/40
    const rrM = t.match(/资源剩余[:：]\s*([^\s|]+)\s+(?:SP\s*(\d+)\s*\/\s*\d+)?(?:\s*[|｜]\s*MP\s*(\d+)\s*\/\s*\d+)?/i);
    if (rrM && (rrM[2] || rrM[3])) {
      const actor = findActor(rrM[1]);
      if (rrM[2]) applyResource(actor, 'SP', parseInt(rrM[2], 10));
      if (rrM[3]) applyResource(actor, 'MP', parseInt(rrM[3], 10));
    }
  });

  // 3) 伤害推导兜底：命中检定 + 伤害结算 + 目标 → 扣血
  try {
    let tgtName = '';
    let hitValue = NaN;
    let defValue = NaN;
    let dmgValue = 0;
    lines.forEach(line => {
      const t = line.trim();
      const tgtM = t.match(/目标[:：]\s*([^\s|（(]+)/);
      if (tgtM) tgtName = tgtM[1];
      // 兼容多种命中写法：命中检定1: d20(14) + 7 = 21 vs 防御 13 / 命中检定: 🎲 13 vs 防御 10 / 命中检定: 命中
      const hitM = t.match(/命中检定\d*\s*[:：]\s*(?:🎲)?\s*(?:d20\(\s*(\d+)\s*\)[^=]*=\s*(\d+)|(\d+))(?:\s*vs\s*防御\s*(\d+))?/i);
      if (hitM) {
        hitValue = parseInt(hitM[2] || hitM[3], 10);
        defValue = hitM[4] ? parseInt(hitM[4], 10) : NaN;
      }
      // 兼容多种伤害写法：伤害结算1: (1d6[4] + 4) × 1.2 = 9 / 伤害结算: 🎲 4 / 伤害结算: 4
      const dmgM = t.match(/伤害(?:结算|检定)\d*\s*[:：]\s*[\s\S]*?(?:=\s*(\d+)|🎲\s*(\d+)|\((\d+)\))/i);
      if (dmgM) dmgValue = parseInt(dmgM[1] || dmgM[2] || dmgM[3], 10);
    });
    if (tgtName && !isNaN(hitValue) && dmgValue > 0) {
      const def = isNaN(defValue) ? 10 : defValue;
      const hit = hitValue >= def;
      if (hit) {
        const actor = findActor(tgtName);
        if (actor && !hpAppliedTargets.has(actor)) {
          const base = actor.基础状态 || (actor.基础状态 = {});
          const hp = base.HP;
          if (hp && typeof hp === 'object') {
            const max = Number(hp.最大) || 0;
            const cur = Number(hp.当前) || 0;
            hp.当前 = Math.max(0, Math.min(max || cur, cur - dmgValue));
            applied++;
          }
        }
      }
    }
  } catch { /* 兜底失败不影响 */ }

  return { applied };
}
