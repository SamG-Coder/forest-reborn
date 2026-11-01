import * as THREE from 'three';

export const RABBIT_COATS=Object.freeze([
  {name:'Meadow',fur:'#c4aa83',light:'#eee2cd',ear:'#bc8179'},
  {name:'Silver',fur:'#adb4b6',light:'#e4e5df',ear:'#c59594'},
  {name:'Cream',fur:'#f0ddbb',light:'#fff2d9',ear:'#d39a8b'},
  {name:'Chestnut',fur:'#9e7354',light:'#e5d1ae',ear:'#af7b77'},
]);

/** A tapered, thick ear. Inner velvet follows the same bend as the outer shell. */
function earGeometry(inner=false,bend=0){
  const vertices=[],indices=[],uv=[],rows=20,columns=12;
  for(let row=0;row<=rows;row++){
    const t=row/rows,width=.049*Math.pow(Math.sin(Math.PI*t),.62)*(inner?.65:1)+.001;
    for(let col=0;col<=columns;col++){
      const a=col/columns*Math.PI*2,y=t*(inner?.29:.34)+(inner?.018:0);
      vertices.push(Math.cos(a)*width,y,.018*Math.sin(a)*Math.sin(Math.PI*t)+(inner?.014:0)-bend*t*t);
      uv.push(col/columns,t);
      if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function bodyGeometry(){
  const path=new THREE.CatmullRomCurve3([
    new THREE.Vector3(.006,.01,.25),new THREE.Vector3(.15,.18,.25),new THREE.Vector3(.20,.23,.26),
    new THREE.Vector3(.18,.20,.27),new THREE.Vector3(.13,.17,.28),new THREE.Vector3(.07,.10,.29),new THREE.Vector3(.005,.015,.31),
  ]),positions=[],uv=[],indices=[],rows=36,columns=28;
  for(let row=0;row<=rows;row++){const t=row/rows,p=path.getPoint(t);for(let col=0;col<=columns;col++){
    const a=col/columns*Math.PI*2;positions.push(Math.cos(a)*p.x,p.z+Math.sin(a)*p.y,-.34+t*.57);uv.push(col/columns,t);
    if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);}
  }}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

/** Shared in-game and preview model, with articulated haunches, paws, head and ears. */
export function createRabbit({variant=0}={}){
  const coat=RABBIT_COATS[variant%RABBIT_COATS.length],root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='rabbit.'+coat.name.toLowerCase();
  const ramp=new THREE.DataTexture(new Uint8Array([150,196,230,255]),4,1,THREE.RedFormat);ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  const fur=new THREE.MeshToonMaterial({color:coat.fur,gradientMap:ramp}),light=new THREE.MeshToonMaterial({color:coat.light,gradientMap:ramp}),pink=new THREE.MeshToonMaterial({color:coat.ear,gradientMap:ramp}),dark=new THREE.MeshToonMaterial({color:'#302c2a',gradientMap:ramp}),shine=new THREE.MeshBasicMaterial({color:'#ffffff'});
  const mesh=(parent,geometry,material,position=[0,0,0],scale=[1,1,1])=>{const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const egg=(parent,material,position,scale)=>mesh(parent,new THREE.SphereGeometry(1,24,16),material,position,scale);
  mesh(body,bodyGeometry(),fur);
  egg(body,light,[0,.20,.115],[.117,.139,.095]);
  const tail=egg(body,light,[0,.255,-.343],[.088,.078,.09]);tail.rotation.x=.3;
  const head=new THREE.Group();head.position.set(0,.38,.225);body.add(head);
  egg(head,fur,[0,0,0],[.133,.139,.135]);
  egg(head,fur,[0,-.044,.09],[.105,.08,.08]);
  for(const sign of [-1,1]){
    egg(head,light,[sign*.032,-.054,.148],[.044,.037,.037]);
    const eye=egg(head,dark,[sign*.112,.029,.067],[.021,.038,.035]);eye.rotation.y=sign*.24;
    egg(head,shine,[sign*.123,.047,.086],[.006,.010,.010]);
    egg(head,shine,[sign*.12,.02,.099],[.003,.004,.004]);
  }
  const nose=mesh(head,new THREE.SphereGeometry(1,12,8),pink,[0,-.041,.180],[.019,.012,.009]);nose.rotation.z=Math.PI;
  const curve=(points,radius,material)=>mesh(head,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),12,radius,5,false),material);
  curve([[0,-.05,.183],[0,-.071,.179],[-.02,-.080,.172]],.0017,dark);
  curve([[0,-.071,.179],[.009,-.079,.176],[.02,-.080,.172]],.0017,dark);
  for(const sign of [-1,1])for(let i=0;i<3;i++)curve([[sign*.055,-.057-i*.007,.165],[sign*.11,-.06-i*.005,.169],[sign*.18,-.046-i*.014,.15]],.0009,light);
  const ears=[];
  for(const sign of [-1,1]){const ear=new THREE.Group();ear.position.set(sign*.057,.104,-.018);ear.rotation.z=sign*-.18;ear.rotation.x=-.08-(variant===3?.13:0);head.add(ear);mesh(ear,earGeometry(false,variant===1?.07:.024),fur);mesh(ear,earGeometry(true,variant===1?.07:.024),pink);ears.push(ear);}
  const fore=[],hind=[];
  for(const sign of [-1,1]){
    const back=new THREE.Group();back.position.set(sign*.151,.16,-.19);body.add(back);
    egg(back,fur,[0,0,0],[.103,.15,.132]);egg(back,light,[sign*.012,-.111,.084],[.065,.040,.139]);hind.push(back);
    const front=new THREE.Group();front.position.set(sign*.085,.20,.142);body.add(front);
    egg(front,fur,[0,-.058,.013],[.041,.107,.046]);egg(front,light,[0,-.155,.050],[.042,.028,.072]);fore.push(front);
    // Fine toe divisions are part of each paw, not a separate paw silhouette.
    for(const offset of [-.012,.012]){const line=new THREE.Mesh(new THREE.CapsuleGeometry(.0013,.023,2,4),pink);line.rotation.x=Math.PI/2;line.position.set(offset,-.137,.093);front.add(line);}
  }
  let clock=variant*.73,hop=0;
  function update(dt,{speed=0,grazing=false,alert=false}={}){
    clock+=dt;const moving=speed>.06;
    if(moving)hop+=dt*(speed>1.5?3.3:2.1);else hop=0;
    const phase=(hop%1)*Math.PI*2,lift=moving?Math.max(0,Math.sin(phase))*(speed>1.5?.12:.075):0;
    body.position.y=lift;body.rotation.x=moving?Math.cos(phase)*.09:0;
    body.scale.y=1+(moving?Math.sin(phase)*.045:Math.sin(clock*2.1)*.009);
    head.rotation.x=grazing?.26+Math.sin(clock*4)*.035:alert?-.08:Math.sin(clock*.65)*.018;
    head.rotation.y=moving?0:Math.sin(clock*.55)*.10;
    for(let i=0;i<2;i++){fore[i].rotation.x=moving?Math.sin(phase-.7)*.5:0;hind[i].rotation.x=moving?Math.sin(phase+.35)*.36:0;ears[i].rotation.x=-.08+(alert?-.12:0)+Math.sin(clock*1.5+i*.6)*.045+(moving?Math.sin(phase)*.08:0);ears[i].rotation.z=(i===0?1:-1)*(.18+(Math.sin(clock*.8+i)>.92?.12:0));}
  }
  return {root,coat,materials:[fur,light,pink],update,dispose(){const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());[fur,light,pink,dark,shine].forEach(m=>m.dispose());ramp.dispose();root.removeFromParent();}};
}
