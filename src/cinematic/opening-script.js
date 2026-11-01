import {ShotTrack} from './shot-track.js';

export const OPENING_DURATION = 74;
export const WAKE_TIME = 27;
export const WAKE_POSITION = Object.freeze([-3, 0, 7]);
export const openingTrack = new ShotTrack([
  {id:'last-bus',scene:'street',start:0,end:5,from:[-4.4,5.7,16],to:[-3.3,4.3,13],look:[1.2,1.2,1.5],lookTo:[1.2,1.2,2.5],fov:54},
  {id:'walk-home',scene:'street',start:5,end:12,from:[5.1,1.6,7.2],to:[5.1,1.6,1.6],look:[6.8,1.22,10.1],lookTo:[6.8,1.22,4.5],fov:39,ease:'linear'},
  {id:'phone',scene:'street',start:12,end:17,from:[6.32,1.74,5.0],to:[6.32,1.74,1.0],look:[6.64,1.24,4.17],lookTo:[6.64,1.24,.17],fov:35,ease:'linear'},
  {id:'crossing',scene:'street',start:17,end:21,from:[-4,2.3,4.5],to:[-3.5,2,4],look:[2,1.1,-.2],lookTo:[.5,1.2,-.7],fov:47},
  {id:'headlights',scene:'street',start:21,end:23.3,from:[-2.3,1.6,3],to:[-1.9,1.5,2.8],look:[.8,1.2,-.6],lookTo:[1.05,1.2,-.5],fov:43},
  {id:'black',scene:'street',start:23.3,end:27,from:[0,1,0],look:[0,1,1],fov:43},
  {id:'wake',scene:'town',start:27,end:34,from:[.4,1.5,2.5],to:[.75,1.3,2.35],look:[0,.85,0],lookTo:[0,.9,0],fov:44},
  {id:'stand',scene:'town',start:34,end:38,from:[1.6,1.8,3.4],to:[2.3,2.2,4.2],look:[0,1,0],lookTo:[0,1.15,0],fov:44},
  {id:'tomas-introduction',scene:'town',start:38,end:42,from:[.85,1.73,1.30],to:[.80,1.73,1.28],look:[-1.35,1.52,1.15],fov:37},
  {id:'player-phone',scene:'town',start:42,end:47,from:[-1.8,1.75,2.8],look:[0,1.5,0],fov:34},
  {id:'tomas-well',scene:'town',start:47,end:53,from:[.85,1.73,1.30],look:[-1.35,1.5,1.15],fov:37},
  {id:'player-confused',scene:'town',start:53,end:57,from:[-1.8,1.75,2.8],look:[0,1.5,0],fov:34},
  {id:'tomas-invitation',scene:'town',start:57,end:65,from:[.80,1.73,1.28],to:[.75,1.73,1.25],look:[-1.35,1.5,1.15],fov:38},
  {id:'player-thanks',scene:'town',start:65,end:68,from:[-1.8,1.75,2.8],look:[0,1.5,0],fov:34},
  {id:'mosswake',scene:'town',start:68,end:74,from:[2.3,2.2,4.2],to:[6,4,8.5],look:[-.5,1.15,.4],lookTo:[-2,1,-4],fov:44,fovTo:51},
]);

export const OPENING_LINES = Object.freeze([
  {id:'long-way',start:6,end:10,person:'player',text:'Great. The long way home.'},
  {id:'wait',start:20.8,end:23.3,person:'player',text:'Wait!'},
  {id:'easy',start:28,end:32,person:'innkeeper',text:'Hey. Easy now. Can you hear me?'},
  {id:'where',start:32.2,end:35.5,person:'player',text:'Where am I?'},
  {id:'tomas',start:36,end:41.5,person:'innkeeper',text:'Mosswake. I am Tomas. You gave us a bit of a fright.'},
  {id:'phone',start:42,end:46.5,person:'player',text:'My phone. There was a car. I was crossing the road.'},
  {id:'well',start:47,end:52.5,person:'innkeeper',text:'I found you by the well. No cart, no horse. Just you.'},
  {id:'sense',start:53,end:56.5,person:'player',text:'That does not make any sense.'},
  {id:'bread',start:57,end:64.5,person:'innkeeper',text:'Come sit down. There is bread at the inn. We can work out the rest after you have eaten.'},
  {id:'thanks',start:65,end:67.5,person:'player',text:'Yeah. Thank you.'},
]);

export function openingCaption(time, name) {
  if(time<4.8)return {speaker:'FRIDAY · 11:47 PM',text:'One more shift. One missed bus.'};
  const line=OPENING_LINES.find(line=>time>=line.start&&time<line.end);
  return line?{...line,speaker:line.person==='player'?name:'TOMAS'}:null;
}

