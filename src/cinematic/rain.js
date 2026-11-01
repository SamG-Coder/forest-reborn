import * as THREE from 'three';

const HEIGHT = 14, SPEED = 8, PERIOD = HEIGHT / SPEED;
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

function fadingMaterial(Material, color) {
  const material = new Material({color, transparent:true, depthWrite:false, opacity:1});
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float impactOpacity; varying float vImpactOpacity;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvImpactOpacity = impactOpacity;');
    shader.fragmentShader = 'varying float vImpactOpacity;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vImpactOpacity; if (diffuseColor.a < .003) discard;');
  };
  return material;
}

/** Seeded rainfall with impacts timed to the same drops, on road and pavement. */
export function createStreetRain({count = 1800, seed = 611} = {}) {
  const root = new THREE.Group(); root.name = 'rain-and-ground-splashes';
  const random = () => {seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296;};
  const drops = Array.from({length:count}, () => {
    const x = random() * 28 - 14, y = random() * HEIGHT, z = random() * 56 - 28;
    return {x,y,z,ground:Math.abs(x) < 5.72 ? -.016 : .128};
  });
  const positions = new Float32Array(count * 6), rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({color:'#c4def4', transparent:true, opacity:.32, depthWrite:false});
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);rain.frustumCulled=false;root.add(rain);
  const impacts = drops.filter((drop, index) => index % 3 === 0 && Math.abs(drop.x) < 8.85);
  const ringGeometry = new THREE.RingGeometry(.86, 1, 20), alpha = new Float32Array(impacts.length);
  ringGeometry.setAttribute('impactOpacity', new THREE.InstancedBufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const ringMaterial = fadingMaterial(THREE.MeshBasicMaterial, '#a1c0cf');
  const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, impacts.length);
  rings.name = 'rain-impact-rings'; rings.frustumCulled=false;rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(rings);
  const sprayPositions = new Float32Array(impacts.length * 12), sprayAlpha = new Float32Array(impacts.length * 4);
  const sprayGeometry = new THREE.BufferGeometry();
  sprayGeometry.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3).setUsage(THREE.DynamicDrawUsage));
  sprayGeometry.setAttribute('impactOpacity', new THREE.BufferAttribute(sprayAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const sprayMaterial = fadingMaterial(THREE.LineBasicMaterial, '#b3cddd');
  const spray = new THREE.LineSegments(sprayGeometry, sprayMaterial);spray.name='rain-impact-droplets';spray.frustumCulled=false;root.add(spray);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI/2);
  return {
    root,
    update(time) {
      for(let i=0;i<drops.length;i++) {
        const d=drops[i], h=modulo(d.y-time*SPEED, HEIGHT)+d.ground;
        positions.set([d.x,h,d.z,d.x+.025,h+.23,d.z+.02],i*6);
      }
      rainGeometry.attributes.position.needsUpdate=true;
      for(let i=0;i<impacts.length;i++) {
        const d=impacts[i], age=modulo(time-d.y/SPEED,PERIOD), life=Math.max(0,1-age/.48);
        const radius=.012+Math.min(age,.48)*.24;
        position.set(d.x,d.ground,d.z);scale.setScalar(radius);matrix.compose(position,rotation,scale);rings.setMatrixAt(i,matrix);
        alpha[i]=life*.44;
        for(let j=0;j<2;j++) {
          const angle=i*2.399+j*Math.PI, spread=age*.20;
          const h=Math.max(0,.7*age-2.7*age*age), x=d.x+Math.cos(angle)*spread,z=d.z+Math.sin(angle)*spread;
          sprayPositions.set([x,d.ground+h,z,x+.004,d.ground+h+.014*life,z+.004],i*12+j*6);
          const opacity=age<.25?.6*(1-age/.25):0;sprayAlpha.set([opacity,opacity],i*4+j*2);
        }
      }
      rings.instanceMatrix.needsUpdate=true;ringGeometry.attributes.impactOpacity.needsUpdate=true;
      sprayGeometry.attributes.position.needsUpdate=true;sprayGeometry.attributes.impactOpacity.needsUpdate=true;
    },
    dispose() { for(const g of [rainGeometry,ringGeometry,sprayGeometry])g.dispose();for(const m of [rainMaterial,ringMaterial,sprayMaterial])m.dispose();root.removeFromParent(); },
  };
}
