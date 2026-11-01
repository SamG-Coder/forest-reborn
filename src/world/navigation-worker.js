import {NavigationAreas} from './navigation-areas.js';

// Grid construction and A* run away from rendering, including gate changes.
const navigation=new NavigationAreas(null,{worker:false});
self.onmessage=({data})=>{
  const {kind,id}=data;
  try{
    if(kind==='add')navigation.add(id,data.obstacles,data.origin,data.extent);
    else if(kind==='remove')navigation.remove(id);
    else if(kind==='route')self.postMessage({id,path:navigation.route(data.start,data.end),revision:data.revision});
  }catch(error){self.postMessage({id,error:error.message});}
};
