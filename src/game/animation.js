import * as THREE from 'three';
import { solveTwoBone, alignElbowHinge } from './constraints.js';
import { locomotionArm, swordArm, applyArmFK } from './arm-motion.js';
import { poseHand, alignPunchWrist } from './hand-poses.js';
import { alignSwordAction, alignSwordReady } from './sword-alignment.js';
import { GAITS, blendGaits } from './locomotion.js';
import {sampleSwordCut} from './sword-motion.js';

const { clamp, lerp, smoothstep, damp } = THREE.MathUtils;
const vector = (x, y, z) => new THREE.Vector3(x, y, z);
const IDENTITY = new THREE.Quaternion();

/** Layered pose controller: body motion, then exact limb constraints, then grips. */
export class CharacterAnimator {
  constructor(avatar) {
    this.avatar = avatar;
    this.phase = 0; this.time = 0; this.motion = 0; this.idleTime = 0;
    this.baseHip = avatar.rig.bones.hips.position.y;
    this.lastFoot = 0; this.events = [];
    this.hands = { L: vector(.25, .83, .03), R: vector(-.32, 1.10, .20) };
    this.recoil = 0;this.airWeight=0;this.landing=0;this.landingImpact=1;this.entryBones={};
    this.footContacts = { L: null, R: null };
    this.runBlend = 0;
    this.lastAction=null;this.lastSwordArm={shoulder:-.10,elbow:1.10,spread:.10,sweep:0,wrist:0};
    this.entryArm={...this.lastSwordArm};this.lastTurn=0;this.entryTurn=0;this.guardWeight=0;
  }

  update(dt, state) {
    const { root, rig } = this.avatar, bones = rig.bones;
    const speed = Math.max(0, state.speed), moving = speed > .12;
    const armed = state.weapon === 'sword' && state.action?.kind !== 'punch';
    const alpha = 1 - Math.exp(-dt * 18);
    if(state.action!==this.lastAction){for(const name of ['upperArmR','forearmR'])this.entryBones[name]=bones[name].quaternion.clone();this.entryArm={...this.lastSwordArm};this.entryTurn=this.lastTurn;this.lastAction=state.action;}
    this.airWeight=damp(this.airWeight,state.airborne?1:0,18,dt);this.landing=Math.max(0,this.landing-dt*3.2);
    this.guardWeight=damp(this.guardWeight,state.block?1:0,14,dt);
    this.time += dt;
    this.recoil = Math.max(0,this.recoil-dt*6);
    this.idleTime = moving || state.action || state.block ? 0 : this.idleTime + dt;
    if(!state.airborne)this.motion = damp(this.motion, moving ? 1 : 0, 10, dt);
    if(!state.airborne)this.runBlend = damp(this.runBlend, smoothstep(speed, 1.8, 3.3), 12, dt);
    const run = this.runBlend;
    if (Number.isFinite(state.scrubPhase)) this.phase = state.scrubPhase;
    else if (moving && !state.airborne) this.phase += speed / lerp(GAITS.walk.distance, GAITS.run.distance, run) * dt;
    const gait = blendGaits(this.phase, run);
    const angle = this.phase * Math.PI * 2, breath = Math.sin(this.time * 1.8);
    const pose = {};
    const set = (name, x = 0, y = 0, z = 0) => {
      pose[name] = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    };
    set('hips', 0, gait.twist * this.motion, gait.roll * this.motion);
    set('spine', gait.lean * this.motion + breath * .008, -gait.twist * this.motion * .35, -gait.roll * this.motion * .5);
    set('chest', 0, -gait.twist * this.motion * .7, -gait.roll * this.motion * .5 + breath * .005);
    set('head', -.025 * run, Math.sin(this.time * .4) * .012);
    for(const [side,s]of [['L',1],['R',-1]])set(`clavicle${side}`,0,s*.018*Math.cos(angle-.1)*this.motion,-s*.012*Math.sin(angle)*this.motion);
    const targets = { L: vector(.25, .83, .03), R: vector(-.25, .83, .03) };
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const swing = -Math.cos(angle + (side === 'R' ? Math.PI : 0));
      targets[side].y += this.motion * lerp(.08, .29, run);
      targets[side].z += swing * lerp(.13, .24, run) * this.motion;
      targets[side].x = s * (.28 + run * .025);
    }

