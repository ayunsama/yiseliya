<template>
  <div class="st-phone-app">
    <div class="st-phone-app-body">
      <Transition name="st-tab-switch">
        <ContactList
          v-if="activeTab === 'contacts'"
          key="contacts"
          :contacts="contacts"
          :show-back="false"
          @select="selectedContact = $event"
          @add="addContactOpen = true"
        />
        <MomentsView v-else-if="activeTab === 'moments'" key="moments" />
        <SettingsView v-else-if="activeTab === 'settings'" key="settings" />
      </Transition>
    </div>
    <TabBar v-if="!selectedContact" v-model="activeTab" />
    <ChatView
      v-if="selectedContact"
      class="st-phone-app-chat"
      :contact="selectedContact"
      :generating="generating"
      :last-error="lastError"
      @back="selectedContact = null"
      @send="onSend"
    />
    <AddContactModal
      v-model:visible="addContactOpen"
      :contacts="contacts"
      :ensure-contact="ensureContact"
      :save-contact="saveContact"
      @created="onContactCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Contact } from '../composables/useContacts';
import { useChat } from '../composables/useChat';
import ContactList from './ContactList.vue';
import ChatView from './ChatView.vue';
import MomentsView from './MomentsView.vue';
import SettingsView from './SettingsView.vue';
import TabBar, { type TabId } from './TabBar.vue';
import AddContactModal from './AddContactModal.vue';

const props = defineProps<{
  contacts: Contact[];
  saveContact: (contact: Contact) => Promise<void>;
  ensureContact: (name: string) => Promise<Contact | null>;
}>();

const activeTab = ref<TabId>('contacts');
const selectedContact = ref<Contact | null>(null);
const addContactOpen = ref(false);
const { generating, lastError, sendMessage } = useChat();

function onContactCreated(contact: Contact) {
  addContactOpen.value = false;
  selectedContact.value = contact;
}

async function onSend(content: string) {
  if (!selectedContact.value) return;
  await sendMessage(selectedContact.value, content, props.saveContact);
}
</script>
