// ============================================================
// 战斗轮 · 快照数据读取（stat_data 己方 + $flags.战斗快照 敌方/轮次/日志）
// ============================================================

export interface AllyUnit {
  name: string;
  kind: '主角' | '同伴' | '契约兽' | '友军' | '英灵';
  hpCur: number;
  hpMax: number;
  mpCur: number;
  mpMax: number;
  spCur: number;
  spMax: number;
  def: number;
  rank: string;
  status: Record<string, { 描述?: string }>;
  avatar: string;
  /** 英灵专属：残响之力（0~100） */
  spiritPower?: number;
  /** 英灵专属：状态（苏醒/沉睡） */
  spiritStatus?: string;
  /** 友军专属（<ally_data>）：等级/种族/攻击/能力 */
  level?: number;
  race?: string;
  attack?: EnemyUnit['attack'];
  ability?: string;
  /** 友军专属（<ally_data> 详细字段，可选） */
  gender?: string;
  age?: string;
  identity?: string;
  faction?: string;
  blessing?: string;
  speed?: string;
  speedInit?: string;
  attrs?: string;
  attitude?: string;
  affinity?: string;
  function?: string;
  background?: string;
  appearance?: string;
  personality?: string;
  equips?: string[];
  carried?: string[];
}

export interface EnemyUnit {
  name: string;
  hpCur: number;
  hpMax: number;
  mpCur: number;
  mpMax: number;
  spCur: number;
  spMax: number;
  def: number;
  status: Record<string, unknown>;
  avatar: string;
  /** 敌人面板（来自 <enemy_data>） */
  kind?: string;
  race?: string;
  rank?: string;
  level?: number;
  speed?: string;
  weakness?: string;
  resist?: string;
  immune?: string;
  attrs?: string;
  attack?: { name: string; type: string; hit: string; dmg: string; effect: string };
  ability?: string;
  loots?: string[];
}

export interface BattleSnapshot {
  active: boolean;
  round: number;
  environment: string;
  surprise: string;
  turn: string;
  /** 当前行动者在先攻序列中的下标（轮转指针） */
  turnIndex: number;
  initiative: string[];
  /** 本轮已行动单位（前端据此检测整轮走完自动换回合） */
  actedRound: string[];
  enemies: Record<string, any>;
  /** 友方单位（临时友军/结盟NPC，来自 <ally_data>） */
  extraAllies: Record<string, any>;
  /** 友方战斗数据区（开战时从 stat_data 复制：三维/技能/装备/防御/等阶；战斗中数值只在这里变化，战斗结束统一打包回写 stat_data） */
  friendlies: Record<string, any>;
  log: string[];
}

function readSnapshotFromStat(stat: any): BattleSnapshot {
  try {
    const flags = stat ? _.get(stat, '$flags', {}) : {};
    const s = flags.战斗快照 || {};
    return {
      active: !!s.active,
      round: Number(s.round) || 1,
      environment: String(s.environment || ''),
      surprise: String(s.surprise || ''),
      turn: String(s.turn || ''),
      turnIndex: Number(s.turnIndex) || 0,
      initiative: Array.isArray(s.initiative) ? s.initiative.map(String) : [],
      actedRound: Array.isArray(s.actedRound) ? s.actedRound.map(String) : [],
      enemies: (s.enemies && typeof s.enemies === 'object') ? s.enemies : {},
      extraAllies: (s.extraAllies && typeof s.extraAllies === 'object') ? s.extraAllies : {},
      friendlies: (s.friendlies && typeof s.friendlies === 'object') ? s.friendlies : {},
      log: Array.isArray(s.log) ? s.log.map(String) : [],
    };
  } catch {
    return { active: false, round: 1, environment: '', surprise: '', turn: '', turnIndex: 0, initiative: [], actedRound: [], enemies: {}, extraAllies: {}, friendlies: {}, log: [] };
  }
}

function readSnapshot(): BattleSnapshot {
  try {
    const all = typeof getAllVariables === 'function' ? getAllVariables() : {};
    return readSnapshotFromStat(_.get(all, 'stat_data'));
  } catch {
    return { active: false, round: 1, environment: '', surprise: '', turn: '', initiative: [], enemies: {}, log: [] };
  }
}

