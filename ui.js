'use strict';
const HD={
 cast:['五条悟','虎杖悠仁','伏黑惠','钉崎野蔷薇','七海建人','禅院真希','乙骨忧太','东堂葵','加茂宪纪','禅院直哉','九十九由基','伏黑甚尔','宿傩','十影宿傩','神武真身宿傩','羂索','真人','漏壶','花御','陀艮','胀相','坏相','血涂','咒胎怠天','顺平','蝗虫','魔虚罗','禅院家主','里梅','多鲁布','黑沐死','乌璐亨子','石流龙','日车宽见','鹿紫云一','秤金次'],
 escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
 artIndex(name){name=String(name||'');if(name.includes('神武真身'))return 14;if(name.includes('十影宿傩'))return 13;if(name.includes('宿傩'))return 12;if(name.includes('真希'))return 5;return this.cast.findIndex(n=>name.includes(n));},
 silhouette(draws=Game.draws){
  const p=Game.player,identity=p?.identity||draws.identity?.label||'',gender=p?.gender||draws.gender?.label||'',age=p?.age||Number(draws.age?.label?.match(/\d+/)?.[0])||22;
  let index=/女/.test(gender)?3:2;if(/咒灵/.test(identity))index=22;else if(/诅咒师/.test(identity))index=27;else if(/受肉/.test(identity))index=12;
  return {index,scale:Number(age)<15?.82:1};
 },
 sprite(name,player=false){
  let index=this.artIndex(name),scale=1;if(player){const s=this.silhouette();index=s.index;scale=s.scale;}
  if(index<0){return `<span class="sprite unknown" aria-label="${this.escape(name)}">影</span>`;}
  const art=(!player&&window.BattleScenes?.portrait(name))||window.ArtCatalog?.[index];
  if(index>=4&&!art&&!player)return `<span class="sprite unknown" aria-label="${this.escape(name)}，美术校正中">待校正</span>`;
  if(player&&index>=4&&!art)index=2;
  if(art){const w=art.width||1254,h=art.height||1254,c=art.cell||0,r=art.rect||(art.single?[0,0,w,h]:[(c%2)*w/2,Math.floor(c/2)*h/2,w/2,h/2]);return `<span class="sprite verified-art ${player?'silhouette':''}" style="background-image:none;--body-scale:${scale}" role="img" aria-label="${player?'你的角色剪影':this.escape(name)}"><svg width="100%" height="100%" viewBox="${r.join(' ')}" preserveAspectRatio="xMidYMax meet" style="display:block;overflow:hidden" aria-hidden="true"><svg x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" viewBox="${r.join(' ')}" overflow="hidden"><image href="assets/${art.file}" width="${w}" height="${h}"/></svg></svg></span>`;}
  const core=index<4,cell=core?index:(index-4)%4,group=Math.floor((index-4)/4);const x=(cell%2)*100,y=Math.floor(cell/2)*100;
  return `<span class="sprite ${core?'core':`cast-group-${group}`} ${player?'silhouette':''}" style="--sx:${x}%;--sy:${y}%;--body-scale:${scale}" role="img" aria-label="${player?'你的角色剪影':this.escape(name)}"></span>`;
 },
 init(){
  $('titleCast').innerHTML=this.sprite('五条悟')+this.sprite('虎杖悠仁');
  $('openMenu').onclick=()=>this.menu();document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>this.menu());
  $('openRules').onclick=()=>$('rulesDialog').showModal();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('.panel-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.panel-tabs button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==b.dataset.panel);});
  if(matchMedia('(max-width:600px)').matches)document.querySelector('.draw-details').open=false;
  let reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;try{reduced=localStorage.getItem('jjk_hd_motion')==='off'||reduced;}catch{}
  this.motion(!reduced);$('motionToggle').onclick=()=>{this.motion(document.body.classList.contains('reduced-motion'));try{localStorage.setItem('jjk_hd_motion',document.body.classList.contains('reduced-motion')?'off':'on');}catch{}};
  const loadStep=Game.loadStep;Game.loadStep=function(i){loadStep.call(this,i);HD.refreshCreation();};
  const attrs=Game.renderCreateAttrs;Game.renderCreateAttrs=function(){attrs.call(this);HD.refreshCreation();};
  const render=Game.render;Game.render=function(){render.call(this);HD.refreshWorld();};
  const addLog=Game.addLog;Game.addLog=function(c,t){addLog.call(this,c,t);$('lastEvent').textContent=t;};
  this.installBattle();
  new MutationObserver(()=>{const box=$('modalBox');if(box.classList.contains('is-battle')!==!!$('bfActions'))box.classList.toggle('is-battle');if(box.classList.contains('is-wheel')!==!!$('mWheelSpin'))box.classList.toggle('is-wheel');document.body.classList.toggle('game-modal-open',!$('modalMask').classList.contains('hidden'));if($('bfLog')&&!$('bfLog').closest('details')){const d=document.createElement('details');d.className='battle-history';const s=document.createElement('summary');s.textContent='战斗记录';d.append(s);$('bfLog').before(d);d.append($('bfLog'));}}).observe($('modalMask'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  this.refreshCreation();
 },
 motion(on){document.body.classList.toggle('reduced-motion',!on);$('motionToggle').textContent=on?'动态效果开':'动态效果关';},
 menu(){if(window.Save)Save.describe();$('menuMessage').textContent='';$('menuDialog').showModal();},
 refreshCreation(){if(!$('creationSilhouette'))return;$('creationSilhouette').innerHTML=this.sprite('你',true);$('silhouetteCaption').textContent=Game.draws.identity?.label||'身份尚未揭晓';if(Game.draws[Game.createSteps[Game.stepIdx]?.key]){$('btnSpin').classList.add('hidden');$('btnNextWheel').textContent=Game.stepIdx===11?'进入咒术世界':'确认，继续';}},
 refreshWorld(){const p=Game.player;if(!p)return;
  $('worldActor').innerHTML=this.sprite('你',true);$('worldIdentity').textContent=p.identity+' · '+p.technique.name;$('worldRank').textContent=lvName(p.levelIndex);
  $('compactStats').innerHTML=`<h2 class="compact-name">${this.escape(p.identity)}</h2><span class="muted">${p.age}岁 · ${this.escape(p.gender)} · ${this.escape(lvName(p.levelIndex))}</span><p class="compact-tech">${this.escape(p.technique.name)}</p><div class="stat-pair"><span>生命</span><b>${Math.round(p.hp)} / ${p.maxHp}</b></div><div class="bar hp"><i style="width:${pct(p.hp,p.maxHp)}"></i></div><div class="stat-pair"><span>咒力</span><b>${Math.round(p.cp)} / ${p.maxCp}</b></div><div class="bar cp"><i style="width:${pct(p.cp,p.maxCp)}"></i></div><div class="stat-pair"><span>术式熟练度</span><b>${Math.round(p.prof)}%</b></div><div class="bar"><i style="width:${clamp(p.prof/3,0,100)}%"></i></div>`;
  $('btnActionWheel').textContent='行动 · 推进一天';$('btnShowAttr').textContent='详细属性';
 },
 installBattle(){
  BattleUI.unitHtml=function(u,side){const idx=this.eng.units.indexOf(u);return `<div class="unit ${u.alive?'':'dead'} ${side==='enemy'&&u.alive?'targetable':''} ${this.selectedTargetIdx===idx?'selected':''}" data-idx="${idx}" ${side==='enemy'&&u.alive?'role="button" tabindex="0"':''} aria-label="${HD.escape(u.name)}，生命${Math.round(u.hp)}">${HD.sprite(u.name,u.isPlayer)}<div class="unit-info"><div class="uname">${HD.escape(u.isPlayer?'你':u.name)}<span class="utype">${HD.escape(lvName(u.li))}</span></div><div class="mini-bar hp"><i style="width:${pct(u.hp,u.maxHp)}"></i></div><div class="nums">HP ${Math.max(0,Math.round(u.hp))}/${u.maxHp}</div><div class="mini-bar cp"><i style="width:${pct(u.cp,u.maxCp)}"></i></div><div class="nums">CP ${Math.round(u.cp)}/${u.maxCp}</div><div class="badges">${this.unitBadges(u)}</div></div></div>`;};
  const render=BattleUI.render;BattleUI.render=function(){render.call(this);HD.shortBattleLabels();HD.battleDetails(this.eng);$('bfEnemy').querySelectorAll('[role=button]').forEach(el=>el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});};
  const wait=BattleUI.waitInput;BattleUI.waitInput=function(){wait.call(this);HD.shortBattleLabels();};
  const run=BattleUI.run;BattleUI.run=function(cfg){const p=run.call(this,cfg);const title=$('modalBox').querySelector('h2');if(title)title.dataset.battleTitle='true';HD.shortBattleLabels();return p;};
 },
 battleDetails(eng){let d=$('battleDetails');if(!d){d=document.createElement('details');d.id='battleDetails';d.className='battle-details';d.innerHTML='<summary>查看双方战况</summary><div></div>';$('bfActions').before(d);}d.querySelector('div').innerHTML=eng.units.map(u=>`<div class="battle-stat-row">${this.escape(u.name)} · ${this.escape(lvName(u.li))}<br>生命 ${Math.max(0,Math.round(u.hp))}/${u.maxHp} · 咒力 ${Math.round(u.cp)}/${u.maxCp}<br>${BattleUI.unitBadges(u)||'无特殊状态'}</div>`).join('');},
 shortBattleLabels(){if(!$('actMelee'))return;$('actMelee').textContent='体术';$('actDefend').textContent='防御';$('actFlee').textContent='撤退';$('actTech').textContent='术式 · '+BattleUI.eng.techCost(BattleUI.eng.player);$('actDomain').textContent=(BattleUI.eng.player.domainCd||0)>0?'领域熔断':'领域展开';$('actUlt').textContent='极之番';const caps=$('modalBox').querySelector('.seq-cap span');if(caps)caps.textContent='行动顺序';const enemy=$('modalBox').querySelector('.side-col.enemy h4');if(enemy)enemy.textContent='敌方 · 点击选中';}
};
window.HD=HD;HD.init();
