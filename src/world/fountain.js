import * as THREE from 'three';
import {metricUV} from './materials.js';

/** Recessed basin with animated ripples, four streams and small splash droplets. */
export function createFountain(parent,{stone,trim,x=0,y=0,z=0}){
  const root=new THREE.Group();root.name='Highmere fountain';root.position.set(x,y,z);parent.add(root);
  const add=(geometry,material,py=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.y=py;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
  const profile=[[0,.12],[2.92,.12],[3.08,.3],[3.24,.76],[3.28,.92],[3.64,.92],[3.85,.16],[3.9,0],[0,0]].map(p=>new THREE.Vector2(...p));
  const basin=new THREE.LatheGeometry(profile,64);metricUV(basin,3);add(basin,stone);
  add(new THREE.TorusGeometry(3.45,.19,8,64).rotateX(Math.PI/2),trim,.86);
  const time={value:0},water=new THREE.ShaderMaterial({uniforms:{time,deep:{value:new THREE.Color('#397e82')},shallow:{value:new THREE.Color('#99cec8')}},transparent:true,depthWrite:false,
    vertexShader:`varying vec3 vWorld;varying vec2 vXZ;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vXZ=position.xz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform float time;uniform vec3 deep;uniform vec3 shallow;varying vec3 vWorld;varying vec2 vXZ;
      void main(){vec2 p=vXZ;float r=length(p);float ripple=sin(r*22.-time*4.)*.35+sin(p.x*10.+p.y*7.+time*1.3)*.2;
      for(int i=0;i<4;i++){float a=float(i)*1.5707963;float d=length(p-vec2(sin(a),cos(a))*2.15);ripple+=sin(d*35.-time*7.)*exp(-d*2.5)*.4;}
      float edge=smoothstep(2.6,3.17,r),fresnel=pow(1.-max(0.,normalize(cameraPosition-vWorld).y),3.);
      float glint=pow(max(0.,ripple*.65+.4),12.);vec3 color=mix(deep,shallow,.32+ripple*.18+fresnel*.35);color+=glint*.7+edge*.09;gl_FragColor=vec4(color,.91);}`});
  const surface=add(new THREE.CircleGeometry(3.19,64).rotateX(-Math.PI/2),water,.63);surface.castShadow=false;surface.name='recessed water surface';
  const pedestal=new THREE.LatheGeometry([[.7,.12],[.7,.24],[.4,.38],[.32,1.6],[.58,1.74],[.60,1.9],[.36,2.0]].map(p=>new THREE.Vector2(...p)),32);metricUV(pedestal,2);add(pedestal,stone);
  add(new THREE.SphereGeometry(.44,24,16),trim,2.24);
  const streamMaterial=new THREE.MeshPhysicalMaterial({color:'#9bd2d5',transparent:true,opacity:.65,roughness:.15,metalness:.05,depthWrite:false});
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,s=Math.sin(a),c=Math.cos(a),points=[];
    for(let j=0;j<=20;j++){const t=j/20,r=.47+t*1.68;points.push(new THREE.Vector3(s*r,1.83+.35*t-1.55*t*t,c*r));}
    const stream=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.025,5,false),streamMaterial);stream.castShadow=false;
  }
  const droplets=new THREE.InstancedMesh(new THREE.SphereGeometry(.022,6,4),new THREE.MeshBasicMaterial({color:'#d5efea',transparent:true,opacity:.8}),48);droplets.frustumCulled=false;root.add(droplets);const dummy=new THREE.Object3D();
  function update(seconds){time.value=seconds;for(let i=0;i<48;i++){const a=Math.floor(i/12)*Math.PI/2,t=(seconds*1.8+(i%12)/12)%1,angle=i*2.39996,r=t*.28;dummy.position.set(Math.sin(a)*2.15+Math.cos(angle)*r,.645+Math.sin(t*Math.PI)*.19,Math.cos(a)*2.15+Math.sin(angle)*r);dummy.scale.setScalar(1-t*.65);dummy.updateMatrix();droplets.setMatrixAt(i,dummy.matrix);}droplets.instanceMatrix.needsUpdate=true;}
  update(0);return {root,surface,update,dispose(){root.removeFromParent();root.traverse(o=>{if(o.geometry)o.geometry.dispose();});water.dispose();streamMaterial.dispose();droplets.material.dispose();droplets.dispose();}};
}
