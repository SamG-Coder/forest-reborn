/** eSpeak WASM returns one string per clause and omits punctuation.
 * Preserve every clause and restore the punctuation expected by Kitten's training input.
 */
export async function phonemizeWithPunctuation(text,phonemize,language='en-us'){
  const parts=text.split(/([,;:!?…—–]+|\.(?!\d))/u),result=[];
  for(const part of parts){
    if(!part.trim())continue;
    if(/^[,;:.!?…—–]+$/u.test(part)){result.push(part.replace(/[—–]/gu,'—'));continue;}
    const output=await phonemize(part.trim(),language);
    const phrases=typeof output==='string'?[output]:output;
    if(!Array.isArray(phrases)||phrases.some(phrase=>typeof phrase!=='string'))throw new Error('eSpeak returned invalid phonemes.');
    result.push(phrases.filter(Boolean).join(' '));
  }
  return result.join(' ').replace(/\s+/gu,' ').trim();
}
