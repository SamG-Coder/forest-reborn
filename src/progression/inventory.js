import {BAG_SIZE} from './items.js';

export const emptyBag=()=>Array(BAG_SIZE).fill(null);
const clone=bag=>bag.map(stack=>stack?{...stack}:null);
/** All-or-nothing insert: callers can reserve room before consuming a world resource. */
export function insertItem(bag,id,count,limit=20){
  if(!Number.isInteger(count)||count<1)return null;
  const next=clone(bag);let remaining=count;
  for(const stack of next)if(stack?.id===id&&stack.count<limit){const n=Math.min(remaining,limit-stack.count);stack.count+=n;remaining-=n;}
  for(let i=0;i<next.length&&remaining;i++)if(!next[i]){const n=Math.min(remaining,limit);next[i]={id,count:n};remaining-=n;}
  return remaining?null:next;
}
export function removeItem(bag,id,count=1){
  if(!Number.isInteger(count)||count<1||bag.reduce((n,s)=>n+(s?.id===id?s.count:0),0)<count)return null;
  const next=clone(bag);let remaining=count;
  for(let i=0;i<next.length&&remaining;i++)if(next[i]?.id===id){const n=Math.min(remaining,next[i].count);next[i].count-=n;remaining-=n;if(!next[i].count)next[i]=null;}
  return next;
}
export function moveStack(bag,from,to,limit=20){
  if(!bag[from]||to<0||to>=bag.length||from===to)return null;
  const next=clone(bag),a=next[from],b=next[to];
  if(b?.id===a.id){const n=Math.min(a.count,limit-b.count);if(n<=0)return null;b.count+=n;a.count-=n;if(!a.count)next[from]=null;}
  else [next[from],next[to]]=[b,a];
  return next;
}
export function splitStack(bag,index){
  const slot=bag.indexOf(null),stack=bag[index];if(slot<0||!stack||stack.count<2)return null;
  const next=clone(bag),count=Math.floor(stack.count/2);next[index].count-=count;next[slot]={id:stack.id,count};return next;
}
export function itemCount(bag,id){return bag.reduce((count,stack)=>count+(stack?.id===id?stack.count:0),0);}
