import {metalResource} from './resources.js';

export const SAVED_OUTFIT_KEY = 'forest-reborn-gear-v1';

export function saveOutfit(storage, ids, metal) {
  storage.setItem(SAVED_OUTFIT_KEY, JSON.stringify({ids, metal}));
}

export function loadOutfit(storage, registry) {
  try {
    const saved = JSON.parse(storage.getItem(SAVED_OUTFIT_KEY));
    if (!Array.isArray(saved?.ids) || saved.ids.length > 8) return null;
    const items = saved.ids.map(id => registry.get(id));
    if (new Set(items.map(item => item.slot)).size !== items.length) return null;
    metalResource(saved.metal);
    return {ids: [...saved.ids], metal: saved.metal};
  } catch {return null;}
}
