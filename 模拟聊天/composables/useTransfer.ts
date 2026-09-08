import { ref } from 'vue';
import { formatTransferTag } from '../utils/parser';

export function useTransfer() {
  const isOpen = ref(false);
  const amount = ref('');
  const error = ref('');

  function open() {
    isOpen.value = true;
    amount.value = '';
    error.value = '';
  }

  function close() {
    isOpen.value = false;
    amount.value = '';
    error.value = '';
  }

  function validate(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) {
      error.value = '请输入金额';
      return false;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      error.value = '金额必须是正整数或最多两位小数';
      return false;
    }
    if (Number(trimmed) <= 0) {
      error.value = '金额必须大于 0';
      return false;
    }
    error.value = '';
    return true;
  }

  function formatTransferMessage(contactName: string, value: string, playerName = '玩家'): string {
    return formatTransferTag(playerName, contactName, value.trim());
  }

  return {
    isOpen,
    amount,
    error,
    open,
    close,
    validate,
    formatTransferMessage,
  };
}
