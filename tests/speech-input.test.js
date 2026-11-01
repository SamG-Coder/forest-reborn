import test from 'node:test';
import assert from 'node:assert/strict';
import {phonemize} from 'phonemizer';
import {phonemizeWithPunctuation} from '../src/audio/phoneme-text.js';
import {padSpeech} from '../src/audio/pcm.js';

test('real eSpeak retains every comma-delimited clause and the final question',async()=>{
  const text=await phonemizeWithPunctuation('Hey, easy now. Can you hear me?',phonemize);
  assert.match(text,/hˈeɪ , ˈiːzi nˈaʊ \./u);
  assert.match(text,/kæn juː hˈɪɹ mˌiː \?$/u);
});
test('creator preview retains starting vowel, word endings and all three sentence pauses',async()=>{
  const text=await phonemizeWithPunctuation('A late shift. A walk home. Nothing out of the ordinary.',phonemize);
  assert.match(text,/^ɐ lˈeɪt ʃˈɪft \./u);
  assert.match(text,/hˈoʊm \./u);assert.match(text,/ɔːɹdɪnˌɛɹi \.$/u);
  assert.equal(text.match(/\./gu).length,3);
});
test('speech padding never truncates or changes synthesized samples',()=>{
  const input=Float32Array.from([.1,-.7,.5,.003,-.08]),output=padSpeech(input,1000);
  assert.deepEqual(output.slice(40,45),input);assert.equal(output.length,165);
  assert.ok(output.slice(0,40).every(v=>v===0));assert.ok(output.slice(45).every(v=>v===0));
});
