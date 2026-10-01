// Development-only QA entry point. Not shipped; never run on the player origin.
if(location.port==='18813'){
  const toolbar=document.createElement('nav');toolbar.id='domainQA';toolbar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:40000;background:#152a32;color:white;display:flex;flex-wrap:wrap;gap:6px;padding:5px;font:12px sans-serif';
  const choices=['常规','火山','海滩','巨手','法庭','御厨子','影域','未知领域','势均力敌','压制对手','少年院','迎击','崩解','关闭测试'];
  const names={'火山':'盖棺铁围山','海滩':'荡蕴平线','巨手':'自闭圆顿裹','法庭':'诛伏赐死','御厨子':'伏魔御厨子','影域':'嵌合暗翳庭','未知领域':'万鬼来朝','势均力敌':'自闭圆顿裹','压制对手':'自闭圆顿裹','迎击':'自闭圆顿裹'};
  const fixture=()=>{const draws={};Game.createSteps.forEach(s=>{let i=['cp','ctl','melee','eff','hp'].includes(s.key)?8:s.key==='identity'?2:s.key==='technique'?0:0;draws[s.key]=deepCopy(s.items[i]);if(s.key==='hp')draws[s.key].tierIdx=i;});const p=Player.create(draws);p.prof=185;p.domainLearned=true;return p;};
  let opening=false;
  const launch=async kind=>{
    if(opening)return;
    if(kind==='关闭测试'){BattleUI.runId++;BattleUI._clearTimers();BattleUI.domainShown=[];closeModal();return;}
    if(kind==='崩解'){if(!BattleUI.eng)return;const ev=[];for(const f of [...window.DomainCombat.fields(BattleUI.eng)])window.DomainCombat.collapse(BattleUI.eng,f,ev,'测试解除');BattleUI.eventsAnim(ev,()=>BattleUI.render());return;}
    opening=true;BattleUI._clearTimers();BattleUI.runId++;BattleUI._introDone=true;
    const p=fixture();Game.player=p;Game.day=90;const oldLoop=BattleUI.loop,oldIntro=BattleUI.playIntro;
    BattleUI.loop=()=>{};BattleUI.playIntro=function(){this._introDone=true;};
    BattleUI.run({title:'领域场景验证 · '+kind,player:p,enemies:[E(kind==='御厨子'?'十影宿傩':kind==='海滩'?'陀艮':kind==='火山'?'漏壶':kind==='法庭'?'日车宽见':'真人',9)],allies:[],v3:true,chapterDay:kind==='少年院'?33:90});
    BattleUI.loop=oldLoop;BattleUI.playIntro=oldIntro;
    const e=BattleUI.eng;
    for(const u of e.units){u.hp=u.maxHp=1000000;u.cp=u.maxCp=10000;u.eff=[100,100];u.ctl=100;u.skills.sixEyes=0;u.canDomain=true;}
    e.player.domainName='无量空处';e.cfg.player.prof=185;e.cfg.domainReactions=kind==='迎击';
    const u=e.units[1],ev=[];u.domainName=names[kind]||'领域';
    if(!['常规','少年院'].includes(kind)){
      if(!['势均力敌','压制对手','迎击'].includes(kind))e.player.canDomain=false;
      if(kind==='压制对手'){e.cfg.player.prof=300;e.player.ctl=100000;u.ctl=0;e.castDomain(e.player,ev);}
      else if(kind==='势均力敌')e.castDomain(e.player,ev);
      else e.castDomain(u,ev);
      e.afterAction(e.lastActor||u,ev);
    }
    e.awaitingPlayer=false;BattleUI.render();
    // Static previews apply real rule events without repeating audio; the reaction test uses the real queue.
    if(kind==='迎击')BattleUI.eventsAnim(ev,()=>{BattleUI.render();opening=false;});
    else{BattleUI.domainShown=window.DomainCombat.snapshot(e);BattleUI.render();opening=false;}
  };
  choices.forEach(t=>{const b=document.createElement('button');b.textContent=t;b.style.cssText='background:#294653;border:1px solid #8ea0a3;color:white;padding:5px';b.onclick=()=>launch(t);toolbar.append(b);});document.body.append(toolbar);
}
