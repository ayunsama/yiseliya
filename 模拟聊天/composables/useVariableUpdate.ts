import type { Contact } from './useContacts';
import { parseVariableUpdates, type VariableUpdate } from '../utils/parser';

export interface AppliedUpdate {
  field: 'affection' | 'relationship' | 'onlineName';
  oldValue: string;
  newValue: string;
}

export function useVariableUpdate() {
  function applyUpdate(contact: Contact, update: VariableUpdate): AppliedUpdate[] {
    const applied: AppliedUpdate[] = [];
    if (update.contactName !== contact.name) {
      console.warn(`[useVariableUpdate] 目标联系人 "${update.contactName}" 与当前联系人 "${contact.name}" 不匹配，忽略`);
      return applied;
    }

    const persona = contact.data.persona;

    if (update.affection !== undefined) {
      const raw = update.affection;
      const current = Number(persona.affection);
      let next: string;
      if (/^[+-]/.test(raw)) {
        const delta = Number(raw);
        next = Number.isNaN(delta) || Number.isNaN(current) ? persona.affection : String(current + delta);
      } else {
        next = raw;
      }
      if (next !== persona.affection) {
        applied.push({ field: 'affection', oldValue: persona.affection, newValue: next });
        persona.affection = next;
      }
    }

    if (update.relationship !== undefined && update.relationship !== persona.relationship) {
      applied.push({ field: 'relationship', oldValue: persona.relationship, newValue: update.relationship });
      persona.relationship = update.relationship;
    }

    if (update.onlineName !== undefined && update.onlineName !== persona.onlineName) {
      applied.push({ field: 'onlineName', oldValue: persona.onlineName, newValue: update.onlineName });
      persona.onlineName = update.onlineName;
    }

    return applied;
  }

  function processReply(contact: Contact, reply: string): { cleanText: string; applied: AppliedUpdate[] } {
    const { updates, cleanText } = parseVariableUpdates(reply);
    const applied: AppliedUpdate[] = [];
    for (const update of updates) {
      applied.push(...applyUpdate(contact, update));
    }
    return { cleanText, applied };
  }

  return { processReply };
}
