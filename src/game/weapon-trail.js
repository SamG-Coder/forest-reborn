import * as THREE from 'three';

/** Short-lived ribbon sampled from the same blade endpoints used for contact. */
export class WeaponTrail {
  constructor(scene, markers) {
    this.markers=markers;this.samples=[];this.time=0;
    this.geometry=new THREE.BufferGeometry();
    this.positions=new Float32Array(32*18);
    this.colors=new Float32Array(32*18);
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.mesh=new THREE.Mesh(this.geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
  }
  update(dt, active) {
    this.time+=dt;
    if(active)this.samples.push({time:this.time,base:this.markers.bladeBase.getWorldPosition(new THREE.Vector3()),tip:this.markers.bladeTip.getWorldPosition(new THREE.Vector3())});
    this.samples=this.samples.filter(sample=>this.time-sample.time<.09).slice(-33);
    let index=0;
    for(let i=1;i<this.samples.length;i++){
      const a=this.samples[i-1],b=this.samples[i];
      for(const [point,sample]of [[a.base,a],[a.tip,a],[b.tip,b],[a.base,a],[b.tip,b],[b.base,b]]){
        point.toArray(this.positions,index);
        const fade=Math.max(0,1-(this.time-sample.time)/.09);
        this.colors.set([fade*.65,fade*.9,fade],index);index+=3;
      }
    }
    this.geometry.setDrawRange(0,index/3);
    this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
    this.mesh.visible=index>0;
  }
}
