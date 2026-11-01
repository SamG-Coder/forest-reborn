import {element,action} from './panel-components.js';
import {AUDIO_DEFAULTS} from '../audio/mixer.js';
import './audio-settings.css';

export function createAudioSettings(mixer){
  const menu=document.querySelector('.game-menu-card'),details=element(null,'details','audio-settings');
  element(details,'summary','','Sound & mixing');element(details,'p','','Nearby voices and actions follow your camera direction. Headphones give the clearest positioning.');
  const inputs=[];
  for(const [id,label]of Object.entries({master:'Master',voices:'Voices',effects:'Combat & actions',music:'Music',ambience:'Ambience'})){
    const row=element(details,'label');row.htmlFor='audio-'+id;element(row,'span','',label);const output=element(row,'output');
    const input=element(row,'input');input.id='audio-'+id;input.type='range';input.min=0;input.max=100;input.step=1;input.value=Math.round(mixer.settings[id]*100);input.setAttribute('aria-label',label+' volume');
    const render=()=>{output.textContent=input.value+'%';};render();input.oninput=()=>{mixer.setVolume(id,input.value/100);render();};inputs.push({id,input,render});
  }
  action(details,'Reset sound levels',()=>{for(const {id,input,render}of inputs){mixer.setVolume(id,AUDIO_DEFAULTS[id]);input.value=Math.round(AUDIO_DEFAULTS[id]*100);render();}});
  menu.querySelector('.game-menu-save-status').before(details);
}
