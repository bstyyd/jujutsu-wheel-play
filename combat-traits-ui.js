(() => {
 'use strict';
 const get=id=>document.getElementById(id),esc=s=>HD.escape(String(s)),traits=window.BattleTraits;
 let clashTimer;
 function refresh(){
  const e=BattleUI.eng,box=get('commandDescription');if(!e||!box)return;
  let ledger=get('battleTraitLedger');
  if(!ledger){ledger=document.createElement('details');ledger.id='battleTraitLedger';ledger.className='battle-trait-ledger';ledger.innerHTML='<summary>状态与领域规则</summary><div></div>';box.append(ledger);}
  const rows=e.alive().map(u=>({u,notes:traits.status(e,u)})).filter(r=>r.notes.length);
  const fields=DomainCombat.fields(e);
  ledger.querySelector('div').innerHTML=(rows.length?rows.map(({u,notes})=>`<p><b>${esc(u.name)}</b><span>${notes.map(esc).join(' / ')}</span></p>`).join(''):'<p class="muted">暂无控制或标记状态。</p>')+fields.map(f=>{const rule=traits.info(f.traitName);return `<article><b>${esc(f.actorName)} · ${esc(f.name)}</b><p>${esc(rule.text)}</p><small>应对：${esc(rule.counter)}</small></article>`;}).join('')+'<small>回合数、概率与倍率为本作平衡规则；未公开领域采用基础规则。</small>';
  ledger.querySelector('summary').textContent=`状态与领域规则${rows.length?' · '+rows.length+' 人受影响':''}`;
  for(const card of document.querySelectorAll('#bfAlly .unit,#bfEnemy .unit')){
   const u=e.units[Number(card.dataset.idx)];if(!u)continue;
   let badge=card.querySelector('.trait-status');
   const notes=traits.status(e,u);if(!notes.length){badge?.remove();continue;}
   if(!badge){badge=document.createElement('div');badge.className='trait-status';card.querySelector('.unit-info')?.append(badge);}
   badge.textContent=notes[0];badge.title=notes.join(' / ');
  }
  const melee=get('actMelee');if(melee&&traits.toolSealed(e,e.player)){const label=melee.querySelector('span');if(label)label.textContent='体术 · 咒具被没收';}
  const f=DomainCombat.active(e,e.player),defend=get('actDefend');
  if(f&&defend){const label=defend.querySelector('span');if(label)label.textContent='防御 · 稳固领域';}
  const shown=BattleUI.domainShown||fields;
  if(shown.length>1){
   let ribbon=get('domainClashBanner');
   if(!ribbon){ribbon=document.createElement('div');ribbon.id='domainClashBanner';ribbon.className='domain-clash-banner';ribbon.setAttribute('role','status');box.prepend(ribbon);}
   const own=shown.find(x=>x.side==='ally'),enemy=shown.find(x=>x.side==='enemy');
   ribbon.innerHTML=`<span>${esc(own.name)}</span><b>领域对攻</b><span>${esc(enemy.name)}</span><small>必中抵消 · 击破施术者 / 防御稳固</small>`;
  }else get('domainClashBanner')?.remove();
 }
 for(const name of ['render','waitInput']){const prior=BattleUI[name];BattleUI[name]=function(...a){const result=prior.apply(this,a);refresh();return result;};}
 const draw=DomainPresentation.draw;DomainPresentation.draw=function(...a){const result=draw.apply(this,a);refresh();return result;};
 const sfx=BattleUI.sfxFor;BattleUI.sfxFor=function(event){
  const result=sfx.call(this,event);if(event.domainSnapshot)refresh();
  if(event.type==='domain_clash'&&event.domainSnapshot?.length===2&&event.domainPhase==='engage'){
   get('domainClashFlash')?.remove();clearTimeout(clashTimer);
   const flash=document.createElement('div');flash.id='domainClashFlash';flash.className='domain-clash-flash';flash.setAttribute('aria-hidden','true');
   const a=event.domainSnapshot.find(f=>f.side==='ally'),b=event.domainSnapshot.find(f=>f.side==='enemy');
   flash.innerHTML=`<span>${esc(a.name)}</span><b>领域对攻</b><span>${esc(b.name)}</span>`;
   document.querySelector('.battle-field')?.append(flash);clashTimer=setTimeout(()=>flash.remove(),1400/Math.max(1,this.speed||1));
  }
  return result;
 };
 for(const name of ['finish','_battleFail','run']){const prior=BattleUI[name];BattleUI[name]=function(...a){clearTimeout(clashTimer);get('domainClashFlash')?.remove();return prior.apply(this,a);};}
 const render=Game.render;Game.render=function(...a){
  const result=render.apply(this,a),p=Game.player;if(!p)return result;
  let guide=get('traitGuide');if(!guide){guide=document.createElement('section');guide.id='traitGuide';guide.className='trait-guide';get('skillList').after(guide);}
  const techniques=[p.technique,...(p.stolenTechs||[])],rules=techniques.map(t=>{
   const notes=[...new Set([t.flag,...(t.flags||[])])].map(f=>traits.techniqueNotes[f]).filter(Boolean);
   return notes.length?`<p><b>${esc(t.name)}</b><span>${notes.map(esc).join(' ')}</span></p>`:'';
  }).join(''),domain=traits.info(p.technique.domain);
  guide.innerHTML=`<h3>战斗特性</h3>${rules||'<p>当前术式沿用自身的伤害、消耗和被动规则。</p>'}<h3>${esc(p.technique.domain||'领域')} · ${p.domainLearned?'已领悟':'熟练度100%解锁'}</h3><p>${esc(domain.text)}</p><small>应对：${esc(domain.counter)}</small><p>领域对攻时必中抵消；攻击施术者削弱稳定度，防御可稳固自己的结界。数值与持续时间按本作规则改编。</p>`;
  return result;
 };
 window.BattleTraitsUI={refresh};
})();
