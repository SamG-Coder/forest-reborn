import {deflateSync,inflateSync,strToU8,strFromU8} from 'fflate';
export function packBattle(snapshot){
  const bytes=deflateSync(strToU8(JSON.stringify(snapshot))),chunks=[];
  for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  return btoa(chunks.join(''));
}
export function unpackBattle(value){try{return JSON.parse(strFromU8(inflateSync(Uint8Array.from(atob(value),c=>c.charCodeAt(0)))));}catch{return null;}}
