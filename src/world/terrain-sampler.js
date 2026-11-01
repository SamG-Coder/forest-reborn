/** Cache a smooth height field for army movement. Rounding heights would make
 * artificial steps and repeatedly stop soldiers on otherwise walkable slopes. */
export function terrainSampler(height,step=2){
  const cache=new Map();
  function at(x,z){const key=(x+32768)*65536+z+32768;let value=cache.get(key);if(value===undefined){value=height(x*step,z*step);cache.set(key,value);}return value;}
  return (x,z)=>{const ix=Math.floor(x/step),iz=Math.floor(z/step),u=x/step-ix,v=z/step-iz;return at(ix,iz)*(1-u)*(1-v)+at(ix+1,iz)*u*(1-v)+at(ix,iz+1)*(1-u)*v+at(ix+1,iz+1)*u*v;};
}
