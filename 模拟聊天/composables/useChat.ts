import { ref, computed } from 'vue';
import type { Contact } from './useContacts';
import { nowTimestamp } from '../utils/parser';
import { useVariableUpdate } from './useVariableUpdate';

export function useChat() {
  const generating = ref(false);
  const lastError = ref<string | null>(null);

  async function sendMessage(contact: Contact, content: string, save: (c: Contact) => Promise<void>) {
    contact.data.messages.push({
      sender: '<user>',
      timestamp: nowTimestamp(),
      content,
    });
    await save(contact);

    generating.value = true;
    lastError.value = null;
    try {
      const reply = await generateReply(contact, content);
      contact.data.messages.push({
        sender: contact.name,
        timestamp: nowTimestamp(),
        content: reply,
      });
      await save(contact);
    } catch (e) {
      lastError.value = String(e);
    } finally {
      generating.value = false;
    }
  }

  return {
    generating: computed(() => generating.value),
    lastError: computed(() => lastError.value),
    sendMessage,
  };
}

async function generateReply(contact: Contact, latestInput: string): Promise<string> {
  const recentMessages = contact.data.messages.slice(-10);
  const historyText = recentMessages
    .map(m => `${m.sender}: ${m.content}`)
    .join('\n');
  const prompt = `你是以下角色，用第一人称回复玩家消息。

## 核心规则

1. 你输出的内容必须是角色真实说出口的话，只能是自然的人类对话。
2. 禁止用任何形式描述动作、神态、语气、心理活动或场景。例如禁止：
   - （笑）、（伸手）、（揉了揉头发）
   - *紧张*、**微笑**、//叹气//
   - 【靠近】、【歪头】
   - "他笑着说："、"她轻声道" 等叙述性文字
3. 所有情绪和态度只能通过对话文字本身表达，不能加额外标注。
4. 不要重复玩家的消息，不要总结，不要解释，不要加任何引导语。

## 输出格式

你的回复只能包含以下一种或多种形式，不要混用说明文字：

1. 普通回复：直接说的话，例如：你好，最近怎么样？

2. 多句回复：如果你想说多句话，用 <回复> 标签分别包裹每句话，每句会显示为一条独立消息。例如：
   <回复>你好！</回复><回复>在干嘛呢？</回复>

3. 语音消息：如果你发送语音，用 <语音> 标签包裹语音转写文字。例如：
   <语音>今晚一起吃饭吧</语音>
   玩家会看到一个语音条，点击后显示「语音转文字：...」。

4. 转账：当角色或玩家发起转账时，必须在回复中插入以下标签（不要省略括号）：
   <发起转账>（转出方）给（转入方）进行了（金额）的转账</发起转账>
   例如：<发起转账>（${contact.name}）给（玩家）进行了（100）的转账</发起转账>

5. 修改联系人信息：如需修改好感度、关系或网名，在回复末尾追加 <更新> 标签：
   <更新 联系人="${contact.name}">
     <好感度>+5</好感度>
     <关系>恋人</关系>
     <网名>小甜甜</网名>
   </更新>
   该标签对玩家不可见，仅用于更新系统记录。

## 收到转账后的反应

根据金额大小、当前关系决定角色的情绪与好感度变化：
- 金额小/关系一般：礼貌感谢，好感度小幅上升（+1~+3）。
- 金额大/关系亲密：感动、惊喜，好感度明显上升（+5~+10）。
- 金额小但关系很差（仇人）：可能嘲讽或拒绝，好感度不变或下降。
- 你也可根据剧情需要自行判断。

角色设定：
${contact.data.persona}

近期对话：
${historyText}

玩家刚说：${latestInput}

请直接给出你的回复。`;

  const result = await generateRaw({
    user_input: latestInput,
    should_silence: true,
    ordered_prompts: [
      { role: 'system', content: prompt },
      { role: 'user', content: latestInput },
    ],
  });

  let replyText = '';
  if (typeof result === 'string') {
    replyText = result;
  } else if (result && typeof result === 'object' && 'content' in result && typeof result.content === 'string') {
    replyText = result.content;
  } else {
    replyText = String(result);
  }

  const { processReply } = useVariableUpdate();
  const { cleanText } = processReply(contact, replyText);
  return cleanText;
}
