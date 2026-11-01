/** Mounts are account possessions within a save, never bag stacks or equipment. */
export const MOUNTS=Object.freeze([
  {id:'bay',name:'Bracken',coat:'#88533a',mane:'#312520',muzzle:'#48352b',price:250,description:'A steady bay. Nell uses him to teach new riders.'},
  {id:'grey',name:'Mistral',coat:'#c5c5be',mane:'#747979',muzzle:'#686e71',price:650,description:'A grey road horse with a patient temperament.'},
  {id:'chestnut',name:'Copper',coat:'#ab633d',mane:'#59301d',muzzle:'#71412b',price:650,description:'A chestnut with a pale blaze and a brisk step.'},
]);
export const mountDefinition=id=>MOUNTS.find(m=>m.id===id);
export const MOUNT_SPEED=Object.freeze({walk:3.2,canter:8.4});
export function grantMount(data,id){
  if(!mountDefinition(id))return false;
  data.mounts??=[];
  if(!data.mounts.includes(id))data.mounts.push(id);
  data.activeMount??=id;
  return true;
}
export function purchaseMount(progress,id){
  const mount=mountDefinition(id);
  if(!mount||progress.data.mounts?.includes(id)){progress.lastError='You already own this horse.';return false;}
  if(progress.data.coins<mount.price){progress.lastError='You do not have enough coin for this horse.';return false;}
  progress.data.coins-=mount.price;grantMount(progress.data,id);progress.save();return true;
}
