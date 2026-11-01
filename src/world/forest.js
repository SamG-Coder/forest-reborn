import {loadTexture} from '../assets/load-texture.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CHUNK_SIZE,WORLD_HALF,random,chunkSeed,terrainHeight,clearForFoliage,roadDistance,inTown} from './terrain.js';
import {roadEdgeDistance} from './layout.js';
import {inHighmere,HIGHMERE_PLOTS,KEEP_FOOTPRINTS,HIGHMERE} from './region-layout.js';
import {treePlacements} from './vegetation-placement.js';
import {TreeHarvest} from './tree-harvest.js';

function cards(count,width,height,seed,canopy=false){
  const rng=random(seed),parts=[];
  for(let i=0;i<count;i++){
    const g=new THREE.PlaneGeometry(width*(.8+rng()*.35),height,1,2);
    g.translate(0,canopy?0:height/2,0);g.rotateY(i*Math.PI/count);
    if(canopy){g.rotateX((rng()-.5)*1.3);const a=i*2.4,r=1.1*Math.sqrt(rng());g.translate(Math.cos(a)*r,4.3+rng()*1.9,Math.sin(a)*r);}
    parts.push(g);
  }
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());return geometry;
}
function treeTrunk(){
  const parts=[],trunk=new THREE.CylinderGeometry(.12,.34,5.6,9,5);trunk.translate(0,2.8,0);parts.push(trunk);
  for(let i=0;i<6;i++){
    const a=i*2.4,from=new THREE.Vector3(0,2.7+i*.35,0),to=new THREE.Vector3(Math.sin(a)*1.3,4.9+i*.18,Math.cos(a)*1.3);
    const delta=to.clone().sub(from),branch=new THREE.CylinderGeometry(.035,.12,delta.length(),7);
    branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));branch.translate(...from.add(to).multiplyScalar(.5));parts.push(branch);
  }
  const g=mergeGeometries(parts);parts.forEach(part=>part.dispose());return g;
}
function pineCanopy(){
  const parts=[];
  for(let tier=0;tier<6;tier++)for(let i=0;i<5;i++){
    const width=3.6-tier*.45,g=new THREE.PlaneGeometry(width,1.65);
    g.rotateX(-.65);g.rotateY(i*Math.PI*2/5+tier*.6);g.translate(0,2+tier*.7,0);parts.push(g);
  }
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());return geometry;
}
function ground(cx,cz){
  const g=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,64,64);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,uv=g.attributes.uv,road=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i)+cx,z=p.getZ(i)+cz;p.setY(i,terrainHeight(x,z));
    uv.setXY(i,x/7,z/7);
    road.push(THREE.MathUtils.clamp((1.6-roadEdgeDistance(x,z))/3.0,0,1));
  }
  g.setAttribute('roadWeight',new THREE.Float32BufferAttribute(road,1));g.computeVertexNormals();return g;
}

