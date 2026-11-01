import * as THREE from 'three';

export const RIG_ID = 'male-tpose-v2';
/** Skeleton for the 1.79 m reconstructed male, +Y up, +Z front. */
export function createBaseRig(root) {
  const bones = {}, rest = {}, segments = [], ordered = [];
  const add = (name, parent, start, end) => {
    const bone = new THREE.Bone(); bone.name = name;
    const origin = parent ? rest[parent] : [0, 0, 0];
    bone.position.set(...start.map((v,i) => v-origin[i]));
    (parent ? bones[parent] : root).add(bone);
    bones[name] = bone; rest[name] = start; ordered.push(bone);
    segments.push({ name, index: ordered.length-1, start: new THREE.Vector3(...start), end: new THREE.Vector3(...end) });
  };
  add('hips', null, [0,.94,0], [0,1.08,0]);
  add('spine','hips',[0,1.08,0],[0,1.24,0]);
  add('chest','spine',[0,1.24,0],[0,1.45,0]);
  add('neck','chest',[0,1.49,0],[0,1.57,0]);
  add('head','neck',[0,1.57,0],[0,1.78,0]);
  for (const [side,s] of [['L',1],['R',-1]]) {
    add(`clavicle${side}`,'chest',[s*.06,1.44,0],[s*.20,1.445,0]);
    add(`upperArm${side}`,`clavicle${side}`,[s*.20,1.445,0],[s*.53,1.42,0]);
    add(`forearm${side}`,`upperArm${side}`,[s*.53,1.42,0],[s*.84,1.418,0]);
    add(`hand${side}`,`forearm${side}`,[s*.84,1.418,0],[s*.924,1.416,0]);
    const fingers=[['little',-18,42],['ring',-5.5,49],['middle',7.5,46],['index',20,35]];
    for (const [finger,z,len] of fingers) {
      const a=[s*506/550,779/550,z/550];
      const b=[s*(506+len*.5)/550,778/550,(z+1)/550];
      const c=[s*(506+len*.78)/550,777/550,(z+1.5)/550];
      const d=[s*(506+len)/550,776.8/550,(z+2)/550];
      add(`${finger}1${side}`,`hand${side}`,a,b);add(`${finger}2${side}`,`${finger}1${side}`,b,c);add(`${finger}3${side}`,`${finger}2${side}`,c,d);
    }
    add(`thumb1${side}`,`hand${side}`,[s*487/550,777/550,23/550],[s*504/550,775/550,35/550]);
    add(`thumb2${side}`,`thumb1${side}`,[s*504/550,775/550,35/550],[s*519/550,774/550,39/550]);
    add(`thigh${side}`,'hips',[s*.11,.93,0],[s*.11,.58,0]);
    add(`shin${side}`,`thigh${side}`,[s*.11,.58,0],[s*.12,.13,0]);
    add(`foot${side}`,`shin${side}`,[s*.12,.13,0],[s*.12,.04,.09]);
    add(`toe${side}`,`foot${side}`,[s*.12,.04,.09],[s*.12,.025,.15]);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(ordered); skeleton.calculateInverses();
  return { id:RIG_ID, bones, skeleton, segments, reset(){ ordered.forEach(b => b.rotation.set(0,0,0)); } };
}

export function skinGeometry(geometry, rig) {
  const indices=[], weights=[], p=new THREE.Vector3(), closest=new THREE.Vector3();
  const pos=geometry.getAttribute('position');
  for(let i=0;i<pos.count;i++) {
    p.fromBufferAttribute(pos,i);
    const lateral=Math.abs(p.x), side=p.x>0?'L':'R';
    // Anatomical shoulder blend. Nearest-bone weighting lets the static
    // clavicle dominate the deltoid cap and creates a shelf with arms lowered.
    // Keep the chest on the torso and move the outer cap with the humerus.
    if(p.y>1.25 && p.y<1.53 && lateral<.43){
      const arm=THREE.MathUtils.smoothstep(lateral,.14,.32)*THREE.MathUtils.smoothstep(p.y,1.28,1.37);
      const collar=(1-arm)*THREE.MathUtils.smoothstep(p.y,1.39,1.46)*THREE.MathUtils.smoothstep(lateral,.055,.16)*.35;
      const pairs=[[`upperArm${side}`,arm],[`clavicle${side}`,collar],['chest',1-arm-collar]];
      for(let j=0;j<4;j++){indices.push(j<3?rig.segments.find(s=>s.name===pairs[j][0]).index:0);weights.push(j<3?pairs[j][1]:0);}
      continue;
    }
    let candidates=rig.segments;
    // Region gates prevent cross-body influences across armpits and finger gaps.
    if(p.y>1.54) candidates=candidates.filter(s=>s.name==='head'||s.name==='neck');
    else if(Math.abs(p.x)>.39 && p.y>1.2) {
      const side=p.x>0?'L':'R';
      candidates=candidates.filter(s=>s.name.endsWith(side)&&!/thigh|shin|foot|toe/.test(s.name));
      if(Math.abs(p.x)<.89) candidates=candidates.filter(s=>!/thumb|little|ring|middle|index/.test(s.name));
    } else if(p.y<.85) candidates=candidates.filter(s=>s.name==='hips'||s.name.endsWith(p.x>0?'L':'R')&&/thigh|shin|foot|toe/.test(s.name));
    else candidates=candidates.filter(s=>!/thumb|little|ring|middle|index|hand/.test(s.name));
    const distances=candidates.map(segment=>{
      new THREE.Line3(segment.start,segment.end).closestPointToPoint(p,true,closest);
      return {index:segment.index,d:closest.distanceToSquared(p)};
    }).sort((a,b)=>a.d-b.d).slice(0,4);
    const softness=Math.abs(p.x)>.91?.000025:.0012;
    const values=distances.map(d=>Math.exp(-(d.d-distances[0].d)/softness));
    const total=values.reduce((a,b)=>a+b,0);
    for(let j=0;j<4;j++){ indices.push(distances[j]?.index??0);weights.push((values[j]??0)/total); }
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  return geometry;
}

export function bindAvatarMesh(geometry,material,rig,name) {
  const mesh=new THREE.SkinnedMesh(skinGeometry(geometry,rig),material);
  mesh.name=name;mesh.bind(rig.skeleton,new THREE.Matrix4());mesh.frustumCulled=false;
  return mesh;
}
