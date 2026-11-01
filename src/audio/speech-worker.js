import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import runtimeUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import {KittenTTSWeb} from '../vendor/kitten/index';
import {padSpeech} from './pcm.js';
import {publicUrl} from '../assets/public-url.js';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {wasm: wasmUrl, mjs: runtimeUrl};
let engine;
async function ready() {
  engine ??= (async () => {
    self.postMessage({status: 'Loading voice model…'});
    let cache;
    try { cache = await caches.open('forest-reborn-voices-nano08'); } catch { /* Private browsing still works. */ }
    const model = await KittenTTSWeb.create({
      modelBaseUrl: new URL(publicUrl('/models/speech/nano08'), self.location.origin).href,
      cache, executionProvider: 'wasm', phonemizerMode: 'espeak', retryCount: 0,
    });
    self.postMessage({status: 'Voices ready'});
    return model;
  })();
  return engine;
}

// One inference at a time: duplicate dialogues cannot compete for WASM memory.
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  queue = queue.then(async () => {
    try {
      const model = await ready();
      if (data.type === 'warm') { self.postMessage({id: data.id, ready: true}); return; }
      const start = performance.now();
      const pcm = padSpeech(await model.generate(data.text, {voice: data.profile.voice, speed: data.profile.speed, cleanText: false}));
      if (!pcm.length || pcm.some(value => !Number.isFinite(value))) throw new Error('Speech model returned invalid audio.');
      self.postMessage({id: data.id, pcm, sampleRate: 24000, generationMs: performance.now() - start}, [pcm.buffer]);
    } catch (error) {
      self.postMessage({id: data.id, error: error.message || String(error)});
    }
  });
};

