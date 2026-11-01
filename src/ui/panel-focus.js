const panels=new Set();
/** Character, world and camera windows share one foreground panel. */
export function registerPanel(close){panels.add(close);}
export function focusPanel(close){for(const other of panels)if(other!==close)other();}
