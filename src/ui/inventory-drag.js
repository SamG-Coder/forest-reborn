const MIME='application/x-forest-item';
export function clearItemDrag(){
  delete document.body.dataset.inventoryDragging;
  document.querySelectorAll('.can-drop,.drop-hover').forEach(node=>node.classList.remove('can-drop','drop-hover'));
}
export function startItemDrag(event,payload,item){
  event.dataTransfer.setData(MIME,JSON.stringify(payload));event.dataTransfer.effectAllowed='move';
  document.body.dataset.inventoryDragging=item.slot??'bag';
  document.querySelectorAll('.equipment-slot').forEach(node=>node.classList.toggle('can-drop',node.dataset.slot===item.slot));
}
export function readItemDrag(event){
  try{const value=JSON.parse(event.dataTransfer.getData(MIME));return value&&['bag','equipment'].includes(value.source)&&typeof value.id==='string'?value:null;}catch{return null;}
}
export function allowItemDrop(event,node){
  if(!event.dataTransfer.types.includes(MIME))return;
  event.preventDefault();event.dataTransfer.dropEffect='move';node.classList.add('drop-hover');
}
