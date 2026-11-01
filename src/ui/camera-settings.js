import {CAMERA_STORAGE_KEY,DEFAULT_CAMERA_SETTINGS} from '../game/follow-camera.js';
import './camera-settings.css';
import {registerPanel,focusPanel} from './panel-focus.js';

export function createCameraSettings({controller,storage,onOpen}){
  const panel=document.createElement('section');panel.className='camera-settings';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','camera-settings-title');
  panel.innerHTML=`<header><h2 id="camera-settings-title">Camera</h2><button aria-label="Close camera settings">×</button></header>
    <p>Adjust how the camera follows you. These settings are saved on this device.</p>
    <p class="camera-help">Left-drag to look around. Right-drag to steer. Hold both buttons to move forward. Scroll to zoom. Q/E strafe; A/D also strafe while holding the right button.</p>
    <label class="camera-check"><input name="steady" type="checkbox"> Steady camera</label>
    <p class="camera-help">Soften height changes and keep jumps within the frame. Turns stay under your control. Combat does not pause the camera.</p>
    <label>Field of view <output for="camera-fov"></output><input id="camera-fov" name="fov" type="range" min="45" max="85" step="1"></label>
    <label>Look sensitivity <output for="camera-sensitivity"></output><input id="camera-sensitivity" name="sensitivity" type="range" min="0.25" max="2" step="0.05"></label>
    <label class="camera-check"><input name="shake" type="checkbox"> Combat camera shake</label>
    <p class="camera-help">Available with Steady camera off. Movement never adds head bob or changes the field of view.</p>
    <button class="camera-reset">Reset camera settings</button>`;
  document.querySelector('#hud').append(panel);
  function render(){
    for(const [name,value]of Object.entries(controller.settings)){
      const input=panel.querySelector(`[name="${name}"]`);
      if(input.type==='checkbox')input.checked=value;
      else{input.value=value;input.parentElement.querySelector('output').textContent=name==='fov'?value+'°':value.toFixed(2)+'×';}
    }
    panel.querySelector('[name="shake"]').disabled=controller.settings.steady;
  }
  function persist(){try{storage.setItem(CAMERA_STORAGE_KEY,JSON.stringify(controller.settings));}catch{}render();}
  panel.addEventListener('input',event=>{
    const input=event.target;if(!input.name)return;
    controller.setSettings({...controller.settings,[input.name]:input.type==='checkbox'?input.checked:Number(input.value)});persist();
  });
  function close(){const visible=!panel.hidden;panel.hidden=true;return visible;}
  registerPanel(close);panel.querySelector('header button').onclick=close;
  panel.querySelector('.camera-reset').onclick=()=>{controller.setSettings(DEFAULT_CAMERA_SETTINGS);persist();};
  const button=document.createElement('button');button.id='camera-options';button.textContent='Camera';
  button.dataset.tooltip='Camera settings\nSteady follow, field of view, look sensitivity and optional combat shake.';
  button.onclick=()=>{onOpen();focusPanel(close);panel.hidden=!panel.hidden;render();};document.querySelector('.top-actions').append(button);
  render();
  return {close};
}
