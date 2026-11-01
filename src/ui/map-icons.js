export const MONSTER_ICONS=Object.freeze({
  rabbit:{label:'Rabbits',color:'#ede1bd'},goblin:{label:'Goblins',color:'#a0cf77'},bandit:{label:'Bandits',color:'#e9a06b'},
  ogre:{label:'Ogres',color:'#d18986'},ogreChampion:{label:'Ogre champion',color:'#df8188'},fieldRaider:{label:'Raiders',color:'#e9a06b'},shieldbreaker:{label:'Shieldbreakers',color:'#df8188'},
});
export function drawMonsterIcon(ctx,x,y,kind,size=9){
  const spec=MONSTER_ICONS[kind]??MONSTER_ICONS.bandit;
  ctx.save();ctx.translate(x,y);ctx.scale(size/9,size/9);
  ctx.fillStyle='#172d2c';ctx.strokeStyle=spec.color;ctx.lineWidth=1.2;
  ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=spec.color;
  if(kind==='rabbit'){
    for(const s of [-1,1]){ctx.beginPath();ctx.ellipse(s*2,-3.3,1.45,4.2,s*.16,0,Math.PI*2);ctx.fill();}
    ctx.beginPath();ctx.ellipse(0,2.6,4.1,3.5,0,0,Math.PI*2);ctx.fill();
  }else if(kind==='goblin'){
    ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(-4,3);ctx.lineTo(0,6);ctx.lineTo(4,3);ctx.lineTo(7,-4);ctx.lineTo(3,-2);ctx.quadraticCurveTo(0,-6,-3,-2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#203426';ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(-1,1);ctx.moveTo(3,0);ctx.lineTo(1,1);ctx.stroke();
  }else if(kind==='bandit'||kind==='fieldRaider'){
    ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(5,5);ctx.moveTo(5,-5);ctx.lineTo(-5,5);ctx.moveTo(-6,2);ctx.lineTo(-2,6);ctx.moveTo(2,6);ctx.lineTo(6,2);ctx.stroke();
  }else{
    ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(-7,-5);ctx.lineTo(-3,-3);ctx.quadraticCurveTo(0,-5,3,-3);ctx.lineTo(7,-5);ctx.lineTo(6,0);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#172d2c';ctx.fillRect(-3,-1,2,2);ctx.fillRect(1,-1,2,2);
  }
  ctx.restore();
}
