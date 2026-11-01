import {RECIPES,craftedBag} from '../progression/recipes.js';
import {SKILLS} from '../progression/skills.js';
import {element,action,itemImage,banner,emptyState} from './panel-components.js';

const selectedRecipes=new Map();
export function renderCrafting({body,station,progress,onCraft}){
  banner(body,{title:station.building,subtitle:station.description,art:station.art});
  const recipes=RECIPES.filter(r=>r.station===station.id),layout=element(body,'div','recipe-browser'),sidebar=element(layout,'aside','recipe-sidebar');
  const search=element(sidebar,'input','panel-search');search.type='search';search.placeholder='Find a recipe…';search.setAttribute('aria-label','Find a recipe');
  const availableLabel=element(sidebar,'label','filter-check'),available=element(availableLabel,'input');available.type='checkbox';availableLabel.append(' Have materials & level');
  const list=element(sidebar,'div','recipe-list'),detail=element(layout,'article','recipe-detail');
  let selected=recipes.find(r=>r.id===selectedRecipes.get(station.id))??recipes.find(r=>craftedBag(progress,r))??recipes[0];
  function renderDetail(){
    detail.replaceChildren();if(!selected){emptyState(detail,'No matching recipes','Try a different name or turn off the material filter.');return;}
    selectedRecipes.set(station.id,selected.id);const recipe=selected,item=progress.item(recipe.output);
    const heading=element(detail,'div','recipe-result');itemImage(heading,item,'large');const title=element(heading);element(title,'small','eyebrow','RESULT · '+recipe.count+' ITEM'+(recipe.count>1?'S':''));element(title,'h3','',item.name);
    element(detail,'p','muted',item.description);
    const stats=element(detail,'div','recipe-facts');
    for(const value of [`${SKILLS[recipe.skill].name} ${recipe.minLevel??1}`,`${recipe.duration} seconds`,`+${recipe.xp} skill XP`])element(stats,'span','stat-chip',value);
    element(detail,'h4','','Materials');const ingredients=element(detail,'div','ingredient-grid');
    for(const [id,count]of Object.entries(recipe.ingredients)){
      const owned=progress.data.bag.reduce((sum,s)=>sum+(s?.id===id?s.count:0),0),row=element(ingredients,'div','ingredient '+(owned>=count?'enough':'missing'));
      itemImage(row,progress.item(id));const copy=element(row);element(copy,'b','',progress.item(id).name);element(copy,'small','',`${owned} / ${count} available`);
    }
    const level=progress.data.skills[recipe.skill]?.level??1,canCraft=Boolean(craftedBag(progress,recipe));
    const footer=element(detail,'div','recipe-footer');
    const craft=action(footer,'Craft '+recipe.name,()=>onCraft(recipe,station),'primary-action');craft.disabled=!canCraft;
    element(footer,'small','muted',level<(recipe.minLevel??1)?`Requires ${SKILLS[recipe.skill].name} level ${recipe.minLevel}.`:!canCraft?'Bring the missing materials and leave room in your bag.':'Stay at the workbench. Moving or taking damage interrupts crafting.');
  }
  function renderList(){
    list.replaceChildren();const visible=recipes.filter(r=>r.name.toLowerCase().includes(search.value.toLowerCase())&&(!available.checked||craftedBag(progress,r)));
    if(!visible.includes(selected))selected=visible[0];
    for(const recipe of visible){
      const button=action(list,'',()=>{selected=recipe;renderList();},'recipe-choice');button.classList.toggle('active',recipe===selected);button.setAttribute('aria-label','Select '+recipe.name);
      itemImage(button,progress.item(recipe.output));const copy=element(button);element(copy,'b','',recipe.name);element(copy,'small','',`Level ${recipe.minLevel??1} · ${craftedBag(progress,recipe)?'Ready to craft':'Materials or level needed'}`);
    }
    if(!visible.length)element(list,'p','muted','No matching recipes.');renderDetail();
  }
  search.oninput=renderList;available.onchange=renderList;renderList();
}
