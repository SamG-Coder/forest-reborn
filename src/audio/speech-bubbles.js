export function showSpeech(person,text,now=Date.now()){
  if(!person?.position)return null;
  const bubble={text,expiresAt:now+Math.max(4000,Math.min(14000,text.split(/\s+/).length*360)),pending:false,playing:false};
  person.speech=bubble;return bubble;
}
export function speechVisible(speech,now=Date.now()){
  return Boolean(speech&&(speech.playing||speech.pending||speech.expiresAt>now));
}
