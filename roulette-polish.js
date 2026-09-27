/* Compact roulette hub. No movement, exploration state, rewards or rule changes. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const arcs=[{day:0,label:'入学'},{day:25,label:'少年院'},{day:49,label:'交流会'},{day:85,label:'涩谷'},{day:100,label:'回游'},{day:118,label:'新宿'}];
 const make=(tag,cls,id)=>{const el=document.createElement(tag);el.className=cls;if(id)el.id=id;return el;};
 document.body.classList.add('battle-only-edition');
 const headline=make('div','world-chapter','worldChapter');document.querySelector('.day-head').prepend(headline);
 const track=make('nav','chapter-track','chapterTrack');track.setAttribute('aria-label','章节进度');document.querySelector('.world-column').append(track);
 const brief=make('div','hub-brief','dayBrief');document.querySelector('.journey-dock').prepend(brief);
 const label=document.querySelector('#worldStage .scene-label');label.innerHTML='<span>术师档案</span><b>本轮角色</b>';
 function refresh(){
  if(!Game.player)return;
  const current=arcs.findLastIndex(a=>Game.day>=a.day),location=BattleScenes.world(Game.day);
  label.querySelector('b').textContent='本轮角色';
  headline.innerHTML='<span>当前章节</span><h1>'+HD.escape(location.chapter)+'</h1>';
  track.innerHTML=arcs.map((a,i)=>`<span class="${i<current?'passed':i===current?'current':''}" ${i===current?'aria-current="step"':''}><i></i>${a.label}</span>`).join('');
  brief.innerHTML=`<p class="eyebrow">第 ${Game.day+1} 天 · ${STORY[Game.day+1]?'剧情日':'行动日'}</p><h2>${STORY[Game.day+1]?'故事，走到了新的岔口。':'转动命运，继续这一轮。'}</h2><p>${STORY[Game.day+1]?'进入事件，确认任务与对手，再决定这场战斗的行动。':'抽取行动，积累实力。下一场战斗中，你的选择仍然重要。'}</p>`;
  const values=document.querySelectorAll('#compactStats .stat-pair b');if(values.length===3)values[2].textContent=(Math.floor(Game.player.prof*10)/10)+'%';
 }
 const prior=Game.render;Game.render=function(...args){const result=prior.apply(this,args);refresh();return result;};
 refresh();
})();
