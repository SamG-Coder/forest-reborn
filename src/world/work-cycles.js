const stop=(x,z,seconds,action,label,face=Math.PI)=>({x,z,seconds,action,label,face});
export const HIGHMERE_WORK_CYCLES=Object.freeze({
  'highmere-smith':[stop(818,-805,22,'hammer','Shaping a field repair'),stop(820,-804,7,'carry','Collecting cooled metal'),stop(818,-805,8,'read','Checking the finished repair')],
  'highmere-tailor':[stop(885.6,-852,24,'sew','Mending a travelling coat'),stop(879,-849.5,8,'sort','Choosing cloth from the delivery'),stop(884,-850.5,5,'carry','Taking cloth to the sewing table')],
  'highmere-cook':[stop(883,-805,20,'cook','Stirring the midday pot'),stop(886,-802,8,'wipe','Cleaning the serving table'),stop(886,-800,7,'sort','Setting out fresh bowls')],
  'highmere-porter':[stop(882,-778.5,7,'carry','Collecting a delivery'),stop(813,-778,9,'sort','Unloading the exchange stores'),stop(869,-783.3,8,'trade','Checking the quartermaster’s order')],
  'highmere-gardener':[stop(798,-818,18,'gather','Weeding the street garden'),stop(799,-812,14,'gather','Tending the young plants'),stop(802,-810,8,'rest','Taking a breather')],
  'highmere-fletcher':[stop(810,-844.4,24,'saw','Shaping ash arrow shafts'),stop(811,-844.4,15,'sew','Binding feathers to the shafts'),stop(813,-844,7,'sort','Packing arrows for the watch')],
});
