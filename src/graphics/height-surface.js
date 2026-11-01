/** Interpolate the actual two triangles of a regular Three.js ground grid.
 * Decals must follow this surface, not the smoother source height function. */
export function gridSurfaceHeight(height,{step,originX=0,originZ=0,offset=0}){
  return (x,z)=>{
    const gx=(x-originX)/step,gz=(z-originZ)/step,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
    const x0=originX+ix*step,z0=originZ+iz*step;
    const h10=height(x0+step,z0),h01=height(x0,z0+step);
    if(u+v<=1){const h00=height(x0,z0);return h00+(h10-h00)*u+(h01-h00)*v+offset;}
    const h11=height(x0+step,z0+step);return h11+(h01-h11)*(1-u)+(h10-h11)*(1-v)+offset;
  };
}
