export const BOUNTIES=Object.freeze([
  {id:'grove',name:'Clear the grove',kind:'goblin',count:12,minLevel:2,x:85,z:-85,xp:160,coins:70,description:'Make the grove safe for the woodcutters. Twelve goblins, as a guild.'},
  {id:'ogres',name:'Heavy footsteps',kind:'ogre',count:2,minLevel:4,x:115,z:-92,xp:280,coins:120,description:'Two ogres are raiding the carts east of the grove. Bring company.'},
  {id:'warden',name:'The ridge warden',kind:'ogreChampion',count:1,minLevel:6,x:118,z:-126,xp:460,coins:220,description:'The old quarry’s warden has come down from the ridge. Stop it before the next wagon arrives.'},
]);
export function bountyDefinition(id){return BOUNTIES.find(b=>b.id===id);}
