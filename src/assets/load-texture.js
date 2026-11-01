import {TextureLoader} from 'three';
import {publicUrl} from './public-url.js';

/** Retry a transient image failure once and retain the URL in the final error. */
export async function loadTexture(url,loader=new TextureLoader()){
  url=publicUrl(url);
  for(let attempt=0;attempt<2;attempt++){
    try{return await loader.loadAsync(url);}catch(cause){
      if(attempt===1)throw new Error(`Could not load texture: ${url}`,{cause});
      await new Promise(resolve=>setTimeout(resolve,300));
    }
  }
}
