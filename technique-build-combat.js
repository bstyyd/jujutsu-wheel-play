/* Technique-specific loadouts. Effects require real hits and never edit permanent panels. */
(() => {
 'use strict';
 const B=window.PlayerBuild,BC=window.PlayerBuildCombat,PS=window.PlayerStyles,DC=window.DomainCombat,proto=BattleEngine.prototype;
 const state=e=>e.techniqueBuildState||(e.techniqueBuildState={procs:{},hits:0,lastKind:'',chainUntil:-1,guardCast:false,riposte:false,healReady:false,construct:null,borrow:null,triggers:0});
 const stamp=e=>e.player.resonanceClock||0;
 const has=(e,id)=>BC.has(e,id)&&B.compatible(B.talents.find(t=>t.id===id),e.cfg.player);
 const ready=(e,id)=>state(e).procs[id]!==stamp(e);
 const spend=(e,id)=>{state(e).procs[id]=stamp(e);state(e).triggers++;};
 const say=(ev,text)=>ev.push({type:'skill',text});
 const advance=(u,n)=>{u.atb=Math.min(99,u.atb+n);};
 const refund=(e,ev,ratio,label)=>{const u=e.player,n=Math.min(u.maxCp-u.cp,Math.ceil(e.techCost(u)*ratio));u.cp+=n;if(n)say(ev,label+' · 咒力 +'+n+'。');};
 const heal=(u,ev,ratio,label)=>{if(!u.alive||u.hp<=0)return;const n=Math.min(u.maxHp-u.hp,Math.round(u.maxHp*ratio));if(n>0){u.hp+=n;ev.push({type:'heal',from:u.name,fromIndex:0,heal:n,text:label+' · 生命 +'+n+'。'});}};
 const originalHP=(e,u)=>{e.buildOriginalHP||=new WeakMap();if(!e.buildOriginalHP.has(u))e.buildOriginalHP.set(u,u.maxHp);return e.buildOriginalHP.get(u);};
 const toxic=(e,u)=>u.buff.poison>0||u.buff.gu>0||u.maxHp<originalHP(e,u);
 const controlled=u=>u.buff.stun>0||!!u.traitEffects?.disrupt||(u.traitFrameUntil||0)>(u.traitClock||0);
 const matchup=(e,t)=>e.player.flag==='jacob'?(t.type==='受肉体'||/受肉/.test(t.name)):e.player.flag==='judge'?(t.type==='式神'||t.summonTag==='式神'||/式神/.test(t.name)):e.player.flag==='negate'&&t.maxCp<e.player.maxCp;
 const borrowable=new Set(['ratio','straw','fire','moon','gu','swap']);
 const reason=e=>window.BattleTraits.blocked(e,e.player,'tech');
 const commands=PS.commands;PS.commands=function(e){
  const rows=commands(e),u=e.player,cp=Math.max(1,Math.round(u.maxCp*.06)),block=reason(e)|| (u.cp<cp?'咒力不足':'');
  const row=(id,label,note,extra='')=>rows.push({id,label,cost:cp,note,reason:block||extra});
  if(has(e,'constructKit')){
   row('techbuild_blades','造物 · 刃阵','一次行动与6%咒力；接下来两次近战实际命中+20%，替换现有造物。');
   row('techbuild_armor','造物 · 护甲','一次行动与6%咒力；接下来两次直接受击减伤20%，不挡领域必中，替换现有造物。');
  }
  if(has(e,'copyStudy')){
   const allies=e.units.map((u,i)=>({u,i})).filter(({u})=>u.alive&&u.side===e.player.side&&!u.isPlayer&&!u.summonTag&&borrowable.has(u.flag));
   for(const {u:ally,i} of allies)row('techbuild_borrow:'+i,'借式 · '+ally.techName,'一次行动与6%咒力；下次施术借用 '+ally.name+' 的 '+ally.techName+'，随后归还。');
   if(!allies.length)row('techbuild_borrow:none','借式 · 等待同伴','支持十划、刍灵、火灾、淀月、蛊毒、不义游戏；其余能力仍待适配。','暂无可借用同伴');
  }
  return rows;
 };
 const act=proto.playerAct;proto.playerAct=function(action,targetIndex){
  if(action.startsWith('techbuild_')){
   const row=PS.commands(this).find(x=>x.id===action),u=this.player,ev=[],s=state(this);
   const retry=text=>({events:[{type:'info',text}],retryInput:true,needInput:this.awaitingPlayer,ended:this.ended});
   if(!this.awaitingPlayer||this.ended||this.pendingDomain||!u.alive)return retry('等待你的行动。');
   if(!row||row.reason)return retry(row?.reason||'当前人物尚未掌握这一专精。');
   this.awaitingPlayer=false;u.cp-=row.cost;u.traitAction='tech';
   if(action==='techbuild_blades'||action==='techbuild_armor'){
    s.construct={kind:action==='techbuild_blades'?'blades':'armor',left:2};say(ev,row.label+'准备完成 · 两次有效命中后消耗。');
   }else{const ally=this.units[Number(action.split(':')[1])];s.borrow={flag:ally.flag,name:ally.techName,source:ally.name};say(ev,'借式准备 · '+ally.name+' / '+ally.techName+'；下一次施术临时借用。');}
   ev.push({type:'style',stylePhase:'charge',from:u.name,fromIndex:this.units.indexOf(u),text:row.label});
   this.afterAction(u,ev);return this.pack(ev);
  }
  const s=state(this),t=this.units[targetIndex]?.alive?this.units[targetIndex]:this.pickEnemyTarget();
  const packet=act.call(this,action,targetIndex);
  if(packet.retryInput)return packet;
  if(action==='defend'&&!this.ended){
   if(has(this,'guardCast')){s.guardCast=true;say(packet.events,'守势施术 · 下一次术式命中可推进自己的行动。');}
   if(has(this,'healReserve')){const n=Math.min(this.player.maxCp-this.player.cp,Math.round(this.player.maxCp*.03));this.player.cp+=n;if(n)say(packet.events,'续航储备 · 咒力 +'+n+'。');}
   if(has(this,'toxicCover')&&t&&toxic(this,t)){heal(this.player,packet.events,.03,'毒蚀掩护');t.atb=Math.max(0,t.atb-10);say(packet.events,'毒蚀掩护 · '+t.name+' 行动值 -10。');}
  }
  if(['defend','domain','ult','style_burst'].includes(action))s.chainUntil=-1;
  return packet;
 };
 const damage=proto.dealDamage;proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  originalHP(this,t);const direct=kind==='melee'||kind==='tech',s=state(this),player=u===this.player,eligible=player&&direct&&u.side!==t.side;
  const mark=!!t.traitEffects?.weak||t.traitEffects?.nail?.source===this.units.indexOf(u);
  const tox=eligible&&kind==='tech'&&toxic(this,t)&&has(this,'toxicBurst')&&ready(this,'toxicBurst');
  const alternate=eligible&&!u.techniqueBuildHit&&has(this,'alternation')&&s.lastKind&&s.lastKind!==kind&&ready(this,'alternation');
  if(tox)base*=1.25;if(alternate)base*=1.12;
  if(eligible&&has(this,'bloodEdge')&&u.hp<=u.maxHp*.5)base*=1.2;
  if(t===this.player&&direct&&u.side!==t.side&&has(this,'bloodEdge')&&t.hp<=t.maxHp*.5)base*=1.1;
  const riposte=eligible&&kind==='tech'&&s.riposte&&has(this,'guardRiposte');if(riposte)base*=1.2;
  const blade=eligible&&kind==='melee'&&s.construct?.kind==='blades'&&ready(this,'construct');if(blade)base*=1.2;
  const armor=t===this.player&&direct&&u.side!==t.side&&s.construct?.kind==='armor';if(armor)base*=.8;
  const n=damage.call(this,u,t,base,mult,kind,ev,...rest);
  if(!(n>0))return n;
  if(t===this.player&&direct&&u.side!==t.side&&t.buff.defend&&has(this,'guardRiposte'))s.riposte=true;
  if(armor&&--s.construct.left===0)s.construct=null;
  if(!eligible)return n;
  u.techniqueBuildHit=true;
  if(tox){spend(this,'toxicBurst');if(t.buff.gu>0)t.buff.gu--;else if(t.buff.poison>0)t.buff.poison--;say(ev,'侵蚀引爆 · 利用已有侵蚀，额外伤害25%。');}
  if(alternate){spend(this,'alternation');say(ev,'交替衔接 · '+(kind==='tech'?'体术→施术':'施术→体术')+'，伤害+12%。');}
  if(blade){spend(this,'construct');if(--s.construct.left===0)s.construct=null;say(ev,'造物刃阵 · 有效近战伤害+20%。');}
  if(riposte){s.riposte=false;say(ev,'防护反攻 · 守势后的施术伤害+20%。');}
  if(mark&&has(this,'weakFollow')&&ready(this,'weakFollow')){spend(this,'weakFollow');advance(u,12);say(ev,'标记追打 · 行动值 +12。');}
  if(controlled(t)&&has(this,'controlFollow')&&ready(this,'controlFollow')){spend(this,'controlFollow');t.atb=Math.max(0,t.atb-12);say(ev,'控后追打 · '+t.name+' 行动值 -12。');}
  if(kind==='tech'&&s.guardCast&&has(this,'guardCast')){s.guardCast=false;advance(u,12);say(ev,'守势施术 · 行动值 +12。');}
  if(s.healReady&&has(this,'healFollow')){s.healReady=false;advance(u,12);say(ev,'复原追击 · 行动值 +12。');}
  if(kind==='tech'&&has(this,'adaptCast')&&ready(this,'adaptCast')){spend(this,'adaptCast');refund(this,ev,.15,'应变施术');}
  if(matchup(this,t)&&has(this,'typeFollow')&&ready(this,'typeFollow')){spend(this,'typeFollow');advance(u,12);say(ev,'识别追击 · 行动值 +12。');}
  if(has(this,'tempo')&&ready(this,'tempo')){spend(this,'tempo');advance(u,12);say(ev,'抢势出手 · 行动值 +12。');}
  if(u.arsenalMove==='charged'&&has(this,'castBreak')&&ready(this,'castBreak')){
   const f=DC.active(this,t);if(f&&f.side!==u.side){spend(this,'castBreak');f.stability=Math.max(0,f.stability-6);if(f.stability<=0)DC.collapse(this,f,ev,'聚能破界');else ev.push({type:'domain_state',domainSnapshot:DC.snapshot(this),text:'聚能破界 · 稳定度 -6。'});}
  }
  return n;
 };
 const strike=proto.performStrike;proto.performStrike=function(u,t,kind,ev){
  u.techniqueBuildHit=false;
  const s=state(this),start=ev.length,player=u===this.player,borrow=player&&kind==='tech'&&t?.alive&&!reason(this)&&s.borrow;
  const oldFlags=u.flags;if(borrow){s.borrow=null;u.flags=[...new Set([...oldFlags,borrow.flag])];say(ev,'借式施放 · '+borrow.source+' / '+borrow.name+'。');}
  try{strike.call(this,u,t,kind,ev);}finally{u.flags=oldFlags;}
  if(!player||!t)return;
  const landed=ev.slice(start).some(h=>h.dmg>0&&h.fromIndex===this.units.indexOf(u)&&h.toIndex===this.units.indexOf(t)&&h.attackKind===kind);
  if(!landed)return;
  if(ready(this,'attackRecord')){
   spend(this,'attackRecord');
   if(has(this,'cadence')&&kind==='melee'){if(++s.hits%3===0){const n=Math.min(u.maxCp-u.cp,Math.round(u.maxCp*.03));u.cp+=n;if(n)say(ev,'接触节奏 · 三次命中，咒力 +'+n+'。');}}
   if(kind==='tech'&&has(this,'castChain')){if(s.chainUntil>=stamp(this))refund(this,ev,.25,'连式回路');s.chainUntil=stamp(this)+2;}else s.chainUntil=-1;
   s.lastKind=kind;
  }
  if(kind==='tech'&&controlled(t)&&has(this,'controlFlow')&&ready(this,'controlFlow')){spend(this,'controlFlow');refund(this,ev,.25,'命令回路');}
  if(kind==='tech'&&has(this,'bloodRecovery')&&ready(this,'bloodRecovery')&&!this.ended){spend(this,'bloodRecovery');heal(u,ev,.04,'血偿回补');}
 };
 const turn=proto.onTurnStart;proto.onTurnStart=function(u,ev){const hp=u.hp;turn.call(this,u,ev);if(u===this.player&&u.alive&&u.hp>hp&&has(this,'healFollow')){state(this).healReady=true;say(ev,'复原追击准备 · 下一次实际命中推进行动。');}};
 const notes=window.BattleTraits.status;window.BattleTraits.status=function(e,u){const rows=notes(e,u);if(u!==e.player)return rows;const s=state(e);if(s.construct)rows.push((s.construct.kind==='blades'?'造物刃阵':'造物护甲')+' · '+s.construct.left+'次');if(s.borrow)rows.push('借式待命 · '+s.borrow.name);if(s.guardCast)rows.push('守势施术就绪');if(s.riposte)rows.push('防护反攻就绪');if(s.healReady)rows.push('复原追击就绪');return rows;};
 window.TechniqueBuildCombat={state,has,borrowable,matchup};
})();
