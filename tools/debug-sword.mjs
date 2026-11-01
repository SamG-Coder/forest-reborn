import * as T from 'three';
import {createBaseRig} from '../src/avatar/rig.js';
import {CharacterAnimator} from '../src/game/animation.js';
import {attachSword} from '../src/game/weapon-sockets.js';
import {segmentDistance} from '../src/game/weapon-contact.js';
for(const combo of [0,1,2]){
 const root=new T.Group(),rig=createBaseRig(root),avatar={root,rig},animator=new CharacterAnimator(avatar);
 const {markers}=attachSword(rig,new T.Group());let closest={d:Infinity};
 for(let i=0;i<60;i++)animator.update(1/60,{speed:0,weapon:'sword'});
 for(let i=0;i<121;i++){
  const action={kind:'sword',style:'cut',combo,side:'R',height:1.25,progress:i/120};animator.update(1/120,{speed:0,weapon:'sword',action});
  const a=markers.bladeBase.getWorldPosition(new T.Vector3()),b=markers.bladeTip.getWorldPosition(new T.Vector3()),d=segmentDistance(a,b,new T.Vector3(0,.35,.9),new T.Vector3(0,1.5,.9));
  if(i/120>=.29&&i/120<=.66&&d<closest.d)closest={d,p:i/120,a:a.toArray(),b:b.toArray()};
 }console.log({combo,...closest});
}
