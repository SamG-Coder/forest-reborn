export const SAVE_KEYS = Object.freeze(['forest-reborn-progress-v2', 'forest-reborn-character-v1', 'forest-reborn-adventurers-v1']);
const INDEX = 'forest-reborn-saves-v1';
const PREFIX = 'forest-reborn-slot:';

/** Same Storage interface as the game, with an isolated namespace per character. */
export class SlotStorage {
  constructor(storage, id) { this.storage = storage; this.prefix = `${PREFIX}${id}:`; }
  getItem(key) { return this.storage.getItem(this.prefix + key); }
  setItem(key, value) { this.storage.setItem(this.prefix + key, value); }
  removeItem(key) { this.storage.removeItem(this.prefix + key); }
}

export class SaveLibrary {
  constructor(storage, {now = () => Date.now(), id = () => crypto.randomUUID()} = {}) {
    this.storage = storage; this.now = now; this.id = id;
    let saved;
    try { saved = JSON.parse(storage.getItem(INDEX)); } catch { /* First launch. */ }
    this.entries = Array.isArray(saved?.entries) ? saved.entries.filter(s => typeof s.id === 'string') : [];
    if (!saved?.migrated) this.migrateLegacy();
  }
  persist() { this.storage.setItem(INDEX, JSON.stringify({version: 1, migrated: true, entries: this.entries})); }
  list() { return this.entries.map(s => ({...s})).sort((a, b) => b.updatedAt - a.updatedAt); }
  slot(id) {
    if (!this.entries.some(s => s.id === id)) throw new Error('This save no longer exists.');
    return new SlotStorage(this.storage, id);
  }
  create(name = 'New life') {
    const entry = {id: this.id(), name: name.trim().slice(0, 24) || 'New life', createdAt: this.now(), updatedAt: this.now(), stage: 'creator', level: 1, playSeconds: 0};
    this.entries.push(entry); this.persist(); return {...entry};
  }
  update(id, values) {
    const entry = this.entries.find(s => s.id === id);
    if (!entry) throw new Error('This save no longer exists.');
    for (const key of ['name', 'stage', 'level', 'playSeconds', 'portrait', 'characterName']) if (key in values) entry[key] = values[key];
    entry.updatedAt = this.now(); this.persist(); return {...entry};
  }
  remove(id) {
    const slot = this.slot(id);
    for (const key of SAVE_KEYS) slot.removeItem(key);
    this.entries = this.entries.filter(s => s.id !== id); this.persist();
  }
  migrateLegacy() {
    const progress = this.storage.getItem(SAVE_KEYS[0]);
    if (progress) {
      let appearance = {}, data = {};
      try { appearance = JSON.parse(this.storage.getItem(SAVE_KEYS[1])) ?? {}; data = JSON.parse(progress) ?? {}; } catch { /* Retain original bytes below. */ }
      const entry = this.create('Mosswake · existing save'), slot = this.slot(entry.id);
      for (const key of SAVE_KEYS) { const value = this.storage.getItem(key); if (value !== null) slot.setItem(key, value); }
      this.update(entry.id, {stage: 'world', characterName: appearance.name || 'Ren', level: data.level || 1});
    }
    this.persist();
  }
}
