/** Flat-ground jump with an anticipation push and independent upper-body actions. */
export function updateJump(player,dt,requested=false,groundHeight=0){
  player.verticalSpeed??=0;player.grounded??=true;player.takeoffTime??=0;
  player.jumpBuffer=requested?.14:Math.max(0,(player.jumpBuffer??0)-dt);
  let landed=false;
  if(player.grounded&&player.jumpBuffer>0&&!player.takeoffTime){player.takeoffTime=.10;player.jumpBuffer=0;}
  player.takeoffWeight=0;
  if(player.takeoffTime>0){
    player.takeoffTime=Math.max(0,player.takeoffTime-dt);
    player.takeoffWeight=1-player.takeoffTime/.10;
    if(player.takeoffTime===0){player.verticalSpeed=4.7;player.grounded=false;player.takeoffWeight=0;}
  }
  if(!player.grounded){
    player.position.y+=player.verticalSpeed*dt-.5*13.5*dt*dt;
    player.verticalSpeed-=13.5*dt;
    if(player.position.y<=groundHeight){player.landingSpeed=Math.abs(player.verticalSpeed);player.position.y=groundHeight;player.verticalSpeed=0;player.grounded=true;landed=true;}
  }
  return landed;
}
