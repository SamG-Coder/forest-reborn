export const CHAPTERS=Object.freeze([
  {title:'A bed and a borrowed blade',levels:'1–2',until:'errand',text:'Tomas needs his flour from Orin’s market stall. Start there; the sword is payment for work.'},
  {title:'Earn your place',levels:'2–3',until:'supper',text:'Help with the south meadow, learn to gather and make your first supplies. The sheep pasture and the weaver’s house offer a quieter way to earn money.'},
  {title:'The roads around Mosswake',levels:'3–4',until:'cargo',text:'Alden needs Briar grove cleared. Orin’s missing wagon leads to the bandit camps. Turn gathered materials into better equipment.'},
  {title:'Someone to carry you',levels:'3–5',until:'saddle-earned',text:'Report to Alden after helping Orin. The watch will pay for your first horse at Nell’s stables.'},
  {title:'The road to Highmere',levels:'3–6',until:'north-road',text:'Take Alden’s letter from Nell. Ride north to Highmere, leave your horse outside the keep and find Lord Edric in the great hall.'},
  {title:'You are not the first',levels:'4–7',until:'unlisted-arrival',text:'Edric knows of another arrival. Ask Corin to show you the old account at Records & Charts.'},
  {title:'A name in Highmere',levels:'7–10',until:'ash-company',text:'Train, craft and find companions before joining Captain Elian on the east road. The quarry and guild bounties offer work while you prepare.'},
  {title:'Older than the walls',levels:'10–13',until:'giant-carvings',text:'The Ash Company has brought giants to the field. Their carvings may explain why arrivals are missing from the gate books.'},
]);
export function currentChapter(progress){return CHAPTERS.find(c=>!progress.data.quests[c.until]?.completed)??{title:'A place in Mosswake',levels:'6+',text:'The road is open. Train your trades, help your guild and answer the next call from the watch.'};}
