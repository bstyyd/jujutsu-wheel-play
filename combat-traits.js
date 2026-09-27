/* Battle-only traits. Canon motifs are adapted to turns; no persistent player mutation. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype,dc=()=>window.DomainCombat;
 const rules={
  '无量空处':{tag:'信息过载',text:'不直接造成领域伤害；每个敌人首次行动被压制，之后输出降低20%。',counter:'展开领域抵消控制，或由同伴击破施术者。'},
  '伏魔御厨子':{tag:'连续斩击 · 开放',text:'每次必中分成三段斩击；对攻时从外侧额外削减封闭结界12稳定度。',counter:'攻击宿傩削弱稳定度；防御可稳固自己的领域。'},
  '嵌合暗翳庭':{tag:'影之增幅 · 未完成',text:'没有必中；自身术式伤害+20%，自己的式神伤害+30%。可牵制对方必中，但对攻额外损失12稳定度。',counter:'优先击破伏黑或其式神；增幅在对攻期间仍生效。'},
  '盖棺铁围山':{tag:'熔岩 · 灼热',text:'必中伤害降低为原基础的70%；敌人每次行动前受到灼热伤害。',counter:'展开领域暂停灼热与必中；防御可减轻伤害。'},
  '自闭圆顿裹':{tag:'灵魂触及',text:'必中伤害降低为原基础的75%；敌方输出降低20%。',counter:'领域对攻暂停灵魂压制；打破领域即可解除。'},
  '荡蕴平线':{tag:'死累累涌军',text:'65%基础必中扫击全体，再对标记目标追加70%基础伤害。目标倒下后重新标记。',counter:'标记目标防御，其余同伴集中攻击陀艮。'},
  '诛伏赐死':{tag:'简化判决 · 没收',text:'无直接伤害。优先没收咒具效果；没有咒具者无法主动使用术式、极之番或领域，生得术式被封。',counter:'在判决成立前展开领域；判决后用体术击破日车。装备不会从存档丢失。'},
  '坐杀博徒':{tag:'抽奖 · 咒力奖金',text:'无直接伤害；展开及维持时抽奖，35%中奖，第三次保底。中奖后收起领域，随后3次行动回满咒力并恢复25%生命。',counter:'在中奖前击破秤；奖金不是无敌，爆发仍可将其击倒。概率与时长为本作改编。'},
  '胎藏遍野':{tag:'重力压制',text:'基础必中；敌方每次行动后行动值回退20。',counter:'对攻抵消压制；集中火力击破施术者。'},
  '真赝相爱':{tag:'刀阵 · 交替连携',text:'基础必中；领域内术式命中后，下一次体术伤害+35%。',counter:'注意施术者的连携状态；刀阵强化在对攻中保留。'},
  '时胞月宫殿':{tag:'帧规则',text:'基础必中降低为70%；敌方使用攻击指令后承受帧规则反噬，防御不触发。',counter:'选择防御等待窗口，或展开领域抵消帧规则。'},
  '朵颐光海':{tag:'花海牵制 · 游戏扩展',text:'必中降为60%；敌人行动前流失5%最大咒力。完整规则未在动画展示，这里是主题玩法。',counter:'展开领域暂停咒力流失，或集中攻击花御。'}
 };
 const fallback={tag:'基础领域',text:'维持期间结算基础必中伤害；对攻时必中抵消。',counter:'攻击施术者削弱稳定度，或展开自己的领域。'};
 const info=name=>rules[window.BattleScenes.name(name)]||fallback;
 const fs=e=>dc().fields(e),solo=(e,f)=>!fs(e).some(g=>g.side!==f.side);
 const hostiles=(e,u)=>fs(e).filter(f=>f.side!==u.side&&solo(e,f));
 const fieldType=(e,f)=>f.traitName||'';
 const court=(e,u)=>hostiles(e,u).some(f=>fieldType(e,f)==='诛伏赐死');
 const sealed=(e,u)=>court(e,u)&&!u.equipmentId;
 const toolSealed=(e,u)=>!!u.equipmentId&&court(e,u);
 const blocked=(e,u,action)=>sealed(e,u)&&['tech','ult','domain'].includes(action)?'判决没收：术式暂时封锁，使用体术或防御。':'';
 const effects=u=>u.traitEffects||(u.traitEffects={});
 const mark=(u,key,source,turns=2)=>{effects(u)[key]={source,left:turns};};
 const say=(ev,text)=>ev.push({type:'skill',text});
 const heal=(u,amount,ev,label)=>{const actual=Math.min(u.maxHp-u.hp,Math.round(amount));u.hp+=actual;if(actual>0)ev.push({type:'heal',from:u.name,heal:actual,text:`${u.name}【${label}】恢复 ${actual} 生命。`});};
 function domainPulse(e,f,ev,opening){
  const name=fieldType(e,f),u=e.units[f.owner];if(!u?.alive)return true;
  const targets=e.alive(u.side==='ally'?'enemy':'ally');
  if(name==='坐杀博徒'){
   f.draws=(f.draws||0)+1;
   if(Math.random()<.35||f.draws>=3){u.traitJackpot=3;u.cp=u.maxCp;say(ev,`${u.name}【坐杀博徒】大奖！获得3次行动的咒力与生命补给。`);dc().collapse(e,f,ev,'抽中大奖，转入奖金时间');}
   else say(ev,`【坐杀博徒】第${f.draws}次抽奖未中；第三次保底。`);
   return true;
  }
  if(name==='嵌合暗翳庭'){say(ev,'【嵌合暗翳庭】影与式神增幅生效；不完整领域没有必中。');return true;}
  if(!solo(e,f))return true;
  if(name==='无量空处'||name==='诛伏赐死'){say(ev,`【${name}】${info(name).tag}生效，不结算直接伤害。`);return true;}
  const avg=(u.eff[0]+u.eff[1])/2,total=u.isPlayer?avg*6+u.maxCp*.06:avg*(u.side==='enemy'?3.5:5),base=total*(opening?.4:.2);
  const hit=(t,n,label)=>{if(t?.alive&&!e.ended&&fs(e).includes(f))e.dealDamage(u,t,Math.round(n),1,'domain',ev,label,false,true);};
  if(name==='荡蕴平线'){
   if(!e.units[f.focus]?.alive)f.focus=e.units.indexOf(targets.slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]);
   targets.forEach(t=>hit(t,base*.65,'死累累涌军·扫击'));hit(e.units[f.focus],base*.7,'死累累涌军·集中围攻');
  }else if(name==='伏魔御厨子'){
   for(let i=0;i<3;i++)for(const t of targets)hit(t,base/3,`伏魔御厨子·连续斩击 ${i+1}/3`);
  }else{
   const scale=name==='盖棺铁围山'||name==='时胞月宫殿'?.7:name==='自闭圆顿裹'?.75:name==='朵颐光海'?.6:1;
   targets.forEach(t=>hit(t,base*scale,`${f.name}·必中`));
  }
  e.checkEnd(ev);return true;
 }
 function beforeTurn(e,u,ev){
  if(u.traitJackpot>0){u.cp=u.maxCp;heal(u,u.maxHp*.25,ev,'咒力奖金');u.traitJackpot--;say(ev,`${u.name} 的奖金补给剩余 ${u.traitJackpot} 次行动。`);}
  for(const f of [...hostiles(e,u)]){
   const name=fieldType(e,f),owner=e.units[f.owner];
   if(name==='盖棺铁围山'){
    e.dealDamage(owner,u,Math.min(u.maxHp*.03,(owner.eff[0]+owner.eff[1])*.3),1,'domain',ev,'熔岩环境·灼热',false,true);e.checkEnd(ev);
    if(!u.alive||e.ended)return true;
   }
   if(name==='朵颐光海'){const loss=Math.min(u.cp,Math.round(u.maxCp*.05));u.cp-=loss;say(ev,`【花海牵制】${u.name} 流失 ${loss} 咒力。`);}
   if(name==='无量空处'){
    f.overloaded||=[];const id=e.units.indexOf(u);
    if(!f.overloaded.includes(id)){f.overloaded.push(id);u.intent=null;u.buff.defend=false;e.actionsTotal++;u.buff.actCount++;say(ev,`${u.name} 陷入【信息过载】，本次无法行动；同一领域只触发一次。`);e.afterAction(u,ev);return true;}
   }
  }
  return false;
 }
 const techniqueNotes={
  ratio:'命中留下弱点：下一次受到的体术/术式伤害+25%，2次自身行动内有效。',
  straw:'命中留下共鸣钉；再次用术式命中同一目标触发共鸣，目标行动值后退25。防御可清除钉。',
  projection:'术式命中定帧，目标跳过1次行动；同一目标需再经过2次行动才能再次定帧。',
  swap:'术式命中后交换扰乱，使目标下一次体术/术式伤害降低25%，2次自身行动内有效。',
  idleTrans:'术式命中造成灵魂扰动，目标输出降低20%，持续2次自身行动；防御可清除。',
  grow:'术式命中吸取目标最多10%最大咒力，恢复给自己。',
  cursedSpeech:'支付额外咒力可压制目标1次行动。',shadows:'自身行动时召唤/融合式神；暗翳庭内式神输出提升。',
  spiritControl:'使用战斗中击败或已吸收的敌人召唤式神。',puppet:'自动补充傀儡，傀儡优先承担敌人攻击。',
  seance:'从击败过的角色中召唤亡灵式神。',moon:'命中叠加淀月毒素，每层在行动前造成5%最大生命伤害。',
  gu:'命中叠加蛊毒，每层在行动前造成10%最大生命伤害。',rot:'命中可腐蚀目标本场生命上限。',
  limitless:'无下限可阻挡普通攻击；领域必中与天逆鉾近战能够突破。'
 };
 function description(e,u){return Object.entries(techniqueNotes).filter(([flag])=>e.hasFlag(u,flag)).map(([,s])=>s).join(' ');}
 const hasFlag=proto.hasFlag;proto.hasFlag=function(u,f){return !!u&&!sealed(this,u)&&hasFlag.call(this,u,f);};
 const strike=proto.performStrike;
 proto.performStrike=function(u,t,kind,ev){
  if(!t?.alive)return;
  const wasNailed=effects(t).nail?.source===this.units.indexOf(u),start=ev.length;
  const result=strike.call(this,u,t,kind,ev);
  const landed=ev.slice(start).some(x=>x.from===u.name&&x.to===t.name&&x.dmg>0);
  if(landed&&t.alive){
   const source=this.units.indexOf(u);
   if(this.hasFlag(u,'ratio')){mark(t,'weak',source);say(ev,`${t.name} 被标出【十划弱点】，下一击可利用。`);}
   if(this.hasFlag(u,'straw')){if(kind==='tech'&&wasNailed){delete effects(t).nail;t.atb=Math.max(0,t.atb-25);say(ev,`【共鸣】引爆钉印，${t.name} 行动值 -25。`);}else{mark(t,'nail',source);say(ev,`${t.name} 留下【共鸣钉】，可用术式引爆。`);}}
   if(kind==='tech'&&this.hasFlag(u,'projection')&&(t.traitClock||0)>=(t.traitFrameUntil||0)){t.buff.stun=Math.max(t.buff.stun,1);t.traitFrameUntil=(t.traitClock||0)+3;say(ev,`【定帧】${t.name} 下一次行动被冻结。`);}
   if(kind==='tech'&&this.hasFlag(u,'swap')){mark(t,'disrupt',source);say(ev,`【不义游戏】交换扰乱，${t.name} 下一次攻击威力降低。`);}
   if(kind==='tech'&&this.hasFlag(u,'idleTrans')){mark(t,'soul',source);say(ev,`${t.name} 受到【灵魂扰动】，防御可解除。`);}
   if(kind==='tech'&&this.hasFlag(u,'grow')){const n=Math.min(t.cp,Math.round(t.maxCp*.1));t.cp-=n;u.cp=Math.min(u.maxCp,u.cp+n);say(ev,`【生长术式】吸取 ${t.name} 的 ${n} 咒力。`);}
  }
  return result;
 };
 const hit=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  let factor=1;const direct=kind==='tech'||kind==='melee',mine=dc().active(this,u),debuff=effects(u),weak=effects(t).weak;
  if(direct){
   if(debuff.soul)factor*=.8;
   if(debuff.disrupt)factor*=.75;
   if(weak)factor*=1.25;
   for(const f of hostiles(this,u))if(['无量空处','自闭圆顿裹'].includes(fieldType(this,f)))factor*=.8;
   const shadow=fs(this).find(f=>fieldType(this,f)==='嵌合暗翳庭'&&f.side===u.side&&(f.owner===this.units.indexOf(u)||u.ownerName===f.actorName));
   if(shadow){if(u.summonTag)factor*=1.3;else if(kind==='tech')factor*=1.2;}
   if(mine?.traitName==='真赝相爱'&&mine.combo&&kind==='melee')factor*=1.35;
  }
  const result=hit.call(this,u,t,base*factor,mult,kind,ev,...rest);
  if(direct&&result>0){
   if(weak){delete effects(t).weak;say(ev,'弱点被利用，伤害提升25%。');}
   if(debuff.disrupt)delete debuff.disrupt;
   if(mine?.traitName==='真赝相爱'){mine.combo=kind==='tech';}
  }
  return result;
 };
 const player=proto.playerAct;
 proto.playerAct=function(action,...a){
  const reason=blocked(this,this.player,action);
  if(reason){this.awaitingPlayer=true;return {events:[{type:'info',text:reason}],ended:false,needInput:true,retryInput:true};}
  if(action==='defend'){
   const state=effects(this.player);delete state.nail;delete state.soul;
   const f=dc().active(this,this.player);if(f)f.stability=Math.min(100,f.stability+15);
  }
  this.player.traitAction=action;return player.call(this,action,...a);
 };
 const npc=proto.npcAct;
 proto.npcAct=function(u,ev){
  u.traitAction='attack';
  if(sealed(this,u)){u.intent=null;say(ev,`${u.name} 术式被没收，改用体术。`);const t=u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget();return this.performStrike(u,t,'melee',ev);}
  return npc.call(this,u,ev);
 };
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){
  if(this.pendingDomain?.owner===this.units.indexOf(u))return after.call(this,u,ev);
  for(const f of [...hostiles(this,u)]){
   if(f.traitName==='胎藏遍野')u.atb=Math.max(0,u.atb-20);
   if(f.traitName==='时胞月宫殿'&&['melee','tech','ult','attack'].includes(u.traitAction)){
    const caster=this.units[f.owner];this.dealDamage(caster,u,Math.min(u.maxHp*.03,(caster.eff[0]+caster.eff[1])*.3),1,'domain',ev,'违反帧规则',false,true);
   }
  }
  u.traitAction=null;u.traitClock=(u.traitClock||0)+1;
  for(const [key,s] of Object.entries(effects(u)))if(--s.left<=0)delete effects(u)[key];
  return after.call(this,u,ev);
 };
 const labels={weak:'弱点 +25%',nail:'共鸣钉 · 防御清除',soul:'灵魂扰动 -20% · 防御清除',disrupt:'交换扰乱 · 下次攻击 -25%'};
 function status(e,u){
  const list=Object.entries(u.traitEffects||{}).map(([key,s])=>`${labels[key]} · ${s.left}行动`);
  for(const f of hostiles(e,u)){
   if(f.traitName==='诛伏赐死')list.push(u.equipmentId?'咒具效果被没收':'术式被没收');
   if(f.traitName==='无量空处')list.push(f.overloaded?.includes(e.units.indexOf(u))?'信息压制 · 输出 -20%':'信息过载 · 首次行动受控');
   if(f.traitName==='自闭圆顿裹')list.push('灵魂触及 · 输出 -20%');
   if(f.traitName==='荡蕴平线'&&f.focus===e.units.indexOf(u))list.push('涌军集中目标');
  }
  if(u.buff.stun>0)list.push('受控 · 跳过 '+u.buff.stun+' 行动');
  if(u.traitJackpot>0)list.push('奖金补给 · '+u.traitJackpot+' 行动');
  if(dc().active(e,u)?.combo)list.push('刀阵连携 · 下次体术 +35%');
  return list;
 }
 window.BattleTraits={rules,info,description,techniqueNotes,domainPulse,beforeTurn,blocked,toolSealed,status,solo};
})();
