/* Random player appearance is independent of the inherited technique and NPC identity. */
(() => {
 'use strict';
 const ageKey=p=>Number(p.age)<23?'young':Number(p.age)<45?'adult':'older';
 function key(p={}){return /咒灵/.test(p.identity||'')?'curse':ageKey(p)+'-'+(p.gender==='女'?'f':'m');}
 function sprite(catalog,p={},unit={}){
  const base=catalog?.actors?.['player-'+key(p)];if(!base)return null;
  const art=JSON.parse(JSON.stringify(base)),tool=catalog.playerWeapons?.[unit.equipmentId];
  art.playerAvatar=true;art.identity=p.identity||'咒术师';art.playerProfile=key(p);
  art.height*=Number(p.age)<15?.80:1;
  const m=((p.melee||[1,1])[0]+(p.melee||[1,1])[1])/2,e=((p.eff||[1,1])[0]+(p.eff||[1,1])[1])/2;
  art.combatStyle=m>e*1.30?'brawler':e>m*1.30?'channeler':'balanced';
  art.mastery=Math.max(0,Math.min(300,Number(p.prof)||0));
  art.techniqueFlag=unit.flag||p.technique?.flag||'';
  if(tool&&!unit.weaponSealed){
   art.playerWeapon={...tool,id:unit.equipmentId};
   const family=tool.family==='blade'?'blade':'pole',idle=family==='blade'?16:20,recover=family==='blade'?19:23;
   art.actions.melee=art.actions[tool.family];
   art.actions['weapon-'+tool.family]=art.actions[tool.family];
   art.actions.blackflash=art.actions[tool.family];
   art.poses.idle=idle;art.poses.idle2=idle;art.poses.idle3=idle;
   art.animations.idle={loop:true,track:[{frame:idle,until:1.15},{frame:recover,until:1.42},{frame:idle,until:2.9}]};
  }
  art.actions['player-burst']=JSON.parse(JSON.stringify(art.actions.melee));
  art.actions['player-burst'].timing=[.30,.52,.59,.83,1.24];
  if(!art.playerWeapon)art.actions['player-burst'].track=[{frame:3,until:.30},{frame:4,until:.41},{frame:5,until:.52},{frame:6,until:.59},{frame:7,until:.83},{frame:8,until:1.04},{frame:0,until:1.24}];
  for(const family of ['blade','pole','chain']){const base=art.actions[family];if(base){art.actions['weapon-'+family+'-special']=JSON.parse(JSON.stringify(base));}}
  return art;
 }
 function action(unit,event={}){
  const flag=unit.flag||'',tech=CombatPresentation.techniques[flag],melee=event.attackKind==='melee'||/体术|拳击|踢击/.test(event.text||'');
  if(melee)return {kind:'melee',variant:event.type==='flash'?'blackflash':event.styleMove==='burst'?'player-burst':event.styleMove?.startsWith('weapon-')?event.styleMove+'-special':unit.battleSprite?.playerWeapon?'weapon-'+unit.battleSprite.playerWeapon.family:''};
  // Passive regeneration/protection must not replace the actual offensive strike with a heal.
  const kind=CombatPresentation.selfKinds.includes(tech?.kind)?'orb':tech?.kind||'orb';
  return {kind,variant:flag};
 }
 window.PlayerPresentation={key,sprite,action};
})();
