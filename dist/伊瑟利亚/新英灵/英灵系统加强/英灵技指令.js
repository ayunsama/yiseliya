/**
 * 英灵技指令 · 酒馆助手脚本
 * ------------------------------------------------------------
 * 注册酒馆 slash 指令：/英灵技
 *
 * 作用：硬校验并执行「英灵技释放」——
 *   · 条件：stat_data.英灵.残响之力 = 100 且 状态 = 苏醒 且 英灵技.冷却 = 0
 *   · 执行：残响之力→0、状态→沉睡、英灵技.已释放+1、冷却按规则置位
 *           （盲目的莉莉丝按已释放次数翻倍：1/3/7/15…日，其余英灵固定1日）
 *   · 返回技能名，供正文输出 <英灵技·技能名> 由渲染脚本生成横幅
 *
 * 使用方式：
 *   1. 在酒馆助手脚本库中新建脚本，粘贴本文件内容（或 import 本文件）；
 *   2. 聊天中发送 /英灵技 即可释放（也可由前端面板按钮触发
 *      executeSlashCommandsWithOptions('/英灵技')）；
 *   3. 前置条件：MVU 变量框架已加载（stat_data.英灵 已按「变量结构脚本」初始化）。
 */

$(async () => {
  console.log('✅ [英灵技指令] 脚本开始加载...');

  try {
    const ctx = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
    const parser = ctx?.SlashCommandParser;
    const SlashCommand = ctx?.SlashCommand;
    if (!parser || !SlashCommand) {
      console.warn('[英灵技指令] 未找到 SlashCommandParser，跳过注册');
      return;
    }

    // ---- 读取 stat_data.英灵 ----
    function getSpiritData() {
      const mvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
      return (mvuData && mvuData.stat_data && mvuData.stat_data.英灵) || null;
    }

    // ---- 写入 stat_data.英灵（MVU 快照方式，与状态栏一致） ----
    async function writeSpiritData(mutator) {
      const mvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
      if (!mvuData.stat_data) mvuData.stat_data = {};
      if (!mvuData.stat_data.英灵) mvuData.stat_data.英灵 = { 名称: '', 残响之力: 0, 状态: '苏醒' };
      mutator(mvuData.stat_data.英灵);
      await Mvu.replaceMvuData(mvuData, { type: 'message', message_id: 'latest' });
    }

    // ---- 计算沉睡冷却：莉莉丝系按已释放次数翻倍（1/3/7/15…），其余固定1 ----
    function calcCooldown(spirit) {
      const name = spirit?.名称 || '';
      const released = Number(spirit?.英灵技?.已释放 || 0);
      if (name.includes('莉莉丝')) {
        return Math.min(30, Math.pow(2, released + 1) - 1); // 第1次=1，第2次=3，第3次=7…
      }
      return 1;
    }

    parser.addCommandObject(SlashCommand.fromProps({
      name: '英灵技',
      aliases: ['spirit-skill'],
      callback: async (args, value) => {
        try {
          const spirit = getSpiritData();
          if (!spirit) {
            toastr.warning('尚未与任何英灵缔结契约（stat_data.英灵 为空）', '英灵技');
            return '未找到契主英灵';
          }

          const name = spirit.名称 || '无名英灵';
          const power = Number(spirit.残响之力 || 0);
          const status = spirit.状态 || '苏醒';
          const skillName = spirit.英灵技?.名称 || '';

          // ---- 硬校验 ----
          if (power < 100) {
            toastr.warning(`残响之力不足（${power}/100）`, `英灵技·${name}`);
            return `残响之力不足（${power}/100），无法释放英灵技`;
          }
          if (status !== '苏醒') {
            toastr.warning(`英灵正处于「${status}」状态，无法释放`, `英灵技·${name}`);
            return `英灵正处于「${status}」状态，无法释放英灵技`;
          }
          const cooldown = Number(spirit.英灵技?.冷却 || 0);
          if (cooldown > 0) {
            toastr.warning(`英灵技冷却中（剩余${cooldown}）`, `英灵技·${name}`);
            return `英灵技冷却中（剩余${cooldown}）`;
          }
          if (!skillName) {
            toastr.warning('未登记英灵技名称（英灵.英灵技.名称 为空）', '英灵技');
            return '未登记英灵技';
          }

          // ---- 执行释放 ----
          let newCooldown = calcCooldown(spirit);
          await writeSpiritData((s) => {
            s.残响之力 = 0;
            s.状态 = '沉睡';
            if (!s.英灵技) s.英灵技 = {};
            s.英灵技.冷却 = newCooldown;
            s.英灵技.已释放 = Number(s.英灵技.已释放 || 0) + 1;
            // 同步英灵殿档案（若存在该英灵记录）
            const hall = s.英灵殿 || {};
            for (const key of Object.keys(hall)) {
              if (name.includes(key) || key.includes(name)) {
                hall[key].残响 = 0;
                hall[key].状态 = '沉睡';
              }
            }
          });

          toastr.success(`「${skillName}」已释放！残响清空，${name}陷入沉睡（${newCooldown}日后苏醒）`, '英灵技');

          // 返回技能名：供 AI 在正文输出标签 <英灵技·技能名>（渲染脚本自动生成横幅）
          return `英灵技已释放：${skillName}（请在正文中输出 <英灵技·${skillName}> 标签）`;
        } catch (e) {
          console.error('[英灵技] 释放失败:', e);
          toastr.error(String(e?.message || e), '英灵技');
          return '英灵技释放失败';
        }
      },
      helpString: '释放当前契主英灵的英灵技（需 残响之力=100、状态=苏醒、冷却=0；释放后残响清空并沉睡）。',
    }));

    console.log('✅ [英灵技指令] /英灵技 已注册');
  } catch (e) {
    console.error('[英灵技指令] 加载失败:', e);
  }
});
