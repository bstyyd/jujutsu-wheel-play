(() => {
 'use strict';
 const $=id=>document.getElementById(id),gear=window.Equipment;
 const art=(index,extra='')=>{
  const t=gear.catalog.find(t=>t.index===index);
  return t?.art?`<span class="tool-art tool-art-single ${extra}" style="background-image:url('${t.art}')" aria-hidden="true"></span>`:
   `<span class="tool-art ${extra}" style="--tool-x:${index%3*50}%;--tool-y:${Math.floor(index/3)*100}%" aria-hidden="true"></span>`;
 };
 let selected='practice',opener=null;
 const dialog=document.createElement('dialog');dialog.id='equipmentDialog';dialog.className='utility-dialog armory';
 dialog.setAttribute('aria-labelledby','armoryHeading');
 dialog.innerHTML='<header class="dialog-heading"><div><p class="eyebrow">CURSED TOOLS / 忌库</p><h2 id="armoryHeading">挑一件，带入下一战。</h2></div><button class="text-btn" data-close>关闭 ×</button></header><div class="armory-layout"><section class="armory-inventory" aria-label="咒具藏品"><p id="armoryCount"></p><div id="toolCollection" class="tool-collection"></div><p class="armory-note">通过剧情战或狩猎获胜解锁。每周目重新收集；晚期开局不补领此前奖励。</p></section><section id="toolDetail" class="tool-detail" aria-live="polite"></section></div><p id="equipmentMessage" role="status"></p>';
 document.body.append(dialog);
 const launcher=document.createElement('button');launcher.id='openEquipment';launcher.className='equipment-slot';launcher.setAttribute('aria-haspopup','dialog');
 $('btnShowAttr').before(launcher);
 function detail(){
  const t=gear.find(selected),state=gear.state(),owned=state.owned.includes(t.id),equipped=state.equipped===t.id,victories=gear.victories(),current=gear.current();
  $('toolDetail').innerHTML=`<div class="tool-showcase">${art(t.index)}<span class="tool-watermark" aria-hidden="true">呪</span><span class="tool-tier">${t.tag}</span></div><div class="tool-copy"><p class="eyebrow">${t.role} / ${t.source}</p><h3>${t.name}<small>${equipped?'已装备':owned?'已收藏':'尚未解锁'}</small></h3><p>${t.desc}</p><div class="tool-effect"><span>本作战斗效果</span><b>${t.effect}</b>${t.id==='soul'?`<small>${Game.player.prof>=100?'已满足领悟条件':'领悟条件：熟练度 100%（当前 '+Math.floor(Game.player.prof)+'%）'}</small>`:''}</div>${window.CursedToolTraining?.families[t.id]?`<small class="tool-learning">动作课题 ${CursedToolTraining.lesson(t.id).stage}/3 · ${CursedToolTraining.certified(t.id)?'已解锁 '+CursedToolTraining.moves[CursedToolTraining.families[t.id]].label:'在日常中安排咒具课题'}</small>`:''}<p class="tool-compare">当前：${current?current.name+' · 体术 +'+Math.round(current.bonus*100)+'%':'徒手'}${!equipped?' → '+t.name+' · 体术 +'+Math.round(t.bonus*100)+'%':''}</p>${!owned?`<div class="tool-progress"><span>累计胜利 ${Math.min(victories,t.wins)} / ${t.wins}</span><progress value="${Math.min(victories,t.wins)}" max="${t.wins}"></progress></div>`:''}<button id="equipSelected" class="btn" ${!owned||gear.blocked()?'disabled':''}>${equipped?'卸下咒具':owned?'装备 '+t.name:'还需 '+Math.max(0,t.wins-victories)+' 场胜利'}</button><small class="tool-footnote">只携带一件主武器。加成仅在战斗结算，不改动永久属性。</small></div>`;
  $('equipSelected').onclick=()=>{try{gear.equip(equipped?null:t.id);$('equipmentMessage').textContent=equipped?'已卸下咒具，装备选择已保存。':`已装备${t.name}，下一场战斗生效。`;renderDialog();$('equipSelected').focus({preventScroll:true});}catch(e){$('equipmentMessage').textContent=e.message;}};
 }
 function renderDialog(){
  const state=gear.state();if(!state)return;
  $('armoryCount').textContent=`藏品 ${state.owned.length} / ${gear.catalog.length} · 已获胜 ${gear.victories()} 场`;
  $('toolCollection').innerHTML=gear.catalog.map(t=>`<button class="tool-tile ${state.owned.includes(t.id)?'':'locked'}" data-tool="${t.id}" aria-pressed="${selected===t.id}" aria-label="${t.name}，${state.equipped===t.id?'已装备':state.owned.includes(t.id)?'已收藏':'尚未解锁'}">${art(t.index)}<span><b>${t.name}</b><small>${state.equipped===t.id?'已装备':state.owned.includes(t.id)?t.role:t.wins+' 场胜利解锁'}</small></span></button>`).join('');
  detail();
 }
 function refresh(){
  if(!Game.player)return;
  gear.sync();const tool=gear.current();
  launcher.innerHTML=`${tool?art(tool.index):art(-1,'tool-art-empty')}<span><small>随身咒具</small><b>${tool?.name||'尚未装备'}</b><em>${tool?'更换 / 查看效果':'领取并装备制式咒刀'}</em></span><i aria-hidden="true">↗</i>`;
  launcher.disabled=gear.blocked();
  if(dialog.open)renderDialog();
 }
 launcher.onclick=()=>{if(gear.blocked())return;opener=document.activeElement;selected=gear.current()?.id||'practice';$('equipmentMessage').textContent='';renderDialog();dialog.showModal();};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
 $('toolCollection').onclick=e=>{const button=e.target.closest('[data-tool]');if(button){selected=button.dataset.tool;renderDialog();dialog.querySelector(`[data-tool="${selected}"]`).focus({preventScroll:true});}};
 const render=Game.render;Game.render=function(...a){const result=render.apply(this,a);refresh();return result;};
 const restore=Save.restore;Save.restore=function(...a){const result=restore.apply(this,a);refresh();return result;};
 const finish=Game.finishCreate;Game.finishCreate=function(...a){const result=finish.apply(this,a);refresh();return result;};
 const daily=Game.dailyAction;Game.dailyAction=async function(...a){try{return await daily.apply(this,a);}finally{refresh();}};
 window.EquipmentUI={refresh};refresh();
})();
