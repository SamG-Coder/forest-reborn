import test from 'node:test';
import assert from 'node:assert/strict';
import {publicUrl} from '../src/assets/public-url.js';

test('runtime assets resolve under a Pages project without double-prefixing or rewriting external URLs',()=>{
  for(const path of ['/models/male-uv-body.glb','/assets/mounts/bay.png','/models/speech/nano08','/validation/body/metrics.json']){
    assert.equal(publicUrl(path,'/'),path);
    assert.equal(publicUrl(path,'/forest-reborn/'),'/forest-reborn'+path);
  }
  assert.equal(publicUrl('/forest-reborn/assets/item.png','/forest-reborn/'),'/forest-reborn/assets/item.png');
  assert.equal(publicUrl('assets/item.png','/forest-reborn/'),'/forest-reborn/assets/item.png');
  for(const path of ['https://example.com/file.png','data:image/png;base64,abc','blob:https://example.com/id'])assert.equal(publicUrl(path,'/forest-reborn/'),path);
});
