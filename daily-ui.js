/* A single character dossier, one active day, and a secondary journal drawer. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=s=>HD.escape(s);
 const directions=[['train','修炼','提升长期实力','体术、咒力与术式，随机遭遇不同课题。'],['mission','任务','实战或稳妥撤回','调查与祓除委托，自己决定是否迎战。'],['prepare','整备','为下一场做准备','护身或咒力补给，也可选择永久成长。']];
 const dock=document.querySelector('.journey-dock'),stage=$('worldStage');
 const drawer=document.createElement('dialog');drawer.id='characterJournal';drawer.className='utility-dialog character-journal';
 drawer.innerHTML='<div class="dialog-heading"><h2>术师档案</h2><button class="text-btn" data-close>关闭 ×</button></div>';
 document.body.append(drawer);drawer.append(document.querySelector('.journal-panel'));
 drawer.querySelector('[data-pane="overview"] details').open=true;
 drawer.querySelector('[data-close]').onclick=()=>drawer.close();
 stage.append($('compactStats'),$('btnShowAttr'));
 $('btnShowAttr').onclick=()=>drawer.showModal();
 $('btnShowAttr').textContent='查看档案 · 技能 · 手记';
 const options=document.createElement('div');options.id='dailyDirections';options.className='daily-directions';options.setAttribute('role','group');options.setAttribute('aria-label','选择今日方向');
 options.innerHTML=directions.map(([id,title,kicker,desc],i)=>`<button class="direction-choice" data-direction="${id}" aria-pressed="${i===0}"><span class="direction-index">0${i+1}</span><span><small>${kicker}</small><b>${title}</b><em>${desc}</em></span><i aria-hidden="true">↗</i></button>`).join('');
 $('dayBrief').after(options);
 const preparation=document.createElement('div');preparation.id='dailyPreparation';preparation.className='daily-preparation';options.after(preparation);
 const old=document.createElement('button');old.id='classicDaily';old.className='text-btn';old.textContent='仍想完全随机？使用经典转盘';dock.append(old);
 const ui={direction:'train',refresh(){
  if(!Game.player)return;
  const modern=Campaign.modern(),story=STORY[Game.day+1],ended=Save.phase==='ended'||Game.day>=120;
  document.body.classList.add('daily-edition');options.hidden=!modern||!!story||ended;old.hidden=!modern||!!story||ended;
  $('btnShowAttr').textContent='档案 · 技能 · 手记';
  const proficiency=$('compactStats').querySelectorAll('.stat-pair b')[2];
  if(proficiency)proficiency.textContent=(Math.round(Game.player.prof*10)/10)+'%';
  if(!modern)preparation.hidden=true;
  if(!modern)return;
  $('dayBrief').innerHTML=`<p class="eyebrow">第 ${Game.day+1} 天 · ${story?'剧情任务':'今日安排'}</p><h2>${story?esc(story.chapter):'把今天，留给哪件事？'}</h2><p>${story?'确认任务与同伴，进入下一场战斗。':'先选方向，再转动轮盘。际遇由命运决定，应对由你决定。'}</p>`;
  const locked=Save.busy||Save.failed||ended;
  for(const b of options.querySelectorAll('button')){b.disabled=locked;b.setAttribute('aria-pressed',b.dataset.direction===ui.direction);}
  $('btnActionWheel').disabled=locked;old.disabled=locked;
  $('btnActionWheel').textContent=story?'确认任务，出发 →':`抽取${DailyEvents.names[ui.direction]}际遇 →`;
  $('btnShowAttr').textContent='档案 · 技能 · 手记';
  const p=Campaign.state.preparation;
  preparation.hidden=!p;
  preparation.innerHTML=p?`<span>已准备 · 下一战生效</span><b>${p==='guard'?'护身整备':'咒力补给'}</b><small>${p==='guard'?DailyEvents.guard:DailyEvents.supply}</small>`:'';
  const target=EVENT_DAYS.find(d=>d>Game.day);
  $('nextEvent').innerHTML=target?`<span>下一剧情</span><b>${esc(STORY[target].chapter)}</b><em>${target-Game.day===1?'明日出发':`还有 ${target-Game.day} 天`}</em>`:'本周目已到终点';
 }};
 options.addEventListener('click',e=>{const b=e.target.closest('[data-direction]');if(b&&!b.disabled){ui.direction=b.dataset.direction;ui.refresh();}});
 old.onclick=async()=>{if(Save.busy||Save.failed)return;const previous=ui.direction;ui.direction='wheel';try{await Game.dailyAction();}finally{ui.direction=previous;ui.refresh();}};
 const render=Game.render;Game.render=function(...args){const r=render.apply(this,args);ui.refresh();return r;};
 const world=CampaignUI.world;CampaignUI.world=function(...args){const r=world.apply(this,args);ui.refresh();return r;};
 // Save restores before releasing its guard; refresh the view once it has finished.
 const restore=Save.restore;Save.restore=function(...args){const r=restore.apply(this,args);ui.refresh();return r;};
 window.DailyUI=ui;ui.refresh();
})();
