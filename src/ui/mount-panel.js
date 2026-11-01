import {MOUNTS,purchaseMount} from '../mounts/catalog.js';
import {publicUrl} from '../assets/public-url.js';
import {formatMoney} from '../progression/currency.js';
import {element,action} from './panel-components.js';

export function renderMountShop({body,progress,mounts,person,player,message,refresh}){
  const details=element(body,'details','mount-shop');const summary=element(details,'summary','','Horses & saddles');summary.dataset.tooltip='Buy a horse or choose which owned horse to call with H.';
  element(details,'p','muted',`Your purse: ${formatMoney(progress.data.coins)}. Every horse includes a saddle. H to mount outside; Shift to canter.`);
  const cards=element(details,'div','mount-cards');
  for(const mount of MOUNTS){
    const owned=progress.data.mounts.includes(mount.id),card=element(cards,'article','mount-card');
    const image=element(card,'img','mount-portrait');image.src=publicUrl(`/assets/mounts/${mount.id}.png`);image.alt=mount.name+' saddled horse';image.onerror=()=>{image.hidden=true;};
    element(card,'h3','',mount.name);element(card,'p','',mount.description);element(card,'b','',owned?'Owned':formatMoney(mount.price));
    const button=action(card,owned?(progress.data.activeMount===mount.id?'Selected':'Select horse'):'Buy horse',()=>{
      if(person.position.distanceTo(player.position)>=3){message('Move closer to Nell.',3);return;}
      if(owned){if(mounts.mounted){message('Dismount first.',2);return;}progress.data.activeMount=mount.id;progress.save();}
      else if(!purchaseMount(progress,mount.id)){message(progress.lastError,3);return;}
      else message(`${mount.name} is yours. Stand outside and press H to ride.`,5);
      refresh();
    },'primary-action');button.disabled=owned&&progress.data.activeMount===mount.id||!owned&&progress.data.coins<mount.price;
  }
}
