import {HAIR_STYLES} from '../hair/system.js';
import {hairChoices,matchingHair} from '../hair/catalog.js';
import './creator.css';
import {VOICE_BANKS} from '../audio/voice-profiles.js';

const PALETTES={skin:['#f7d9bd','#efc4a3','#d7a780','#b68461','#895d45','#5c3e32'],eyes:['#548cab','#588d74','#927248','#7168a4','#92726c','#404d55'],hairColor:['#201f28','#47342c','#835237','#cda164','#d1c9bc','#8b4d66','#49666e','#8b8fbb'],shirtColor:['#ffffff','#647f8d','#5b7472','#94685e','#bcae92','#47434f']};
const INPUTS={skin:'skin',eyes:'eyes',hairColor:'hair-color',shirtColor:'shirt-color'};
export function installCreator({appearance,onChange,onBack,onVoicePreview}) {
  const root=document.getElementById('creator');root.classList.add('character-workshop');
  root.querySelector('header span').textContent='PROLOGUE / THE LAST BUS';
  const panel=root.querySelector('.creation-panel');
  panel.innerHTML=`<p class="eyebrow">BEFORE EVERYTHING CHANGES</p><h1>Who were you?</h1><p class="intro">A late shift. A walk home.<br>Make the person who takes that last turn.</p>
  <nav class="creator-tabs" aria-label="Character options"><button type="button" data-creator-tab="identity" aria-selected="true">Identity</button><button type="button" data-creator-tab="face">Face</button><button type="button" data-creator-tab="hair">Hair</button><button type="button" data-creator-tab="style">Style</button></nav>
  <div class="creator-options"><section data-creator-section="identity"><label>Your name<input id="character-name" maxlength="20" value="Ren" autocomplete="off"></label><label>Gender<select id="body-type"><option value="male">Male</option><option value="female">Female</option></select></label><label>Height <output id="height-value">179 cm</output><input id="character-height" type="range" min="0.91" max="1.08" step="0.01" value="1"></label><p class="creator-hint">Your name and appearance travel with you. You arrive in the other world with 5 gold and no weapon.</p></section>
  <section data-creator-section="face" hidden><label>Face<select id="face"></select></label><label>Eyes<input id="eyes" type="color"></label><div class="palette" data-palette="eyes"></div><label>Skin<input id="skin" type="color"></label><div class="palette" data-palette="skin"></div><label>Skin detail<select id="skin-detail"></select></label></section>
  <section data-creator-section="hair" hidden><label>Hair style<select id="hair"></select></label><div class="hairstyle-grid"></div><label>Hair colour<input id="hair-color" type="color"></label><div class="palette" data-palette="hairColor"></div></section>
  <section data-creator-section="style" hidden><p class="creator-hint">Your clothes for the walk home.</p><div class="outfit-card"><b>Cotton tee / indigo denim</b><span>Canvas sneakers · phone</span></div><label>Shirt colour<input id="shirt-color" type="color" value="#647f8d"></label><div class="palette" data-palette="shirtColor"></div><p class="creator-hint">In Mosswake, clothing and armour are earned by playing.</p></section></div>
  <div class="creator-bottom"><button type="button" id="randomise-character" class="quiet">↻ Randomise look</button><button id="enter" class="primary">Begin your story <span>→</span></button><button id="creator-back" class="quiet">← Save slots</button></div>`;
  root.querySelector('.creation-caption').innerHTML='<span>YOUR CHARACTER</span><h2>The night before.</h2><p>Drag to turn · scroll to zoom</p><button id="rotate-character" class="quiet">↻ Auto turn</button><button id="creation-closeup" class="quiet">Face / full body</button><button id="reset-view" class="quiet">Reset view</button>';
  root.querySelector('footer').innerHTML='<span>FOREST REBORN · CHARACTER CREATION</span><span>Appearance can be edited later</span>';
  const controls={angle:-.15,zoom:1};
  const voiceLabel=document.createElement('label');voiceLabel.textContent='Voice';
  const voiceSelect=document.createElement('select');voiceSelect.id='character-voice';voiceLabel.append(voiceSelect);
  const preview=document.createElement('button');preview.type='button';preview.textContent='Hear voice';preview.onclick=async()=>{preview.disabled=true;preview.textContent='Preparing voice…';try{await onVoicePreview?.();}finally{preview.disabled=false;preview.textContent='Hear voice';}};
  root.querySelector('[data-creator-section="identity"]').append(voiceLabel,preview);
  voiceSelect.onchange=()=>{appearance.voice=voiceSelect.value;onChange();};
  const change=(key,value)=>{appearance[key]=value;onChange();};
  root.querySelectorAll('[data-creator-tab]').forEach(button=>button.onclick=()=>{
    root.querySelectorAll('[data-creator-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));
    root.querySelectorAll('[data-creator-section]').forEach(s=>s.hidden=s.dataset.creatorSection!==button.dataset.creatorTab);
  });
  for(const [key,colors] of Object.entries(PALETTES))for(const color of colors){const b=document.createElement('button');b.style.background=color;b.title=`${key} ${color}`;b.setAttribute('aria-label',`${key} ${color}`);b.onclick=()=>{document.getElementById(INPUTS[key]).value=color;change(key,color);};root.querySelector(`[data-palette="${key}"]`).append(b);}
  for(const [id,name] of Object.entries(HAIR_STYLES)){const b=document.createElement('button');b.className='hair-choice';const image=document.createElement('img');image.alt='';image.loading='lazy';b.append(image,document.createTextNode(name));b.dataset.hairStyle=id;b.onclick=()=>{document.getElementById('hair').value=id;change('hair',id);};root.querySelector('.hairstyle-grid').append(b);}
  document.getElementById('randomise-character').onclick=()=>{for(const [key,values] of Object.entries(PALETTES))appearance[key]=values[Math.floor(Math.random()*values.length)];appearance.face=Math.floor(Math.random()*5);const hair=hairChoices(appearance.bodyType);appearance.hair=hair[1+Math.floor(Math.random()*(hair.length-1))];onChange();sync();};
  document.getElementById('creator-back').onclick=onBack;
  let lastType=null;
  function sync(){
    const voices=VOICE_BANKS[appearance.bodyType];if(!voices.includes(appearance.voice))appearance.voice=voices[0];
    voiceSelect.replaceChildren(...voices.map(voice=>new Option(voice,voice)));voiceSelect.value=appearance.voice;
    const choices=hairChoices(appearance.bodyType);appearance.hair=matchingHair(appearance.hair,appearance.bodyType);
    if(lastType!==appearance.bodyType){const select=document.getElementById('hair');select.replaceChildren(...choices.map(id=>new Option(HAIR_STYLES[id],id)));lastType=appearance.bodyType;}
    for(const [key,id] of Object.entries(INPUTS))document.getElementById(id).value=appearance[key];for(const [key,id]of [['name','character-name'],['bodyType','body-type'],['face','face'],['hair','hair'],['height','character-height']])document.getElementById(id).value=appearance[key];root.querySelector('#height-value').textContent=Math.round(179*appearance.height)+' cm';root.querySelectorAll('.hair-choice').forEach(b=>{b.hidden=!choices.includes(b.dataset.hairStyle);b.classList.toggle('selected',b.dataset.hairStyle===appearance.hair);});
  }
  return {controls,sync};
}

