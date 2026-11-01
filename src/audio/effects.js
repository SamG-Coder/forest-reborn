/** Mono one-shots, cached by the mixer. Noise and resonances avoid tonal UI beeps. */
export const EFFECTS=Object.freeze({
  sword:{seconds:.32,gain:.28,range:24,type:'whoosh'},greatsword:{seconds:.46,gain:.35,range:28,type:'whoosh'},spear:{seconds:.22,gain:.22,range:22,type:'whoosh'},
  punchSwing:{seconds:.18,gain:.17,range:16,type:'whoosh'},bow:{seconds:.24,gain:.28,range:24,type:'string'},
  hit:{seconds:.24,gain:.42,range:34,type:'impact'},punch:{seconds:.20,gain:.32,range:24,type:'impact'},
  metal:{seconds:.68,gain:.25,range:45,type:'metal'},shield:{seconds:.38,gain:.35,range:34,type:'wood'},arrowHit:{seconds:.21,gain:.28,range:25,type:'wood'},
  stepStone:{seconds:.14,gain:.075,range:10,type:'step'},stepGrass:{seconds:.18,gain:.055,range:8,type:'rustle'},
  hoof:{seconds:.18,gain:.12,range:22,type:'hoof'},hoofGrass:{seconds:.18,gain:.10,range:18,type:'hoof'},land:{seconds:.30,gain:.24,range:18,type:'impact'},
  chop:{seconds:.35,gain:.40,range:38,type:'wood'},mine:{seconds:.75,gain:.33,range:42,type:'metal'},
  saw:{seconds:.32,gain:.21,range:22,type:'rasp'},sew:{seconds:.14,gain:.10,range:9,type:'rustle'},shear:{seconds:.22,gain:.17,range:14,type:'snip'},
  gather:{seconds:.25,gain:.16,range:12,type:'rustle'},cook:{seconds:.42,gain:.15,range:12,type:'liquid'},brew:{seconds:.40,gain:.15,range:12,type:'liquid'},
  trade:{seconds:.34,gain:.20,range:14,type:'coins'},wipe:{seconds:.25,gain:.12,range:10,type:'rustle'},read:{seconds:.22,gain:.10,range:8,type:'rustle'},
});

export function synthesizeEffect(kind,variant=0,sampleRate=22050){
  const spec=EFFECTS[kind];if(!spec)throw new Error('Unknown sound effect: '+kind);
  const data=new Float32Array(Math.ceil(spec.seconds*sampleRate));let seed=1431+variant*971,low=0,peak=0;
  const pitch=1+(variant-1)*.06;
  for(let i=0;i<data.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,t=i/sampleRate,p=t/spec.seconds;
    low+=(noise-low)*.12;const high=noise-low,decay=Math.exp(-t*23),fade=Math.min(1,i/50)*Math.min(1,(data.length-i)/150);
    let value=0;
    switch(spec.type){
      case 'whoosh':value=(low*.9+high*(.12+.55*Math.sin(Math.PI*p)))*Math.pow(Math.sin(Math.PI*p),1.8);break;
      case 'string':value=(Math.sin(2*Math.PI*185*pitch*t)+.4*Math.sin(2*Math.PI*377*pitch*t))*Math.exp(-t*24)*.35+high*Math.exp(-t*75)*.3;break;
      case 'impact':value=Math.sin(2*Math.PI*(94*t-95*t*t)*pitch)*decay*.7+noise*Math.exp(-t*50)*.5+low*Math.exp(-t*14)*.3;break;
      case 'metal':value=(Math.sin(2*Math.PI*1231*pitch*t)*.31+Math.sin(2*Math.PI*2017*pitch*t)*.22+Math.sin(2*Math.PI*3293*pitch*t)*.11)*Math.exp(-t*8)+high*Math.exp(-t*75)*.35;break;
      case 'wood':value=(Math.sin(2*Math.PI*210*pitch*t)*.5+Math.sin(2*Math.PI*457*pitch*t)*.22)*Math.exp(-t*19)+high*Math.exp(-t*60)*.6+low*Math.exp(-t*10)*.3;break;
      case 'step':value=Math.sin(2*Math.PI*113*t)*decay*.25+noise*(Math.exp(-t*65)*.4+Math.exp(-Math.pow((t-.05)/.02,2))*.17);break;
      case 'hoof':value=Math.sin(2*Math.PI*86*pitch*t)*Math.exp(-t*29)*.55+Math.sin(2*Math.PI*713*pitch*t)*Math.exp(-t*74)*(kind==='hoofGrass'?.10:.26)+noise*Math.exp(-t*95)*(kind==='hoofGrass'?.13:.38)+low*Math.exp(-t*30)*.25;break;
      case 'rustle':value=(high*.5+low)*Math.pow(Math.sin(Math.PI*p),.7)*(.4+.6*Math.sin(t*93)**2);break;
      case 'rasp':value=(high*.5+low*.6)*Math.sin(Math.PI*p)*(.3+.7*Math.sin(t*175*pitch)**2);break;
      case 'snip':value=high*Math.exp(-t*65)*.7+Math.sin(2*Math.PI*2200*t)*Math.exp(-t*35)*.2+high*Math.exp(-Math.pow((t-.07)/.016,2))*.5;break;
      case 'liquid':value=(Math.sin(2*Math.PI*(400*t+1300*t*t))*low+Math.sin(t*4200)*low)*Math.sin(Math.PI*p)*.7;break;
      case 'coins':{const ring=(at)=>at>=0?(Math.sin(2*Math.PI*2450*pitch*at)+Math.sin(2*Math.PI*3601*pitch*at)*.5)*Math.exp(-at*32)*.3:0;value=ring(t)+ring(t-.075)*.7+ring(t-.145)*.4;break;}
    }
    data[i]=value*fade;peak=Math.max(peak,Math.abs(data[i]));
  }
  if(peak>.85)for(let i=0;i<data.length;i++)data[i]*=.85/peak;
  return data;
}
