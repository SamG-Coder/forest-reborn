import * as THREE from 'three';
import {createBaseRig} from '../avatar/rig.js';

/** A separate skeleton keeps the body at the death site when the player revives. */
export function createPlayerRemains(avatar,scene,serial){
  const root=new THREE.Group();root.name='Player remains';root.position.copy(avatar.root.position);root.quaternion.copy(avatar.root.quaternion);root.scale.copy(avatar.root.scale);
  const rig=createBaseRig(root),ownedMaterials=new Set();
  function copy(source,parent){
    if(source.isSkeletonHelper||source.isLine||source.isLineSegments||source.isAxesHelper)return;
    let node;
    if(source.isBone){node=rig.bones[source.name];if(!node)return;}
    else if(source.isMesh){
      // Share immutable geometry, but keep blood and colour uniforms independent.
      const original=Array.isArray(source.material)?source.material:[source.material];
      const materials=original.map(m=>{const result=m.clone();result.onBeforeCompile=m.onBeforeCompile;result.customProgramCacheKey=m.customProgramCacheKey;ownedMaterials.add(result);return result;});
      const material=Array.isArray(source.material)?materials:materials[0];
      node=source.isSkinnedMesh?new THREE.SkinnedMesh(source.geometry,material):new THREE.Mesh(source.geometry,material);
      if(source.isSkinnedMesh)node.bind(rig.skeleton,source.bindMatrix);
      node.castShadow=source.castShadow;node.receiveShadow=source.receiveShadow;node.frustumCulled=false;parent.add(node);
    }else{node=new THREE.Group();parent.add(node);}
    node.name=source.name;node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);node.visible=source.visible;
    for(const child of source.children)copy(child,node);
  }
  for(const child of avatar.root.children)copy(child,root);
  root.updateMatrixWorld(true);rig.skeleton.update();scene.add(root);
  const controller={root,avatar:{rig}};
  return {id:'player-remains-'+serial,name:'Your remains',kind:'player',hp:0,maxHp:100,root,position:root.position,height:1.3,controller,
    dispose(){root.removeFromParent();rig.skeleton.dispose();for(const m of ownedMaterials)m.dispose();}};
}
