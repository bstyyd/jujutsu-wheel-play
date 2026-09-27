/* Battle chrome is a view over existing controls; it never owns a turn or a save. */
(() => {
 'use strict';
 const get=id=>document.getElementById(id), esc=s=>HD.escape(s);
 let pending=null,preview='actMelee',lastRun=-1;
 const actionsById={actMelee:'melee',actTech:'tech',actDomain:'domain',actDefend:'defend',actUlt:'ult'};
 const touch=()=>matchMedia('(max-width:600px), (pointer:coarse)').matches;
 const commandInfo={
  actMelee:['体术','近身攻击，保留咒力。'],
  actTech:['术式','使用当前术式攻击选中的敌人。'],
  actDomain:['领域展开','展开生得领域；对方领域生效时可进行对抗。'],
  actDefend:['防御','承受伤害减半，回复 8% 咒力。防御持续到下次自身行动。'],
  actUlt:['极之番','攻击敌方全体并回复自身生命；每场战斗可使用一次。'],
  actFlee:['撤退','按当前任务的撤退规则离开战斗。']
 };
 function strikeInfo(id,eng,enemy){
  if(id==='actDomain'){const d=window.BattleTraits?.info(eng.player.domainName);return d?d.text+' 应对：'+d.counter:commandInfo[id][1];}
  if(id==='actDefend')return commandInfo[id][1]+' 清除共鸣钉与灵魂扰动。'+(DomainCombat.active(eng,eng.player)?' 稳固己方领域，恢复15稳定度。':'');
  if(!['actMelee','actTech'].includes(id))return commandInfo[id][1];
  const p=eng.player,has=f=>eng.hasFlag(p,f),tech=id==='actTech',notes=[tech?'以咒力效率攻击选中目标。':'近身攻击，不消耗咒力。'];
  if(!tech&&p.equipmentId)notes.push(window.BattleTraits?.toolSealed(eng,p)?'咒具效果暂时被没收，本次按普通体术结算。':window.Equipment?.combatDescription(p)||'');
  if(tech&&has('cleave'))notes.push(`本次：${['解','捌','开','灶'][((p.buff.actCount-1)%4+4)%4]}，四式依次轮换。`);
  if(!tech&&has('ratio'))notes.push('十划：体术伤害提高 50%。');
  if(!tech&&has('straw'))notes.push('共鸣：追加咒力效率 50% 的伤害。');
  if(has('idleTrans'))notes.push(tech?'追加体术伤害。':'追加术式伤害。');
  if(tech&&has('blood'))notes.push(`以血为武：消耗 ${Math.round(p.maxHp*.1)} 生命。`);
  if(has('amber'))notes.push(`燃烧 ${Math.round(p.maxHp*.2)} 生命，转为附加伤害。`);
  if(has('moon'))notes.push('命中后叠加毒素。');
  if(has('rot'))notes.push('伤害同时削减目标生命上限。');
  if(tech&&has('cursedSpeech')&&enemy){const extra=p.skills?.sixEyes?0:Math.round(p.maxCp*.05+enemy.maxCp*.02);notes.push(`额外支付 ${extra} CP 可控制目标一次行动；咒力不足时只攻击。`);}
  if(window.BattleTraits)notes.push(window.BattleTraits.description(eng,p));
  return notes.join(' ');
 }
 function facts(id,eng=BattleUI.eng){
  const p=eng.player,cost=id==='actTech'?eng.techCost(p):id==='actDomain'?DomainCombat.cost(p):id==='actUlt'?Math.round(p.maxCp*.5):0;
  let reason='';
  if(id==='actDomain')reason=!p.canDomain?'尚未领悟领域':DomainCombat.fields(eng).some(f=>f.side===p.side)?'己方已有领域':p.domainCd>0?'领域熔断中':'';
  if(id==='actUlt')reason=!p.canUlt?'尚未领悟极之番':p.ultUsed?'本场已使用':'';
  if(!reason)reason=window.BattleTraits?.blocked(eng,p,actionsById[id])||'';
  if(!reason&&p.cp<cost)reason=`咒力不足 · 还需 ${cost-p.cp}`;
  if(!reason&&(!eng.awaitingPlayer||eng.ended))reason=eng.ended?'战斗已结束':'等待你的回合';
  const chosen=eng.units[BattleUI.selectedTargetIdx],enemy=chosen?.alive&&chosen.side==='enemy'?chosen:null;
  return {cost,reason,enemy,target:id==='actDefend'?'自身':id==='actDomain'||id==='actUlt'?'敌方全体':id==='actFlee'?'离开本场':enemy?.name||'自动选择敌人'};
 }
 function portrait(node,unit){
  if(!node||!unit)return;
  node.textContent=unit.isPlayer?'你':unit.name.slice(0,2);
  node.setAttribute('aria-label',unit.name);
 }
 function describe(id){
  const info=get('commandDescription'),eng=BattleUI.eng;
  if(!info||!eng||!commandInfo[id])return;
  preview=id;
  const label=id==='actMelee'&&eng.player.equipmentId?'咒具攻击':commandInfo[id][0],f=facts(id,eng),body=strikeInfo(id,eng,f.enemy);
  const skill=id==='actTech'?(eng.player.techName||eng.cfg.player.technique.name):id==='actDomain'?(eng.player.domainName||label):label;
  let enemyInfo='';
  if(f.enemy&&eng.cfg.v3){const p=Tactics.plan(eng,f.enemy),target=Tactics.target(eng,f.enemy,p.target);enemyInfo=f.enemy.buff.stun?'目标受控，本次行动跳过':`${f.enemy.name} 下次：${p.label}${p.action==='charge'?' · 蓄力':p.scope==='all'?' → 己方全体':target?' → '+target.name:''}`;}
  let copy=info.querySelector('.command-copy');if(!copy){copy=document.createElement('div');copy.className='command-copy';info.prepend(copy);}
  copy.innerHTML=`<span class="command-caption">${touch()?'先选指令，再确认施放':'战斗指令'}</span><strong>${esc(skill)}</strong><p>${esc(body)}</p><div class="command-facts"><span>${f.cost?`消耗 ${f.cost} CP`:'无需消耗咒力'}</span><span>目标：${esc(f.target)}</span></div>${f.reason?`<p class="command-reason">${esc(f.reason)}</p>`:''}${enemyInfo?`<p class="command-enemy">${esc(enemyInfo)}</p>`:''}`;
  let confirm=get('confirmCommand');if(!confirm){confirm=document.createElement('button');confirm.id='confirmCommand';confirm.className='btn';info.append(confirm);}
  confirm.hidden=!pending;
  if(pending){confirm.textContent=`确认${label}${['actMelee','actTech'].includes(id)?' → '+f.target:''}`;confirm.disabled=!!f.reason;confirm.onclick=()=>{if(!pending||pending.runId!==BattleUI.runId||facts(pending.id).reason)return;const action=actionsById[pending.id];pending=null;confirm.hidden=true;SFX.click();BattleUI.input(action);};}
  for(const b of document.querySelectorAll('#bfActions button'))b.setAttribute('aria-pressed',pending?.id===b.id?'true':'false');
 }
 function sync(){
  const actions=get('bfActions'),eng=BattleUI.eng,modal=get('modalBox');
  if(!actions||!eng)return;
  if(lastRun!==BattleUI.runId){lastRun=BattleUI.runId;pending=null;preview='actMelee';}
  if(!eng.awaitingPlayer||eng.ended||BattleUI.auto)pending=null;
  // A visible default selection makes the preview and the eventual strike agree.
  const chosen=eng.units[BattleUI.selectedTargetIdx];
  if(eng.awaitingPlayer&&(!chosen?.alive||chosen.side!=='enemy')){
   const first=eng.alive('enemy').slice().sort((a,b)=>a.hp-b.hp)[0];
   if(first)BattleUI.selectedTargetIdx=eng.units.indexOf(first);
  }
  for(const card of document.querySelectorAll('#bfEnemy .unit'))card.classList.toggle('selected',Number(card.dataset.idx)===BattleUI.selectedTargetIdx);
  modal.classList.add('battle-v2','battle-compact');
  let header=modal.querySelector('.battle-v2-header');
  if(!header){
   header=document.createElement('header');header.className='battle-v2-header';
   const heading=document.createElement('div');heading.className='battle-v2-heading';
   const kicker=document.createElement('span');kicker.className='battle-kicker';kicker.textContent='咒术任务';heading.append(kicker);
   const title=modal.querySelector('h2');if(title)heading.append(title);
   header.append(heading);modal.prepend(header);
   const deck=document.createElement('div');deck.className='battle-command-deck';
   const info=document.createElement('section');info.id='commandDescription';info.className='command-description';
   info.setAttribute('aria-label','指令说明');deck.append(actions,info);modal.append(deck);
   actions.addEventListener('pointerover',e=>{const b=e.target.closest('button');if(b&&!pending)describe(b.id);});
   actions.addEventListener('focusin',e=>{if(!pending)describe(e.target.id);});
   actions.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!actionsById[b.id]||!touch()||b.disabled)return;
    e.preventDefault();e.stopImmediatePropagation();
    clearTimeout(BattleUI._autoTimer);BattleUI.auto=false;get('btnAuto').textContent='关';get('btnAuto').classList.remove('on');
    pending={id:b.id,runId:BattleUI.runId};describe(b.id);
   },true);
   describe('actMelee');
  }
  const move=(selector,parent)=>{const n=modal.querySelector(selector);if(n&&n.parentElement!==parent)parent.append(n);};
  move('#missionStatus',header.querySelector('.battle-v2-heading'));
  move('.seq-wrap',header);
  const field=modal.querySelector('.battle-field');
  move('#domainStatus',field);
  let roster=modal.querySelector('.battle-roster');
  if(!roster){roster=document.createElement('section');roster.className='battle-roster';roster.setAttribute('aria-label','双方战斗状态');field.after(roster);}
  for(const side of ['ally','enemy']){
   move('.side-col.'+side,roster);
   const column=roster.querySelector('.side-col.'+side),units=eng.units.filter(u=>u.side===side),fallen=units.filter(u=>u.summonTag&&!u.alive).length;
   column.querySelector('h4').textContent=(side==='ally'?'我方':'敌方 · 点击选中')+(fallen?' · '+fallen+' 个召唤物退场':'');
   for(const card of column.querySelectorAll('.unit')){
    const unit=eng.units[Number(card.dataset.idx)];card.hidden=!!unit?.summonTag&&!unit.alive;
   }
  }
  const deck=modal.querySelector('.battle-command-deck');
  move('.battle-tools',deck);
  const tools=deck.querySelector('.battle-tools'),log=get('bfLog');
  if(tools&&log&&!log.closest('details')){
   const history=document.createElement('details');history.className='battle-history';
   const summary=document.createElement('summary');summary.textContent='战斗记录';
   history.append(summary,log);tools.append(history);
  }
  move('#bfTip',deck.querySelector('.command-description'));
  // Keep reaction buttons in the same visible deck, above normal commands.
  if(get('domainReaction'))deck.classList.add('has-reaction');else deck.classList.remove('has-reaction');
  const first=eng.awaitingPlayer?eng.player:null,seq=eng.previewOrder(8,first);
  modal.querySelectorAll('.seq-node').forEach((node,i)=>portrait(node.querySelector('.seq-ava'),seq[i]));
  const hint=get('bfTip');if(hint){hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');}
  const key=pending?.id||Object.keys(commandInfo).find(id=>get(id)===document.activeElement)||preview;
  for(const [id,[label]] of Object.entries(commandInfo)){
   const b=get(id);if(!b)continue;
   const p=eng.player;
   const text=id==='actMelee'&&p.equipmentId?'咒具攻击':id==='actDomain'?(DomainCombat.active(eng,p)?'领域维持中':p.domainCd>0?'领域熔断中':p.canDomain&&p.cp<DomainCombat.cost(p)?'领域 · 咒力不足':'领域展开'):label;
   const f=facts(id,eng),cost=f.cost;
   if(id!=='actFlee')b.disabled=!!f.reason;
   const why=f.reason&&!f.reason.startsWith('等待')?f.reason:'';
   b.title=why||`${label} · ${cost} CP`;
   b.innerHTML=`<span>${esc(text)}</span><small class="${why?'unavailable':''}">${esc(why||(id==='actDefend'?'回复 8% CP':cost?cost+' CP':id==='actFlee'?'离开战斗':'0 CP'))}</small>`;
  }
  describe(key);
  const place=BattleScenes.battle(eng.cfg,Game.day).place;
  field.setAttribute('aria-label',place+'；己方在左，敌方在右');
  window.HDStage?.layout();
 }
 const after=(owner,name)=>{const prior=owner[name];owner[name]=function(...args){const result=prior.apply(this,args);sync();return result;};};
 for(const key of ['render','waitInput'])after(BattleUI,key);
 // Observe reaction insertion and modal replacement, not every turn's descendant text.
 new MutationObserver(()=>{if(get('bfActions'))sync();else get('modalBox').classList.remove('battle-v2','battle-compact');}).observe(get('modalBox'),{childList:true});
 window.BattlePresentation={sync,describe,facts,version:3};
})();
