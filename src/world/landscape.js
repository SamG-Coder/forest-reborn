import * as THREE from 'three';
import {terrainHeight,WORLD_SIZE} from './terrain.js';
import {waterSample,RIVER_SEGMENTS,LAKES} from './watersheds.js';
import {loadTexture} from '../assets/load-texture.js';
import {yieldJob} from './async-jobs.js';

/** Coarse horizon terrain and a bounded set of connected water surfaces. */
export async function createLandscape(scene,materials){
  const root=new THREE.Group();root.name='Watersheds and mountain horizon';scene.add(root);
  const terrain=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,240,240).rotateX(-Math.PI/2);
  const p=terrain.attributes.position,uv=terrain.attributes.uv;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,terrainHeight(x,z)-.6);uv.setXY(i,x/7,z/7);if(i%256===0)await yieldJob();}
  terrain.setAttribute('roadWeight',new THREE.Float32BufferAttribute(new Float32Array(p.count),1));
  terrain.setAttribute('bankWeight',new THREE.Float32BufferAttribute(new Float32Array(p.count),1));terrain.computeVertexNormals();
  const ground=materials.ground.clone(),nearRect={value:new THREE.Vector4(0,0,0,0)};
  const maskSize=512,maskData=new Uint8Array(maskSize*maskSize);
  // Mask only well inside the water. The coarse mask's texels cover almost
  // eight metres; cutting out the banks exposes holes beyond the fine tiles.
  for(let z=0;z<maskSize;z++){for(let x=0;x<maskSize;x++){const w=waterSample((x+.5)/maskSize*WORLD_SIZE-WORLD_SIZE/2,(z+.5)/maskSize*WORLD_SIZE-WORLD_SIZE/2);maskData[z*maskSize+x]=w&&w.shore<-8?255:0;}if(z%8===0)await yieldJob();}
  const waterMask=new THREE.DataTexture(maskData,maskSize,maskSize,THREE.RedFormat);waterMask.needsUpdate=true;
  ground.onBeforeCompile=shader=>{
    materials.ground.onBeforeCompile(shader);shader.uniforms.nearRect=nearRect;
    shader.uniforms.waterMask={value:waterMask};
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 nearRect; uniform sampler2D waterMask;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`if(vTerrainWorld.x>nearRect.x&&vTerrainWorld.x<nearRect.z&&vTerrainWorld.z>nearRect.y&&vTerrainWorld.z<nearRect.w)discard; if(texture2D(waterMask,vTerrainWorld.xz/4000.+.5).r>.1)discard;\n#include <map_fragment>`);
  };
  ground.customProgramCacheKey=()=> 'distant-terrain-water-v1';
  const floor=new THREE.Mesh(terrain,ground);floor.receiveShadow=true;root.add(floor);
  const ripple=await loadTexture('/assets/world/water-ripples.png');ripple.wrapS=ripple.wrapT=THREE.RepeatWrapping;ripple.anisotropy=4;
  const uniforms={time:{value:0},ripple:{value:ripple},sky:{value:new THREE.Color('#b8dce7')},light:{value:1},sunDir:{value:new THREE.Vector3(.3,.8,.4)}};
  const waterMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute float shore; attribute float waterDepth; attribute vec2 flow;
      varying vec3 vWorld; varying float vShore; varying float vDepth; varying vec2 vFlow;
      void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;vShore=shore;vDepth=waterDepth;vFlow=flow;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:`uniform sampler2D ripple;uniform float time;uniform float light;uniform vec3 sky;uniform vec3 sunDir;
      varying vec3 vWorld;varying float vShore;varying float vDepth;varying vec2 vFlow;
      void main(){if(vShore>-.12||vDepth<.015)discard;
        vec2 drift=length(vFlow)>.1?vFlow:vec2(.17,.08);
        vec2 uv=vWorld.xz*.15-drift*time*.055;
        float a=texture2D(ripple,uv).r,b=texture2D(ripple,uv*.63+vec2(time*.017,-time*.012)).r;
        vec2 grad=vec2(texture2D(ripple,uv+vec2(.003,0.)).r-a,texture2D(ripple,uv+vec2(0.,.003)).r-a)*18.;
        vec3 n=normalize(vec3(-grad.x,1.,-grad.y));vec3 eye=normalize(cameraPosition-vWorld);
        float fresnel=.14+.65*pow(1.-max(0.,dot(n,eye)),4.);
        vec3 shallow=vec3(.20,.53,.49),deep=vec3(.055,.24,.30);
        vec3 color=mix(shallow,deep,smoothstep(.2,5.,vDepth))*(.25+.75*light);
        color=mix(color,sky*(.73+(a+b)*.12),fresnel);
        float glint=pow(max(0.,dot(reflect(-normalize(sunDir),n),eye)),110.);
        color+=vec3(1.,.9,.64)*glint*light*.7;
        float foam=(1.-smoothstep(.06,.55,vDepth))*(.35+.65*smoothstep(.46,.59,a));
        foam+=smoothstep(.67,.84,a+b*.15)*.045;
        color=mix(color,vec3(.77,.91,.86)*(.25+.75*light),foam);
        float fog=smoothstep(500.,1700.,distance(cameraPosition,vWorld));color=mix(color,sky,fog);
        gl_FragColor=vec4(color,smoothstep(.015,.2,vDepth)*.95);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  function meshFromPoints(points,indices,name){
    const pos=[],shore=[],depth=[],flow=[];
    for(const [x,z]of points){const w=waterSample(x,z);const level=w?.level??-100;pos.push(x,level+.025,z);shore.push(w?.shore??100);depth.push(Math.max(0,level-terrainHeight(x,z)));flow.push(w?.flowX??0,w?.flowZ??0);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('shore',new THREE.Float32BufferAttribute(shore,1));g.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depth,1));g.setAttribute('flow',new THREE.Float32BufferAttribute(flow,2));g.setIndex(indices);g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,waterMaterial);mesh.name=name;mesh.renderOrder=1;root.add(mesh);
  }
  const riverPoints=[],riverIndices=[];
  for(const {a,b}of RIVER_SEGMENTS){const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),base=riverPoints.length;
    for(const point of [a,b])for(let j=0;j<=8;j++){const offset=(j/8*2-1)*(point.width+2);riverPoints.push([point.x-dz/len*offset,point.z+dx/len*offset]);}
    for(let j=0;j<8;j++)riverIndices.push(base+j,base+j+9,base+j+1,base+j+1,base+j+9,base+j+10);
  }meshFromPoints(riverPoints,riverIndices,'Flowing western river');
  for(const lake of LAKES){const points=[],indices=[],segments=64;
    for(let z=0;z<=segments;z++)for(let x=0;x<=segments;x++)points.push([lake.x+(x/segments*2-1)*(lake.rx+4),lake.z+(z/segments*2-1)*(lake.rz+4)]);
    for(let z=0;z<segments;z++)for(let x=0;x<segments;x++){const i=z*(segments+1)+x;indices.push(i,i+segments+1,i+1,i+1,i+segments+1,i+segments+2);}
    meshFromPoints(points,indices,lake.name);
  }
  return {root,update(time,position,forestStats,daylight=1){
    uniforms.time.value=time;uniforms.sky.value.copy(scene.fog.color);uniforms.light.value=daylight;
    // Hide the horizon mesh only after the fine chunks are ready, avoiding a
    // loading hole during teleportation. Both tiers use the same height query.
    if(forestStats.queuedChunks===0){const x=Math.floor(position.x/80),z=Math.floor(position.z/80);nearRect.value.set((x-3)*80+2,(z-3)*80+2,(x+4)*80-2,(z+4)*80-2);}
    else nearRect.value.set(0,0,0,0);
  },stats(){return {waterSurfaces:root.children.length-1,riverSegments:RIVER_SEGMENTS.length,horizonTriangles:terrain.index.count/3};},dispose(){root.removeFromParent();root.traverse(m=>m.geometry?.dispose());ground.dispose();waterMask.dispose();ripple.dispose();waterMaterial.dispose();}};
}
