import {METAL_IDS, metalResource} from './resources.js';

const palette = entries => Object.freeze(entries.map(([id, name, color]) => Object.freeze({id, name, color})));
export const CLOTH_DYES = palette([
  ['blue', 'Storm blue', '#376785'], ['red', 'Crimson', '#973e46'],
  ['green', 'Forest', '#41674b'], ['ivory', 'Ivory', '#d3c8a7'],
  ['ochre', 'Ochre', '#b48c42'], ['violet', 'Violet', '#715687'],
  ['slate', 'Slate', '#617078'], ['black', 'Charcoal', '#323940'],
  ['rose', 'Dusty rose', '#a66975'], ['teal', 'Deep teal', '#347d7b'],
  ['rust', 'Rust', '#9c5d3e'], ['indigo', 'Indigo', '#494e88'],
]);
export const LEATHER_DYES = palette([
  ['brown', 'Brown', '#684a34'], ['black', 'Black', '#2d3133'],
  ['tan', 'Tan', '#a47b50'], ['oxblood', 'Oxblood', '#663b40'],
]);
export const OUTER_LAYERS = Object.freeze(['none', 'leather', 'mail', 'plate']);
export const CLOTH_FINISHES = Object.freeze(['plain', 'brocade']);
export const METAL_FINISHES = Object.freeze(['plain', 'engraved']);
export const VARIANT_SWITCHES = Object.freeze({
  frontPanel: 'Front cloth panel', backPanel: 'Back cloth panel',
  belt: 'Waist belt', trim: 'Metal trim',
  shoulderLeft: 'Left pauldron', shoulderRight: 'Right pauldron',
  helmet: 'Helmet', necklace: 'Necklace', ringLeft: 'Left ring', ringRight: 'Right ring',
});
const switchIds = Object.keys(VARIANT_SWITCHES);
export const DEFAULT_VARIANT = Object.freeze({
  dye: 'blue', leather: 'brown', metal: 'iron', outer: 'plate', clothFinish: 'plain', metalFinish: 'plain',
  states: Object.freeze(Object.fromEntries(switchIds.map(id => [id, true]))),
});
const stateCount = 2 ** switchIds.length;
export const VARIANT_COUNT = CLOTH_DYES.length * LEATHER_DYES.length * METAL_IDS.length * OUTER_LAYERS.length * CLOTH_FINISHES.length * METAL_FINISHES.length * stateCount;
const prefix = 'look-v1-';

function choiceIndex(values, value, label) {
  const index = values.indexOf(value);
  if (index < 0) throw new Error(`Unknown ${label}: ${value}`);
  return index;
}

/** Versioned, collision-free mixed-radix ID. No giant array of duplicate items. */
export function encodeVariant(options = {}) {
  const value = {...DEFAULT_VARIANT, ...options};
  const states = {...DEFAULT_VARIANT.states, ...options.states};
  for (const [key, state] of Object.entries(states)) {
    if (!switchIds.includes(key) || typeof state !== 'boolean') throw new Error(`Invalid garment state: ${key}`);
  }
  let code = choiceIndex(CLOTH_DYES.map(d => d.id), value.dye, 'cloth dye');
  code = code * LEATHER_DYES.length + choiceIndex(LEATHER_DYES.map(d => d.id), value.leather, 'leather dye');
  code = code * METAL_IDS.length + choiceIndex(METAL_IDS, value.metal, 'metal');
  code = code * OUTER_LAYERS.length + choiceIndex(OUTER_LAYERS, value.outer, 'outer layer');
  code = code * CLOTH_FINISHES.length + choiceIndex(CLOTH_FINISHES, value.clothFinish, 'cloth finish');
  code = code * METAL_FINISHES.length + choiceIndex(METAL_FINISHES, value.metalFinish, 'metal finish');
  const bits = switchIds.reduce((sum, id, bit) => sum + (states[id] ? 2 ** bit : 0), 0);
  return prefix + (code * stateCount + bits).toString(36);
}

