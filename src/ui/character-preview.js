import {isWeapon,weaponDefinition} from '../game/weapon-catalog.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createHumanoid} from '../npc/humanoid.js';
import {createHairSystem} from '../hair/system.js';

export function createCharacterPreview(template,registry,materials,progress,appearance){
  const mount=document.createElement('div');mount.className='character-preview';
  mount.dataset.tooltip='Character preview\nDrag to rotate. Scroll to zoom. Shows your currently equipped items.';
  let renderer,scene,camera,controls,actor,hair,loading,lastKey='';
  async function prepare(){
    if(loading)return loading;
    loading=(async()=>{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));mount.append(renderer.domElement);
      scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#ecf5ea','#576759',2.4));const light=new THREE.DirectionalLight('#fff0d5',2.2);light.position.set(2,4,4);scene.add(light);
      camera=new THREE.PerspectiveCamera(37,1,.05,20);camera.position.set(.3,1.05,3.4);
      controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.92,0);controls.enablePan=false;controls.minDistance=1.5;controls.maxDistance=4;controls.update();
      actor=await createHumanoid(template,registry,materials,{outfit:progress.data.equipped});scene.add(actor.root);
      hair=await createHairSystem(actor.avatar,template.gearTemplates.helmet);
    })();return loading;
  }
  return {mount,prepare,update(dt){
    if(!actor||!mount.isConnected||mount.clientWidth===0)return;
    const key=JSON.stringify([progress.data.equipped,progress.data.weapon,appearance]);
    if(key!==lastKey){lastKey=key;actor.avatar.bodySystem.setType(appearance.bodyType??'male');actor.wardrobe.apply(progress.data.equipped);actor.avatar.materials.setFace(appearance.face);actor.avatar.materials.setEye(appearance.eyes);actor.avatar.materials.setSkin(appearance.skin);actor.avatar.materials.setBody(appearance.body);hair.setStyle(appearance.hair);hair.setColor(appearance.hairColor);hair.setHeadwear(actor.wardrobe.entries.get('head')?.definition);}
    const w=mount.clientWidth,h=mount.clientHeight;if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    actor.weapon.setWeapon(progress.data.weapon);
    actor.update(Math.min(dt,.05),{armed:isWeapon(progress.data.weapon),weaponId:progress.data.weapon});controls.update();renderer.render(scene,camera);
  }};
}
