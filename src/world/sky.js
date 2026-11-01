import * as THREE from 'three';
import {loadTexture} from '../assets/load-texture.js';

/** Camera-centred atmosphere. Art textures are independent of the clock. */
export async function createSky(scene,camera){
  const [stars,cloud,sunMap]=await Promise.all(['night-stars','cloud-bank','sun-glow'].map(n=>loadTexture('/assets/world/'+n+'.png')));
  for(const t of [stars,cloud,sunMap])t.colorSpace=THREE.SRGBColorSpace;
  stars.wrapS=stars.wrapT=THREE.RepeatWrapping;
  const root=new THREE.Group();root.name='Day and night sky';scene.add(root);
  const uniforms={stars:{value:stars},day:{value:1},horizon:{value:new THREE.Color('#c9dfe2')},turn:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,side:THREE.BackSide,depthWrite:false,depthTest:false,
    vertexShader:`varying vec2 vUv;varying vec3 vDirection;void main(){vUv=uv;vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D stars;uniform float day;uniform float turn;uniform vec3 horizon;varying vec2 vUv;varying vec3 vDirection;
      void main(){float height=max(0.,vDirection.y);vec3 zenith=mix(vec3(.006,.012,.035),vec3(.16,.43,.68),day);
      vec3 color=mix(horizon,zenith,smoothstep(0.,.8,height));
      vec3 star=texture2D(stars,vec2(vUv.x+turn,vUv.y)*2.5).rgb;
      float intensity=max(max(star.r,star.g),star.b);color+=star*pow(smoothstep(.18,.95,intensity),2.)*(1.-day)*smoothstep(0.,.18,height)*1.1;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1500,40,24),material);dome.renderOrder=-100;dome.frustumCulled=false;root.add(dome);
  const clouds=[];
  for(let i=0;i<14;i++){
    const mat=new THREE.SpriteMaterial({map:cloud,transparent:true,depthWrite:false,depthTest:true,color:'#ffffff',opacity:.8});
    const sprite=new THREE.Sprite(mat);sprite.scale.set(280+(i%4)*90,110+(i%4)*32,1);sprite.renderOrder=-80;root.add(sprite);clouds.push(sprite);
  }
  const sun=new THREE.Sprite(new THREE.SpriteMaterial({map:sunMap,transparent:true,depthTest:true,depthWrite:false,color:'#fff3ce'}));sun.scale.set(100,100,1);sun.renderOrder=-90;root.add(sun);
  const moon=new THREE.Sprite(new THREE.SpriteMaterial({map:sunMap,transparent:true,depthTest:true,depthWrite:false,color:'#c5d8ff'}));moon.scale.set(43,43,1);moon.renderOrder=-90;root.add(moon);
  return {root,update(hour,time,day,horizon){
    root.position.copy(camera.position);uniforms.day.value=day;uniforms.horizon.value.copy(horizon);uniforms.turn.value=hour/96;
    const angle=(hour-6)/24*Math.PI*2;sun.position.set(Math.cos(angle)*950,Math.sin(angle)*950,-240);sun.visible=sun.position.y>-40;sun.material.opacity=Math.min(1,Math.max(0,(sun.position.y+40)/160));
    moon.position.set(-Math.cos(angle)*1050,-Math.sin(angle)*900,170);moon.visible=moon.position.y>0;moon.material.opacity=(1-day)*.85;
    clouds.forEach((sprite,i)=>{const a=i*2.399+time*.00012,r=760+(i%3)*50;sprite.position.set(Math.sin(a)*r,145+(i%4)*64,Math.cos(a)*r);sprite.material.color.setRGB(.16+day*.84,.21+day*.79,.32+day*.68);sprite.material.opacity=.35+day*.5;});
  },dispose(){root.removeFromParent();dome.geometry.dispose();material.dispose();for(const s of [...clouds,sun,moon])s.material.dispose();[stars,cloud,sunMap].forEach(t=>t.dispose());}};
}
