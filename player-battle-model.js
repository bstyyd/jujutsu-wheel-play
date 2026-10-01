/* Practice uses the game's real generators and battle engine. It never reads or writes a save. */
(() => {
 const rules=window.PlayerBattleRules;
 const choose=(list)=>{const sum=list.reduce((n,x)=>n+(x.weight??1),0);let roll=Math.random()*sum;return list.find(x=>(roll-=x.weight??1)<0)||list.at(-1);};
 function create(options={}){
  const profile=CombatPresentation.profiles.find(p=>p.key===options.profile)||CombatPresentation.profiles[0];
  const identity=rules.identity.find(x=>x.label===options.identity)||rules.identity.find(x=>x.label==='咒术师')||rules.identity[2];
  const tech=rules.techniques.find(x=>x.flag===options.technique)||choose(rules.techniques);
  const tiers=({balanced:[7,7,7,7],brawler:[7,6,8,6],channeler:[8,6,6,8],precise:[7,8,6,7]})[options.build]||[7,7,7,7];
  const draws={identity,era:rules.era[0],age:{label:profile.age+'岁'},gender:{label:profile.gender},face:rules.face[4],
   technique:tech,cp:rules.cp[tiers[0]],ctl:rules.ctl[tiers[1]],melee:rules.melee[tiers[2]],eff:rules.eff[tiers[3]],hp:{...rules.hp[6],tierIdx:6},growth:rules.growth[3]};
  const p=rules.Player.create(draws);p.prof=Number(options.mastery)||0;p.domainLearned=p.prof>=100;p.ultimateLearned=p.prof>=300;p.blackFlash=!!options.learnBlackFlash;
  return p;
 }
 function randomOptions(){const p=choose(CombatPresentation.profiles),identity=choose(rules.identity);return {profile:p.key,identity:identity.label,technique:choose(rules.techniques).flag,build:choose(['balanced','brawler','channeler','precise'].map(key=>({key}))).key,mastery:100,equipment:choose([{id:''},...Equipment.catalog.filter(x=>x.index<5)]).id};}
 function engine(p,equipment,style='',playerBuild=null){
  rules.Game.player=p;rules.Game.day=70;
  // The rival roster follows the player's actual faction, rather than making curses ally with sorcerers.
  const cfg=p.isVillain?{allies:[{name:'坏相',li:6,type:'受肉体'}],enemies:[{name:'虎杖悠仁',li:6,type:'咒术师'},{name:'钉崎野蔷薇',li:4,type:'咒术师'}]}:
   {allies:[{name:'钉崎野蔷薇',li:4,type:'咒术师'}],enemies:[{name:'坏相',li:6,type:'受肉体'},{name:'血涂',li:5,type:'受肉体'}]};
  if(style){
   // These relative panels exist only in the sandbox. Production story NPCs remain unchanged.
   const e=new rules.BattleEngine({title:'玩家流派演练',player:p,equipment:equipment||null,villain:p.isVillain,stylePractice:true,practiceSkills:true,playerBuild,weaponTraining:style==='weapon'?{version:1,lessons:Object.fromEntries(Object.keys(CursedToolTraining.families).map(id=>[id,{stage:3,focus:'edge',day:0}]))}:null,allies:[],enemies:[{name:'二级咒灵',li:4,type:'咒灵'}]});
   const enemy=e.units[1],avg=(p.melee[0]+p.melee[1])/2;
   enemy.maxHp=enemy.hp=Math.round((style==='ranged'?(p.eff[0]+p.eff[1])*5:avg*(style==='summon'?5.4:7)));enemy.melee=[Math.round(p.maxHp*.07),Math.round(p.maxHp*.10)];enemy.eff=[Math.round(p.maxHp*.11),Math.round(p.maxHp*.14)];enemy.reverse=false;enemy.canDomain=false;enemy.skills={};enemy.speed=e.player.speed*.83;enemy.atb=0;enemy.flag=null;enemy.flags=[];enemy.techName='咒力冲击';enemy.ctl=0;
   return e;
  }
  return new rules.BattleEngine({title:'八十八桥 · 玩家战斗演练',player:p,equipment:equipment||null,villain:p.isVillain,playerBuild,...cfg});
 }
 window.PlayerPractice={create,randomOptions,engine};
})();
