import * as THREE from 'three';
import {hairChoices} from '../hair/catalog.js';

/** Render actual hair meshes, one thumbnail per frame, without loading a second avatar. */
export class HairThumbnails {
  constructor(renderer,scene,avatar){
    Object.assign(this,{renderer,scene,avatar});this.cache=new Map();
    this.target=new THREE.WebGLRenderTarget(144,168);this.target.texture.colorSpace=THREE.SRGBColorSpace;this.camera=new THREE.PerspectiveCamera(38,144/168,.03,10);
    this.canvas=document.createElement('canvas');this.canvas.width=144;this.canvas.height=168;this.context=this.canvas.getContext('2d');this.pixels=new Uint8Array(144*168*4);
  }
  update(appearance){
    if(document.querySelector('[data-creator-section="hair"]').hidden)return;
    const prefix=`${appearance.bodyType}:${appearance.hairColor}:`;
    for(const id of hairChoices(appearance.bodyType)){
      const image=document.querySelector(`[data-hair-style="${id}"] img`),key=prefix+id;
      if(this.cache.has(key)){image.src=this.cache.get(key);continue;}
      const {avatar,renderer,camera,target}=this,rotation=avatar.root.rotation.clone(),scale=avatar.root.scale.clone(),current=avatar.hair.style,active=renderer.getRenderTarget();
      avatar.root.rotation.set(0,-.2,0);avatar.root.scale.setScalar(1);avatar.hair.setStyle(id);avatar.root.updateMatrixWorld(true);
      camera.position.set(.035,1.68,.68);camera.lookAt(0,1.64,0);
      renderer.setRenderTarget(target);renderer.render(this.scene,camera);renderer.readRenderTargetPixels(target,0,0,144,168,this.pixels);renderer.setRenderTarget(active);
      const data=this.context.createImageData(144,168);
      for(let y=0;y<168;y++)data.data.set(this.pixels.subarray((167-y)*144*4,(168-y)*144*4),y*144*4);
      this.context.putImageData(data,0,0);const url=this.canvas.toDataURL('image/jpeg',.8);this.cache.set(key,url);image.src=url;
      avatar.hair.setStyle(current);avatar.root.rotation.copy(rotation);avatar.root.scale.copy(scale);avatar.root.updateMatrixWorld(true);break;
    }
  }
  dispose(){this.target.dispose();this.cache.clear();}
}
