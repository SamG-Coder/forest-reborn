/** Dialogue is selected from current world state, not a permanently cached greeting. */
const pools={
  innkeeper:['There is bread left, if you have not eaten.','You can leave your pack by the bench.','Morning. What can I do for you?'],
  captain:['Keep to the road if you are travelling alone.','The watch is changing over. Have you a report?','If something is blocking the road, tell me where.'],
  trader:['Have a look. The prices are marked.','Buying, or have you brought something to sell?','Set your things on the counter. Let us see what you have.'],
  stablemaster:['Come around the front. Let them see you.','Need a horse, or a hand with the saddle?','Check the girth before you set off. They puff themselves up.'],
  smith:['Mind the sparks. What needs fixing?','Put it on the bench. I will take a look.','Let that cool before you touch it.'],
  herbalist:['The dry bundles are ready. Leave the fresh ones hanging.','What are you looking for?','A little of this goes a long way.'],
  vendor:['The carrots came in this morning.','Take a look. I still have berries.','Careful with that basket. The bottom is giving out.'],
  courier:['I have a moment. Is it about a delivery?','Do you know which house this is for?','Nearly done with this round.'],
  guard:['Keep the road clear, please.','If you need the captain, try the north gate.','We have had trouble outside the walls. Travel with someone.'],
  'highmere-lord':['Come in. What brings you to Highmere?','I can spare a moment. Speak plainly.','The steward said someone was waiting. What is your name?'],
  'highmere-steward':['Wait by the runner. I will see if he is free.','Is this about a delivery or an audience?','Please leave room for the servants to pass.'],
  'highmere-servant':['Give me a moment to put this down.','Careful. I have just cleaned that.','If you need the steward, she is by the desk.'],
  'highmere-castle-porter':['Mind the bench. It sticks out at the corner.','Let me get these out of the way.','Deliveries go through me. What have you brought?'],
  'highmere-scribe':['Please keep your hands dry around the records.','Which year are you looking for?','I can help, but I will need more than a name.'],
  'highmere-guild':['Contracts or registration?','The open contracts are on the board.','Give me your name. I will check the register.'],
  'highmere-marshal':['Have you come from the east road?','Check your straps before you go out.','If you are joining the line, find a company first.'],
  'highmere-smith':['Show me the damage.','A split ring is easy to fix if you catch it early.','Leave it here. I will see what can be saved.'],
  'highmere-cook':['There is stew left. Are you hungry?','Let me find you a clean bowl.','The next patrol is due. You picked a good time.'],
  patron:['You can take that chair.','I am resting my feet before I set off again.','Have you been on the north road lately?'],
  hunt:['I am looking for a few more before I head back.','I am hunting nearby. Watch the trees.','I will stop when I have enough for the job.'],
  gather:['I am collecting supplies. Still need a few more.','There should be more growing further along.','Give me a moment to finish here.'],
  sell:['I am taking these supplies to Orin.','I need to clear some room in my bag.','If Orin will buy this lot, I can get moving again.'],
  rest:['My feet need a break.','I am staying here a little longer.','I will head out again once I have rested.'],
  tavern:['I could use something hot to eat.','I am stopping at the Wayward Oak.','A meal first. Then I will decide where to go.'],
  train:['Still working on my footing.','I am trying to get this movement right.','One more try. I nearly had it.'],
  buyTool:['I need an axe before I can get started.','I am looking for a tool I can afford.','Orin should have what I need.'],
  explore:['I am seeing where this road goes.','I have not been this way before.','No job this time. Just looking around.'],
  companion:['I am with you. Which way?','Ready when you are.','We can stop if you need a rest.'],
  generic:['Hello. Did you need something?','I have a moment.','Morning. How can I help?'],
};
const arrival=['Sit down a moment. You were in a bad way when we found you.','Start with something simple. There is work here if you need it.','You said you cannot remember the road here. Anything come back to you?'];
const letter=['You have Alden’s letter. Come in. Tell me what happened.','Alden told me to expect you. What do you remember of that other place?','The traveller from Mosswake. I have been waiting to hear your account.'];
export function dialoguePool(person,progress){
  if(person.id==='innkeeper'&&!progress.data.quests.errand?.completed)return {key:'arrival',lines:arrival};
  if(person.id==='highmere-lord'&&progress.data.quests['north-road']?.active)return {key:'letter',lines:letter};
  const task=person.companion?'companion':person.type==='adventurer'?(person.data?.task??'rest'):person.id;
  const key=pools[task]?task:pools[person.type]?person.type:'generic';return {key,lines:pools[key]};
}

export class DialogueDirector {
  constructor(progress){this.progress=progress;this.speakers=new Map();this.lines=new Map();this.nextAmbient=0;}
  select(person,{channel='greeting',now=Date.now()}={}){
    const {key,lines}=dialoguePool(person,this.progress),id=person.id,state=this.speakers.get(id)??{index:-1,next:0,key:null,text:null};
    const wait=now<state.next||(channel==='ambient'&&now<this.nextAmbient);
    if(wait&&state.key===key)return channel==='ambient'?null:{text:state.text,speak:false};
    if(channel==='ambient'&&wait)return null;
    let selected=-1;
    for(let i=1;i<=lines.length;i++){const at=(state.index+i)%lines.length;if((this.lines.get(id+'|'+lines[at])??0)<=now){selected=at;break;}}
    if(selected<0)return channel==='ambient'?null:{text:state.key===key?state.text:lines[0],speak:false};
    const text=lines[selected];this.lines.set(id+'|'+text,now+180000);
    this.speakers.set(id,{index:selected,key,text,next:now+(channel==='ambient'?90000:12000)});
    if(channel==='ambient')this.nextAmbient=now+24000;
    return {text,speak:true};
  }
}
