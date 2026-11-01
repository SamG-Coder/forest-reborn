// All coordinates are on the continuous 4 km square world.
export const ASHHOLD=Object.freeze({id:'ashhold',name:'Ashhold',x:1710,z:-1640,enter:210,leave:270});
export const BATTLE_SITES=Object.freeze([
  {id:'cart-road-raid',name:'Cart-road ambush',x:-132,z:-164,enter:115,leave:155,radius:62,count:80,factions:['mosswake','bandits'],cavalry:false,recurring:true},
  {id:'briar-raid',name:'Briar border skirmish',x:162,z:-185,enter:120,leave:160,radius:65,count:100,factions:['briar','bandits'],cavalry:false,recurring:true},
  {id:'northern-battle',name:'The northern crossing',x:1270,z:-1310,enter:510,leave:580,radius:420,count:10000,factions:['highmere','ash'],cavalry:true,campaign:true},
]);
export const CAMPAIGN_SITE=BATTLE_SITES[2];
export const MUSTER_CAMPS=Object.freeze([
  {id:'highmere-muster',name:'Highmere camp',faction:'highmere',team:0,x:1055,z:-1310,color:'#38667b'},
  {id:'ash-muster',name:'Ash Company camp',faction:'ash',team:1,x:1485,z:-1310,color:'#994f39'},
]);
export const CAMPAIGN_ROADS=Object.freeze([
  {width:6,points:[[1120,-831],[1080,-960],[1010,-1090],[1010,-1215],[1050,-1270],[1270,-1310]]},
  {width:6,points:[[1270,-1310],[1430,-1400],[1540,-1490],[1710,-1560],[1710,-1640]]},
]);
