import {element,itemImage,meter} from './panel-components.js';
import {formatMoney} from '../progression/currency.js';

export function renderContracts({body,person,contracts,progress,player,onMap,onSpeak,refresh,message}){
  element(body,'h3','section-heading','Work together');
  element(body,'p','muted','Split a supply order or share a quest. Keeping your agreement builds trust; each person keeps their own quest rewards.');
  const respond=result=>{if(result.error){onSpeak?.(person,result.error);message(result.error,4);}else {onSpeak?.(person,result.contract.kind==='supply'?'I’ll collect my half. Meet me at the market when you have yours.':'All right. We’ll both do our part, then report back.');refresh();}};
  const active=contracts.activeFor(person.data.id);
  if(active){
    const c=active,card=element(body,'article','social-card');card.dataset.contract=c.id;
    element(card,'h3','',c.kind==='supply'?'Our supply order':c.title);
    element(card,'p','muted',`Time left: ${Math.max(0,Math.ceil((c.expiresAt-Date.now())/60000))} minutes`);
    if(c.kind==='supply'){
      for(const [side,part]of Object.entries(c.contributions)){
        const row=element(card,'div','item-card-heading');itemImage(row,progress.item(part.item));
        const copy=element(row);element(copy,'strong','',`${side==='player'?'You':person.name}: ${part.count} × ${progress.item(part.item).name}`);
        element(copy,'p','',`${part.delivered?'Delivered':'Still needed'} · Pay ${formatMoney(part.pay)}`);
      }
      element(card,'p','',`Deliver both halves to ${c.destination.name}. Payment is held until both deliveries arrive.`);
      const deliver=element(card,'button','','Deliver my half');deliver.disabled=c.contributions.player.delivered;
      deliver.onclick=()=>{if(!contracts.deliver(c,'player',player.position))message('Bring your share of the order to the marked market.',4);refresh();};
      const map=element(card,'button','','Show delivery point');map.onclick=()=>onMap({...c.destination,place:'Shared supply order'});
    }else{
      element(card,'p','',`Finish this quest together. Nearby participants who helped fight the same enemy share objective credit. Report to the quest giver for your own reward.`);
      meter(card,Number(c.helped.player)+Number(c.helped.partner),2,`Your contribution: ${c.helped.player?'recorded':'needed'} · ${person.name}: ${c.helped.partner?'recorded':'needed'}`);
    }
    const cancel=element(card,'button','','End agreement');cancel.onclick=()=>{contracts.cancel(c);message('Agreement ended. Any deposited supplies have been returned.',4);refresh();};
    const signature=JSON.stringify(c),timer=setInterval(()=>{if(!card.isConnected){clearInterval(timer);return;}if(JSON.stringify(c)!==signature){clearInterval(timer);refresh();}},1000);
    return;
  }
  const previous=contracts.agreements.filter(c=>c.partner===person.data.id).at(-1);
  if(previous)element(body,'p','agreement-result',previous.status==='completed'?'You both kept your word. Your trust has grown.':`Previous agreement ${previous.status}.`);
  const offer=contracts.supplyOffer(person),grid=element(body,'div','card-grid');
  if(offer){
    const card=element(grid,'article','social-card');itemImage(card,progress.item(offer.player.item));element(card,'h3','','Split a market order');
    element(card,'p','',`You bring ${offer.player.count} ${progress.item(offer.player.item).name.toLowerCase()}. ${person.name} brings ${offer.partner.count} ${progress.item(offer.partner.item).name.toLowerCase()}.`);
    element(card,'p','muted',`Your pay: ${formatMoney(offer.player.pay)} · Their pay: ${formatMoney(offer.partner.pay)} · 20 minutes`);
    const b=element(card,'button','','Propose supply agreement');b.onclick=()=>respond(contracts.requestSupply(person));
  }
  const quests=contracts.sharedQuests(person);
  for(const q of quests){
    const card=element(grid,'article','social-card');itemImage(card,progress.item(q.reward.item??q.reward.weapon??'sword'));element(card,'h3','',q.title);
    element(card,'p','muted','Both of you meet the requirements. Each person must contribute. 30 minutes.');
    const b=element(card,'button','','Share this quest');b.onclick=()=>respond(contracts.requestQuest(person,q.id));
  }
  if(!quests.length)element(body,'p','muted','No matching active quests yet. You both need to meet the quest requirements.');
}
