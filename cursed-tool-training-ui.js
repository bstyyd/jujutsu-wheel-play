(() => {
 'use strict';
 const T=window.CursedToolTraining,box=document.createElement('section');box.className='tool-lesson-card';box.id='toolLessonCard';document.getElementById('dailyPreparation').after(box);
 function refresh(){
  if(!Game.player)return;
  const id=T.eligible(),hidden=!Campaign.modern()||Save.phase==='ended'||Game.day>=120||!!STORY[Game.day+1];box.hidden=hidden;
  if(hidden)return;
  const active=DailyUI.direction==='tool',tool=Equipment.find(id),l=T.lesson(id);
  if(!id){if(active){DailyUI.direction='train';DailyUI.refresh();}box.innerHTML='<div><small>咒具课题</small><b>现有咒具的动作已掌握</b><p>收集新的咒具后，可以继续适应它的重心与出手方式。</p></div>';return;}
  const next=['取用登记','适应训练','动作演练'][l.stage];
  box.classList.toggle('active',active);
  box.innerHTML=`<img src="assets/events/b-v1/tool-training.png" alt="咒具与训练场"><div><small>咒具课题 · ${l.stage}/3</small><b>${tool.name} · ${next}</b><p>每课消耗一天。完成后解锁「${T.moves[T.families[id]].label}」，原有咒具特性继续生效。</p><ol>${['取用','适应','动作'].map((n,i)=>`<li class="${i<l.stage?'done':i===l.stage?'next':''}">${n}</li>`).join('')}</ol></div><button type="button" aria-pressed="${active}" ${Save.busy||Save.failed?'disabled':''}>${active?'已安排今日课题':'安排咒具课题'}</button>`;
  box.querySelector('button').onclick=()=>{DailyUI.direction=active?'train':'tool';DailyUI.refresh();refresh();};
  if(active)document.getElementById('btnActionWheel').textContent='开始 '+next+' →';
 }
 const ui=DailyUI.refresh;DailyUI.refresh=function(...a){const r=ui.apply(this,a);refresh();return r;};
 window.CursedToolTrainingUI={refresh};refresh();
})();