/**
 * 从 stat_data 构建友方战斗数据区（$flags.战斗快照.friendlies）。
 * 结构：{ 单位名: { kind, hp:[当前,最大], mp:[..], sp:[..], def, rank, status, avatar, 技能:[名..], 装备:[名..] } }
 * 英灵：{ kind:'英灵', 残响之力, 状态 }（无三维）
 * 战斗中所有友方数值变化只维护在这里；战斗结束由前端统一打包回写 stat_data。
 */
export function buildFriendlySnapshot(stat: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!stat || typeof stat !== 'object') return out;
  const avatarMap = _.get(stat, '$avatarMap', {});
  const pickActor = (name: string, actor: any): any => {
    if (!actor || typeof actor !== 'object') return null;
    const base = _.get(actor, '基础状态', {});
    const ab = _.get(actor, '资产与能力', {});
    const skillNames = [
      ...Object.keys(_.get(ab, '角色技能', {}) || {}),
      ...Object.keys(_.get(ab, '魔法栏', {}) || {}),
      ...Object.keys(_.get(ab, '神术栏', {}) || {}),
    ];
    // 技能详情（战斗规则"力量清单"引用：类型/等级/MP消耗/描述）
    const skillDetail: Record<string, any> = {};
    [...Object.entries(_.get(ab, '角色技能', {}) || {}),
      ...Object.entries(_.get(ab, '魔法栏', {}) || {}),
      ...Object.entries(_.get(ab, '神术栏', {}) || {})].forEach(([sn, sd]: any) => {
      const isMagic = !!(_.get(ab, '魔法栏', {}) && _.get(ab, ['魔法栏', sn]));
      const isDivine = !!(_.get(ab, '神术栏', {}) && _.get(ab, ['神术栏', sn]));
      skillDetail[sn] = {
        类型: isMagic ? '魔法' : (isDivine ? '神术' : '技能'),
        描述: String((sd && sd.描述) || ''),
        等级: Number((sd && sd.等级)) || 1,
        MP消耗: Number((sd && sd.消耗MP)) || 0,
      };
    });
    const equipSlot = _.get(ab, '装备栏', {});
    const equipNames = Object.keys(equipSlot)
      .map(k => String(_.get(equipSlot, [k, '物品名'], '') || ''))
      .filter(Boolean);
    // 装备详情（面板效果/附加词条/特别机制——战斗规则引用）
    const equipDetail: Record<string, any> = {};
    Object.entries(equipSlot || {}).forEach(([slot, eq]: any) => {
      if (eq && eq.物品名) {
        equipDetail[slot] = {
          物品名: String(eq.物品名),
          品阶: String(eq.品阶 || ''),
          面板效果: (eq.面板效果 || {}),
          附加词条: Array.isArray(eq.附加词条) ? eq.附加词条 : [],
          特别机制: String(eq.特别机制 || ''),
        };
      }
    });
    return {
      kind: '',
      hp: [Number(_.get(base, 'HP.当前', 0)) || 0, Number(_.get(base, 'HP.最大', 0)) || 0],
      mp: [Number(_.get(base, 'MP.当前', 0)) || 0, Number(_.get(base, 'MP.最大', 0)) || 0],
      sp: [Number(_.get(base, 'SP.当前', 0)) || 0, Number(_.get(base, 'SP.最大', 0)) || 0],
      def: Number(_.get(actor, '防御值', 10)) || 10,
      rank: String(_.get(actor, '等阶', '') || ''),
      status: _.get(base, '自身状态', {}),
      avatar: String(avatarMap[name] || ''),
      技能: skillNames,
      技能详情: skillDetail,
      装备: equipNames,
      装备详情: equipDetail,
    };
  };
  if (stat.主角) { const f = pickActor('主角', stat.主角); if (f) out['主角'] = { ...f, kind: '主角' }; }
  Object.keys(stat.同伴 || {}).forEach(n => { const f = pickActor(n, stat.同伴[n]); if (f) out[n] = { ...f, kind: '同伴' }; });
  Object.keys(stat.契约兽 || {}).forEach(n => { const f = pickActor(n, stat.契约兽[n]); if (f) out[n] = { ...f, kind: '契约兽' }; });
  const spirit = stat.英灵;
  if (spirit && typeof spirit === 'object' && spirit.名称) {
    out['英灵'] = {
      kind: '英灵',
      name: String(spirit.名称),
      残响之力: Math.max(0, Math.min(100, Number(spirit.残响之力) || 0)),
      状态: String(spirit.状态 || '苏醒'),
      avatar: String(avatarMap[String(spirit.名称)] || ''),
    };
  }
  return out;
}