    if (armed) targets.R.set(-.32, 1.10 + run * .08, .20 + Math.sin(angle) * .025 * this.motion);
    if (this.idleTime > 7) {
      const weight = smoothstep(this.idleTime, 7, 9);
      targets.L.lerp(vector(.24, 1.035, .03), weight);
      set('chest', 0, -.035 * weight);
    }
    if (state.block) {
      targets.L.set(.16, 1.40, .29);
      targets.R.set(-.18, armed ? 1.25 : 1.38, .34);

      set('chest', .045, -.10);
      set('head', .04);
    }
    if (state.action) {
      const { kind, progress: p, side, combo, height } = state.action;
      if (kind === 'sword') {
        let turn=sampleSwordCut(p,combo,height,state.action.power??0).turn;
        turn=lerp(this.entryTurn,turn,smoothstep(p,0,.27));this.lastTurn=turn;
        set('hips',0,turn*.30);
        set('chest',.10*Math.sin(p*Math.PI),turn);
        set('spine',.035*Math.sin(p*Math.PI),turn*.35);
      } else {
        const s = side === 'L' ? 1 : -1;
        const extension = smoothstep(p, .18, .43) * (1 - smoothstep(p, .48, .88));
        const wind = Math.sin(Math.PI * clamp(p / .22, 0, 1)) * .06;
        targets[side].set(s * lerp(.18, .04, extension), lerp(1.32, clamp(height, 1.02, 1.55), extension), .25 - wind + .34 * extension);
        targets[side === 'L' ? 'R' : 'L'].set(-s * .16, 1.36, .26);
        set('chest', .015, s * .23 * extension);
        set('spine', 0, s * .08 * extension);
      }
    }

