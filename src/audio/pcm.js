/** Keep the complete synthesized signal, with a small lead-in and release for playback. */
export function padSpeech(pcm,sampleRate=24000){
  const lead=Math.round(sampleRate*.04),tail=Math.round(sampleRate*.12);
  const output=new Float32Array(lead+pcm.length+tail);
  output.set(pcm,lead);return output;
}
