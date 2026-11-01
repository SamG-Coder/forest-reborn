import {SHOP_OFFERS,shopStock,buyItem,sellStack} from '../progression/shop.js';
import {formatMoney} from '../progression/currency.js';
import {element,action,itemImage,emptyState} from './panel-components.js';

export function renderShop({body,person,progress,simulation,mode,canTrade,onTrade,message,refresh}){
  const toolbar=element(body,'div','panel-toolbar');element(toolbar,'p','',mode==='buy'?'Supplies for the road':'Sell items from your backpack');element(toolbar,'b','coin-label',formatMoney(progress.data.coins));
  const search=element(toolbar,'input','panel-search');search.type='search';search.placeholder='Find an item…';search.setAttribute('aria-label','Find a shop item');
  const grid=element(body,'div','shop-grid');
  function render(){
    grid.replaceChildren();
    const entries=mode==='buy'?SHOP_OFFERS[person.id].map(offer=>({item:progress.item(offer[0]),price:offer[1],count:shopStock(simulation.shopStock,person.id,offer)})):progress.data.bag.flatMap((stack,index)=>stack?[{item:progress.item(stack.id),price:progress.item(stack.id).value*stack.count,count:stack.count,index}]:[]);
    for(const entry of entries.filter(e=>e.item.name.toLowerCase().includes(search.value.toLowerCase()))){
      const {item,price,count,index}=entry,card=element(grid,'article','shop-card'),head=element(card,'div','item-card-heading');itemImage(head,item);
      const title=element(head);element(title,'small','eyebrow',item.type);element(title,'h3','',item.name);
      element(card,'p','muted',item.description);const footer=element(card,'div','card-footer');const info=element(footer);element(info,'b','coin-label',formatMoney(price));element(info,'small','muted',`${count} ${mode==='buy'?'in stock':'in stack'}`);
      const button=action(footer,mode==='buy'?'Buy':'Sell stack',()=>{
        if(!canTrade()){message('Move closer to trade.',3);return;}
        if(mode==='buy'){if(buyItem(progress,simulation.shopStock,person.id,item.id)){onTrade?.();message(item.name+' added to your bag.',3);}else message(progress.lastError,3);}
        else{const coins=sellStack(progress,index,simulation.stock);onTrade?.();message('Sold for '+formatMoney(coins),3);}
        simulation.save();refresh();
      });
      button.setAttribute('aria-label',(mode==='buy'?'Buy ':'Sell ')+item.name);button.dataset.tooltip=`${item.name}\n${item.description}\n${mode==='buy'?'Price':'Stack value'}: ${formatMoney(price)}`;
      button.disabled=mode==='buy'?(count<1||progress.data.coins<price):price<=0;
    }
    if(!grid.children.length)emptyState(grid,'Nothing here yet',mode==='buy'?'Try a different search.':'Gather materials or find loot, then bring it here.');
  }
  search.oninput=render;render();
}
