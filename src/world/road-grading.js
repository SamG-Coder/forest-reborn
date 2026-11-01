const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

/** Grade a connected road network, then blend shallow verges into the landscape.
 * Intersections share height nodes, so separate streets cannot form a step. */
export function createRoadGrading(roads,heightAt,{grade=.18,spacing=3,verge=14}={}){
  const lines=[];
  for(const road of roads)for(let i=1;i<road.points.length;i++)lines.push({a:road.points[i-1],b:road.points[i],width:road.width,cuts:[0,1]});
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const a=lines[i],b=lines[j],rx=a.b[0]-a.a[0],rz=a.b[1]-a.a[1],sx=b.b[0]-b.a[0],sz=b.b[1]-b.a[1],den=rx*sz-rz*sx;
    if(Math.abs(den)<1e-8)continue;
    const dx=b.a[0]-a.a[0],dz=b.a[1]-a.a[1],t=(dx*sz-dz*sx)/den,u=(dx*rz-dz*rx)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1){a.cuts.push(t);b.cuts.push(u);}
  }
  const nodes=[],byPosition=new Map(),edges=[];
  const nodeAt=(x,z)=>{const key=`${x.toFixed(4)}:${z.toFixed(4)}`;if(!byPosition.has(key)){byPosition.set(key,nodes.length);nodes.push({x,z,h:heightAt(x,z)});}return byPosition.get(key);};
  for(const line of lines){
    const length=Math.hypot(line.b[0]-line.a[0],line.b[1]-line.a[1]),cuts=[...new Set(line.cuts)].sort((a,b)=>a-b);let prior=null;
    for(let i=1;i<cuts.length;i++){
      const start=cuts[i-1],end=cuts[i],count=Math.max(1,Math.ceil((end-start)*length/spacing));
      for(let k=0;k<=count;k++){
        const t=start+(end-start)*k/count,x=line.a[0]+(line.b[0]-line.a[0])*t,z=line.a[1]+(line.b[1]-line.a[1])*t,id=nodeAt(x,z);
        if(prior!==null&&prior!==id){const a=nodes[prior],b=nodes[id];edges.push({a,b,width:line.width,length:Math.hypot(b.x-a.x,b.z-a.z)});}
        prior=id;
      }
    }
  }
  // Project neighbouring samples onto a grade limit, sharing each correction.
  for(let pass=0;pass<500;pass++){
    let worst=0;
    for(const edge of pass%2?edges.toReversed():edges){const {a,b,length}=edge,delta=b.h-a.h,excess=Math.abs(delta)-grade*length;if(excess>.0001){const correction=Math.sign(delta)*excess*.5;a.h+=correction;b.h-=correction;worst=Math.max(worst,excess);}}
    if(worst<.001)break;
  }
  const cells=new Map(),cellSize=64;
  for(const edge of edges){
    const r=edge.width/2+verge;
    for(let z=Math.floor((Math.min(edge.a.z,edge.b.z)-r)/cellSize);z<=Math.floor((Math.max(edge.a.z,edge.b.z)+r)/cellSize);z++)for(let x=Math.floor((Math.min(edge.a.x,edge.b.x)-r)/cellSize);x<=Math.floor((Math.max(edge.a.x,edge.b.x)+r)/cellSize);x++){
      const key=`${x}:${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(edge);
    }
  }
  return {nodes,edges,height(x,z,landscape){
    let weightedHeight=0,totalWeight=0,blend=0;
    for(const edge of cells.get(`${Math.floor(x/cellSize)}:${Math.floor(z/cellSize)}`)??[]){
      const dx=edge.b.x-edge.a.x,dz=edge.b.z-edge.a.z,t=clamp(((x-edge.a.x)*dx+(z-edge.a.z)*dz)/(edge.length**2),0,1);
      const distance=Math.hypot(x-edge.a.x-t*dx,z-edge.a.z-t*dz);
      const outside=Math.max(0,distance-edge.width/2),influence=1-smooth(outside/verge);
      if(influence<=0)continue;
      // Blend overlapping road verges. Picking one nearest segment introduced
      // cliffs at its Voronoi boundary, especially next to a rising side street.
      const weight=influence/Math.pow(4+distance,3);
      weightedHeight+=(edge.a.h+(edge.b.h-edge.a.h)*t)*weight;totalWeight+=weight;blend=Math.max(blend,influence);
    }
    if(totalWeight===0)return landscape;
    return landscape+(weightedHeight/totalWeight-landscape)*blend;
  }};
}
