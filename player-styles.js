/* Player decisions use the real engine. All style resources belong to this battle only. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype, rawFlag=(u,f)=>u.flag===f||u.flags?.includes(f);
 const families=['shadows','puppet','crows','spiritControl','seance'];
 const family=u=>families.find(f=>rawFlag(u,f))||'';
 const manualSummons=(e,u)=>!!u.isPlayer&&!!family(u);
 const cost=(u,p)=>Math.max(1,Math.round(u.maxCp*p));
 const state=u=>u.playerStyle||(u.playerStyle={pressure:0,burst:0,deployed:0,orders:0,intercepts:0,damage:0});
 const owned=(e,u=e.player)=>e.alive(u.side).filter(s=>s.summonTag&&s.ownerIndex===e.units.indexOf(u));
 const shadowSpecs=[
  {key:'dog',name:'玉犬式神',label:'玉犬',ratio:.24,prof:0,note:'近身追击 · 稳定输出'},
  {key:'rabbit',name:'脱兔式神',label:'脱兔',ratio:.14,prof:0,note:'更快行动 · 适合护卫',speed:1.35},
  {key:'nue',name:'鵺式神',label:'鵺',ratio:.30,prof:40,note:'空中协攻 · 速度较快',speed:1.15},
  {key:'ox',name:'贯牛式神',label:'贯牛',ratio:.34,prof:100,note:'蓄势冲撞 · 更高单次输出',speed:.85}
 ];
 const limit=u=>family(u)==='crows'?3:2;
 const summon=proto.addSummon;
 proto.addSummon=function(owner,...args){const u=summon.call(this,owner,...args);if(u)u.ownerIndex=this.units.indexOf(owner);return u;};
 function specs(e,u){
  switch(family(u)){
   case 'shadows':return shadowSpecs;
   case 'puppet':return [{key:'puppet',name:'傀儡',label:'傀儡',ratio:.70,prof:0,note:'实体机械 · 协攻与护卫'}];
   case 'crows':return [{key:'crow',name:'乌鸦式神',label:'乌鸦',ratio:.30,prof:0,note:'飞行式神 · 最多三只'}];
   default:return [...(e.cfg.player.absorbed||[]),...e.killedPool].filter((s,i,a)=>a.findIndex(x=>x.name===s.name)===i).map((s,i)=>({key:'recall-'+i,name:(family(u)==='seance'?'亡灵式神·':'咒灵式神·')+s.name,label:s.name,spec:s,ratio:1,prof:0,note:'已收录单位 · 原面板召回'}));
  }
 }
 function commands(e){
  const u=e.player,s=state(u),mine=owned(e),block=window.BattleTraits?.blocked(e,u,'tech')||'',rows=[];
  const row=(id,label,cp,note,reason='')=>rows.push({id,label,cost:cp,note,reason:reason||(u.cp<cp?'咒力不足':'')});
  row('style_burst','破势一击',cost(u,.04),'消耗3格势能 · 体术×1.65，命中额外削减领域稳定度10',s.pressure<3?'势能 '+s.pressure+'/3':'');
  if(!family(u))return rows;
  const max=limit(u),deployCost=cost(u,.08);
  for(const spec of specs(e,u))row('style_deploy:'+spec.key,'显现 · '+spec.label,deployCost,spec.note,block||(mine.length>=max?'在场上限 '+max:((e.cfg.player.prof||0)<spec.prof?'熟练度需 '+spec.prof+'%':e.alive().length>=14?'战场已满':'')));
  if(!specs(e,u).length)row('style_deploy:none','召回已收录单位',deployCost,'击败敌人后可收录；不凭空生成咒灵','尚未收录单位');
  row('style_coordinate','协攻指令',cost(u,.06),'锁定当前目标 · 召唤物行动值+40，下次攻击×1.30',block||(!mine.length?'先显现召唤物':''));
  row('style_protect','护卫指令',cost(u,.04),'最健康的召唤物分担下一次直接攻击35% · 不影响领域必中',block||(!mine.length?'先显现召唤物':''));
  if(family(u)==='shadows')row('style_fuse','融合 · 嵌合兽',cost(u,.10),'两只式神融合 · 累加现有生命与面板，不回复已损失生命',block||(mine.filter(x=>x.shadow&&!x.fused).length<2?'需两只未融合式神':''));
  return rows;
 }
 function event(e,ev,phase,text,extra={}){ev.push({type:'style',stylePhase:phase,from:e.player.name,fromIndex:e.units.indexOf(e.player),text,...extra});}
 const act=proto.playerAct;
 proto.playerAct=function(action,targetIndex){
  if(!action.startsWith('style_')){
   const packet=act.call(this,action,targetIndex);
   if(!packet.retryInput&&action==='tech')state(this.player).pressure=Math.max(0,state(this.player).pressure-1);
   return packet;
  }
  const ev=[],u=this.player,command=commands(this).find(c=>c.id===action);
  const retry=reason=>({events:[{type:'info',text:reason}],ended:this.ended,result:this.result,needInput:this.awaitingPlayer,retryInput:true});
  if(!this.awaitingPlayer||this.ended||this.pendingDomain||!u.alive)return retry('等待你的行动。');
  if(!command||command.reason)return retry(command?.reason||'此指令不属于当前人物。');
  const target=this.units[targetIndex]?.alive&&this.units[targetIndex].side!==u.side?this.units[targetIndex]:this.pickEnemyTarget();
  if(!target)return retry('没有可攻击的目标。');
  const mine=owned(this),st=state(u);u.cp-=command.cost;this.awaitingPlayer=false;
  if(action==='style_burst'){
   st.pressure=0;st.burst++;u.styleStrike='burst';u.traitAction='melee';
   event(this,ev,'burst','势能满格 · 破势一击！');
   try{this.performStrike(u,target,'melee',ev);}finally{u.styleStrike='';}
  }else if(action.startsWith('style_deploy:')){
   const spec=specs(this,u).find(x=>action==='style_deploy:'+x.key);
   const spawned=this.addSummon(u,spec.name,spec.ratio,family(u)==='puppet'?'傀儡':'式神');
   if(!spawned){u.cp+=command.cost;this.awaitingPlayer=true;return retry('当前无法显现。');}
   spawned.shadow=family(u)==='shadows';spawned.styleSpawn=true;spawned.speed=u.speed*(spec.speed||1);spawned.atb=55;
   if(spec.spec){for(const k of ['maxHp','maxCp','ctl','li'])spawned[k]=spec.spec[k]??spawned[k];spawned.hp=spawned.maxHp;spawned.cp=spawned.maxCp;spawned.melee=spec.spec.melee.slice();spawned.eff=spec.spec.eff.slice();}
   st.deployed++;event(this,ev,'deploy','显现 · '+spec.label+'！',{spawnIndex:this.units.indexOf(spawned),summonFamily:family(u)});u.traitAction='tech';
  }else if(action==='style_coordinate'){
   for(const summon of mine){summon.summonOrder={targetIndex:this.units.indexOf(target),boost:1.30};summon.atb=Math.min(99,summon.atb+40);}
   st.orders++;event(this,ev,'coordinate','协攻 · '+mine.map(s=>s.name).join('、')+' → '+target.name,{toIndex:this.units.indexOf(target),ordered:mine.map(s=>this.units.indexOf(s))});u.traitAction='tech';
  }else if(action==='style_protect'){
   const guard=mine.slice().sort((a,b)=>b.hp-a.hp)[0];u.summonGuard={index:this.units.indexOf(guard),until:(u.resonanceClock||0)+2};guard.buff.defend=true;
   event(this,ev,'protect',guard.name+' · 护卫就绪，分担你的下一次直接攻击。',{guardIndex:this.units.indexOf(guard)});u.traitAction='defend';
  }else if(action==='style_fuse'){
   const source=mine.filter(x=>x.shadow&&!x.fused).slice(0,2),departed=source.map(s=>this.units.indexOf(s));
   const f=this.decorate({name:'嵌合兽·式神',side:u.side,isPlayer:false,li:u.li,summonTag:'式神',ownerName:u.name,ownerIndex:this.units.indexOf(u),fused:true,shadow:true,
    maxHp:source.reduce((n,s)=>n+s.maxHp,0),hp:source.reduce((n,s)=>n+s.hp,0),maxCp:source.reduce((n,s)=>n+s.maxCp,0),cp:source.reduce((n,s)=>n+s.cp,0),
    melee:[0,1].map(i=>source.reduce((n,s)=>n+s.melee[i],0)),eff:[0,1].map(i=>source.reduce((n,s)=>n+s.eff[i],0)),ctl:source.reduce((n,s)=>n+s.ctl,0),
    atb:Math.min(90,Math.max(...source.map(s=>s.atb))),speed:u.speed,styleSpawn:true,alive:true,flag:null,flags:[],canDomain:false,reverse:false,domainUsed:0,techName:'嵌合兽',domainName:''});
   source.forEach(s=>{s.hp=0;s.alive=false;s.summonOrder=null;});this.units.push(f);st.deployed++;
   event(this,ev,'fuse','融合 · 嵌合兽！保留现有生命，承接两只式神的力量。',{spawnIndex:this.units.indexOf(f),departed,summonFamily:'shadows'});u.traitAction='tech';
  }
  this.afterAction(u,ev);return this.pack(ev);
 };
 const strike=proto.performStrike;
 proto.performStrike=function(u,t,kind,ev){
  const start=ev.length,move=u.styleStrike,order=u.summonOrder;
  if(order&&kind==='melee')u.styleDamageBoost=order.boost;
  try{strike.call(this,u,t,kind,ev);}finally{u.styleDamageBoost=0;}
  const hits=ev.slice(start).filter(x=>x.dmg>0&&x.fromIndex===this.units.indexOf(u)&&x.toIndex===this.units.indexOf(t)&&x.attackKind===kind);
  if(u.isPlayer&&kind==='melee'){
   const s=state(u);if(hits.length){s.damage+=hits.reduce((n,x)=>n+x.dmg,0);if(move!=='burst')s.pressure=Math.min(3,s.pressure+1);}
   for(const hit of hits)if(move==='burst')hit.styleMove='burst';
   if(move==='burst'&&hits.length){const dc=window.DomainCombat,field=dc?.active(this,t);if(field){field.stability=Math.max(0,field.stability-10);if(field.stability<=0)dc.collapse(this,field,ev,'破势一击击破结界');else ev.push({type:'domain_state',domainSnapshot:dc.snapshot(this),text:'破势一击 · 对方领域稳定度额外 -10。'});}}
  }
  if(order&&hits.length)for(const hit of hits){hit.styleMove='coordinate';hit.text='协攻 · '+hit.text;}
 };
 const damage=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  if(u.styleStrike==='burst'&&kind==='melee')base*=1.65;
  if(u.styleDamageBoost&&kind==='melee')base*=u.styleDamageBoost;
  const guard=t?.isPlayer&&t.summonGuard,protector=guard&&this.units[guard.index];
  if(guard&&guard.until>(t.resonanceClock||0)&&protector?.alive&&protector.hp>0&&u.side!==t.side&&['melee','tech'].includes(kind)&&base>0&&!this.guardRedirect){
   const share=window.PlayerStyles.guardShare?.(this)||.35;
   t.summonGuard=null;state(t).intercepts++;this.guardRedirect=true;
   try{
    ev.push({type:'style',stylePhase:'intercept',from:t.name,fromIndex:this.units.indexOf(t),guardIndex:guard.index,text:protector.name+' 分担来袭的'+Math.round(share*100)+'%攻击。'});
    const begin=ev.length;damage.call(this,u,protector,base*share,mult,kind,ev,...rest);
    for(const hit of ev.slice(begin))if(hit.dmg&&hit.toIndex===guard.index)hit.attackKind='intercept';
    return damage.call(this,u,t,base*(1-share),mult,kind,ev,...rest);
   }finally{this.guardRedirect=false;}
  }
  return damage.call(this,u,t,base,mult,kind,ev,...rest);
 };
 const npc=proto.npcAct;
 function intent(e,u){
  if(window.Tactics&&e.cfg.v3){const p=window.Tactics.plan(e,u),target=window.Tactics.target(e,u,p.target);return {label:p.label,target:target?.name||'我方',targetIndex:e.units.indexOf(target),danger:!!p.danger,scope:p.scope};}
  if(!e.cfg.stylePractice)return {label:'准备行动',target:'—',danger:false};
  if(!u.practiceIntent){const t=e.player.alive?e.player:e.alive('ally')[0],tech=u.cp>=e.techCost(u)&&(u.buff.actCount||0)%3===2;u.practiceIntent={kind:tech?'tech':'melee',label:tech?u.techName:'体术攻击',target:t?.name||'我方',targetIndex:e.units.indexOf(t),danger:tech};}
  return u.practiceIntent;
 }
 proto.npcAct=function(u,ev){
  if(this.cfg.stylePractice&&u.side==='enemy'&&!u.summonTag&&!window.BattleResonance?.burnoutLeft(u)){
   const plan=intent(this,u),t=this.units[plan.targetIndex]?.alive?this.units[plan.targetIndex]:this.pickAllyTarget();u.practiceIntent=null;
   if(t){let kind=plan.kind;if(kind==='tech'){const paid=this.techCost(u);if(u.cp>=paid)u.cp-=paid;else kind='melee';}this.performStrike(u,t,kind,ev);}return;
  }
  if(!u.summonOrder){
   const owner=this.units[u.ownerIndex];
   if(u.summonTag&&owner?.isPlayer&&manualSummons(this,owner)){const target=u.side==='ally'?this.pickEnemyTarget():this.pickAllyTarget();if(target)this.performStrike(u,target,'melee',ev);return;}
   return npc.call(this,u,ev);
  }
  const order=u.summonOrder,t=this.units[order.targetIndex];
  const target=t?.alive&&t.side!==u.side?t:u.side==='ally'?this.pickEnemyTarget():this.pickAllyTarget();
  if(target)this.performStrike(u,target,'melee',ev);u.summonOrder=null;
 };
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){after.call(this,u,ev);if(u.summonTag)u.summonOrder=null;if(u.summonGuard?.until<=(u.resonanceClock||0))u.summonGuard=null;};
 const status=window.BattleTraits.status;
 window.BattleTraits.status=function(e,u){const notes=status(e,u);if(u.isPlayer){if(state(u).pressure)notes.push('势能 '+state(u).pressure+'/3');if(u.summonGuard)notes.push('召唤护卫');}if(u.summonOrder)notes.push('协攻待命');return notes;};
 window.PlayerStyles={manualSummons,family,owned,commands,state,limit,intent};
})();
