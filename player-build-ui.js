/* Compact dossier; configuration is committed once, with save rollback. */
(() => {
 'use strict';
 const B=window.PlayerBuild,esc=s=>HD.escape(String(s)),box=document.createElement('section');box.id='playerBuildCard';box.className='build-dossier';document.getElementById('dailyPreparation').after(box);
 function techniqueHTML(p){const tb=window.TechniqueBuilds,c=tb?.entry(p);return c?`<details class="build-technique"><summary>术式打法 · ${esc(tb.groups[c.group].name)}</summary><p>${esc(c.current)}</p><p>可发展：${esc(c.routes.join(' / '))}</p><small>专精与回合效果是游戏改编；保留原有术式和随机人物。</small></details>`:'';}
 function open(){
  if(Equipment.blocked())return;
  const b=B.state();let draft=b.equipped.slice();
  const visible=B.talents.filter(t=>B.compatible(t,Game.player)),known=visible.filter(t=>b.unlocked.includes(t.id)),locked=visible.filter(t=>!b.unlocked.includes(t.id));
  const tile=t=>`<button type="button" data-talent="${t.id}" aria-pressed="${draft.includes(t.id)}" ${b.unlocked.includes(t.id)?'':'disabled'}><span>${b.unlocked.includes(t.id)?'已掌握':'课题解锁'}</span><b>${esc(t.name)}</b><small>${esc(t.note)}</small></button>`;
  const talentHTML=`<div class="build-talents">${known.map(tile).join('')}</div>${locked.length?`<details class="build-library" ${known.length?'':'open'}><summary>可学习专精 · ${locked.length} 种</summary><div class="build-talents">${locked.map(tile).join('')}</div></details>`:''}`;
 
  showModal(`<section class="build-editor"><p class="eyebrow">${esc(Game.player.identity)} · ${esc(Game.player.technique.name)}</p><h2>我的构筑</h2><p>两个专精槽。确认一次调整消耗一次重训，剩余 <b>${b.retrains}</b> 次；原有术式、咒具和人物保持。</p><div class="build-slots" id="buildSlots"></div>${techniqueHTML(Game.player)}${talentHTML}<div class="build-selects"><label>束缚<select id="buildVow" ${b.stage<3?'disabled':''}>${Object.entries(B.vows).map(([id,d])=>`<option value="${id}" ${b.vow===id?'selected':''}>${esc(d.name)}</option>`).join('')}</select><small id="buildVowNote"></small></label><label>领域方向<select id="buildDomain" ${b.stage<3?'disabled':''}>${Object.entries(B.domains).filter(([id])=>id!=='escort'||B.family(Game.player)).map(([id,d])=>`<option value="${id}" ${b.domain===id?'selected':''}>${esc(d.name)}</option>`).join('')}</select><small id="buildDomainNote"></small></label></div><p class="build-feedback" id="buildFeedback" role="status">${b.stage<3?'完成前三次构筑课题后，可调整束缚与领域方向。':'这些倍率、回合和专精是游戏改编规则。'}</p><div class="build-editor-actions"><button class="btn" id="buildCommit">确认搭配</button><button class="btn ghost" id="buildCancel">返回</button></div></section>`);
  function draw(){document.getElementById('buildSlots').innerHTML=[0,1].map(i=>`<div><small>专精 ${i+1}</small><b>${esc(B.talents.find(t=>t.id===draft[i])?.name||'空槽')}</b></div>`).join('');for(const el of document.querySelectorAll('[data-talent]'))el.setAttribute('aria-pressed',draft.includes(el.dataset.talent));document.getElementById('buildVowNote').textContent=B.vows[document.getElementById('buildVow').value].note;document.getElementById('buildDomainNote').textContent=B.domains[document.getElementById('buildDomain').value].note;}
  for(const el of document.querySelectorAll('[data-talent]'))el.onclick=()=>{const id=el.dataset.talent;if(draft.includes(id))draft=draft.filter(x=>x!==id);else if(draft.length<2)draft.push(id);else{document.getElementById('buildFeedback').textContent='两槽已满，先取消一个专精再选择。';return;}draw();};
  document.getElementById('buildVow').onchange=document.getElementById('buildDomain').onchange=draw;
  document.getElementById('buildCommit').onclick=()=>{try{B.equip(draft,document.getElementById('buildVow').value,document.getElementById('buildDomain').value);closeModal();refresh();}catch(e){document.getElementById('buildFeedback').textContent=e.message;}};
  document.getElementById('buildCancel').onclick=closeModal;draw();
 }
 function refresh(){
  if(!Game.player)return;box.hidden=!Campaign.modern()||Save.phase==='ended';if(box.hidden)return;
  const b=B.state(),active=DailyUI.direction==='build',story=!!STORY[Game.day+1],locked=Equipment.blocked(),p=Game.player;
  box.innerHTML=`<div class="build-dossier-heading"><div><small>我的构筑 · 两个专精槽</small><b>${esc(p.technique.name)}</b></div><button type="button" id="openPlayerBuild" ${locked?'disabled':''}>调整搭配</button></div><div class="build-slots">${[0,1].map(i=>`<div><small>专精 ${i+1}</small><b>${esc(B.talents.find(t=>t.id===b.equipped[i])?.name||'等待领悟')}</b></div>`).join('')}</div>${techniqueHTML(p)}<p>${esc(B.vows[b.vow].name)} · ${esc(B.domains[b.domain].name)} · 重训 ${b.retrains} 次</p><div class="build-dossier-footer"><span>${story?'明日剧情优先，课题保留':b.stage<3?'成长课题 '+Math.min(3,b.stage)+'/3 · 三选一决定打法':'已掌握 '+b.unlocked.length+' 种专精 · 可以继续进修'}</span><button type="button" id="planPlayerBuild" aria-pressed="${active}" ${locked||story||Game.day>=120?'disabled':''}>${active?'已安排课题':'安排构筑课题'}</button></div>`;
  document.getElementById('openPlayerBuild').onclick=open;document.getElementById('planPlayerBuild').onclick=()=>{DailyUI.direction=active?'train':'build';DailyUI.refresh();};
  if(active&&!story)document.getElementById('btnActionWheel').textContent='开始构筑课题 →';
 }
 const refreshDaily=DailyUI.refresh;DailyUI.refresh=function(...a){const out=refreshDaily.apply(this,a);refresh();return out;};
 const render=BattleUI.render;BattleUI.render=function(...a){const out=render.apply(this,a),e=this.eng,panel=document.getElementById('playerStylePanel');if(e&&panel){let line=document.getElementById('battleBuildSummary');if(!line){line=document.createElement('p');line.id='battleBuildSummary';line.className='build-battle-summary';panel.prepend(line);}line.textContent=B.summary(PlayerBuildCombat.config(e));}return out;};
 window.PlayerBuildUI={open,refresh};refresh();
})();