    // Pose parents before solving limbs: IK sees the final chest/clavicle transforms.
    for (const [name, bone] of Object.entries(bones)) {
      if (/upperArm|forearm|hand|thigh|shin|foot|toe|index|middle|ring|little|thumb/.test(name)) continue;
      bone.quaternion.slerp(pose[name] ?? IDENTITY, alpha);
    }
    if(!state.action)this.lastTurn=damp(this.lastTurn,0,10,dt);
    const combatWeight=state.action?Math.sin(Math.PI*state.action.progress):this.guardWeight;
    bones.hips.position.y = this.baseHip + gait.pelvisY * this.motion + breath * .001 - combatWeight*.035 - Math.sin(Math.PI*(1-this.landing))*this.landingImpact*.075 - (state.takeoffWeight??0)*.055;
    bones.hips.position.x = gait.pelvisX * this.motion + this.lastTurn*.025;
    bones.hips.position.z = state.action?.kind==='sword'?.045*Math.sin(Math.PI*state.action.progress):0;
    root.updateMatrixWorld(true);
    // Keep the supporting leg reachable without stretching. This is a contact
    // correction, not a permanent run crouch: flight uses the authored height.
    let correction=0;
    for(const [side,s]of [['L',1],['R',-1]])if(!state.airborne&&gait.feet[side].contact&&this.motion>.95){
      const hip=root.worldToLocal(bones[`thigh${side}`].getWorldPosition(new THREE.Vector3()));
      const foot=gait.feet[side],dx=s*.12-hip.x,dz=foot.z*this.motion-hip.z;
      const length=bones[`shin${side}`].position.length()+bones[`foot${side}`].position.length()-.005;
      const limit=lerp(.13,foot.y,this.motion)+Math.sqrt(Math.max(0,length*length-dx*dx-dz*dz));
      correction=Math.max(correction,hip.y-limit);
    }
    bones.hips.position.y-=Math.min(.12,Math.max(0,correction));
    root.updateMatrixWorld(true);
    const worldQ = root.getWorldQuaternion(new THREE.Quaternion());

    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const sample = gait.feet[side];
      const foot = vector(s * (.12+combatWeight*.025), lerp(.13, sample.y, this.motion), sample.z * this.motion+s*combatWeight*.12);
      if(this.airWeight>.001){
        const rising=smoothstep(state.verticalSpeed??0,-1,3);
        foot.lerp(vector(s*.12,.18+rising*(side==='L'?.17:.10),s*(.08+.10*rising)),this.airWeight);
      }
      // Rotate gait toward actual travel, supporting strafing/backpedal under target lock.
      if (state.travelAngle) foot.applyAxisAngle(vector(0, 1, 0), state.travelAngle);
      const target = root.localToWorld(foot);
      const planted = !state.airborne && moving && sample.contact && this.motion > .95 && state.grounding !== false;
      if (planted) {
        this.footContacts[side] ??= target.clone();
        // Release a foot when a sharp turn makes the old contact unreachable.
        if (this.footContacts[side].distanceTo(target) < .12) {target.x=this.footContacts[side].x;target.z=this.footContacts[side].z;}
        else this.footContacts[side] = target.clone();
      } else this.footContacts[side] = null;
      const kneeHint = root.localToWorld(vector(s * .15, .55, .6));
      solveTwoBone(bones[`thigh${side}`], bones[`shin${side}`], bones[`foot${side}`], target, kneeHint, worldQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sample.pitch * this.motion,0,0))));
      bones[`toe${side}`].quaternion.identity();
    }

    for (const [side, s] of [['L', 1], ['R', -1]]) {
      this.hands[side].lerp(targets[side], 1 - Math.exp(-dt * (state.action ? 40 : 14)));
      const handQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-s*1.40));
      if (!armed && (state.action || state.block)) {
        handQ.setFromUnitVectors(vector(s, 0, 0), vector(0, 0, 1));
      }
      const useIK = state.action?.kind==='punch' || (state.block && !(armed&&side==='R')) || (this.idleTime>7&&side==='L');
      if (useIK) {
        const target = root.localToWorld(this.hands[side].clone());
        const elbow = root.localToWorld(vector(s * .30, 1.08, -.20));
        const orientation = null;
        solveTwoBone(bones[`upperArm${side}`], bones[`forearm${side}`], bones[`hand${side}`], target, elbow, orientation);
        bones[`hand${side}`].quaternion.identity();
        if(state.action?.kind==='punch')alignPunchWrist(bones,side,new THREE.Vector3(0,-1,0).applyQuaternion(worldQ));
      }
      const freeArm = !state.block && !state.action && !(this.idleTime>7 && side==='L');
      if (freeArm && !(armed && side==='R')) {
        const relaxed=locomotionArm(side,this.phase,run,this.motion);
        relaxed.shoulder+=Math.sin(this.time*1.8-.25)*.008*(1-this.motion);
        relaxed.elbow+=Math.sin(this.time*1.8-.5)*.012*(1-this.motion);
        relaxed.shoulder=lerp(relaxed.shoulder,.35,this.airWeight*.65);
        relaxed.elbow=lerp(relaxed.elbow,.65,this.airWeight*.65);
        relaxed.spread+=this.airWeight*.12;
        applyArmFK(bones,side,relaxed,alpha);
      }
      if (armed && side==='R') {
        let arm={shoulder:-.10+Math.sin(angle)*.045*this.motion,elbow:1.10,spread:.10,sweep:0,wrist:0};
        if(state.block)arm={shoulder:.35-this.recoil*.16,elbow:1.23,spread:.10,sweep:.10,wrist:0};
        if(state.action?.kind==='sword'){
          arm=swordArm(state.action.progress,state.action.combo,state.action.height);
          const blend=smoothstep(state.action.progress,0,state.action.chained?.24:.18);
          for(const key of ['shoulder','elbow','sweep','spread','wrist'])arm[key]=lerp(this.entryArm[key],arm[key],blend);
        }
        this.lastSwordArm={...arm};
        applyArmFK(bones,side,arm,1-Math.exp(-dt*(state.action?55:18)));
      }
      if(state.action?.kind==='sword'&&side==='L')applyArmFK(bones,side,{shoulder:.10,elbow:1.28,spread:.10,sweep:.1,wrist:0},alpha);
      const mode=armed&&side==='R'?'grip':state.action?.kind==='punch'||state.block?'fist':'open';
      // An equipped sword requires a closed grip from the first frame, including
      // weapon switches and interrupted recoveries; do not ease from an open hand.
      poseHand(rig,side,mode,mode==='grip'?1:alpha,run);
    }
    if(armed&&!state.action)alignSwordReady(this.avatar,this.guardWeight);
    if(state.action?.kind==='sword'){
      alignSwordAction(this.avatar,state.action);
      if(state.action.chained&&state.action.progress<.25)for(const name of ['upperArmR','forearmR'])bones[name].quaternion.copy(this.entryBones[name].clone().slerp(bones[name].quaternion,smoothstep(state.action.progress,0,.25)));
    }

    for(const side of ['L','R']) {
      alignElbowHinge(bones[`upperArm${side}`],bones[`forearm${side}`],bones[`hand${side}`]);
    }
    root.updateMatrixWorld(true);
    const foot = Math.floor(this.phase * 2);
    if (moving && !state.airborne && foot !== this.lastFoot) this.events.push('step');
    this.lastFoot = foot;
  }
}
