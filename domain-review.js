'use strict';
// Isolated presentation viewer: no engine, save code, background music or storage writes.
const $=id=>document.getElementById(id),Game={player:null,draws:{}},Fx={};
const BattleUI={runId:0,sfxFor(){},laterFixed(ms,fn){return setTimeout(fn,ms);}};
const SFX={muted:false,voiceOn:true,setMuted(v){this.muted=v;},setVoice(v){this.voiceOn=v;},speak(){return null;}};
const HD={
 cast:['五条悟','虎杖悠仁','伏黑惠','钉崎野蔷薇','七海建人','禅院真希','乙骨忧太','东堂葵','加茂宪纪','禅院直哉','九十九由基','伏黑甚尔','宿傩','十影宿傩','神武真身宿傩','羂索','真人','漏壶','花御','陀艮','胀相','坏相','血涂','咒胎怠天','顺平','蝗虫','魔虚罗','禅院家主','里梅','多鲁布','黑沐死','乌璐亨子','石流龙','日车宽见','鹿紫云一','秤金次'],
 escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
 artIndex(name){return /宿傩/.test(name)?12:this.cast.indexOf(name);},
 sprite(name,player=false){const art=window.ArtCatalog[player?2:this.artIndex(name)];if(!art)return '';const w=art.width,h=art.height,c=art.cell||0,r=art.rect||(art.single?[0,0,w,h]:[(c%2)*w/2,Math.floor(c/2)*h/2,w/2,h/2]);return `<span class="sprite ${player?'silhouette':''}"><svg width="100%" height="100%" viewBox="${r.join(' ')}" preserveAspectRatio="xMidYMax meet"><image href="assets/${art.file}" width="${w}" height="${h}"/></svg></span>`;}
};
const domainReferences={
 blossom:['domain-roster-v4/hanami-game.jpg','花海 · 参考《幻影夜行》画面'],
 void:['battle-slice-v1/domain-98.png','动画参考'],shrine:['battle-slice-v1/domain-20.png','动画参考'],shadow:['battle-slice-v1/domain-210.png','不完整领域 · 保留战场'],lava:['battle-slice-v1/domain-56.png','动画参考'],hands:['domain-stage-v2/comp-450.jpg','动画参考'],beach:['domain-stage-v2/comp-365.jpg','动画参考'],court:['domain-stage-v2/comp-518.jpg','动画参考'],
 love:['domain-roster-v4/love.jpg','漫画第 249 话 · 动画画风改编'],womb:['domain-roster-v4/womb.jpg','漫画第 205 话 · 开放领域'],moon:['domain-roster-v4/moon.jpg','漫画第 198 话 · 动画画风改编'],jackpot:['domain-roster-v4/jackpot.jpg','漫画第 186 话 · 展开场景'],station:['domain-roster-v4/station.jpg','漫画第 264 话 · 展开后的车站，名称未公开']
};
const domainReviewItems=BattleScenes.domainRoster;
document.addEventListener('DOMContentLoaded',()=>{
 let reviewSerial=0;
 const play=(who,text)=>{
  const serial=++reviewSerial,status=$('reviewStatus');let endedAt=0,failed=false;
  const done=Cinema.play({who,text,kind:'domain',duration:3600}),audio=AnimeVoice.active;
  status.textContent='正在展开 · '+text+(audio?' · 角色原声':' · 无声演出');
  status.dataset.voice=audio?'playing':'silent';delete status.dataset.tailMs;
  status.dataset.phase='opening';
  const phase=e=>{if(serial!==reviewSerial)return;if(e.animationName==='domain-call-in')status.dataset.phase='invocation';if(e.animationName==='domain-name')status.dataset.phase='name';};
  Cinema.el.addEventListener('animationend',phase);
  if(audio){audio.addEventListener('ended',()=>{endedAt=performance.now();});audio.addEventListener('error',()=>{failed=true;});}
  done.then(()=>{Cinema.el.removeEventListener('animationend',phase);if(serial!==reviewSerial)return;status.dataset.phase='finished';const tail=endedAt?Math.round(performance.now()-endedAt):0;status.dataset.tailMs=String(tail);status.dataset.voice=endedAt?'ended':audio?(failed?'failed':'stopped'):'silent';status.textContent='演出结束 · '+text+(tail?' · 原声后停留 '+(tail/1000).toFixed(2)+' 秒':!audio?' · 无声演出':'');});
 };
 for(const item of domainReviewItems){
  const {who,name,key,file,note}=item,[ref,caption]=domainReferences[key]||[];
  const card=document.createElement('article');card.dataset.actor=who;
  const preview=file?'<img src="assets/'+file+'" alt="'+HD.escape(name)+'场景" loading="lazy">':'<div class="motif-preview" data-kind="'+key+'" style="--domain-light:'+item.light+'">'+HD.sprite(who)+'<span>角色专属演出</span></div>';
  card.innerHTML=preview+'<div class="body"><h2>'+HD.escape(name)+'</h2><p class="meta">'+who+' · '+(caption||note)+'</p><button>展开 · '+who+'</button>'+(ref?'<details><summary>对照原作画面</summary><img src="references/'+ref+'" alt="'+who+'原作场景参考" loading="lazy"><p>场景结构参考原作；新图的配色、镜头与战斗站位为游戏改编。</p></details>':'<p class="reference-note">'+(key==='frost'||key==='swarm'?'游戏扩展设定':'专属图片与动态展开 · 游戏演绎，非官方领域内部设定')+'</p>')+'</div>';
  card.querySelector('button').onclick=()=>play(who,name);$('domainCards').append(card);
 }
 $('reviewVoice').onchange=e=>SFX.setVoice(e.target.checked);
 $('reviewMotion').onchange=e=>document.body.classList.toggle('reduced-motion',!e.target.checked);
 document.querySelector('[data-example=canon]').onclick=()=>play('随机特级咒灵','领域');
 document.querySelector('[data-example=custom]').onclick=()=>play('你','灵魂共鸣');
 document.addEventListener('keydown',e=>{if(e.key==='Escape')Cinema.hide();});
});
