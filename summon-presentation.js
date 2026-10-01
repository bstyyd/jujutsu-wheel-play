/* Summon identity is independent of the randomly generated player. No gameplay/save changes. */
(() => {
 'use strict';
 const named=['五条悟','虎杖悠仁','伏黑惠','钉崎野蔷薇','七海建人','禅院真希','乙骨忧太','东堂葵','加茂宪纪','禅院直哉','九十九由基','伏黑甚尔','宿傩','十影宿傩','神武真身宿傩','羂索','真人','漏壶','花御','陀艮','胀相','坏相','血涂','咒胎怠天','顺平','蝗虫','魔虚罗','禅院家主','里梅','多鲁布','黑沐死','乌璐亨子','石流龙','日车宽见','鹿紫云一','秤金次'];
 const summons=[[/玉犬/,'dog'],[/脱兔/,'rabbit'],[/蟾蜍|蝦蟇/,'frog'],[/大蛇/,'serpent'],[/圆鹿|円鹿/,'deer'],[/贯牛|貫牛/,'ox'],[/鵺/,'nue'],[/满象|満象/,'elephant'],[/嵌合兽|顎吐/,'fused'],[/乌鸦|烏鴉/,'crow'],[/傀儡|机械丸|究极机械|究極メカ/,'puppet']];
 let posterCatalog;
 const clone=a=>a&&JSON.parse(JSON.stringify(a));
 function actorKey(u,day=0){
  const raw=String(u.name||''),name=raw.replace(/^(?:咒灵式神|亡灵式神)[·・]/,'');
  if(/魔虚罗/.test(name))return 'mahoraga';
  // The legacy game's "虎杖式神" is retained, not renamed to the unshown canon 虎葬.
  if(name==='虎杖式神')return 'yuji';
  for(const [re,key] of summons)if(re.test(name))return 'summon-'+key;
  let i=/神武真身/.test(name)?14:/十影宿傩/.test(name)?13:/宿傩/.test(name)?12:/真希/.test(name)?5:named.findIndex(n=>name.includes(n));
  if(i<0){const aliases={'漏瑚':17,'脹相':20,'吉野顺平':24,'伏黑甚尔':11,'乌鹭亨子':31};for(const [n,index] of Object.entries(aliases))if(name.includes(n))i=index;}
  return i>=0?CombatPresentation.battleActorKey(i,day,name):u.summonTag?'curse':null;
 }
 function sprite(catalog,u,day=0){
  if(u.isPlayer)return null;
  const key=actorKey(u,day);if(!key)return null;const a=clone(catalog?.actors[key]);if(!a)return null;
  a.summonIdentity=key;a.summonUnit=!!u.summonTag;
  if(/^(咒灵式神|亡灵式神)[·・]/.test(u.name))a.recalled=true;
  return a;
 }
 function action(art,event){
  if(!art?.summonUnit)return null;
  if(event.attackKind==='tech'&&event.summonAbility==='electric')return {kind:'lightning',variant:'nue-electric'};
  if(event.attackKind==='tech'&&event.summonAbility==='cannon')return {kind:'cannon',variant:'puppet-cannon'};
  if(event.attackKind!=='melee')return null;
  return {kind:'melee',variant:art.summonAction||''};
 }
 function domainEntities(catalog,fields){
  const a=catalog?.actors['summon-mecha'];if(!a)return [];
  return fields.filter(f=>f.name==='超巨大机甲').slice(0,2).map(f=>({side:f.side,name:f.name,file:a.file,maskFile:a.maskFile,height:a.height,frame:a.poses.idle,rect:a.frames[a.poses.idle],maskFrame:a.maskFrames[a.poses.idle],castRect:a.frames[a.poses.attack],castMaskFrame:a.maskFrames[a.poses.attack]}));
 }
 function poster(u,day=0){
  if(!posterCatalog||!u.summonTag)return null;const a=sprite(posterCatalog,u,day);if(!a)return null;
  const r=a.frames[a.poses.idle||0],size=a.sheetSize;if(!size)return null;
  const safe=String(u.name).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return a.posterFile?`<span class="sprite verified-art summon-art" style="background-image:none" role="img" aria-label="${safe}"><img src="assets/${a.posterFile}" style="height:100%;width:100%;object-fit:contain;image-rendering:pixelated" alt=""/></span>`:null;
 }
 fetch('battle-sprites.json').then(r=>r.ok?r.json():null).then(c=>posterCatalog=c).catch(()=>{});
 window.SummonPresentation={actorKey,sprite,action,domainEntities,poster};
})();
