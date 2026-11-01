import {MathUtils} from 'three';
import {encodeVariant,variantItemIds} from '../gear/variants.js';

export const GOBLIN_SCALE=.69;
export const GOBLIN_SKINS=['#759b53','#68946a','#8ea765'];

/** A human-derived head morph. Body, joint pivots, weights and clothing UVs stay compatible. */
export function shapeGoblin(geometry){
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),head=MathUtils.smoothstep(y,1.51,1.60);
    if(!head)continue;
    // The accepted human ear runs from x=.077 to .093, y=1.61..1.68.
    // Extend that existing surface; keep the cheek, temple and scalp outside it.
    const heightMask=MathUtils.smoothstep(y,1.607,1.623)*(1-MathUtils.smoothstep(y,1.676,1.692));
    const depthMask=1-MathUtils.smoothstep(Math.abs(z+.016),.019,.038);
    const ear=Math.pow(MathUtils.clamp((Math.abs(x)-.077)/.016,0,1),1.5)*heightMask*depthMask;
    const headY=1.54+(y-1.54)*(1+.47*head),headZ=z*(1+.42*head);
    // A narrow bridge runs into a projecting, slightly lifted nose tip.
    // Work only on the front of the face, below the eyes, so the nostrils
    // keep their UV placement and the back of the head cannot be pulled.
    const noseRadius=Math.hypot(x/.032,(y-1.633)/.034);
    const nose=Math.pow(Math.max(0,1-noseRadius),1.2)*MathUtils.smoothstep(z,.025,.055);
    // Upper rim rises toward a narrow, backward-swept tip. Original UVs and
    // skin weights stay intact, including the folds in the inner ear.
    p.setXYZ(i,x*(1+.68*head)+Math.sign(x)*.15*ear,MathUtils.lerp(headY,1.785,ear*.82)+.014*nose,MathUtils.lerp(headZ,-.045,ear*.55)+.095*nose);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

export function goblinOutfit(index=0){
  const id=encodeVariant({dye:['rust','slate','ochre'][index%3],leather:'brown',outer:index%3===2?'leather':'none',
    states:{frontPanel:false,backPanel:false,belt:true,trim:false,helmet:false,necklace:false,ringLeft:false,ringRight:false,shoulderLeft:false,shoulderRight:false}});
  return variantItemIds(id);
}