function extractAllies(stat: any, extraAllies: Record<string, any> = {}, friendlies: Record<string, any> = {}): AllyUnit[] {
  const out: AllyUnit[] = [];
  if (!stat) return out;
  const avatarMap = _.get(stat, '$avatarMap', {});
  const push = (name: string, kind: AllyUnit['kind'], actor: any) => {
    if (!actor || typeof actor !== 'object') return;
    // 快照 friendlies 优先（战斗中数值只维护在快照）
    const f = friendlies[name];
    const base = f && typeof f === 'object'
      ? { HP: { 当前: f.hp?.[0], 最大: f.hp?.[1] }, MP: { 当前: f.mp?.[0], 最大: f.mp?.[1] }, SP: { 当前: f.sp?.[0], 最大: f.sp?.[1] }, 自身状态: f.status || {} }
      : _.get(actor, '基础状态', {});
    out.push({
      name,
      kind,
      hpCur: Number(f ? f.hp?.[0] : _.get(base, 'HP.当前', 0)) || 0,
      hpMax: Number(f ? f.hp?.[1] : _.get(base, 'HP.最大', 0)) || 0,
      mpCur: Number(f ? f.mp?.[0] : _.get(base, 'MP.当前', 0)) || 0,
      mpMax: Number(f ? f.mp?.[1] : _.get(base, 'MP.最大', 0)) || 0,
      spCur: Number(f ? f.sp?.[0] : _.get(base, 'SP.当前', 0)) || 0,
      spMax: Number(f ? f.sp?.[1] : _.get(base, 'SP.最大', 0)) || 0,
      def: Number(f ? f.def : _.get(actor, '防御值', 10)) || 10,
      rank: String(f ? f.rank : _.get(actor, '等阶', '') || ''),
      status: (f ? f.status : _.get(base, '自身状态', {})) || {},
      avatar: String(f ? f.avatar : avatarMap[name] || ''),
    });
  };
  if (stat.主角) push('主角', '主角', stat.主角);
  Object.keys(stat.同伴 || {}).forEach(n => push(n, '同伴', stat.同伴[n]));
  Object.keys(stat.契约兽 || {}).forEach(n => push(n, '契约兽', stat.契约兽[n]));
  // 契约英灵：stat_data.英灵.名称 非空 → 我方开启英灵位（残响之力/状态）
  const spirit = stat.英灵;
  if (spirit && typeof spirit === 'object' && spirit.名称) {
    const name = String(spirit.名称);
    const f = friendlies['英灵'];
    out.push({
      name,
      kind: '英灵',
      hpCur: 0, hpMax: 0, mpCur: 0, mpMax: 0, spCur: 0, spMax: 0,
      def: 10,
      rank: '英灵',
      status: {},
      avatar: String(f ? f.avatar : _.get(stat, '$avatarMap.' + name, '') || ''),
      spiritPower: Number(f ? f.残响之力 : spirit.残响之力) || 0,
      spiritStatus: String(f ? f.状态 : spirit.状态 || '苏醒'),
    });
  }
  // 友方单位（<ally_data>）：临时友军/结盟NPC
  Object.keys(extraAllies || {}).forEach(n => {
    const e = extraAllies[n] || {};
    const hp = e.hp || [0, 0];
    const mp = e.mp || [0, 0];
    const sp = e.sp || [0, 0];
    // 状态：优先 status 对象；否则 statusText（[状态|专注]）并入
    let st: Record<string, { 描述?: string }> = (e.status && typeof e.status === 'object') ? e.status : {};
    if (e.statusText && !Object.keys(st).length) st = { [String(e.statusText)]: { 描述: String(e.statusText) } };
    out.push({
      name: n,
      kind: '友军',
      hpCur: Number(hp[0]) || 0,
      hpMax: Number(hp[1]) || 0,
      mpCur: Number(mp[0]) || 0,
      mpMax: Number(mp[1]) || 0,
      spCur: Number(sp[0]) || 0,
      spMax: Number(sp[1]) || 0,
      def: Number(e.def) || 10,
      rank: String(e.rank || '') || undefined,
      status: st,
      avatar: String(e.avatar || ''),
      level: e.level ? Number(e.level) : undefined,
      race: e.race ? String(e.race) : undefined,
      attack: e.attack || undefined,
      ability: e.ability ? String(e.ability) : undefined,
      gender: e.gender ? String(e.gender) : undefined,
      age: e.age ? String(e.age) : undefined,
      identity: e.identity ? String(e.identity) : undefined,
      faction: e.faction ? String(e.faction) : undefined,
      blessing: e.blessing ? String(e.blessing) : undefined,
      speed: e.speed ? String(e.speed) : undefined,
      speedInit: e.speedInit ? String(e.speedInit) : undefined,
      attrs: e.attrs ? String(e.attrs) : undefined,
      attitude: e.attitude ? String(e.attitude) : undefined,
      affinity: e.affinity !== undefined ? String(e.affinity) : undefined,
      function: e.function ? String(e.function) : undefined,
      background: e.background ? String(e.background) : undefined,
      appearance: e.appearance ? String(e.appearance) : undefined,
      personality: e.personality ? String(e.personality) : undefined,
      equips: Array.isArray(e.equips) ? e.equips.map(String) : undefined,
      carried: Array.isArray(e.carried) ? e.carried.map(String) : undefined,
    });
  });
  return out;
}

