/* Independent practice configurations, current production rules, no save access. */
(() => {
 const scenarios=[
  {id:'complete',label:'完整领域 · 熔岩迎击',enemy:'漏壶',li:10,type:'咒灵',technique:'limitless',day:35,environment:'road',goal:'抵消灼热，集中攻击施术者动摇结界。'},
  {id:'incomplete',label:'未完成领域 · 影域牵制',enemy:'陀艮',li:10,type:'咒灵',technique:'shadows',day:89,environment:'platform',goal:'用未完成影域牵制必中，利用式神增幅争取出手机会。'},
  {id:'open',label:'开放领域 · 外侧侵蚀',enemy:'15指宿傩',li:10,type:'受肉体',technique:'limitless',day:90,environment:'shibuya-ruins',goal:'观察开放结界的侵蚀，权衡进攻破域与防御稳固。'}
 ];
 function create(options={}){
  const scenario=scenarios.find(s=>s.id===options.scenario)||scenarios[0];
  const player=PlayerPractice.create({...options,identity:'咒术师',technique:scenario.technique,mastery:185});
  // This isolated lesson grants learned black flash; the journey's learning rules stay intact.
  player.blackFlash=true;
  const rules=PlayerBattleRules;rules.Game.player=player;rules.Game.day=scenario.day;
  const engine=new rules.BattleEngine({title:'领域迎击 · 独立演练',player,allies:[],enemies:[{name:scenario.enemy,li:scenario.li,type:scenario.type}],domainReactions:true,equipment:options.equipment||null,chapterDay:scenario.day});
  const enemy=engine.units[1];
  // Explicit practice panels only: production NPC values and story encounters are untouched.
  enemy.hp=enemy.maxHp=Math.round(player.maxHp*1.15);enemy.cp=enemy.maxCp=Math.round(player.maxCp*.95);
  enemy.melee=player.melee.map(n=>Math.round(n*.65));enemy.eff=player.eff.map(n=>Math.round(n*.70));enemy.ctl=player.ctl;enemy.speed=engine.player.speed*.95;
  enemy.skills={...enemy.skills,charge:0,chargeSlash:null,spaceSlash:null,summonMakora:0};enemy.canUlt=false;enemy.reverse=false;
  // Make the first real NPC action deterministic for the domain lesson; later decisions use normal AI.
  const npc=engine.npcAct;let announced=false;
  engine.npcAct=function(unit,ev){if(unit===enemy&&!announced){announced=true;return this.castDomain(unit,ev);}return npc.call(this,unit,ev);};
  enemy.atb=99;engine.player.atb=0;engine.events=[];
  return {player,engine,scenario};
 }
 window.DomainDuelModel={scenarios,create};
})();
