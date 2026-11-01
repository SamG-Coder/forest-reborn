export class GameInput {
  constructor(canvas){
    this.canvas=canvas;this.keys=new Set();this.buttons=new Map();this.lookX=0;this.lookY=0;this.zoom=0;this.attacks=[];this.selections=[];this.jumps=0;this.enabled=false;this.drag=false;this.chord=false;this.autoRun=false;
    window.addEventListener('keydown',e=>{
      if(!this.enabled||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable)return;
      if(['NumLock','Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      this.keys.add(e.code);if(e.repeat)return;
      if(e.code==='NumLock')this.autoRun=!this.autoRun;
      else if(['KeyW','KeyS','Escape'].includes(e.code))this.autoRun=false;
      if(e.code==='KeyJ'||e.code==='Digit1')this.attacks.push('attack');if(e.code==='Space')this.jumps++;
    });
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);});
    // mousedown fires for a second held button; pointerdown does not.
    canvas.addEventListener('mousedown',e=>{
      if(!this.enabled||e.button>2)return;e.preventDefault();
      this.buttons.set(e.button,{x:e.clientX,y:e.clientY,moved:false});
      this.lastX=e.clientX;this.lastY=e.clientY;
      if(this.buttons.has(0)&&this.buttons.has(2))this.chord=true;
    });
    window.addEventListener('mousemove',e=>{
      if(!this.enabled||!this.buttons.size)return;
      const dx=e.clientX-this.lastX,dy=e.clientY-this.lastY;this.lastX=e.clientX;this.lastY=e.clientY;
      for(const down of this.buttons.values())if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)down.moved=true;
      this.drag=[...this.buttons.values()].some(down=>down.moved);
      if(this.drag){this.lookX+=dx;this.lookY+=dy;canvas.style.cursor='grabbing';}
    });
    window.addEventListener('mouseup',e=>{
      const down=this.buttons.get(e.button);if(!down)return;
      if(this.enabled&&!down.moved&&!this.chord&&(e.button===0||e.button===2)&&e.target===canvas)this.selections.push({x:e.clientX,y:e.clientY,button:e.button});
      this.buttons.delete(e.button);
      if(!this.buttons.size){this.drag=false;this.chord=false;canvas.style.cursor='';}
    });
    canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(this.enabled){e.preventDefault();this.zoom+=e.deltaY;}},{passive:false});
    window.addEventListener('blur',()=>this.clear());canvas.addEventListener('pointercancel',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
  clear(){this.keys.clear();this.buttons.clear();this.attacks.length=0;this.selections.length=0;this.jumps=0;this.drag=false;this.chord=false;this.autoRun=false;this.lookX=this.lookY=this.zoom=0;this.canvas.style.cursor='';}
  get steering(){return this.buttons.has(2);}
  get freeLooking(){return !this.steering&&(this.buttons.has(0)||this.buttons.has(1));}
  get mouseForward(){return this.buttons.has(0)&&this.buttons.has(2);}
  get turn(){return this.steering?0:Number(this.keys.has('KeyA'))-Number(this.keys.has('KeyD'));}
  get movement(){return {x:Number(this.keys.has('KeyE'))-Number(this.keys.has('KeyQ'))+(this.steering?Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')):0),z:Number(this.autoRun||this.mouseForward||this.keys.has('KeyW'))-Number(this.keys.has('KeyS'))};}
  get running(){return this.autoRun||this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');}
}
