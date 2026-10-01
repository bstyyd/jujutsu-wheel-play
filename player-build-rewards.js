/* At most one build reward per victorious real journey day. Practice never grants rewards. */
(() => {
 'use strict';
 const B=window.PlayerBuild,run=BattleUI.run;
 async function choose(day){
  const choices=B.rewardOffers(day),esc=HD.escape;
  await new Promise(resolve=>{
   showModal(`<section class="daily-event build-reward"><p class="eyebrow">第 ${day} 天 · 实战收获</p><h2>把这场胜利，变成你的打法</h2><p class="event-narrative">${esc(Game.player.technique.name)} · 本日首次胜利奖励。专精槽满时进入已掌握列表，返回日程再调整；后续连战不重复领取。</p><div class="daily-responses">${choices.map((c,i)=>`<button data-build-reward="${i}" class="daily-response"><span>${c.buildLesson.kind==='talent'?'适配专精':'复盘与整备'}</span><b>${esc(c.label)}</b><small>${esc(c.desc)}</small><i aria-hidden="true">↗</i></button>`).join('')}</div><p id="buildRewardError" role="status"></p></section>`);
   for(const el of document.querySelectorAll('[data-build-reward]'))el.onclick=()=>{
    try{const c=choices[Number(el.dataset.buildReward)];Game.addLog('lgold',B.claimReward(c,day));if(c.stat)Game.addLog('lcyan',Player.train(Game.player,c.stat));closeModal();resolve();}
    catch(err){document.getElementById('buildRewardError').textContent=err.message;}
   };
  });
 }
 BattleUI.run=async function(cfg){
  const won=await run.call(this,cfg),day=Game.day;
  if(won&&Campaign.modern()&&Number.isInteger(day)&&day>0&&day<=120&&Save.phase!=='ended'&&!cfg.practiceSkills&&!cfg.stylePractice&&!(B.state().rewardDays||[]).includes(day))await choose(day);
  return won;
 };
 window.PlayerBuildRewards={choose};
})();
