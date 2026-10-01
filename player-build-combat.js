/* Real engine hooks. Build state is copied into a battle, resources never persist. */
(() => {
 'use strict';
 const B=window.PlayerBuild,PS=window.PlayerStyles,DC=window.DomainCombat,proto=BattleEngine.prototype;
 const config=e=>e.cfg.playerBuild||B.fresh();
 const has=(e,id)=>config(e).equipped.includes(id);
 const clock=e=>e.player.resonanceClock||0;
 const state=e=>e.buildBattle||(e.buildBattle={riposte:false,flow:false,returned:0,erosion:0,followups:0,counters:0,returnedTotal:0});
 const mine=(e,u)=>!!u.summonTag&&u.ownerIndex===e.units.indexOf(e.player)&&u.side===e.player.side;
 const say=(ev,text)=>ev.push({type:'skill',text});
 const role=u=>/脱兔/.test(u.name)?'rabbit':/鵺/.test(u.name)?'nue':/贯牛/.test(u.name)?'ox':/玉犬/.test(u.name)?'dog':/傀儡/.test(u.name)?'puppet':'';
 PS.guardShare=(e)=>has(e,'shelter')?.50:.35;
 const commands=PS.commands;PS.commands=function(e){
  const rows=commands(e),f=PS.family(e.player),blocked=window.BattleTraits.blocked(e,e.player,'tech');
  for(const r of rows){
   const summonNotes={'style_deploy:dog':'近身追击 · 实际命中可以衔接玩家追击专精','style_deploy:rabbit':'掩护牵制 · 每次自身行动耗自身5%咒力，目标行动值-10，不造成伤害','style_deploy:nue':'空中电击 · 自身5%咒力，真实术式攻击；咒力不足改为近身攻击','style_deploy:ox':'先用一次自身行动蓄势，再以×1.80基础体术冲撞'};
   if(summonNotes[r.id])r.note=summonNotes[r.id];
   if(r.id==='style_protect'&&has(e,'shelter'))r.note=r.note.replace('35%','50%');
   if(r.id==='style_coordinate'){r.note=f==='shadows'?'锁定目标 · 式神行动值+'+(has(e,'relay')?60:40)+'；玉犬追击、脱兔牵制、鵺电击、贯牛蓄势，攻击仍由式神自身回合结算。':r.note;}
  }
  if(f==='puppet'){
   const cp=Math.max(1,Math.round(e.player.maxCp*.06));rows.push({id:'build_barrage',label:'炮击指令',cost:cp,note:'消耗一次玩家行动；傀儡行动值+25，下次自身行动耗自身5%咒力进行炮击。',reason:blocked||(!PS.owned(e).length?'先显现傀儡':e.player.cp<cp?'咒力不足':'')});
  }
  return rows;
 };
 const act=proto.playerAct;proto.playerAct=function(action,targetIndex){
  this.player.buildArsenalProc=false;
  if(action==='build_barrage'){
   const row=PS.commands(this).find(r=>r.id===action),ev=[],u=this.player;
   if(!this.awaitingPlayer||this.pendingDomain||this.ended||!u.alive||!row||row.reason)return {events:[{type:'info',text:row?.reason||'等待你的行动。'}],retryInput:true,ended:this.ended,needInput:this.awaitingPlayer};
   const t=this.units[targetIndex]?.alive&&this.units[targetIndex].side!==u.side?this.units[targetIndex]:this.pickEnemyTarget();if(!t)return {events:[],retryInput:true,needInput:true};
   this.awaitingPlayer=false;u.cp-=row.cost;u.traitAction='tech';PS.state(u).orders++;
   const sums=PS.owned(this);for(const s of sums){s.summonOrder={targetIndex:this.units.indexOf(t),boost:1.15,ability:'cannon'};s.atb=Math.min(99,s.atb+25);}
   ev.push({type:'style',stylePhase:'coordinate',from:u.name,fromIndex:0,toIndex:this.units.indexOf(t),ordered:sums.map(s=>this.units.indexOf(s)),text:'炮击待命 · '+sums.map(s=>s.name).join('、')});this.afterAction(u,ev);return this.pack(ev);
  }
  const packet=act.call(this,action,targetIndex);
  if(!packet.retryInput&&action==='defend'){
   if(has(this,'flow'))state(this).flow=true;
   if(config(this).vow==='reserve'){const n=Math.min(this.player.maxCp-this.player.cp,Math.round(this.player.maxCp*.04));this.player.cp+=n;say(packet.events,'节律回补 · 额外恢复 '+n+' 咒力。');}
  }
  if(!packet.retryInput&&action==='style_coordinate'&&has(this,'relay'))for(const s of PS.owned(this))if(s.summonOrder)s.atb=Math.min(99,s.atb+20);
  return packet;
 };
 const techCost=proto.techCost;proto.techCost=function(u){const n=techCost.call(this,u);return u.isPlayer&&config(this).vow==='reserve'?Math.ceil(n*1.2):n;};
 const damage=proto.dealDamage;proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  const direct=['melee','tech'].includes(kind),c=config(this),s=state(this),first=u.buildStrikeUsed!==true;
  if(direct){
   if(u.isPlayer&&c.vow==='rush')base*=1.15;if(t.isPlayer&&c.vow==='rush')base*=1.15;
   if(c.domain==='anchor'&&DC.active(this,this.player)){if(t.isPlayer)base*=.85;if(u.isPlayer)base*=.9;}
   if(u.buildPower)base*=u.buildPower;
  }
  const result=damage.call(this,u,t,base,mult,kind,ev,...rest);
  if(result>0&&direct){
   if(t.isPlayer&&t.buff.defend&&u.side!==t.side&&has(this,'counter'))s.riposte=true;
   if(mine(this,u)&&has(this,'pursuit')){t.buildOpening={owner:0,until:clock(this)+2};say(ev,u.name+' 创造了追击窗口 · 你的下一次命中可牵制 '+t.name+'。');}
   if(u.isPlayer&&t.buildOpening?.until>clock(this)&&has(this,'pursuit')){delete t.buildOpening;s.followups++;t.atb=Math.max(0,t.atb-18);say(ev,'召唤追击 · '+t.name+' 行动值 -18。');}
   if(u.isPlayer&&kind==='melee'&&s.riposte&&has(this,'counter')){s.riposte=false;s.counters++;u.atb=Math.min(99,u.atb+20);say(ev,'守势反击 · 你的行动值 +20。');}
   if(u.isPlayer&&kind==='tech'&&s.flow&&has(this,'flow')){s.flow=false;const n=Math.min(u.maxCp-u.cp,Math.ceil(this.techCost(u)*.25));u.cp+=n;say(ev,'收束回路 · 命中后返还 '+n+' 咒力。');}
   if(u.isPlayer&&first&&!u.buildArsenalProc&&u.arsenalMove&&has(this,u.arsenalMove==='charged'?'focus':'blade')){u.buildArsenalProc=true;const n=u.arsenalMove==='charged'?20:15;t.atb=Math.max(0,t.atb-n);say(ev,'构筑压制 · '+t.name+' 行动值 -'+n+'。');}
   if(mine(this,u)&&u.buildAbility==='cannon'&&has(this,'battery')){const n=Math.min(this.player.maxCp-this.player.cp,Math.max(0,Math.round(this.player.maxCp*.04)-s.returned),Math.round(this.player.maxCp*.02));this.player.cp+=n;s.returned+=n;s.returnedTotal+=n;if(n)say(ev,'炮击回路 · 你的咒力 +'+n+'。');}
   if(mine(this,u)&&c.domain==='escort'&&DC.active(this,this.player)&&s.erosion<6){const f=DC.active(this,t);if(f&&f.side!==u.side){const n=Math.min(3,6-s.erosion);s.erosion+=n;f.stability=Math.max(0,f.stability-n);if(f.stability<=0)DC.collapse(this,f,ev,'召唤物协同击破');else ev.push({type:'domain_state',domainSnapshot:DC.snapshot(this),text:'协同争夺 · 对方领域稳定度 -'+n+'。'});}}
   u.buildStrikeUsed=true;
  }
  return result;
 };
 const strike=proto.performStrike;proto.performStrike=function(u,t,kind,ev){u.buildStrikeUsed=false;const start=ev.length;strike.call(this,u,t,kind,ev);for(const h of ev.slice(start))if(h.dmg>0&&h.fromIndex===this.units.indexOf(u)&&u.buildAbility)h.summonAbility=u.buildAbility;};
 const npc=proto.npcAct;proto.npcAct=function(u,ev){
  if(!mine(this,u)||!['shadows','puppet'].includes(PS.family(this.player)))return npc.call(this,u,ev);
  if(window.BattleTraits.blocked(this,this.player,'tech')){say(ev,'术式封锁 · '+u.name+' 本次无法执行术式指令。');return;}
  const r=role(u),order=u.summonOrder,chosen=this.units[order?.targetIndex],t=chosen?.alive&&chosen.side!==u.side?chosen:this.pickEnemyTarget();if(!t)return;
  const cp=Math.max(1,Math.round(u.maxCp*.05));
  if(r==='rabbit'){
   if(u.cp>=cp){u.cp-=cp;t.atb=Math.max(0,t.atb-10);ev.push({type:'style',stylePhase:'coordinate',from:u.name,fromIndex:this.units.indexOf(u),toIndex:this.units.indexOf(t),ordered:[this.units.indexOf(u)],text:'脱兔掩护 · '+t.name+' 行动值 -10，不造成伤害。'});}else say(ev,'脱兔咒力不足，维持掩护位置。');return;
  }
  if(r==='ox'&&!u.buildOxReady){u.buildOxReady=true;ev.push({type:'style',stylePhase:'charge',from:u.name,fromIndex:this.units.indexOf(u),text:'贯牛蓄势 · 下一次自身行动冲撞。'});return;}
  const cannon=r==='puppet'&&(order?.ability==='cannon'||has(this,'battery')),special=r==='nue'||cannon,kind=special&&u.cp>=cp?'tech':'melee';
  if(kind==='tech')u.cp-=cp;
  u.buildAbility=kind==='tech'?(r==='nue'?'electric':'cannon'):r==='ox'?'charge':'';u.buildPower=(kind==='tech'?(order?.boost||1):1)*(r==='ox'?1.8:1);
  try{this.performStrike(u,t,kind,ev);}finally{u.buildAbility='';u.buildPower=0;if(r==='ox')u.buildOxReady=false;}
 };
 const after=proto.afterAction;proto.afterAction=function(u,ev){
  if(this.pendingDomain?.owner===this.units.indexOf(u))return after.call(this,u,ev);
  const c=config(this),f=u.isPlayer&&DC.active(this,u),opening=!!f?.fresh;
  if(f&&!f.fresh&&['pressure','escort'].includes(c.domain)){
   const n=Math.max(1,Math.round(u.maxCp*.02));if(u.cp<n)DC.collapse(this,f,ev,'构筑方向所需咒力不足');else{u.cp-=n;say(ev,'领域构筑维持 · 额外消耗 '+n+' 咒力。');}
  }
  after.call(this,u,ev);
  if(u.isPlayer){
   state(this).returned=0;state(this).erosion=0;
   for(const t of this.units)if(t.buildOpening?.until<=clock(this))delete t.buildOpening;
   const own=DC.active(this,u),enemy=own&&DC.fields(this).find(g=>g.side!==u.side);
   if(!opening&&!this.ended&&own&&enemy&&c.domain==='pressure'){enemy.stability=Math.max(0,enemy.stability-4);if(enemy.stability<=0)DC.collapse(this,enemy,ev,'加压对攻击破');else ev.push({type:'domain_state',domainSnapshot:DC.snapshot(this),text:'加压对攻 · 对方领域稳定度 -4。'});}
  }
 };
 const notes=window.BattleTraits.status;window.BattleTraits.status=function(e,u){const rows=notes(e,u);if(u.isPlayer){if(state(e).riposte)rows.push('反击就绪');if(state(e).flow)rows.push('回路收束');}if(u.buildOpening?.until>clock(e))rows.push('玩家追击窗口');if(mine(e,u)){rows.push(({dog:'近身追击',rabbit:'掩护牵制',nue:'空中电击',ox:'蓄势冲撞',puppet:has(e,'battery')?'炮击回路':'近战 / 炮击待命'})[role(u)]||'融合输出');}return rows;};
 window.PlayerBuildCombat={has,config,state,role,mine};
})();
