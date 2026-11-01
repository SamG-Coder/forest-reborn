// Import startup dynamically so rejected model/image loads reach an actionable screen.
try{
  // Fetch and compile speech while the player chooses a save. No audio permission
  // is needed for inference; playback still waits for the player's first click.
  import('../audio/voices.js').then(({sharedVoices})=>{const voices=sharedVoices();voices.warm().then(()=>voices.prepare({id:'innkeeper'},'Hey. Easy now. Can you hear me?'));});
  const {chooseSave}=await import('../session/save-menu.js');
  await chooseSave();
  await import('./main.js');
}catch(error){
  console.error('Forest Reborn could not start:',error);
  const panel=document.getElementById('loading');
  panel.hidden=false;
  panel.replaceChildren();
  const title=document.createElement('h1');title.textContent='Mosswake could not load.';
  const detail=document.createElement('p');
  detail.textContent=error instanceof Error?error.message:'An asset failed to load. Please try again.';
  const retry=document.createElement('button');retry.className='primary';retry.textContent='Try again';
  retry.onclick=()=>location.reload();
  panel.append(title,detail,retry);panel.setAttribute('role','alert');
}
