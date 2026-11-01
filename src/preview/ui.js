import {SLOTS} from '../items/registry.js';
import {publicUrl} from '../assets/public-url.js';
import {ANIMATIONS} from '../model/animation.js';

const icon=(name)=>({body:'◈',hair:'⌁',shirt:'◇',outerwear:'◫',legs:'Ⅱ',hands:'✧',feet:'⌑',waist:'⊖',rightHand:'╱'}[name]??'◇');
export function mountUI(container,registry){
 container.innerHTML=`
 <header class="topbar"><div class="brand"><span class="brand-mark">F<span>R</span></span><div>FOREST REBORN<small>CHARACTER WORKSHOP</small></div></div><nav><span class="nav-active">Model preview</span><span class="muted">Local project</span></nav><button id="export" class="export-button">Export model <span>↗</span></button></header>
 <aside class="library"><div class="eyebrow">ASSET LIBRARY</div><h1>Build the character.</h1><p class="intro">One body. A shared rig.<br>Everything else is an item.</p>
 <p><a href="./body.html">Open full-body depth reconstruction →</a></p>
 <div class="tree-title">MODEL</div><div class="model-node"><span>◈</span><div><strong>Male</strong><small>Humanoid · v1</small></div><span class="status-dot"></span></div>
 <div class="branch"><div class="branch-line">Base body <span>21 parts</span></div><div class="branch-line">Skeleton <span>19 bones</span></div></div>
 <div class="tree-title">HAIR STYLES</div><div id="hair-list" class="hair-list"></div>
 <div class="tree-title equipment-title">CLOTHING & EQUIPMENT <span id="item-count"></span></div><div id="item-list" class="item-list"></div>
 <div class="preset-actions"><button id="base-body">Base body</button><button id="starter-outfit">Starter outfit</button></div>
 <div class="library-footer"><span class="status-dot"></span> Items share the male rig</div></aside>
 <main id="viewport"><div class="viewport-top"><div class="breadcrumb">Model <span>/</span> Male <span>/</span> <b id="view-label">Preview</b></div><span class="live-badge"><i></i> LIVE 3D</span></div>
 <div id="loading" class="loading">Loading material textures…</div>
 <div class="view-tools" aria-label="Camera views"><button data-view="front" title="Front view">Front</button><button data-view="side">Side</button><button data-view="back">Back</button><button data-view="face">Face</button><button data-view="full" title="Reset camera">↺</button></div>
 <div class="model-caption"><span class="eyebrow">HUMANOID / MALE</span><h2 id="outfit-name">Traveller’s outfit</h2><p id="outfit-detail">Separate meshes. One connected skeleton.</p></div>
 <div class="viewport-help">Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Right-drag to pan</div>
 <div class="timeline"><button id="play" class="play-button" title="Pause animation">Ⅱ</button><div class="animation-select"><span>ANIMATION</span><select id="animation">${ANIMATIONS.map(name=>`<option value="${name}">${name==='bind'?'Bind pose':name[0].toUpperCase()+name.slice(1)}</option>`).join('')}</select></div><div class="timeline-track"><div id="timeline-progress"></div></div><select id="speed" aria-label="Animation speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select><button id="turntable" title="Rotate model">⟳</button></div></main>
 <aside class="inspector"><div class="eyebrow">INSPECTOR</div><h2>Male model</h2><div class="model-id">male-v1</div>
 <section><h3>Preview</h3><label class="toggle-row">Show skeleton<input id="skeleton" type="checkbox"></label><label class="toggle-row">Wireframe<input id="wireframe" type="checkbox"></label><label class="toggle-row">Floor grid<input id="grid" type="checkbox" checked></label></section>
 <section><h3>Equipped item</h3><div id="selected-name" class="selected-name">Traveller’s coat</div><p id="selected-description">Open front, separate collar and weighted coat tails.</p><dl><dt>Item ID</dt><dd id="selected-id">coat.traveller-teal</dd><dt>Slot</dt><dd id="selected-slot">Outerwear</dd><dt>Compatible model</dt><dd>Male v1</dd><dt>Rig</dt><dd>humanoid-male-v1</dd></dl><button id="isolate" class="wide-button">Isolate selected item</button></section>
 <section><h3>Geometry</h3><dl class="stats"><dt>Meshes</dt><dd id="stat-meshes">—</dd><dt>Triangles</dt><dd id="stat-triangles">—</dd><dt>Bones</dt><dd id="stat-bones">—</dd><dt>Equipped items</dt><dd id="stat-items">—</dd></dl></section>
 <section class="texture-section"><h3>Generated materials</h3><div class="textures">${[['warrior-face','Face'],['warrior-hair','Hair'],['warrior-coat','Cloth'],['warrior-leather','Leather']].map(([name,label])=>`<figure><img src="${publicUrl(`/assets/${name}.png`)}" alt="${label} texture"><figcaption>${label}</figcaption></figure>`).join('')}</div></section>
 <button id="save-outfit" class="wide-button">Save outfit JSON ↓</button><p class="inspector-note">The outfit stores item IDs. The body and rig stay independent.</p></aside>
 <footer class="statusbar"><span id="status">Assembling male model…</span><span>Three.js r187 <b>·</b> Local preview</span></footer><div id="toast" role="status"></div>`;
 function refreshEquipment(equipment,selected){
  const hairs=registry.list('hair'),current=equipment.equipped.get('hair')?.definition.id;
  document.querySelector('#hair-list').innerHTML=`<button class="hair-choice ${!current?'active':''}" data-unequip="hair"><span class="hair-swatch bare">◯</span><span>None<small>Base head</small></span></button>`+hairs.map(item=>`<button class="hair-choice ${current===item.id?'active':''}" data-item="${item.id}"><span class="hair-swatch">${item.id.includes('swept')?'⌁':'≋'}</span><span>${item.name.split(' / ')[0]}<small>Charcoal</small></span>${current===item.id?'<b>✓</b>':''}</button>`).join('');
  document.querySelector('#item-list').innerHTML=registry.list().filter(item=>item.slot!=='hair').map(item=>{
   const equipped=equipment.equipped.get(item.slot)?.definition.id===item.id;
   return `<div class="item-row ${selected===item.id?'selected':''}"><button class="item-select" data-select="${item.id}"><span class="item-icon">${icon(item.slot)}</span><span>${item.name}<small>${SLOTS[item.slot]}</small></span></button><button class="equip-toggle ${equipped?'equipped':''}" data-item="${item.id}" aria-label="${equipped?'Unequip':'Equip'} ${item.name}" title="${equipped?'Unequip':'Equip'}">${equipped?'✓':'+'}</button></div>`;
  }).join('');document.querySelector('#item-count').textContent=registry.list().filter(i=>i.slot!=='hair').length;
 }
 return {refreshEquipment,toast(message){const element=document.querySelector('#toast');element.textContent=message;element.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>element.classList.remove('visible'),3000);}};
}
