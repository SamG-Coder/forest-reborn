/** Yield CPU-heavy preparation so input, rendering and audio can run between batches. */
export const yieldJob=()=>globalThis.scheduler?.yield?.()??new Promise(resolve=>setTimeout(resolve,0));

export async function finishJob(iterator,{budgetMs=3,onProgress=()=>{}}={}){
  let deadline=performance.now()+budgetMs,step;
  while(!(step=iterator.next()).done){
    if(performance.now()>=deadline){onProgress(step.value);await yieldJob();deadline=performance.now()+budgetMs;}
  }
  return step.value;
}
