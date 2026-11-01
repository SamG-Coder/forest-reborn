import {saveLibrary, selectSession} from './session.js';
import './session.css';

const el = (tag, cls = '', text = '') => {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
};
const playtime = seconds => {
  const minutes = Math.floor(Math.max(0, seconds || 0) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};
const locationName = entry => entry.stage === 'world' ? 'Mosswake' : entry.stage === 'opening' ? 'The last bus' : 'Character creation';

export function chooseSave() {
  const root = el('main', 'save-screen'); root.id = 'save-screen';
  root.innerHTML = `<div class="menu-landscape" aria-hidden="true"></div>
    <div class="menu-vignette" aria-hidden="true"></div>
    <div class="menu-topline"><span>FOREST REBORN</span><span>LOCAL PLAY</span></div>
    <section class="save-intro" aria-labelledby="menu-title">
      <div class="menu-emblem" aria-hidden="true">✦</div>
      <h1 id="menu-title">FOREST<br><em>REBORN</em></h1>
      <div class="menu-title-rule" aria-hidden="true"></div>
      <p>You were only trying to get home.</p>
      <small>A new life begins in Mosswake.</small>
    </section>
    <section class="save-panel" aria-labelledby="saves-title">
      <div class="save-panel-heading"><div><p class="menu-eyebrow">YOUR JOURNEY</p><h2 id="saves-title">Characters</h2></div><span class="save-count"></span></div>
      <div class="save-list" aria-label="Saved characters"></div>
      <div class="selected-save"></div>
      <div class="menu-management"></div>
      <div class="menu-dialog" hidden></div>
      <div class="menu-primary-actions"></div>
      <p class="save-error" role="alert"></p>
    </section>
    <div class="menu-bottomline"><button class="menu-help-button">Controls &amp; saving</button><p class="menu-status" role="status">Saves stay on this device.</p><span>PROTOTYPE · 0.1</span></div>
    <dialog class="menu-help"><button class="menu-help-close" aria-label="Close controls">×</button><p class="menu-eyebrow">BEFORE YOU GO</p><h2>Find your footing.</h2><dl><dt>W/S - A/D - Q/E</dt><dd>Move - turn - strafe</dd><dt>Shift / Space</dt><dd>Run / jump</dd><dt>Left drag / right drag</dt><dd>Look around / steer character</dd><dt>Both mouse buttons / wheel</dt><dd>Move forward / zoom</dd><dt>Click / Tab</dt><dd>Select a target</dd><dt>1 or J</dt><dd>Attack</dd><dt>V</dt><dd>Talk or interact</dd><dt>B / C / L</dt><dd>Bag / character / quests</dd><dt>Esc</dt><dd>Close panels or open the game menu</dd></dl><p>Your progress saves automatically. Use <b>Log off</b> in the game menu to save and return here. Each character has a separate save.</p></dialog>`;
  document.body.append(root);
  const list = root.querySelector('.save-list'), selected = root.querySelector('.selected-save');
  const actions = root.querySelector('.menu-primary-actions'), management = root.querySelector('.menu-management');
  const dialog = root.querySelector('.menu-dialog'), error = root.querySelector('.save-error');
  let selectedId = saveLibrary.list()[0]?.id;
  const help = root.querySelector('.menu-help');
  root.querySelector('.menu-help-button').onclick = () => help.showModal();
  root.querySelector('.menu-help-close').onclick = () => help.close();
  try {
    if (sessionStorage.getItem('forest-reborn-logged-off')) {
      root.querySelector('.menu-status').textContent = 'Progress saved. You’re logged off.';
      sessionStorage.removeItem('forest-reborn-logged-off');
    }
  } catch { /* Storage notification is optional. */ }
  document.getElementById('loading').hidden = true;

  return new Promise(resolve => {
    const run = fn => { error.textContent = ''; try { fn(); } catch (e) { error.textContent = `Could not save: ${e.message}`; } };
    function open(entry) {
      selectSession(entry); root.remove();
      document.getElementById('loading').hidden = false;
      resolve(entry);
    }
    function closeEditor() { dialog.replaceChildren(); dialog.hidden = true; }
    function rename(entry) {
      dialog.replaceChildren(); dialog.hidden = false;
      const label = el('label', '', 'Save name'), input = el('input');
      input.value = entry.name; input.maxLength = 24; label.append(input);
      const row = el('div', 'menu-dialog-actions'), submit = el('button', 'menu-gold', 'Save name'), cancel = el('button', 'menu-secondary', 'Cancel');
      submit.onclick = () => run(() => { saveLibrary.update(entry.id, {name: input.value.trim().slice(0, 24) || entry.name}); render(); });
      cancel.onclick = closeEditor;
      input.onkeydown = e => { if (e.key === 'Enter') submit.click(); if (e.key === 'Escape') closeEditor(); };
      row.append(submit, cancel); dialog.append(label, row); input.focus(); input.select();
    }
    function remove(entry) {
      dialog.replaceChildren(); dialog.hidden = false;
      const heading = el('h3', '', `Delete ${entry.name}?`), copy = el('p', '', 'This removes this character and their world. It cannot be undone.');
      const row = el('div', 'menu-dialog-actions'), yes = el('button', 'menu-danger', 'Delete this save'), no = el('button', 'menu-secondary', 'Keep character');
      yes.onclick = () => run(() => { saveLibrary.remove(entry.id); selectedId = saveLibrary.list()[0]?.id; render(); });
      no.onclick = closeEditor; row.append(no, yes); dialog.append(heading, copy, row); no.focus();
    }
    function render() {
      closeEditor(); list.replaceChildren(); actions.replaceChildren(); management.replaceChildren(); selected.replaceChildren();
      const entries = saveLibrary.list(), entry = entries.find(s => s.id === selectedId) ?? entries[0];
      selectedId = entry?.id;
      root.querySelector('.save-count').textContent = `${entries.length} ${entries.length === 1 ? 'character' : 'characters'}`;
      for (const save of entries) {
        const card = el('button', 'save-card'); card.dataset.saveId = save.id;
        card.setAttribute('aria-pressed', String(save.id === selectedId));
        card.setAttribute('aria-label', `${save.characterName || save.name}, ${locationName(save)}, level ${save.level || 1}`);
        const portrait = el('span', 'save-portrait', (save.characterName || save.name).slice(0, 1));
        if (save.portrait?.startsWith('data:image/')) { const img = el('img'); img.src = save.portrait; img.alt = ''; portrait.replaceChildren(img); }
        const detail = el('span', 'save-detail');
        detail.append(el('strong', '', save.characterName || save.name), el('span', '', locationName(save)), el('small', '', save.name !== save.characterName ? save.name : `Played ${playtime(save.playSeconds)}`));
        const level = el('span', 'save-level'); level.append(el('small', '', 'LV'), el('b', '', String(save.level || 1).padStart(2, '0')));
        card.append(portrait, detail, level); card.onclick = () => { selectedId = save.id; render(); list.querySelector(`[data-save-id="${CSS.escape(save.id)}"]`).focus(); }; list.append(card);
      }
      if (entry) {
        const meta = el('dl', 'save-metadata');
        for (const [key, value] of [['PLAYED', playtime(entry.playSeconds)], ['LAST SAVED', new Date(entry.updatedAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})]]) meta.append(el('dt', '', key), el('dd', '', value));
        selected.append(meta);
        const changeName = el('button', 'menu-link', 'Rename save'), deleteSave = el('button', 'menu-link', 'Delete save');
        changeName.onclick = () => rename(entry); deleteSave.onclick = () => remove(entry); management.append(changeName, deleteSave);
        const play = el('button', 'menu-gold menu-continue', entry.stage === 'creator' ? 'Finish character' : `Continue as ${entry.characterName || 'Ren'}`);
        play.dataset.continueSave = entry.id; play.append(el('span', '', '→')); play.onclick = () => run(() => open(entry)); actions.append(play);
      } else {
        const empty = el('div', 'no-saves'); empty.append(el('span', 'empty-star', '✦'), el('h3', '', 'Begin your story.'), el('p', '', 'Create your character, then head home after a long shift.')); list.append(empty);
      }
      const create = el('button', entry ? 'menu-secondary new-save' : 'menu-gold new-save', '+  Create character'); create.id = 'new-save';
      create.onclick = () => run(() => open(saveLibrary.create())); actions.append(create);
    }
    render();
  });
}

