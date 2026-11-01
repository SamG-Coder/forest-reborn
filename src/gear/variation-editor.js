import {METAL_RESOURCES} from './resources.js';
import {saveOutfit} from './outfit-storage.js';
import {CLOTH_DYES, LEATHER_DYES, OUTER_LAYERS, CLOTH_FINISHES, METAL_FINISHES,
  VARIANT_SWITCHES, VARIANT_COUNT, DEFAULT_VARIANT, encodeVariant, decodeVariant, variantItemIds} from './variants.js';

export function createVariationEditor({root, equipment, weapon, onChange}) {
  root.innerHTML = `<h2>Outfit variations</h2><p class="muted">Combine colours, surfaces and individual parts.</p>
    <div class="variant-fields"></div><div class="metal-swatches" aria-label="Metal resources"></div>
    <div class="part-switches"></div><div class="buttons"><button type="button" data-random>Shuffle outfit</button></div>
    <label>Outfit ID<input data-recipe spellcheck="false" aria-label="Outfit ID"></label>
    <div class="buttons"><button type="button" data-load>Load ID</button><button type="button" data-save>Save look</button></div>
    <p class="muted" data-count></p><p class="muted" data-note role="status"></p>`;
  const fields = {}, toggles = {}, note = root.querySelector('[data-note]');
  let id = encodeVariant(DEFAULT_VARIANT);
  for (const [key, title, options] of [
    ['dye', 'Cloth colour', CLOTH_DYES], ['leather', 'Leather colour', LEATHER_DYES],
    ['outer', 'Outer layer', OUTER_LAYERS], ['clothFinish', 'Cloth surface', CLOTH_FINISHES],
    ['metalFinish', 'Metal surface', METAL_FINISHES],
  ]) {
    const label = document.createElement('label'); label.textContent = title;
    const select = document.createElement('select'); select.dataset.variation = key;
    for (const option of options) select.add(new Option(option.name ?? option, option.id ?? option));
    select.onchange = () => apply({...decodeVariant(id), [key]: select.value});
    label.append(select); root.querySelector('.variant-fields').append(label); fields[key] = select;
  }
  for (const metal of Object.values(METAL_RESOURCES)) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.metal = metal.id;
    button.innerHTML = `<i style="background:${metal.color}"></i><span>${metal.name}</span>`;
    button.onclick = () => apply({...decodeVariant(id), metal: metal.id});
    root.querySelector('.metal-swatches').append(button);
  }
  for (const [key, title] of Object.entries(VARIANT_SWITCHES)) {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.dataset.part = key;
    input.onchange = () => {const spec = decodeVariant(id); apply({...spec, states: {...spec.states, [key]: input.checked}});};
    label.append(input, ` ${title}`); root.querySelector('.part-switches').append(label); toggles[key] = input;
  }
  function apply(spec) {
    const next = encodeVariant(spec), value = decodeVariant(next);
    equipment.apply(variantItemIds(next)); weapon.setMetal(value.metal); id = next;
    for (const [key, field] of Object.entries(fields)) field.value = value[key];
    for (const [key, input] of Object.entries(toggles)) {
      input.checked = value.states[key];
      input.disabled = key.startsWith('shoulder') && value.outer !== 'plate';
    }
    fields.metalFinish.disabled = value.outer !== 'plate' && !value.states.helmet;
    for (const button of root.querySelectorAll('[data-metal]')) button.setAttribute('aria-pressed', String(button.dataset.metal === value.metal));
    root.querySelector('[data-recipe]').value = id;
    root.querySelector('[data-count]').textContent = `${VARIANT_COUNT.toLocaleString()} reproducible recipes · shared meshes and masks`;
    note.textContent = 'Pauldron switches apply to plate armour. Engraving applies to solid metal, not mail.';
    onChange();
    history.replaceState(null, '', `${location.pathname}?look=${id}`);
    return id;
  }
  root.querySelector('[data-load]').onclick = () => {
    try {apply(decodeVariant(root.querySelector('[data-recipe]').value.trim()));}
    catch (error) {note.textContent = error.message;}
  };
  root.querySelector('[data-random]').onclick = () => {
    const value = crypto.getRandomValues(new Uint32Array(1))[0] % VARIANT_COUNT;
    apply(decodeVariant(`look-v1-${value.toString(36)}`));
  };
  root.querySelector('[data-save]').onclick = () => {
    saveOutfit(localStorage, equipment.ids(), decodeVariant(id).metal);
    note.textContent='Look saved in the lab. Equipment in the game is earned through quests.';
  };
  try {apply(decodeVariant(new URLSearchParams(location.search).get('look') ?? id));}
  catch {apply(DEFAULT_VARIANT);}
  return {apply, get id(){return id;}};
}
