import {MapView,bindMapInput} from './map-view.js';
import {TerrainMap} from './terrain-map.js';
import {MONSTER_ICONS,drawMonsterIcon} from './map-icons.js';
import {ROAD_PATHS,TOWN_PLOTS} from '../world/layout.js';
import {HIGHMERE,HIGHMERE_WALL,HIGHMERE_ROADS,HIGHMERE_PLOTS,KEEP_FOOTPRINTS} from '../world/region-layout.js';
import {LANDMARKS} from '../world/terrain.js';
import {questLocations,drawQuestMarker,questMarkerLabel} from '../progression/quest-markers.js';

const terrain=new TerrainMap();
const roads=[...ROAD_PATHS,...HIGHMERE_ROADS],plots=[...TOWN_PLOTS,...HIGHMERE_PLOTS];

export function createInteractiveMap({container,player,population,progress,workstations,compact=false}){
  const size=compact?224:560,view=new MapView({x:player.position.x,z:player.position.z,range:compact?110:170,minRange:compact?22:30,size});
  const frame=document.createElement('div');frame.className='interactive-map'+(compact?' compact':'');
  const canvas=document.createElement('canvas');canvas.className=compact?'minimap':'world-map';canvas.width=canvas.height=size*2;canvas.tabIndex=0;
  const ctx=canvas.getContext('2d');
  const bar=document.createElement('div');bar.className='map-controls';
  const recenter=document.createElement('button');recenter.type='button';recenter.textContent='Centre on me';recenter.title='Follow your character again';
  const scaleLabel=document.createElement('span');scaleLabel.className='map-scale';bar.append(scaleLabel,recenter);
  const tip=document.createElement('div');tip.className='map-hover';tip.hidden=true;
  const hint=document.createElement('small');hint.className='map-hint';hint.textContent='Scroll to zoom · Drag to explore';
  frame.append(canvas,tip,bar,hint);container.append(frame);
  const legend=document.createElement('div');legend.className='map-legend';
  for(const kind of ['rabbit','goblin','bandit','ogre']){const entry=document.createElement('span'),icon=document.createElement('canvas');icon.width=40;icon.height=40;const c=icon.getContext('2d');c.scale(2,2);drawMonsterIcon(c,10,10,kind,8);entry.append(icon,MONSTER_ICONS[kind].label);legend.append(entry);}
  const quests=document.createElement('span');quests.className='quest-map-key';quests.textContent='! Quest  ·  ? Turn in';legend.append(quests);container.append(legend);
  let hits=[],lastTime=-1,disposed=false,destination=null;
  const visible=p=>p.x>-20&&p.y>-20&&p.x<size+20&&p.y<size+20;
  const dot=(p,color,r=2)=>{ctx.fillStyle=color;ctx.strokeStyle='#1e322d';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();};
  function draw(){
    if(disposed)return;view.follow(player.position);ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,size,size);hits=[];
    terrain.draw(ctx,view);const scale=size/(2*view.range);
    for(const road of roads){ctx.strokeStyle='#d4c69c';ctx.lineWidth=Math.max(.8,road.width*scale);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();road.points.forEach(([x,z],i)=>{const p=view.project(x,z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.stroke();}
    for(const plot of plots){const p=view.project(plot.x,plot.z);if(!visible(p))continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-(plot.angle??0));ctx.fillStyle='#5a4e41';ctx.fillRect(-plot.w*scale/2+1,-plot.d*scale/2+1,plot.w*scale,plot.d*scale);ctx.fillStyle=plot.wall==='brick'?'#bb8670':'#c4b798';ctx.strokeStyle='#354139';ctx.lineWidth=.7;ctx.fillRect(-plot.w*scale/2,-plot.d*scale/2,plot.w*scale,plot.d*scale);ctx.strokeRect(-plot.w*scale/2,-plot.d*scale/2,plot.w*scale,plot.d*scale);ctx.restore();}
    ctx.strokeStyle='#d6d2b8';ctx.lineWidth=Math.max(1.3,1.9*scale);ctx.beginPath();HIGHMERE_WALL.forEach(([x,z],i)=>{const p=view.project(x+HIGHMERE.x,z+HIGHMERE.z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.stroke();
    for(const keep of KEEP_FOOTPRINTS){const p=view.project(HIGHMERE.x+keep.x,HIGHMERE.z+keep.z);if(!visible(p))continue;ctx.fillStyle='#b9b8a7';ctx.strokeStyle='#394947';ctx.lineWidth=1;ctx.beginPath();if(keep.r)ctx.arc(p.x,p.y,keep.r*scale,0,Math.PI*2);else ctx.rect(p.x-keep.w*scale/2,p.y-keep.d*scale/2,keep.w*scale,keep.d*scale);ctx.fill();ctx.stroke();hits.push({...p,label:'Highmere keep · Great hall'});}
    {const p=view.project(800,-829);if(visible(p)){dot(p,'#97ab5d',Math.max(2,8*scale));hits.push({...p,label:'The old oak'});}}
    if(!compact||view.range>180){ctx.font='600 12px Manrope, sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';for(const mark of LANDMARKS){const p=view.project(mark.x,mark.z);if(!visible(p))continue;if(view.range>500&&!['town','highmere','highmere-field','ridge'].includes(mark.id))continue;ctx.strokeStyle='#20372cea';ctx.lineWidth=3;ctx.strokeText(mark.name,p.x,p.y-13);ctx.fillStyle='#f2ead2';ctx.fillText(mark.name,p.x,p.y-13);}}
    for(const person of population.residents){if(person.target.hp<=0)continue;const p=view.project(person.position.x,person.position.z);if(!visible(p))continue;dot(p,person.type==='adventurer'?'#9fd8f4':'#d2e9a8',compact?2:2.8);hits.push({...p,label:person.name+' · '+person.role});}
    // Cluster close units by species, preserving a readable, distinct silhouette for each type.
    const clusters=new Map(),cell=compact?24:27;
    for(const target of population.targets){if(target.hp<=0)continue;const p=view.project(target.position.x,target.position.z);if(!visible(p))continue;const key=`${target.kind}:${Math.floor(p.x/cell)}:${Math.floor(p.y/cell)}`;const cluster=clusters.get(key);if(cluster){cluster.x+=p.x;cluster.y+=p.y;cluster.count++;}else clusters.set(key,{x:p.x,y:p.y,count:1,kind:target.kind,name:target.name,level:target.level});}
    for(const c of clusters.values()){const x=c.x/c.count,y=c.y/c.count;drawMonsterIcon(ctx,x,y,c.kind,compact?8:10);if(c.count>1){ctx.font='bold 9px sans-serif';ctx.textAlign='left';ctx.strokeStyle='#172e29';ctx.lineWidth=3;ctx.strokeText(String(c.count),x+6,y+9);ctx.fillStyle='#fff1cc';ctx.fillText(String(c.count),x+6,y+9);}hits.push({x,y,label:`${c.name} · Level ${c.level}${c.count>1?' · '+c.count+' nearby':''}`});}
    for(const station of workstations?.stations??[]){const p=view.project(station.x??station.position?.x??station.root?.position.x,station.z??station.position?.z??station.root?.position.z);if(!visible(p))continue;ctx.fillStyle='#97d1df';ctx.strokeStyle='#21464c';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(p.x,p.y-4);ctx.lineTo(p.x+4,p.y);ctx.lineTo(p.x,p.y+4);ctx.lineTo(p.x-4,p.y);ctx.closePath();ctx.fill();ctx.stroke();hits.push({...p,label:station.name??station.building});}
    const event=population.simulation.society.event;if(event){const p=view.project(event.x,event.z);if(visible(p)){dot(p,'#f2b76d',6);hits.push({...p,label:event.title});}}
    const markers=questLocations(population.residents,progress).filter(marker=>visible(view.project(marker.x,marker.z)));
    for(const marker of markers){const p=view.project(marker.x,marker.z);drawQuestMarker(ctx,p.x,p.y-8,marker.symbol,compact?18:22);hits.push({x:p.x,y:p.y-8,label:questMarkerLabel(marker)});}
    if(destination){const p=view.project(destination.x,destination.z);if(visible(p)){dot(p,'#ffe08c',8);ctx.strokeStyle='#ffdb8c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);ctx.stroke();hits.push({...p,label:destination.name+' · '+destination.place});}}
    const own=view.project(player.position.x,player.position.z);
    if(visible(own)){ctx.save();ctx.translate(own.x,own.y);ctx.rotate(-player.yaw);ctx.fillStyle='#fff2bd';ctx.strokeStyle='#223e3a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(-6,-6);ctx.lineTo(0,-3);ctx.lineTo(6,-6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
    ctx.textAlign='left';ctx.font='bold 12px Manrope, sans-serif';ctx.fillStyle='#f7ebc7';ctx.strokeStyle='#263f36';ctx.lineWidth=3;ctx.strokeText('N ↑',compact?18:16,compact?28:24);ctx.fillText('N ↑',compact?18:16,compact?28:24);
    const span=2*view.range;scaleLabel.textContent=`${span>=1000?(span/1000).toFixed(1)+' km':Math.round(span)+' m'} across`;
    recenter.disabled=view.following;frame.dataset.following=String(view.following);canvas.dataset.range=view.range.toFixed(3);canvas.dataset.center=`${view.x.toFixed(3)},${view.z.toFixed(3)}`;
    canvas.setAttribute('aria-label',`${compact?'Minimap':'World map'}. Terrain, roads, buildings, monsters and quests. ${scaleLabel.textContent}. Scroll to zoom. Drag to pan. ${markers.map(questMarkerLabel).join('. ')}`);
  }
  const unbind=bindMapInput(canvas,view,draw);
  recenter.onclick=()=>{view.recenter(player.position);draw();};
  canvas.addEventListener('pointermove',e=>{if(e.buttons){tip.hidden=true;return;}const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*size/r.width,y=(e.clientY-r.top)*size/r.height;const hit=hits.findLast(h=>Math.hypot(h.x-x,h.y-y)<13);tip.hidden=!hit;if(hit)tip.textContent=hit.label;});
  canvas.addEventListener('pointerleave',()=>tip.hidden=true);
  draw();
  return {view,canvas,draw,setDestination(point){destination=point;view.following=false;view.x=point.x;view.z=point.z;view.range=100;draw();},update(time){if(time-lastTime>=.2){lastTime=time;draw();}},dispose(){disposed=true;unbind();frame.remove();legend.remove();}};
}
