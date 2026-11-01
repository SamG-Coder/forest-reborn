import {loft,ellipsoid,box} from '../geometry.js';

export function buildSword(add,m){
 add('grip',loft([[1.14,.035,.035,-.56,.09],[1.43,.035,.035,-.56,.09]],8),m.leather,'handR');
 add('pommel',ellipsoid(-.56,1.12,.09,.05,.06,.05),m.gold,'handR');
 add('guard',box(-.56,1.46,.09,.34,.045,.065),m.gold,'handR');
 add('blade',loft([[1.48,.07,.018,-.56,.09],[2.24,.055,.014,-.56,.09],[2.45,.001,.001,-.56,.09]],4,Math.PI/4),m.steel,'handR');
}
