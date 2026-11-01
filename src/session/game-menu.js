import './game-menu.css';

/** In-game controls share the same save callback as autosave and logging off. */
export function createGameMenu({getCharacter, getSavedAt, onPause, onSave, onLogOff}) {
  const root = document.getElementById('paused');
  root.className = 'game-menu';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'game-menu-title');
  root.innerHTML = `<section class="game-menu-card">
    <p class="game-menu-eyebrow">FOREST REBORN</p>
    <h2 id="game-menu-title">Take a breath.</h2>
    <div class="game-menu-character"><span class="game-menu-sigil" aria-hidden="true">✦</span><div><b data-menu-name></b><small data-menu-details></small></div></div>
    <button id="resume-game" class="game-menu-primary">Resume <kbd>Esc</kbd></button>
    <button id="save-game">Save progress <span aria-hidden="true">↓</span></button>
    <button id="log-off">Log off <span aria-hidden="true">→</span></button>
    <p class="game-menu-save-status" role="status"></p>
    <p class="game-menu-hint">Logging off saves your progress and returns to character selection.</p>
  </section>`;
  document.body.append(root);
  const hud = document.getElementById('hud'), resume = root.querySelector('#resume-game');
  const status = root.querySelector('.game-menu-save-status');
  const trigger = document.createElement('button'); trigger.id = 'game-menu-button'; trigger.textContent = 'Menu · Esc';
  trigger.dataset.tooltip = 'Game menu · Esc\nResume, save progress, or log off to character selection.';
  document.querySelector('.top-actions').append(trigger);
  let previousFocus = null, leaving = false;
  function savedMessage() {
    status.classList.remove('error');
    status.textContent = `Last saved ${new Date(getSavedAt()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  }
  function open() {
    if (leaving || !root.hidden) return;
    previousFocus = document.activeElement;
    onPause(true); hud.inert = true; root.hidden = false;
    const character = getCharacter();
    root.querySelector('[data-menu-name]').textContent = character.name;
    root.querySelector('[data-menu-details]').textContent = `Level ${character.level} · ${character.location}`;
    savedMessage(); resume.focus();
  }
  function close() {
    if (leaving || root.hidden) return false;
    root.hidden = true; hud.inert = false; onPause(false);
    if (previousFocus?.isConnected) previousFocus.focus();
    return true;
  }
  function save() {
    try { onSave(); savedMessage(); status.textContent = 'Progress saved.'; return true; }
    catch (error) { status.classList.add('error'); status.textContent = `Could not save: ${error.message}. You are still in the game.`; return false; }
  }
  trigger.onclick = open; resume.onclick = close;
  root.querySelector('#save-game').onclick = save;
  root.querySelector('#log-off').onclick = () => {
    if (leaving || !save()) return;
    leaving = true;
    root.querySelector('#log-off').textContent = 'Returning to character selection…';
    for (const button of root.querySelectorAll('button')) button.disabled = true;
    onLogOff();
  };
  // Capture keys before game hotkeys. Background panels and movement stay inactive.
  window.addEventListener('keydown', event => {
    if (root.hidden) return;
    event.stopImmediatePropagation();
    if (event.code === 'Escape') { event.preventDefault(); close(); }
    else if (event.code === 'Tab') {
      event.preventDefault();
      const buttons = [...root.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  }, true);
  return {open, close, get visible() { return !root.hidden; }};
}