function extractEnemies(snap: BattleSnapshot): EnemyUnit[] {
  const out: EnemyUnit[] = [];
  Object.keys(snap.enemies || {}).forEach(name => {
    const e = snap.enemies[name] || {};
    const hp = e.hp || [0, 0];
    const mp = e.mp || [0, 0];
    const sp = e.sp || [0, 0];
    const unit: EnemyUnit = {
      name,
      hpCur: Number(hp[0]) || 0,
      hpMax: Number(hp[1]) || 0,
      mpCur: Number(mp[0]) || 0,
      mpMax: Number(mp[1]) || 0,
      spCur: Number(sp[0]) || 0,
      spMax: Number(sp[1]) || 0,
      def: Number(e.def) || 10,
      status: (e.status && typeof e.status === 'object') ? e.status : {},
      avatar: String(e.avatar || ''),
    };
    // 敌人面板附加信息
    if (e.kind) unit.kind = String(e.kind);
    if (e.race) unit.race = String(e.race);
    if (e.rank) unit.rank = String(e.rank);
    if (e.level) unit.level = Number(e.level);
    if (e.speed) unit.speed = String(e.speed);
    if (e.weakness) unit.weakness = String(e.weakness);
    if (e.resist) unit.resist = String(e.resist);
    if (e.immune) unit.immune = String(e.immune);
    if (e.attrs) unit.attrs = String(e.attrs);
    if (e.attack) unit.attack = e.attack;
    if (e.ability) unit.ability = String(e.ability);
    if (Array.isArray(e.loots)) unit.loots = e.loots.map(String);
    out.push(unit);
  });
  return out;
}

export function getBattleDataFromStat(stat: any) {
  const snap = readSnapshotFromStat(stat);
  return { snapshot: snap, allies: extractAllies(stat, snap.extraAllies, snap.friendlies), enemies: extractEnemies(snap) };
}

export function getBattleData() {
  const all = typeof getAllVariables === 'function' ? getAllVariables() : {};
  const stat = _.get(all, 'stat_data', {});
  return getBattleDataFromStat(stat);
}
