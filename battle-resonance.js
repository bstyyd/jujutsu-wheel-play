/* Battle-only black flash, barrier conditions and burnout. Never serialized into a save. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype,dc=()=>window.DomainCombat;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const clock=u=>u.resonanceClock||0;
 const zoneLeft=u=>Math.max(0,(u.flashZone?.until||0)-clock(u));
 const burnoutLeft=u=>Math.max(0,(u.techBurnoutUntil||0)-clock(u));
 const contact=(e,u,kind)=>kind==='melee'||kind==='tech'&&['ratio','mass','idleTrans'].some(f=>e.hasFlag(u,f));
 const momentum=u=>u.domainMomentum?.until>clock(u)?u.domainMomentum.bonus:0;
 const flashChance=(e,u,kind)=>{
  if(!contact(e,u,kind)||u.summonTag)return 0;
  const learned=u.isPlayer?e.cfg.player.blackFlash:!!u.bf,ratio=e.hasFlag(u,'ratio');
  if(!learned&&!ratio)return 0;
  const control=clamp(u.ctl/(u.ctl+4500),0,1),strain=u.cp<Math.round(u.maxCp*.12)? .65:1;
  const disrupted=u.buff.stun>0||u.traitEffects?.soul||u.traitEffects?.disrupt;
  return clamp(((learned?.055:0)+(ratio?.10:0)+control*.03+Math.min(3,u.contactRhythm||0)*.015+(zoneLeft(u)>0?.12:0)+(u.focusUntil>clock(u)?.025:0))*strain*(disrupted?.65:1),0,.45);
 };
 const blocked=(e,u,action)=>burnoutLeft(u)>0&&['tech','ult','domain'].includes(action)?`术式熔断 · 还需 ${burnoutLeft(u)} 次自身行动，用体术或防御等待恢复。`:'';
 const emit=(e,ev,type,text,extra={})=>ev.push({type,text,domainSnapshot:dc().snapshot(e),...extra});
 function surge(e,u,ev,bonus,turns,label){
  const prior=momentum(u);u.domainMomentum={bonus:Math.max(prior,bonus),until:Math.max(u.domainMomentum?.until||0,clock(u)+turns+1)};
  if(dc().active(e,u))emit(e,ev,'domain_state',`${u.name}【${label}】获得短暂领域优势 +${Math.round(momentum(u)*100)}%。`,{domainPhase:'momentum',owner:e.units.indexOf(u),momentum:momentum(u)});
 }
 function onFlash(e,u,ev){
  const chained=zoneLeft(u)>0;
  u.flashZone={until:clock(u)+4,chain:chained?(u.flashZone.chain||1)+1:1};
  surge(e,u,ev,.10,2,'黑闪心流');
  emit(e,ev,'skill',`${u.name}${chained?' · 连续黑闪 '+u.flashZone.chain:' · 黑闪心流'}！随后3次自身行动输出 +12%，接触攻击更容易再次黑闪；领域优势 +10%持续2次行动。`,{resonancePhase:'zone',owner:e.units.indexOf(u),zoneActions:3,chain:u.flashZone.chain});
 }
 function onContact(e,u,kind,damage,flash,ev){
  if(u.summonTag)return;
  if(!contact(e,u,kind)||!(damage>0)){u.contactRhythm=0;u.contactCombo=0;return;}
  u.contactRhythm=Math.min(3,(u.contactRhythm||0)+1);
  u.contactCombo=(u.contactCombo||0)+1;
  if(!flash&&u.contactCombo%3===0&&dc().active(e,u))surge(e,u,ev,.06,1,'连续压制');
 }
 const effective=(e,f)=>{
  const u=e.units[f.owner];return f.power*(1+momentum(u))*(f.barrierCondition==='compact'?1.12:1);
 };
 const advantage=(e,f)=>effective(e,f)*(.35+.65*clamp(f.stability,0,100)/100);
 const conditionLabel=f=>f.barrierCondition==='reinforce'?'外壳加固':f.barrierCondition==='compact'?'压缩结界':f.open?'开放结界':f.incomplete?'未完成结界':'常规结界';
 function pressure(e,from,to){
  const inner=8+Math.min(20,Math.max(0,(effective(e,from)/Math.max(1,effective(e,to))-1)*30));
  const outer=from.open&&!to.open&&!to.incomplete?12:0;
  const outsideFactor=to.barrierCondition==='reinforce'?.45:to.barrierCondition==='compact'?.65:1;
  const insideFactor=to.barrierCondition==='reinforce'?1.15:1;
  return {inner:inner*insideFactor,external:outer*outsideFactor,total:inner*insideFactor+outer*outsideFactor};
 }
 const conditionCost=u=>Math.round(u.maxCp*.04);
 function canCondition(e,u,kind){
  const f=dc().active(e,u),other=f&&dc().fields(e).find(x=>x.side!==f.side);
  const mastery=u.isPlayer?e.cfg.player.prof||0:/五条悟|宿傩|羂索/.test(u.name)?260:160;
  return !!f&&!!other&&!f.open&&!f.incomplete&&!f.barrierCondition&&u.alive&&!burnoutLeft(u)&&mastery>=160&&u.cp>=conditionCost(u)&&(kind!=='reinforce'||other.open);
 }
 function adjust(e,u,kind,ev){
  if(!['reinforce','compact'].includes(kind)||!canCondition(e,u,kind))return false;
  const f=dc().active(e,u),paid=conditionCost(u);u.cp-=paid;f.barrierCondition=kind;
  emit(e,ev,'domain_state',`【${f.name}】${conditionLabel(f)}，支付 ${paid} CP。${kind==='reinforce'?'外侧侵蚀降55%，内部对攻压力增加15%，施术者受击时稳定度损失增加35%；维持消耗增加35%。':'精炼输出增加12%，外侧侵蚀降35%，必中输出降15%；维持消耗增加65%。'}`,{domainPhase:'condition',owner:f.owner,condition:kind,cpPaid:paid});return true;
 }
 function onCollapse(e,u,ev,reason){
  if(e.ended||!u.alive)return;
  const actions=u.reverse?2:3,ownAction=e.lastActor===u||u.resonanceTick;
  u.techBurnoutUntil=clock(u)+actions+(ownAction?1:0);u.domainCd=actions;
  emit(e,ev,'skill',`${u.name} 进入术式熔断，随后 ${actions} 次自身行动只能使用体术与防御${u.reverse?'；反转术式缩短了恢复时间':''}。`,{resonancePhase:'burnout',owner:e.units.indexOf(u),burnoutActions:actions,reason});
 }
 const hasFlag=proto.hasFlag;
 proto.hasFlag=function(u,flag){if(u&&burnoutLeft(u)>0&&(u.flag===flag||u.flags?.includes(flag)))return false;return hasFlag.call(this,u,flag);};
 const hit=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){return hit.call(this,u,t,base*(zoneLeft(u)>0&&['melee','tech'].includes(kind)?1.12:1),mult,kind,ev,...rest);};
 const npc=proto.npcAct;
 proto.npcAct=function(u,ev){
  if(burnoutLeft(u)>0){u.intent=null;u.traitAction='melee';return this.performStrike(u,u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget(),'melee',ev);}
  const f=dc().active(this,u);
  if(f&&(f.shellStress||0)>=8&&canCondition(this,u,'reinforce')){u.intent=null;u.traitAction='barrier';return adjust(this,u,'reinforce',ev);}
  return npc.call(this,u,ev);
 };
 const player=proto.playerAct;
 proto.playerAct=function(action,...args){
  if(action.startsWith('barrier_')){
   const ev=[];
   if(!this.awaitingPlayer||this.ended||this.pendingDomain)return {events:ev,ended:this.ended,needInput:this.awaitingPlayer,retryInput:true};
   if(!adjust(this,this.player,action.slice(8),ev)){ev.push({type:'info',text:'当前不能调整结界：需要熟练度160%、领域僵持、完整封闭领域、足够咒力，且每次展开只能调整一次。'});return {events:ev,ended:false,needInput:true,retryInput:true};}
   this.awaitingPlayer=false;this.player.traitAction='barrier';this.afterAction(this.player,ev);return this.pack(ev);
  }
  if(action==='defend'&&this.awaitingPlayer){this.player.focusUntil=clock(this.player)+2;this.player.contactRhythm=0;this.player.contactCombo=0;}
  return player.call(this,action,...args);
 };
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){
  if(this.pendingDomain?.owner===this.units.indexOf(u))return after.call(this,u,ev);
  const wasZone=zoneLeft(u)>0,wasBurnout=burnoutLeft(u)>0;
  u.resonanceTick=true;try{after.call(this,u,ev);}finally{u.resonanceTick=false;}
  u.resonanceClock=clock(u)+1;
  if(wasZone&&!zoneLeft(u)){u.flashZone=null;emit(this,ev,'skill',`${u.name} 的黑闪心流结束。`,{resonancePhase:'zone_end',owner:this.units.indexOf(u)});}
  if(wasBurnout&&!burnoutLeft(u)){u.techBurnoutUntil=0;u.domainCd=0;emit(this,ev,'skill',`${u.name} 的术式恢复，可以再次使用术式与领域。`,{resonancePhase:'recovery',owner:this.units.indexOf(u)});}
  else if(burnoutLeft(u)>0)u.domainCd=burnoutLeft(u);
  if(momentum(u)===0&&u.domainMomentum){u.domainMomentum=null;if(dc().active(this,u))emit(this,ev,'domain_state',`${u.name} 的短暂领域优势消退。`,{domainPhase:'momentum_end',owner:this.units.indexOf(u)});}
 };
 function status(e,u){const list=[];if(zoneLeft(u))list.push(`黑闪心流 · ${Math.min(3,zoneLeft(u))} 行动`);if(burnoutLeft(u))list.push(`术式熔断 · ${burnoutLeft(u)} 行动`);return list;}
 function fieldText(e,f,contested){
  const u=e.units[f.owner],boost=f.momentum??momentum(u);return `${conditionLabel(f)} · ${contested?'对攻持续至结界破裂 / 咒力耗尽':`剩余 ${f.remaining} 行动`}${boost?` · 优势 +${Math.round(boost*100)}%`:''}${f.shellStress>0?` · 外壳侵蚀 ${Math.round(f.shellStress)}`:''}`;
 }
 function buttons(e,u,can){
  const f=dc().active(e,u);if(!f||!dc().fields(e).some(x=>x.side!==f.side)||f.open||f.incomplete||f.barrierCondition)return '';
  return `<div class="barrier-options" role="group" aria-label="结界条件调整"><span>结界条件 · 消耗一次行动与 ${conditionCost(u)} CP</span><button type="button" data-barrier="reinforce" ${can&&canCondition(e,u,'reinforce')?'':'disabled'}>外壳加固<small>抵御外侧侵蚀 · 内部更脆弱</small></button><button type="button" data-barrier="compact" ${can&&canCondition(e,u,'compact')?'':'disabled'}>压缩结界<small>精炼增强 · 更耗咒力</small></button></div>`;
 }
 window.BattleResonance={flashChance,onFlash,onContact,zoneLeft,burnoutLeft,blocked,effective,advantage,pressure,conditionCost,canCondition,adjust,onCollapse,momentum,status,fieldText,buttons,conditionLabel};
})();