/** A bounded cache of deterministic chunks, not a 4 km mesh kept in memory. */
export async function createForest(scene,worldMaterials){
  const loader=new THREE.TextureLoader(),textures={};
  await Promise.all(['leaves','shrub','grass','timber','fern-v2','herb-v2','pine-leaves','berry-bush'].map(async name=>{
    const texture=await loadTexture(`/assets/world/${name}.png`,loader);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;textures[name]=texture;
  }));
  textures.timber.wrapS=textures.timber.wrapT=THREE.RepeatWrapping;
  const clock={value:0},foliage=name=>{
    const mat=new THREE.MeshToonMaterial({map:textures[name],color:'#ffffff',alphaTest:.6,side:THREE.DoubleSide});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.forestTime=clock;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float forestTime;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float phase=instanceMatrix[3].x*.31+instanceMatrix[3].z*.19;
        transformed.x+=sin(forestTime*1.3+phase+position.y)*${name==='leaves'?'.045':'.065'}*uv.y;
      `);
    };mat.customProgramCacheKey=()=>`forest-wind-${name}`;return mat;
  };
  const materials={trunk:worldMaterials.bark,stump:worldMaterials.bark,leaves:foliage('leaves'),shrub:foliage('shrub'),grass:foliage('grass'),fern:foliage('fern-v2'),ground:worldMaterials.ground};
  const geometry={trunk:treeTrunk(),stump:new THREE.CylinderGeometry(.32,.34,.22,9).translate(0,.11,0),leaves:cards(16,3,2.5,51,true),shrub:cards(4,2,1.4,18),grass:cards(2,.85,.62,5),fern:cards(3,1.1,.75,9)};
  materials.shortGrass=foliage('grass');materials.shortGrass.color.set('#b5c89a');
  materials.dryGrass=foliage('grass');materials.dryGrass.color.set('#d1ba83');
  geometry.shortGrass=cards(3,.62,.28,35);geometry.dryGrass=cards(2,.55,.85,29);
  Object.assign(materials,{pineTrunk:worldMaterials.bark,pineLeaves:foliage('pine-leaves'),birchTrunk:worldMaterials['birch-bark'],birchLeaves:foliage('leaves')});materials.birchLeaves.color.set('#c4d6a7');
  Object.assign(geometry,{pineTrunk:new THREE.CylinderGeometry(.06,.28,6.5,8,4).translate(0,3.25,0),pineLeaves:pineCanopy(),birchTrunk:treeTrunk(),birchLeaves:geometry.leaves});
  const chunks=new Map(),dummy=new THREE.Object3D(),treeHarvest=new TreeHarvest();let center='',queue=[],colliders=[];
  function batch(group,name,transforms){
    const mesh=new THREE.InstancedMesh(geometry[name],materials[name],transforms.length);
    for(let i=0;i<transforms.length;i++){const t=transforms[i];dummy.position.set(t.x,t.y,t.z);dummy.rotation.set(0,t.a,0);dummy.scale.setScalar(t.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
    mesh.castShadow=/trunk|leaves/i.test(name);mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
  }
  function build(x,z,near){
    const cx=(x+.5)*CHUNK_SIZE,cz=(z+.5)*CHUNK_SIZE,rng=random(chunkSeed(x,z)),group=new THREE.Group();group.position.set(cx,0,cz);scene.add(group);
    const floor=new THREE.Mesh(ground(cx,cz),materials.ground);floor.receiveShadow=true;group.add(floor);
    const trees=[],shrubs=[],grass=[],shortGrass=[],dryGrass=[],ferns=[],solids=[];
    for(const [index,t]of treePlacements(x,z,rng).entries()){
      const id=`tree:${x}:${z}:${index}`,node=treeHarvest.register(id,t.x,t.z,.32*t.s);
      const targetRoot=new THREE.Object3D();targetRoot.position.set(t.x,terrainHeight(t.x,t.z),t.z);node.root=targetRoot;
      trees.push({...t,id,node,x:t.x-cx,y:terrainHeight(t.x,t.z),z:t.z-cz});solids.push({id,x:t.x,z:t.z,r:.32*t.s});
    }
    for(let i=0;i<(near?950:60);i++){
      const px=(rng()-.5)*CHUNK_SIZE,pz=(rng()-.5)*CHUNK_SIZE,wx=px+cx,wz=pz+cz;
      if(inTown(wx,wz)||roadDistance(wx,wz)<3)continue;
      if(inHighmere(wx,wz,8)){
        if(HIGHMERE_PLOTS.some(p=>Math.abs(wx-p.x)<p.w/2+2&&Math.abs(wz-p.z)<p.d/2+2))continue;
        if(KEEP_FOOTPRINTS.some(p=>Math.abs(wx-HIGHMERE.x-p.x)<(p.w/2||p.r)+2&&Math.abs(wz-HIGHMERE.z-p.z)<(p.d/2||p.r)+2))continue;
      }
      const patch=.5+.25*Math.sin(wx*.23+wz*.11)+.25*Math.sin(wz*.32-wx*.07);if(rng()>patch*.85+.12)continue;
      const t={x:px,y:terrainHeight(wx,wz),z:pz,a:rng()*Math.PI*2,s:.7+rng()*.7};
      if(i<40&&clearForFoliage(wx,wz))shrubs.push(t);else if(near){if(i%13===0)ferns.push(t);else if(patch<.34)dryGrass.push(t);else if(i%3===0)grass.push(t);else shortGrass.push(t);}
    }
    const treeMeshes=[];
    for(const species of ['oak','pine','birch']){
      const selected=trees.filter(t=>t.species===species),prefix=species==='oak'?'':species;
      if(!selected.length)continue;
      const trunk=batch(group,prefix?prefix+'Trunk':'trunk',selected),leaves=batch(group,prefix?prefix+'Leaves':'leaves',selected);
      trunk.userData.treeIds=leaves.userData.treeIds=selected.map(t=>t.id);treeMeshes.push(trunk,leaves);
      selected.forEach((t,index)=>{t.render={trunk,leaves,index};});
    }
    const stump=batch(group,'stump',trees.map(t=>({...t,s:0})));
    batch(group,'shrub',shrubs);if(near){batch(group,'grass',grass);batch(group,'shortGrass',shortGrass);batch(group,'dryGrass',dryGrass);batch(group,'fern',ferns);}
    chunks.set(`${x},${z}`,{group,solids,near,trees,treeMeshes,stump});
  }
  function remove(key){const chunk=chunks.get(key);for(const tree of chunk.trees)treeHarvest.unregister(tree.id);chunk.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();else if(o.isMesh)o.geometry.dispose();});chunk.group.removeFromParent();chunks.delete(key);}
  function updateFelledTrees(){
    for(const chunk of chunks.values()){
      let changed=false;
      chunk.trees.forEach((tree,index)=>{
        const state=treeHarvest.felled.get(tree.id),age=state?(treeHarvest.now-state.felledAt)/1000:-1;
        const pose=state?Math.min(3,Math.max(0,age)):-1;
        if(tree.pose===pose)return;tree.pose=pose;changed=true;
        const tilt=age<0?0:Math.min(1,age/1.5)**2*1.45;
        dummy.position.set(tree.x,tree.y,tree.z);dummy.rotation.set(tilt,tree.a,0);dummy.scale.setScalar(age>=3?0:tree.s);dummy.updateMatrix();
        tree.render.trunk.setMatrixAt(tree.render.index,dummy.matrix);tree.render.leaves.setMatrixAt(tree.render.index,dummy.matrix);tree.node.root.visible=!state;
        dummy.rotation.set(0,tree.a,0);dummy.scale.setScalar(state?tree.s:0);dummy.updateMatrix();chunk.stump.setMatrixAt(index,dummy.matrix);
      });
      if(changed){for(const mesh of chunk.treeMeshes)mesh.instanceMatrix.needsUpdate=true;chunk.stump.instanceMatrix.needsUpdate=true;chunk.stump.computeBoundingSphere();}
    }
  }
  function update(position,seconds,immediate=false){
    clock.value=seconds;const x=Math.floor(position.x/CHUNK_SIZE),z=Math.floor(position.z/CHUNK_SIZE),next=`${x},${z}`;
    if(next!==center){
      center=next;const desired=new Map();queue=[];
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
        const a=x+dx,b=z+dz;if(a<-WORLD_HALF/CHUNK_SIZE||a>=WORLD_HALF/CHUNK_SIZE||b<-WORLD_HALF/CHUNK_SIZE||b>=WORLD_HALF/CHUNK_SIZE)continue;
        const key=`${a},${b}`,near=Math.max(Math.abs(dx),Math.abs(dz))<=1;desired.set(key,true);
        if(chunks.has(key)&&chunks.get(key).near!==near)remove(key);
        if(!chunks.has(key))queue.push({a,b,near,d:dx*dx+dz*dz});
      }
      for(const key of chunks.keys())if(!desired.has(key))remove(key);
      queue.sort((a,b)=>a.d-b.d);
    }
    for(let i=0,n=immediate?9:1;i<n&&queue.length;i++){const q=queue.shift();build(q.a,q.b,q.near);}
    updateFelledTrees();colliders=[...chunks.values()].filter(c=>c.near).flatMap(c=>c.solids).filter(c=>!treeHarvest.felled.has(c.id));
  }
  update(new THREE.Vector3(),0,true);
  return {update,textures,treeHarvest,get colliders(){return colliders;},stats:()=>({loadedChunks:chunks.size,queuedChunks:queue.length,worldSize:4000}),
    dispose(){for(const key of [...chunks.keys()])remove(key);Object.values(geometry).forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());Object.values(textures).forEach(t=>t.dispose());}};
}
