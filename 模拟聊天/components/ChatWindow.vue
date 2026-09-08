<!--
  DEPRECATED: This component is superseded by PhoneApp.vue and retained for reference only.
-->
<template>
  <div style="width: 100%; height: 100%;">
    <ContactList
      v-if="!selectedContact"
      :contacts="contacts"
      @select="selectedContact = $event"
      @back="emit('back')"
    />
    <ChatView
      v-else
      :contact="selectedContact"
      :generating="generating"
      :last-error="lastError"
      @back="selectedContact = null"
      @send="onSend"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Contact } from '../composables/useContacts';
import { useChat } from '../composables/useChat';
import ContactList from './ContactList.vue';
import ChatView from './ChatView.vue';

const props = defineProps<{
  contacts: Contact[];
  saveContact: (contact: Contact) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const selectedContact = ref<Contact | null>(null);
const { generating, lastError, sendMessage } = useChat();

async function onSend(content: string) {
  if (!selectedContact.value) return;
  await sendMessage(selectedContact.value, content, props.saveContact);
}
</script>
