import { ref, computed } from 'vue';
import { parseContactContent, formatContactContent, makeEmptyContactContent } from '../utils/parser';

export interface Contact {
  uid: number;
  name: string;
  data: ReturnType<typeof parseContactContent>;
}

const CONTACT_PREFIX = '联系人-';

export function useContacts() {
  const worldbookName = ref<string | null>(null);
  const contacts = ref<Contact[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadContacts() {
    loading.value = true;
    error.value = null;
    try {
      const name = await getCurrentWorldbookName();
      if (!name) {
        error.value = '请先在酒馆绑定世界书';
        contacts.value = [];
        return;
      }
      worldbookName.value = name;
      const entries = await getWorldbook(name);
      contacts.value = entries
        .filter(entry => entry.name.startsWith(CONTACT_PREFIX))
        .map(entry => ({
          uid: entry.uid,
          name: entry.name.slice(CONTACT_PREFIX.length),
          data: parseContactContent(entry.content),
        }));
    } catch (e) {
      error.value = String(e);
      contacts.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function ensureContact(name: string): Promise<Contact | null> {
    const wb = worldbookName.value;
    if (!wb) return null;
    const entryName = `${CONTACT_PREFIX}${name}`;
    let contact = contacts.value.find(c => c.name === name);
    if (!contact) {
      const { new_entries } = await createWorldbookEntries(wb, [
        { name: entryName, content: makeEmptyContactContent() },
      ]);
      const entry = new_entries[0];
      if (!entry) return null;
      contact = {
        uid: entry.uid,
        name,
        data: parseContactContent(entry.content),
      };
      contacts.value.push(contact);
    }
    return contact;
  }

  async function saveContact(contact: Contact) {
    const wb = worldbookName.value;
    if (!wb) return;
    await updateWorldbookWith(wb, entries => {
      const entry = entries.find(e => e.uid === contact.uid);
      if (entry) {
        entry.content = formatContactContent(contact.data);
      }
      return entries;
    });
  }

  return {
    worldbookName: computed(() => worldbookName.value),
    contacts: computed(() => contacts.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    loadContacts,
    ensureContact,
    saveContact,
  };
}

async function getCurrentWorldbookName(): Promise<string | null> {
  const chatName = await getChatWorldbookName('current');
  if (chatName) return chatName;
  const charBooks = getCharWorldbookNames('current');
  return charBooks.primary;
}
