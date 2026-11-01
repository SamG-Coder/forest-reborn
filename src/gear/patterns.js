import {tabardGeometry} from './tabards.js';
import * as THREE from 'three';
import {bindAvatarMesh} from '../avatar/rig.js';
import {ClothPatch} from './cloth.js';
import {MATERIAL_FAMILIES} from './catalog.js';
import {fitSurfacePath} from './surface-fit.js';
import {metalResource} from './resources.js';
import {garmentPartEnabled} from './variants.js';
import {applyBodyShape} from '../avatar/body-shape.js';
import {jeansShell,jeanDetails,shirtShell,sneakerSole,sneakerUpper,sneakerLaces} from './modern-patterns.js';
import {trouserShell} from './garment-shells.js';

/** Purpose-built pattern topology with continuous UVs; never a copy of skin. */
export function tubePattern(rings,segments=24,axis='y',sign=1){
  const p=[],uv=[],indices=[];
  for(let r=0;r<rings.length;r++)for(let s=0;s<=segments;s++){
    const t=s/segments*Math.PI*2,[along,a,b,offset=0]=rings[r],u=Math.cos(t)*a,v=Math.sin(t)*b;
    p.push(...(axis==='y'?[offset+u,along,v]:[sign*along,offset+u,v]));uv.push(s/segments,r/(rings.length-1));
    if(r&&s){const i=r*(segments+1)+s;indices.push(i,i-1,i-segments-1,i-1,i-segments-2,i-segments-1);}
  }
  if(axis==='y'||sign<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function panelGeometry(front){
  const columns=17,rows=13,p=[],uv=[],indices=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const u=x/(columns-1),v=y/(rows-1);
    // Sew the upper edge to the elliptical waist beneath the belt. A flat
    // rectangle here floats away from the body at both side corners.
    const angle=Math.PI*(.08+.84*u),fold=Math.sin(u*Math.PI*8)*v*.002;
    p.push(Math.cos(angle)*(.174+v*.05),1.074-v*.26,
      front*(Math.sin(angle)*(.136+v*.045)+fold));uv.push(u,v);
    if(x&&y){const i=y*columns+x;indices.push(i,i-1,i-columns,i-1,i-columns-1,i-columns);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return {g,columns,rows};
}
function rigidWeights(geometry,rig,name){
  const index=rig.segments.find(s=>s.name===name).index,count=geometry.attributes.position.count;
  const ids=[],weights=[];for(let i=0;i<count;i++){ids.push(index,0,0,0);weights.push(1,0,0,0);}
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
}
function rigidBreastplateWeights(geometry,rig){
  const chest=rig.segments.find(segment=>segment.name==='chest').index;
  const position=geometry.attributes.position,ids=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  for(let i=0;i<position.count;i++){
    if(position.getY(i)>1.37)continue;
    ids.setXYZW(i,chest,0,0,0);weights.setXYZW(i,1,0,0,0);
  }
}
/** A shaped plate with a rolled thickness and an open underside. */
function shoulderPlate(sign){
  const sections=[[.12,.105,.140],[.20,.115,.143],[.29,.105,.135],[.35,.085,.112]];
  const steps=24,stride=steps+1,surface=sections.length*stride,p=[],uv=[],index=[];
  for(let layer=0;layer<2;layer++)for(let row=0;row<sections.length;row++)for(let col=0;col<=steps;col++){
    const [x,ry,rz]=sections[row],a=(-.04+1.08*col/steps)*Math.PI,thickness=layer*.006;
    p.push(sign*x,1.445+Math.sin(a)*(ry-thickness),Math.cos(a)*(rz-thickness));uv.push(row/(sections.length-1),col/steps);
    if(row&&col){const i=layer*surface+row*stride+col,tri=[i-stride-1,i-1,i-stride,i-stride,i-1,i];if(layer)for(let j=0;j<tri.length;j+=3)[tri[j+1],tri[j+2]]=[tri[j+2],tri[j+1]];index.push(...tri);}
  }
  const border=[];for(let c=0;c<=steps;c++)border.push(c);for(let r=1;r<sections.length;r++)border.push(r*stride+steps);for(let c=steps-1;c>=0;c--)border.push((sections.length-1)*stride+c);for(let r=sections.length-2;r>0;r--)border.push(r*stride);
  for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length];index.push(a,b,a+surface,b,b+surface,a+surface);}
  if(sign<0)for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
function shoulderAttachmentWeights(geometry,rig,side){
  const collar=rig.segments.find(s=>s.name===`clavicle${side}`).index,arm=rig.segments.find(s=>s.name===`upperArm${side}`).index;
  const ids=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  // Uniform weights keep the whole plate in one affine transform. The upper
  // arm contributes less rotation so the medial rim remains over the cuirass.
  for(let i=0;i<ids.count;i++){ids.setXYZW(i,collar,arm,0,0);weights.setXYZW(i,.6,.4,0,0);}
}
export function buildGear(avatar,item,material,templates={},supportSurface=avatar.body.geometry){
  const pattern=item.base.pattern;
  if(!['tabard','shirt','shoes','jeans','tunic','vest','cuirass','trousers','boots','helmet','headwear','necklace','ring'].includes(pattern)){
    material.dispose();throw new Error(`Pattern not built yet: ${pattern}`);
  }
  const group=new THREE.Group();group.name=item.id;const meshes=[],patches=[],ownedMaterials=[material];
  const leather=new THREE.MeshStandardMaterial({color:item.leatherColor??'#503a29',roughness:.85,side:THREE.DoubleSide});
  const resource=item.trimResource?metalResource(item.trimResource):null;
  const trim=new THREE.MeshStandardMaterial({color:resource?.color??'#b69b60',roughness:resource?.roughness??.42,metalness:resource?.metalness??.75,side:THREE.DoubleSide});ownedMaterials.push(leather,trim);
  function add(g,name,bone=null,mat=material){
    const mesh=bindAvatarMesh(g,mat,avatar.rig,`${item.id}.${name}`);if(bone)rigidWeights(g,avatar.rig,bone);
    g.setAttribute('gearRest',g.attributes.position.clone());
    if(pattern!=='necklace')applyBodyShape(g,avatar.bodyType);
    mesh.userData.partEnabled=garmentPartEnabled(item,name);mesh.userData.part=name;
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);meshes.push(mesh);return mesh;
  }
  if(pattern==='tabard'){
    add(tabardGeometry(),'heraldic-shell');
  }else if(pattern==='shirt'){
    add(shirtShell(templates.tunic),'sewn-shell');
    add(templates.collarFacing.clone(),'collar-facing');
    const collar=new THREE.TorusGeometry(.087,.004,8,40);collar.rotateX(Math.PI/2);collar.scale(1,1,.84);collar.translate(0,1.525,-.026);add(collar,'neckband');
    for(const sign of [-1,1]){const cuff=new THREE.TorusGeometry(.077,.003,8,24);cuff.rotateY(Math.PI/2);cuff.translate(sign*.442,1.423,0);add(cuff,'sleeve-hem',`upperArm${sign===1?'L':'R'}`);}
  }else if(pattern==='shoes'){
    const rubber=new THREE.MeshToonMaterial({color:'#e1e1d8'});ownedMaterials.push(rubber);
    for(const [side,sign] of [['L',1],['R',-1]]){
      add(tubePattern([[.09,.052,.066,sign*.12],[.15,.051,.062,sign*.12]],24),'heel-collar',`foot${side}`);
      add(sneakerUpper(sign),'sneaker',`foot${side}`);
      add(sneakerSole(sign),'rubber-sole',`foot${side}`,rubber);
      for(const lace of sneakerLaces(sign))add(lace,'lace',`foot${side}`,rubber);
    }
  }else if(['tunic','vest','cuirass'].includes(pattern)){
    const armour=pattern==='cuirass';
    if(pattern!=='tunic'){
      const template=item.material==='mail'?templates.mail:templates.vest;
      const shell=add(template.clone(),'sewn-vest');
      if(armour)rigidBreastplateWeights(shell.geometry,avatar.rig);
    }else{
      if(!templates.tunic)throw new Error('Connected tunic template has not loaded');
      add(templates.tunic.clone(),'sewn-shell');
    }
    if(pattern==='tunic'){
      add(templates.collarFacing.clone(),'collar-facing');
      const collar=new THREE.TorusGeometry(.087,.003,6,40);collar.rotateX(Math.PI/2);collar.scale(1,1,.84);collar.translate(0,1.525,-.026);add(collar,'collar-piping',null,trim);
      for(const sign of [-1,1]){const cuff=new THREE.TorusGeometry(.077,.0035,6,24);cuff.rotateY(Math.PI/2);cuff.translate(sign*.442,1.423,0);add(cuff,'cuff-piping',`upperArm${sign===1?'L':'R'}`,trim);}
      add(tubePattern([[1.053,.180,.140],[1.083,.180,.140]],40),'waist-belt','hips',leather);
      for(const [x,y,w,h] of [[-.021,1.069,.005,.037],[.021,1.069,.005,.037],[0,1.088,.046,.005],[0,1.05,.046,.005]]){const g=new THREE.BoxGeometry(w,h,.007);g.translate(x,y,.143);add(g,'buckle','hips',trim);}
      for(const front of [-1,1]){
        const {g,columns,rows}=panelGeometry(front);rigidWeights(g,avatar.rig,'hips');applyBodyShape(g,avatar.bodyType);
        const driver=new THREE.SkinnedMesh(g,material);driver.bind(avatar.rig.skeleton,new THREE.Matrix4());
        const rest=g.attributes.position.array.slice();
        const mesh=new THREE.Mesh(g,material);mesh.name=`${item.id}.free-panel`;mesh.userData.part=front===1?'panel-front':'panel-back';mesh.userData.partEnabled=garmentPartEnabled(item,mesh.userData.part);mesh.frustumCulled=false;group.add(mesh);meshes.push(mesh);
        const target=(i,out)=>{out.fromArray(rest,i*3);driver.applyBoneTransform(i,out);return avatar.root.worldToLocal(out);};
        // Both rows beneath the belt form the sewn waistband. Only fabric
        // below it can slide around the trousers.
        const patch=new ClothPatch(g,columns,rows,target,{...MATERIAL_FAMILIES[item.material],pinRows:2,motionInfluence:.85});patch.side=front;patch.enabled=mesh.userData.partEnabled;patches.push(patch);
      }
    }
    if(armour){
      for(const side of ['L','R']){
        const sign=side==='L'?1:-1;
        const cap=shoulderPlate(sign);add(cap,`shoulder-${side}`);shoulderAttachmentWeights(cap,avatar.rig,side);
      }
      for(const y of [1.07,1.09,1.115])add(tubePattern([[y,.190,.151],[y+.016,.189,.150]],36),'fauld','hips');
      for(const x of [-.145,-.075,.075,.145])for(const y of [1.15,1.36]){const g=new THREE.SphereGeometry(.0055,8,6);g.translate(x,y,.15*Math.sqrt(1-(x/.24)**2)+.026);add(g,'rivet','chest',trim);}
    }
  }else if(pattern==='trousers'||pattern==='jeans'){
    if(pattern==='jeans'){
      const shell=jeansShell(avatar.sourceBody),stitch=new THREE.MeshToonMaterial({color:'#b3a17f'});ownedMaterials.push(stitch);
      const details=jeanDetails(shell);add(shell,'denim-shell');for(const g of details)add(g,'stitching',null,stitch);
      for(const sign of [-1,1])add(tubePattern([[.115,.054,.055,sign*.113],[.13,.055,.056,sign*.113]],32),'denim-hem');
    }else{
      add(trouserShell(avatar.sourceBody,{hem:.14,ease:.016}),'woven-shell');
    }
  }else if(pattern==='boots'){
    for(const side of ['L','R']){
      const sign=side==='L'?1:-1;add(tubePattern([[.07,.067,.10,sign*.12],[.16,.06,.083,sign*.12],[.32,.077,.085,sign*.114],[.42,.080,.085,sign*.114]],20),'shaft');
      const g=new THREE.SphereGeometry(1,20,12);g.scale(.075,.061,.148);g.translate(sign*.12,.065,.047);add(g,'foot',`foot${side}`);
      const sole=new THREE.SphereGeometry(1,20,10);sole.scale(.077,.014,.15);sole.translate(sign*.12,.018,.047);add(sole,'sole',`foot${side}`,leather);
      add(tubePattern([[.385,.085,.092,sign*.114],[.418,.085,.092,sign*.114]],24),'boot-cuff',`shin${side}`,leather);
      for(const y of [.20,.26])add(tubePattern([[y,.069,.084,sign*.118],[y+.012,.069,.084,sign*.118]],24),'boot-strap',`shin${side}`,leather);
    }
  }else if(pattern==='helmet'||pattern==='headwear'){
    add(templates.helmet.shell.clone(),'shell','head');
    add(templates.helmet.rim.clone(),'rim','head',pattern==='headwear'?material:trim);
  }else if(pattern==='necklace'){
    const points=[];for(let i=0;i<=72;i++){
      const t=i/72*Math.PI*2,front=Math.max(0,Math.sin(t));
      points.push(new THREE.Vector3(Math.cos(t)*.09,1.525-front*.19,Math.sin(t)*(.095+front*.085)-.015));
    }
    const fitted=fitSurfacePath(supportSurface,points,.009);
    const chain=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fitted),144,.0026,6,false);add(chain,'chain');
    const bottom=fitted[18];
    const gem=new THREE.OctahedronGeometry(.023);gem.scale(.7,1,.35);gem.translate(bottom.x,bottom.y-.02,bottom.z+.005);add(gem,'pendant','chest');
  }else if(pattern==='ring'){
    const side=item.slot==='ringLeft'?'L':'R',sign=side==='L'?1:-1;
    const g=new THREE.TorusGeometry(.010,.0028,6,16);g.rotateY(Math.PI/2);g.translate(sign*.934,1.416,-.010);add(g,'ring',`ring1${side}`);
  }else throw new Error(`Pattern not built yet: ${pattern}`);
  return {group,meshes,patches,definition:item,dispose(){for(const mesh of meshes)mesh.geometry.dispose();for(const mat of ownedMaterials)mat.dispose();group.removeFromParent();}};
}
