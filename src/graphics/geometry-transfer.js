import {BufferGeometry,BufferAttribute} from 'three';
export function packGeometry(geometry,copy=false){
  const attributes={};
  for(const [name,attribute]of Object.entries(geometry.attributes))attributes[name]={array:copy?attribute.array.slice():attribute.array,itemSize:attribute.itemSize,normalized:attribute.normalized};
  return {attributes,index:copy?geometry.index?.array.slice():geometry.index?.array};
}
export function unpackGeometry(data){
  const geometry=new BufferGeometry();for(const [name,a]of Object.entries(data.attributes))geometry.setAttribute(name,new BufferAttribute(a.array,a.itemSize,a.normalized));
  if(data.index)geometry.setIndex(new BufferAttribute(data.index,1));geometry.computeBoundingSphere();return geometry;
}
export function geometryTransfers(data){return [...new Set([...Object.values(data.attributes).map(a=>a.array.buffer),...(data.index?[data.index.buffer]:[])])];}
