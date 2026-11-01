import {CHUNK_SIZE,random,chunkSeed,clearForFoliage} from './terrain.js';

/** Rendering and navigation use exactly the same deterministic trunk positions. */
export function treePlacements(chunkX,chunkZ,rng=random(chunkSeed(chunkX,chunkZ))){
  const cx=(chunkX+.5)*CHUNK_SIZE,cz=(chunkZ+.5)*CHUNK_SIZE,trees=[];
  for(let i=0;i<80;i++){
    const x=cx+(rng()-.5)*CHUNK_SIZE,z=cz+(rng()-.5)*CHUNK_SIZE;
    if(!clearForFoliage(x,z))continue;
    trees.push({x,z,a:rng()*Math.PI*2,s:.9+rng()*.8,species:['oak','pine','birch'][Math.abs(Math.floor(x*3+z*7))%3]});
  }
  return trees;
}

export function trunkObstacles(extent=150){
  const obstacles=[];
  for(let z=Math.floor(-extent/CHUNK_SIZE);z<=Math.floor(extent/CHUNK_SIZE);z++){
    for(let x=Math.floor(-extent/CHUNK_SIZE);x<=Math.floor(extent/CHUNK_SIZE);x++){
      for(const tree of treePlacements(x,z)){
        if(Math.abs(tree.x)>extent||Math.abs(tree.z)>extent)continue;
        const radius=.32*tree.s;
        obstacles.push({minX:tree.x-radius,maxX:tree.x+radius,minZ:tree.z-radius,maxZ:tree.z+radius});
      }
    }
  }
  return obstacles;
}
