const panels=new Map();
/** The backpack remains available beside equipment, traders, and loot. */
export function registerPanel(close,{persistent=false}={}){panels.set(close,{persistent});}
export function focusPanel(close){for(const [other,options] of panels)if(other!==close&&!options.persistent)other();}
