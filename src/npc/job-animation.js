import * as THREE from 'three';
import {applyArmFK} from '../game/arm-motion.js';
import {poseHand} from '../game/hand-poses.js';
import {SWORD_GRIP,swordGripOrientation} from '../game/weapon-sockets.js';
import {solveTwoBone} from '../game/constraints.js';

/** Small job poses layered over locomotion, using the same arm/hand rig as combat. */
export class JobAnimation {
  constructor(avatar){
    this.avatar=avatar;this.time=0;this.weight=0;this.previous='rest';this.props={};
    const wood=new THREE.MeshToonMaterial({color:'#755439'}),metal=new THREE.MeshToonMaterial({color:'#7f898b'}),paper=new THREE.MeshToonMaterial({color:'#d3bb8f'});
    const prop=(name,geometry,material,position)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name='job-'+name;mesh.position.set(...position);mesh.visible=false;avatar.rig.bones.handR.add(mesh);this.props[name]=mesh;return mesh;};
    const hammer=prop('hammer',new THREE.CylinderGeometry(.012,.015,.21,8),wood,SWORD_GRIP.position);hammer.quaternion.copy(swordGripOrientation());
    const head=new THREE.Mesh(new THREE.BoxGeometry(.075,.05,.06),metal);head.position.y=.10;hammer.add(head);
    const pick=prop('mine',new THREE.CylinderGeometry(.012,.014,.30,8),wood,SWORD_GRIP.position);pick.quaternion.copy(swordGripOrientation());
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.27,.035,.035),metal);blade.position.y=.14;pick.add(blade);
    const axeHandle=new THREE.CylinderGeometry(.014,.017,.45,8);axeHandle.translate(0,.12,0);
    const axe=prop('chop',axeHandle,wood,SWORD_GRIP.position);axe.quaternion.copy(swordGripOrientation());
    const edge=new THREE.Shape();edge.moveTo(-.035,.25);edge.lineTo(.15,.21);edge.lineTo(.18,.37);edge.lineTo(-.035,.34);edge.closePath();
    const axeHead=new THREE.Mesh(new THREE.ExtrudeGeometry(edge,{depth:.035,bevelEnabled:false}),metal);axeHead.position.z=-.0175;axe.add(axeHead);
    prop('drink',new THREE.CylinderGeometry(.035,.029,.085,12),wood,[-.065,-.015,.035]);
    prop('carry',new THREE.BoxGeometry(.20,.15,.16),paper,[-.08,-.035,.03]);
    prop('read',new THREE.BoxGeometry(.15,.008,.18),paper,[-.09,0,.025]);
    const shears=prop('shear',new THREE.BoxGeometry(.025,.16,.012),metal,SWORD_GRIP.position);shears.quaternion.copy(swordGripOrientation());
    const second=new THREE.Mesh(new THREE.BoxGeometry(.025,.16,.012),metal);second.rotation.z=.25;shears.add(second);
    const spoon=prop('cook',new THREE.CylinderGeometry(.006,.006,.22,6),wood,SWORD_GRIP.position);spoon.quaternion.copy(swordGripOrientation());
    const bottle=prop('brew',new THREE.CylinderGeometry(.025,.035,.11,10),new THREE.MeshToonMaterial({color:'#749789'}),[-.065,-.015,.035]);
    const saw=prop('saw',new THREE.BoxGeometry(.022,.23,.08),metal,SWORD_GRIP.position);saw.quaternion.copy(swordGripOrientation());
    prop('sew',new THREE.BoxGeometry(.12,.012,.14),paper,[-.08,-.02,.03]);
    prop('wipe',new THREE.BoxGeometry(.12,.012,.12),paper,[-.08,-.02,.03]);
  }
  clear(){this.weight=0;for(const mesh of Object.values(this.props))mesh.visible=false;}
  update(dt,action='rest',moving=false){
    this.time+=dt;const {rig}=this.avatar,b=rig.bones,t=this.time;
    for(const mesh of Object.values(this.props))mesh.visible=false;
    const name=moving&&action!=='carry'?'rest':action;
    if(name!==this.lastAction){this.actionTime=0;this.lastAction=name;}else this.actionTime+=dt;
    const active=!['rest','watch'].includes(name);this.weight=THREE.MathUtils.damp(this.weight,active?1:0,9,dt);
    if(active)this.previous=name;
    if(this.weight<.002)return;
    const type=active?name:this.previous,before={};
    for(const key of ['upperArmL','upperArmR','forearmL','forearmR','handL','handR','spine','chest','head','thighL','thighR','shinL','shinR'])before[key]=b[key].quaternion.clone();
    let left={shoulder:.3,elbow:.7,spread:.12,sweep:0,wrist:0},right={...left};
    if(type==='chop'){
      const phase=(this.actionTime%1.2)/1.2,stroke=phase<.58?THREE.MathUtils.smoothstep(phase,0,.58):1-THREE.MathUtils.smoothstep(phase,.58,.76);
      right={shoulder:.55+stroke*1.35,elbow:.38+stroke*1.05,spread:.2,sweep:-.10+stroke*.08,wrist:0};
      left={shoulder:.25,elbow:.45,spread:.22,sweep:.08,wrist:0};b.chest.rotation.x=.17*(1-stroke);b.chest.rotation.y=.12-stroke*.25;
      b.thighR.rotation.x-=.08;b.shinR.rotation.x+=.15;
    }
    else if(type==='cook'||type==='brew'){right={shoulder:.62,elbow:.95+Math.sin(t*5)*.12,spread:.16,sweep:Math.cos(t*5)*.12,wrist:0};left={shoulder:.65,elbow:1.05,spread:.12,sweep:.12,wrist:0};b.head.rotation.x=.1;}
    else if(type==='saw'){const push=Math.sin(t*8);right={shoulder:.65+push*.18,elbow:1.0-push*.25,spread:.15,sweep:0,wrist:0};left={shoulder:.8,elbow:.6,spread:.18,sweep:.12,wrist:0};b.chest.rotation.x=.10;}
    else if(type==='sew'){right={shoulder:.65,elbow:1.3+Math.sin(t*7)*.14,spread:.12,sweep:-.12,wrist:0};left={shoulder:.65,elbow:1.3,spread:.12,sweep:.12,wrist:0};b.head.rotation.x=.17;}
    else if(type==='wipe'){right={shoulder:.72,elbow:.65+Math.sin(t*2.4)*.15,spread:.15,sweep:-.15+Math.cos(t*2.4)*.20,wrist:0};left={...left,shoulder:.32,elbow:.7};b.chest.rotation.x=.12;b.head.rotation.x=.12;}
    else if(type==='sort'){right={shoulder:.6,elbow:1.1+Math.sin(t*2)*.2,spread:.15,sweep:Math.cos(t*2)*.16,wrist:0};left={...left,shoulder:.6,elbow:1.15};b.head.rotation.x=.12;}
    else if(type==='hammer'||type==='mine'){right={shoulder:.8+Math.sin(t*4.1)*.35,elbow:1.05+Math.sin(t*4.1+.7)*.45,spread:.20,sweep:.1,wrist:0};left={...left,shoulder:.5,elbow:.7};b.chest.rotation.x=.08;}
    else if(type==='gather'||type==='collect'||type==='shear'){
      b.hips.position.y-=.24*this.weight;b.spine.rotation.x=.4;b.head.rotation.x=.24;
      for(const side of ['L','R']){b[`thigh${side}`].rotation.x=-.9;b[`shin${side}`].rotation.x=1.55;}
      left={...left,shoulder:1.05,elbow:.5};right={...left,shoulder:1.1+Math.sin(t*3)*.14};
    }
    else if(type==='drink'){const sip=(1+Math.sin(t*.9))*.5;right={shoulder:.35+sip*.35,elbow:1.2+sip*.8,spread:.10,sweep:0,wrist:0};}
    else if(type==='carry'||type==='read'){left={...left,shoulder:.4,elbow:1.3,sweep:.16};right={...left,sweep:-.16};b.head.rotation.x+=type==='read'?.17:0;}
    else{right={...right,shoulder:.55+Math.sin(t*1.9)*.12,elbow:.95,spread:.12,sweep:Math.sin(t*1.1)*.12};left={...left,shoulder:.3,elbow:.9};}
    applyArmFK(b,'L',left);applyArmFK(b,'R',right);
    if(this.props[type]){this.props[type].visible=active;if(type==='shear')this.props.shear.children[0].rotation.z=.1+(1+Math.sin(t*10))*.16;poseHand(rig,'R',['chop','hammer','mine','drink','shear','cook','brew','saw'].includes(type)?'grip':'open',.9);}
    for(const [key,q] of Object.entries(before))b[key].quaternion.slerpQuaternions(q,b[key].quaternion.clone(),this.weight);
    if(['gather','collect','shear'].includes(type))for(const [side,sign]of [['L',1],['R',-1]]){
      const target=this.avatar.root.localToWorld(new THREE.Vector3(sign*.13,.55,.46+Math.sin(t*3+sign)*.035));
      const hint=this.avatar.root.localToWorld(new THREE.Vector3(sign*.4,.8,.05));
      const upper=b[`upperArm${side}`],fore=b[`forearm${side}`],hand=b[`hand${side}`],oldUpper=upper.quaternion.clone(),oldFore=fore.quaternion.clone();
      solveTwoBone(upper,fore,hand,target,hint);upper.quaternion.slerpQuaternions(oldUpper,upper.quaternion.clone(),this.weight);fore.quaternion.slerpQuaternions(oldFore,fore.quaternion.clone(),this.weight);
    }
    this.avatar.root.updateMatrixWorld(true);
  }
}
