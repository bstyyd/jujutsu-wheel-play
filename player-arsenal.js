/* Battle-only weapon stance and ranged concentration. All hits use existing defenses. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype,PS=window.PlayerStyles,T=window.CursedToolTraining;
 const ranged=new Set(['limitless','cleave','straw','blood','construct','moon','rot','amber','cannon','fire','gu']);
 const state=u=>u.arsenal||(u.arsenal={edge:0,focus:0,weaponUses:0,charges:0,releases:0,interruptions:0});
 const family=u=>T.families[u.equipmentId]||'';
 const isRanged=u=>ranged.has(u.flag);
 const cost=(u,n)=>Math.max(1,Math.round(u.maxCp*n));
 const trained=(e,u)=>T.certified(u.equipmentId,{training:e.cfg.weaponTraining});
 const priorCommands=PS.commands;
 PS.commands=function(e){
  const rows=priorCommands(e),u=e.player,s=state(u),f=family(u),blocked=window.BattleTraits.blocked(e,u,'tech');
  const row=(id,label,cp,note,reason='')=>rows.push({id,label,cost:cp,note,reason:reason||(u.cp<cp?'咒力不足':'')});
  if(f){const m=T.moves[f];row('arsenal_weapon',m.label,cost(u,.04),m.note,window.BattleTraits.toolSealed(e,u)?'咒具被封锁':!trained(e,u)?'完成这件咒具的三步课题':s.edge<2?'刃势 '+s.edge+'/2':'');}
  if(isRanged(u)){
   row('arsenal_charge','集中蓄力',cost(u,.02),'消耗一次行动与2%咒力 · 最多2层；单次直接伤害达到12%最大生命损失1层，防御可稳住',blocked||(s.focus>=2?'已达2层':''));
   row('arsenal_release','集中施术',e.techCost(u)+cost(u,.03*s.focus),'释放当前术式 · 1层×2，2层×3；额外每层3%咒力，仍受原有防护与单击上限',blocked||(!s.focus?'先集中蓄力':''));
  }
  return rows;
 };
 function style(e,ev,phase,text){ev.push({type:'style',stylePhase:phase,from:e.player.name,fromIndex:e.units.indexOf(e.player),text});}
 const act=proto.playerAct;
 proto.playerAct=function(action,targetIndex){
  if(!action.startsWith('arsenal_')){
   const packet=act.call(this,action,targetIndex);
   if(!packet.retryInput&&['melee','tech','domain','ult','style_burst'].includes(action))state(this.player).focus=0;
   return packet;
  }
  const u=this.player,s=state(u),command=PS.commands(this).find(c=>c.id===action),ev=[];
  const retry=reason=>({events:[{type:'info',text:reason}],ended:this.ended,result:this.result,needInput:this.awaitingPlayer,retryInput:true});
  if(!this.awaitingPlayer||this.ended||this.pendingDomain||!u.alive)return retry('等待你的行动。');
  if(!command||command.reason)return retry(command?.reason||'此指令不属于当前人物。');
  const target=this.units[targetIndex]?.alive&&this.units[targetIndex].side!==u.side?this.units[targetIndex]:this.pickEnemyTarget();
  if(!target)return retry('没有可攻击的目标。');
  this.awaitingPlayer=false;u.cp-=command.cost;
  if(action==='arsenal_charge'){
   s.focus++;s.charges++;u.traitAction='tech';style(this,ev,'charge','咒力集中 · '+s.focus+'/2');
  }else{
   const start=ev.length,weapon=action==='arsenal_weapon',f=family(u),level=s.focus;
   u.arsenalMove=weapon?f:'charged';u.arsenalPower=weapon?(f==='blade'?.8:1.5):1+level;u.traitAction=weapon?'melee':'tech';
   if(weapon){s.edge=0;s.focus=0;s.weaponUses++;style(this,ev,'weapon-ready',T.moves[f].label+'！');}
   else{s.focus=0;s.releases++;style(this,ev,'release','集中施术 · '+u.techName+' / '+level+'层');}
   try{
    this.performStrike(u,target,weapon?'melee':'tech',ev);
    if(weapon&&f==='blade'&&target.alive&&u.alive)this.performStrike(u,target,'melee',ev);
   }finally{u.arsenalMove='';u.arsenalPower=0;}
   const hits=ev.slice(start).filter(x=>x.dmg>0&&x.fromIndex===this.units.indexOf(u)&&x.attackKind===(weapon?'melee':'tech'));
   hits.forEach((hit,i)=>{hit.styleMove=weapon?'weapon-'+f:'charged';hit.chargeLevel=weapon?0:level;hit.comboIndex=i;hit.text=(weapon?T.moves[f].label:'集中施术')+' · '+hit.text;});
   if(weapon&&hits.length&&f==='pole')target.weaponSuppressed=true;
   if(weapon&&f==='chain')u.buff.defend=true;
  }
  this.afterAction(u,ev);return this.pack(ev);
 };
 const strike=proto.performStrike;
 proto.performStrike=function(u,t,kind,ev){
  const start=ev.length;strike.call(this,u,t,kind,ev);
  if(u.isPlayer&&family(u)&&!window.BattleTraits.toolSealed(this,u)&&kind==='melee'&&!u.arsenalMove&&ev.slice(start).some(x=>x.dmg>0&&x.attackKind==='melee'&&x.fromIndex===this.units.indexOf(u)))state(u).edge=Math.min(2,state(u).edge+1);
 };
 const damage=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  if(u.arsenalPower&&['melee','tech'].includes(kind))base*=u.arsenalPower;
  if(u.weaponSuppressed&&u.side!==t.side&&['melee','tech'].includes(kind)&&base>0){base*=.8;u.weaponSuppressed=false;}
  const start=ev.length,result=damage.call(this,u,t,base,mult,kind,ev,...rest);
  if(t.isPlayer&&!t.buff.defend&&state(t).focus&&u.side!==t.side&&['melee','tech'].includes(kind)&&ev.slice(start).some(x=>x.dmg>=t.maxHp*.12&&x.toIndex===this.units.indexOf(t)&&x.attackKind===kind)){
   const s=state(t);s.focus--;s.interruptions++;ev.push({type:'info',text:'蓄力被命中打断 · 剩余 '+s.focus+' 层。'});
  }
  return result;
 };
 const turn=proto.onTurnStart;
 proto.onTurnStart=function(u,ev){turn.call(this,u,ev);if(u.isPlayer&&state(u).focus&&window.BattleTraits.blocked(this,u,'tech')){state(u).focus=0;ev.push({type:'info',text:'术式无法维持，蓄力解除。'});}};
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){after.call(this,u,ev);u.weaponSuppressed=false;};
 const notes=window.BattleTraits.status;
 window.BattleTraits.status=function(e,u){const rows=notes(e,u);if(u.isPlayer){const s=state(u);if(family(u))rows.push('刃势 '+s.edge+'/2');if(s.focus)rows.push('蓄力 '+s.focus+'/2');}if(u.weaponSuppressed)rows.push('下次直接攻击 -20%');return rows;};
 function summary(e){const u=e.player,s=state(u),f=family(u);return (f?'刃势 '+s.edge+'/2 · '+(trained(e,u)?T.moves[f].label:'咒具课题未完成'):'')+(isRanged(u)?(f?' / ':'')+'蓄力 '+s.focus+'/2':'');}
 window.PlayerArsenal={state,family,isRanged,trained,summary};
})();
