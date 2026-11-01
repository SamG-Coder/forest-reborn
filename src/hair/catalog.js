export const HAIR_STYLES=Object.freeze({none:'Shaved',short:'Short crop',swept:'Swept fringe',shaggy:'Messy layers',parted:'Curtain part',spiky:'Spiked crest',undercut:'Shaved sides',topknot:'Tied topknot',quiff:'Swept quiff',warriorbraid:'Long back braid',halftie:'Half tied',shoulderlength:'Shoulder length',pixie:'Pixie cut',bob:'Blunt bob',long:'Long centre part',ponytail:'Low ponytail',highpony:'High ponytail',sidebraid:'Side braid',bun:'Coiled bun',wavy:'Wavy bob',crownbraid:'Braided crown',twintails:'Twin tails',twinbraids:'Twin braids',crew:'Short crop',sidepart:'Swept fringe',fauxhawk:'Spiked crest',layered:'Messy layers',longwaves:'Wavy bob',braid:'Side braid'});
export const HAIR_COLLECTIONS=Object.freeze({
  male:Object.freeze(['none','short','swept','shaggy','parted','spiky','undercut','topknot','quiff','warriorbraid','halftie','shoulderlength']),
  female:Object.freeze(['none','pixie','bob','long','wavy','crownbraid','ponytail','highpony','sidebraid','twintails','twinbraids','bun']),
});
export function hairChoices(bodyType){return HAIR_COLLECTIONS[bodyType]??HAIR_COLLECTIONS.male;}
export function matchingHair(id,bodyType){const collection=hairChoices(bodyType);return collection.includes(id)?id:bodyType==='female'?'bob':'swept';}