export function decodeVariant(id) {
  if (typeof id !== 'string' || !/^look-v1-[0-9a-z]+$/.test(id)) throw new Error(`Invalid outfit ID: ${id}`);
  let code = parseInt(id.slice(prefix.length), 36);
  if (!Number.isSafeInteger(code) || code < 0 || code >= VARIANT_COUNT || prefix + code.toString(36) !== id) throw new Error(`Invalid outfit ID: ${id}`);
  const bits = code % stateCount; code = Math.floor(code / stateCount);
  const metalFinish = METAL_FINISHES[code % METAL_FINISHES.length]; code = Math.floor(code / METAL_FINISHES.length);
  const clothFinish = CLOTH_FINISHES[code % CLOTH_FINISHES.length]; code = Math.floor(code / CLOTH_FINISHES.length);
  const outer = OUTER_LAYERS[code % OUTER_LAYERS.length]; code = Math.floor(code / OUTER_LAYERS.length);
  const metal = METAL_IDS[code % METAL_IDS.length]; code = Math.floor(code / METAL_IDS.length);
  const leather = LEATHER_DYES[code % LEATHER_DYES.length].id; code = Math.floor(code / LEATHER_DYES.length);
  return Object.freeze({dye: CLOTH_DYES[code].id, leather, metal, outer, clothFinish, metalFinish,
    states: Object.freeze(Object.fromEntries(switchIds.map((key, bit) => [key, Boolean(bits & 2 ** bit)]))),
  });
}

export function variantItemIds(id) {
  const {outer, states} = decodeVariant(id);
  const slots = ['clothes', 'legs', 'shoes'];
  if (outer !== 'none') slots.push('body');
  for (const [state, slot] of [['helmet', 'head'], ['necklace', 'necklace'], ['ringLeft', 'ringLeft'], ['ringRight', 'ringRight']]) {
    if (states[state]) slots.push(slot);
  }
  return slots.map(slot => `${id}/${slot}`);
}

/** Produces a normal registry item; the base still owns coverage and rigging. */
export function resolveVariantItem(id) {
  if (!id.startsWith(prefix)) return null;
  const [recipe, slot, extra] = id.split('/');
  if (extra || !variantItemIds(recipe).includes(id)) throw new Error(`Item is disabled or invalid: ${id}`);
  const spec = decodeVariant(recipe), dye = CLOTH_DYES.find(d => d.id === spec.dye);
  const leather = LEATHER_DYES.find(d => d.id === spec.leather), metal = metalResource(spec.metal);
  const common = {id, states: spec.states, leatherColor: leather.color, trimResource: metal.id};
  const metalItem = (base, name) => ({...common, base, name: `${metal.name} ${name}`, resource: metal.id, color: metal.color,
    finish: base === 'chainmail' ? 'plain' : spec.metalFinish});
  switch (slot) {
    case 'clothes': return {...common, base: 'tunic', name: `${dye.name} tunic`, color: dye.color, finish: spec.clothFinish};
    case 'legs': return {...common, base: 'trousers', name: `${dye.name} trousers`, color: dye.color};
    case 'shoes': return {...common, base: 'tall-boots', name: `${leather.name} boots`, color: leather.color};
    case 'head': return metalItem('open-helmet', 'open helmet');
    case 'necklace': return metalItem('pendant', 'pendant');
    case 'ringLeft': return metalItem('ring', 'left ring');
    case 'ringRight': return {...metalItem('ring', 'right ring'), slot: 'ringRight'};
    case 'body':
      if (spec.outer === 'leather') return {...common, base: 'leather-armour', name: `${leather.name} vest`, color: leather.color};
      return metalItem(spec.outer === 'mail' ? 'chainmail' : 'plate-cuirass', spec.outer === 'mail' ? 'mail vest' : 'cuirass');
    default: throw new Error(`Unknown variant slot: ${slot}`);
  }
}

export function garmentPartEnabled(item, part) {
  const state = item.states ?? {};
  if (part === 'buckle') return state.belt !== false && state.trim !== false;
  if (['collar-piping', 'cuff-piping', 'rim', 'rivet'].includes(part)) return state.trim !== false;
  const control = {'waist-belt': 'belt', 'panel-front': 'frontPanel', 'panel-back': 'backPanel',
    'shoulder-L': 'shoulderLeft', 'shoulder-R': 'shoulderRight'}[part];
  return !control || state[control] !== false;
}
