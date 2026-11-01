import {Scene,Vector4} from 'three';
import {yieldJob} from '../world/async-jobs.js';

/** Upload buffers and finish driver programs a mesh at a time. compileAsync by
 * itself does not upload vertex buffers or force lazy first-draw compilation.
 * The one-pixel scissored draw uses the real output colour/tone-mapping path. */
export async function warmMeshes(renderer,camera,world,meshes){
  const stage=new Scene();stage.environment=world.environment;stage.environmentIntensity=world.environmentIntensity;stage.fog=world.fog;
  const view=camera.clone();view.aspect=1;view.near=.001;view.updateProjectionMatrix();
  world.traverseVisible(light=>{if(light.isLight){const copy=light.clone();copy.position.copy(light.getWorldPosition(copy.position));if(light.shadow)copy.shadow=light.shadow;stage.add(copy);}});
  for(const mesh of meshes){
    await renderer.compileAsync(mesh,camera,world);await yieldJob();
    const parent=mesh.parent,count=mesh.count,visible=mesh.visible,culled=mesh.frustumCulled;
    const viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),test=renderer.getScissorTest(),shadow=renderer.shadowMap.autoUpdate,target=renderer.getRenderTarget();
    try{
      stage.add(mesh);mesh.visible=true;mesh.frustumCulled=false;if(mesh.isInstancedMesh)mesh.count=1;
      mesh.updateMatrixWorld(true);mesh.geometry.computeBoundingSphere();const bounds=mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
      view.position.copy(bounds.center);view.position.z+=Math.max(.1,bounds.radius*3);view.lookAt(bounds.center);view.updateMatrixWorld();
      const pose=mesh.geometry.attributes.npcPose,state=mesh.geometry.attributes.npcState;
      if(pose){pose.setXYZW(0,0,.1,0,.1);pose.needsUpdate=true;}if(state){state.setXY(0,1,-1);state.needsUpdate=true;}
      renderer.setRenderTarget(null);renderer.setViewport(0,0,1,1);renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);renderer.shadowMap.autoUpdate=false;
      renderer.render(stage,view);
    }finally{
      parent.add(mesh);mesh.visible=visible;mesh.frustumCulled=culled;if(mesh.isInstancedMesh)mesh.count=count;
      renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.shadowMap.autoUpdate=shadow;
    }
    await yieldJob();
  }
  stage.clear();
}
