// ============================================================
// 骰子表达式计算（渲染层实时替换 + 后台楼层文本替换共用）
// ============================================================

// 支持：NdM、NdM±K、+ - * /、括号、kh（取高）/ kl（取低）
export function rollDiceExpr(expr: string): number | null {
  const e = String(expr || '').trim();
  if (!e) return null;
  if (!/^[\d\s+\-*/()dkh]+$/i.test(e)) return null;
  try {
    const result = e.replace(/(\d+)d(\d+)(kh(\d+)|kl(\d+))?/gi, (_m, cnt, sides, _k, kh, kl) => {
      const count = Math.max(1, parseInt(cnt, 10) || 1);
      const side = Math.max(1, parseInt(sides, 10) || 1);
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * side) + 1);
      if (kh) {
        const k = Math.max(1, Math.min(parseInt(kh, 10) || 1, rolls.length));
        rolls.sort((a, b) => b - a);
        return String(rolls.slice(0, k).reduce((a, b) => a + b, 0));
      }
      if (kl) {
        const k = Math.max(1, Math.min(parseInt(kl, 10) || 1, rolls.length));
        rolls.sort((a, b) => a - b);
        return String(rolls.slice(0, k).reduce((a, b) => a + b, 0));
      }
      return String(rolls.reduce((a, b) => a + b, 0));
    });
    const fn = new Function('return (' + result + ')');
    const value = fn();
    return typeof value === 'number' && isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** 把文本里的所有 {{roll:表达式}} 替换为「🎲 结果」（无法解析的保留原样）。
 * 同一表达式在同一段文本中多次出现时只掷一次（结果复用），
 * 保证思维链预测与结算引用一致。 */
export function replaceDiceMacros(text: string): { text: string; results: { expr: string; value: number }[] } {
  const results: { expr: string; value: number }[] = [];
  const cache = new Map<string, number>();
  const out = String(text || '').replace(/\{\{roll:([^}]+)\}\}/g, (_m, expr) => {
    const key = String(expr).trim();
    let v = cache.get(key);
    if (v === undefined) {
      v = rollDiceExpr(expr);
      if (v === null) return `{{roll:${expr}}}`;
      cache.set(key, v);
      results.push({ expr: key, value: v });
    }
    return `🎲 ${v}`;
  });
  return { text: out, results };
}
