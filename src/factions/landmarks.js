import * as THREE from 'three';
import {terrainHeight} from '../world/terrain.js';
import {removeItem} from '../progression/inventory.js';

/** Quest consequences have a visible state as well as economic effects. */
export function createFactionLandmarks(scene,progress){
  const root=new THREE.Group();root.name='Faction changes';scene.add(root);
  const wood=new THREE.MeshToonMaterial({color:'#694b32'}),iron=new THREE.MeshStandardMaterial({color:'#747e82',metalness:.7,roughness:.6}),cloth=new THREE.MeshToonMaterial({color:'#376483',side:THREE.DoubleSide});
  const add=(group,g,m,x,y,z)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;};
  const beacon=new THREE.Group();beacon.position.set(8,terrainHeight(8,-59),-59);root.add(beacon);
  add(beacon,new THREE.CylinderGeometry(.22,.35,2,8),wood,0,1,0);add(beacon,new THREE.CylinderGeometry(.45,.2,.4,10),iron,0,2.05,0);
  const flame=add(beacon,new THREE.IcosahedronGeometry(.27,1),new THREE.MeshBasicMaterial({color:'#ffcf71'}),0,2.4,0);
  const watch=new THREE.Group();watch.position.set(-8,terrainHeight(-8,-51),-51);root.add(watch);
  add(watch,new THREE.CylinderGeometry(.06,.08,3,6),wood,0,1.5,0);add(watch,new THREE.PlaneGeometry(1.1,.8),cloth,.55,2.3,0);
  const wagon=new THREE.Group();wagon.position.set(15,terrainHeight(15,-44),-44);root.add(wagon);
  add(wagon,new THREE.BoxGeometry(1.4,.25,2.1),wood,0,.7,0);
  for(const x of [-.8,.8])for(const z of [-.72,.72]){const wheel=add(wagon,new THREE.CylinderGeometry(.42,.42,.15,12),wood,x,.4,z);wheel.rotation.z=Math.PI/2;}
  for(const x of [-.7,.7])add(wagon,new THREE.BoxGeometry(.12,.6,2.1),wood,x,1,0);
  for(let i=0;i<3;i++)add(wagon,new THREE.BoxGeometry(.48,.5,.5),new THREE.MeshToonMaterial({color:'#b4a484'}),(i%2)*.6-.3,1,i<2?-.5:.3);
  return {root,beacon,update(time,player){const f=progress.data.worldFlags;flame.visible=Boolean(f.beaconLit);watch.visible=Boolean(f.roadWatch);wagon.visible=Boolean(f.caravanOpen);root.visible=Math.hypot(player.x,player.z)<230;flame.scale.setScalar(1+Math.sin(time*5)*.1);},
    near(player){return player.distanceTo(beacon.position)<3;},
    interact(player){
      if(!this.near(player))return '';
      const entry=progress.data.quests['road-beacon'];if(!entry?.active)return 'The beacon is cold. Corin in Highmere may know its history.';
      if(progress.data.worldFlags.beaconLit||entry.count)return 'The light is steady. Return to Corin.';
      if(!progress.hasItem('ironIngot',3)||!progress.hasItem('wood',6))return 'Repair the beacon with 3 iron ingots and 6 cut timber.';
      let bag=removeItem(progress.data.bag,'ironIngot',3);bag=removeItem(bag,'wood',6);progress.data.bag=bag;progress.data.worldFlags.beaconLit=true;progress.recordObjective('restore:beacon');progress.save();return 'The old inscription glows. The beacon is lit. Tell Corin what happened.';
    }};
}
