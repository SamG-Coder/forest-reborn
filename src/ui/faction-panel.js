import {element,action,banner,meter,tabs,itemImage,emptyState} from './panel-components.js';
import {focusPanel,registerPanel} from './panel-focus.js';
import {FACTIONS,VENDORS,attitude,standing} from '../factions/catalog.js';
import {formatMoney} from '../progression/currency.js';
import {RESOURCE_VALUES} from '../factions/economy.js';
import {publicUrl} from '../assets/public-url.js';
import './factions.css';

export function renderJobs(parent,{factions,progress,person,player,message,refresh,population}){
  const orders=person?factions.jobs.forPerson(person):factions.jobs.orders.filter(j=>j.status==='active');
  if(!orders.length){emptyState(parent,'No outstanding orders','Speak to townspeople or camp quartermasters. Their shortages become jobs.');return;}
  const grid=element(parent,'div','card-grid');
  for(const order of orders){
    const card=element(grid,'article','quest-card'),item=progress.item(order.item),head=element(card,'div','item-card-heading');itemImage(head,item);
    const copy=element(head);element(copy,'small','eyebrow',FACTIONS[order.faction].name+' · '+order.status);element(copy,'h3','',`${item.name} × ${order.count}`);
    element(card,'p','',`${order.name} needs supplies for the next shift. Deliver ${order.count} ${item.name.toLowerCase()}.`);
    element(card,'strong','coin-label',formatMoney(order.pay));element(card,'p','muted',`${Math.max(0,Math.ceil((order.expiresAt-Date.now())/60000))} minutes left · ${order.name}`);
    const perform=()=>{
      const npc=person??population?.residents.find(p=>p.id===order.giver);
      if(!npc||npc.position.distanceTo(player.position)>3){message('Deliver this order to '+order.name+'.',3);return;}
      const ok=order.status==='available'?factions.jobs.accept(order.id,progress):factions.jobs.complete(order.id,progress);
      message(ok?'Order updated.':order.status==='available'?'They cannot offer you that order.':'Bring the full order before handing it in.',3);
      population?.simulation.save();progress.save();refresh();
    };
    action(card,order.status==='available'?'Accept order':'Deliver supplies',perform,'primary-action');
  }
}
export function createFactionPanel({factions,progress,population,player,message}){
  const panel=element(document.querySelector('#hud'),'section','world-panel faction-panel');panel.hidden=true;
  const close=()=>{const open=!panel.hidden;panel.hidden=true;return open;};registerPanel(close);action(panel,'×',close,'panel-close');
  element(panel,'h2','','Factions & the world');const body=element(panel,'div','panel-body');let section='factions';
  const open=()=>{focusPanel(close);panel.hidden=false;render();};action(document.querySelector('#hud .top-actions'),'Factions',()=>panel.hidden?open():close());
  function render(){
    body.replaceChildren();tabs(body,[['factions','Factions'],['jobs','Jobs'],['markets','Markets'],['war','War report']],section,id=>{section=id;render();});
    if(section==='factions'){
      banner(body,{title:'Everyone is building something',subtitle:'Camp supplies fund training. Your work and your fights affect who will deal with you.',item:progress.item('sword')});
      const grid=element(body,'div','faction-grid');
      for(const [id,spec]of Object.entries(FACTIONS)){
        const card=element(grid,'article','quest-card faction-card'),rep=standing(progress.data.reputation,id),market=factions.economy.markets[id];card.style.setProperty('--faction-color',spec.color);
        element(card,'small','eyebrow',attitude(rep)+` · ${rep} standing`);element(card,'h3','',spec.name);element(card,'p','',spec.goal);meter(card,rep+100,200,'Your standing');
        element(card,'strong','faction-goal',factions.goal(id));
        for(const need of factions.economy.needs(id).slice(0,2)){const row=element(card,'div','need-row');itemImage(row,progress.item(need.item));element(row,'span','',`${progress.item(need.item).name}: ${Math.floor(market.stock[need.item])} / ${factions.economy.target(id,need.item)}`);}
        element(card,'small','muted',`Training ${market.training.toFixed(1)} / 100 · Enemies: ${spec.enemies.map(e=>FACTIONS[e].name).join(', ')||'none'}`);
      }
    }else if(section==='jobs')renderJobs(body,{factions,progress,player,message,refresh:render,population});
    else if(section==='markets'){
      element(body,'p','muted','Current offers. A workshop pays more for what it uses; a shortage raises prices. Delivery changes the next quote.');
      const grid=element(body,'div','market-grid');
      for(const item of ['wood','iron','herbs','linen','coal','bread','wool']){
        const card=element(grid,'article','quest-card'),head=element(card,'div','item-card-heading');itemImage(head,progress.item(item));element(head,'h3','',progress.item(item).name);
        for(const id of ['trader','smith','herbalist','briar-envoy']){const row=element(card,'div','market-quote');element(row,'span','',VENDORS[id].name);element(row,'strong','coin-label',formatMoney(factions.economy.quote(id,item,RESOURCE_VALUES[item],'sell')));}
      }
    }else{
      banner(body,{title:'The east-field companies',subtitle:'500 Highmere fighters face 500 from the Ash Company. Supplies improve training; casualties weaken the side that loses.',item:progress.item('sword')});
      const link=element(body,'a','primary-action','Open 500 vs 500 battle test ↗');link.href=publicUrl('battle.html');link.target='_blank';link.rel='noopener';
      for(const p of factions.parties)element(body,'p','',`${p.goal}: ${p.members.map(id=>population.simulation.actors[id]?.name).join(', ')}`);
      const feed=element(body,'div','notice-feed');for(const e of factions.events.slice(-12).reverse())element(feed,'p','',e.text);
      if(!factions.events.length)element(feed,'p','muted','World changes and field reports will appear here.');
    }
  }
  return {show:open,close,render};
}
