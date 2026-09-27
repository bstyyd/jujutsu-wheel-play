'use strict';
// v3 journey rules. Existing v1 saves keep their original route until a new journey is created.
const Campaign = {
  state: null,
  eras: [
    {day:0, place:'杉泽第三高校', brief:'虎杖尚未吞下宿傩的手指。', tier:3},
    {day:5, place:'东京 · 咒术高专', brief:'虎杖已成为宿傩的容器，即将与钉崎会合。', tier:3},
    {day:25, place:'少年院任务前', brief:'一年级三人组已经集结，少年院任务尚未开始。', tier:5},
    {day:34, place:'东京 · 高专训练期', brief:'少年院事件已发生，虎杖正在秘密修行。', tier:6},
    {day:49, place:'东京 · 交流会会场', brief:'顺平事件已结束，两校交流会即将开始。', tier:6},
    {day:69, place:'八十八桥周边', brief:'花御袭击交流会之后，新的咒物事件等待调查。', tier:7},
    {day:85, place:'涩谷 · 帐外待命', brief:'10月31日的涩谷事件即将展开；五条尚未被封印。', tier:8},
    {day:100, place:'死灭回游 · 结界外', brief:'涩谷事变已结束，五条仍被封印；此前战斗不计入你的履历。', tier:9},
    {day:118, place:'新宿 · 决战准备', brief:'五条已经解封，宿傩已占据伏黑的身体。最终挑战即将开始。', tier:11}
  ],
  fresh(mode='random', origin=0) {
    return {version:1,mode,cycle:1,carry:0,inheritedProf:0,origin,completed:[],missions:[],chronicles:[],preparation:null,eventSeed:Math.floor(Math.random()*4294967296)};
  },
  modern(){return !!this.state && this.state.mode!=='legacy';},
  difficulty(cycle=1){const n=cycle-1;return {hp:1+.22*n+.015*n*n,damage:1+.12*n,speed:1+Math.min(.2,.025*n)};},
  validate(r, day, phase) {
    if(!r||r.version!==1||!['random','custom','legacy'].includes(r.mode)||!Number.isInteger(r.cycle)||r.cycle<1||r.cycle>99)throw Error('周目数据不兼容');
    if(!Number.isFinite(r.carry)||r.carry!==Math.min(30,(r.cycle-1)*5)||!Number.isFinite(r.inheritedProf)||r.inheritedProf<0||r.inheritedProf>100)throw Error('继承数据超出范围');
    if(!this.eras.some(e=>e.day===r.origin)||!Array.isArray(r.completed)||r.completed.length>EVENT_DAYS.length||new Set(r.completed).size!==r.completed.length||r.completed.some(d=>!EVENT_DAYS.includes(d)||d<=r.origin||(phase!=='create'&&d>day)))throw Error('章节进度不一致');
    if(!Array.isArray(r.missions)||r.missions.length>80||new Set(r.missions.map(m=>m?.id)).size!==r.missions.length||r.missions.some(m=>!m||typeof m.id!=='string'||!/^\d+:\d+$/.test(m.id)||Number(m.id.split(':')[0])!==m.day||!Number.isInteger(m.day)||!EVENT_DAYS.includes(m.day)||m.day<=r.origin||m.day>day||!['win','lose','flee'].includes(m.result)))throw Error('任务记录异常');
    if(!Array.isArray(r.chronicles)||r.chronicles.length>98||r.chronicles.some(c=>!c||!Number.isInteger(c.cycle)||c.cycle<1||c.cycle>=r.cycle||typeof c.technique!=='string'))throw Error('历次周目记录异常');
    if(![null,'guard','supply'].includes(r.preparation))throw Error('整备数据异常');
    if(r.eventSeed!==undefined&&(!Number.isInteger(r.eventSeed)||r.eventSeed<0||r.eventSeed>4294967295))throw Error('际遇数据异常');
    return r;
  },
  nextRun(s){
    if(s.phase!=='ended'||s.ending?.kind!=='win'||s.day!==120||!s.run||s.run.cycle>=99||(s.run.mode!=='legacy'&&!s.run.completed.includes(120)))throw Error('完成最终挑战后才能进入下一周目');
    const r=this.fresh('custom',s.run.origin);r.cycle=s.run.cycle+1;r.carry=Math.min(30,(r.cycle-1)*5);
    r.inheritedProf=Math.min(100,Math.floor(s.player.prof*.25));
    r.chronicles=[...s.run.chronicles,{cycle:s.run.cycle,technique:s.player.technique.name,day:s.day}].slice(-98);
    return r;
  },
  facts(day=Game.day,r=this.state){const passed=d=>r&&r.mode!=='legacy'?(r.origin>=d||r.completed.includes(d)):day>=d;return {gojoSealed:passed(88)&&day<118,shibuyaEnded:passed(90),sukunaVessel:day>=118?'伏黑惠':'虎杖悠仁'};},
  applyStart(){
    const p=Game.player,r=this.state;if(!this.modern())return;
    r.origin=p.startDay;p.isVillain=false;
    const k=1+r.carry/100;
    for(const key of ['maxHp','maxCp','ctl'])p[key]=Math.round(p[key]*k);
    p.melee=p.melee.map(v=>Math.round(v*k));p.eff=p.eff.map(v=>Math.round(v*k));p.hp=p.maxHp;p.cp=p.maxCp;
    Player.gainProf(p,Math.max(0,r.inheritedProf-p.prof)/(p.identity==='咒术师'?1.2:1));
    p.levelIndex=Player.evalLevel(p);
    Game.addLog('lgold',`第 ${r.cycle} 周目 · 开局属性加成 ${r.carry}% · 全部 36 种术式保留。`);
    Game.addLog('lg',this.eras.find(e=>e.day===p.startDay).brief);
    Game.addLog('lg','日数是游戏进度刻度；玩家支援任务与扩展技能属于游戏玩法。身份不会翻转原作人物的阵营。');
  },
  async choose(title, text, choices){
    return new Promise(resolve=>{
      showModal(`<h2>${HD.escape(title)}</h2><p>${HD.escape(text)}</p><div class="journey-choices">${choices.map((c,i)=>`<button class="choice-card" data-choice="${i}"><b>${HD.escape(c.label)}</b><small>${HD.escape(c.desc||'')}</small></button>`).join('')}</div>`);
      $('modalBox').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{closeModal();resolve(choices[Number(b.dataset.choice)]);});
    });
  },
  async daily(){
    if(Game.day>=120||Save.phase==='ended')return;
    $('btnActionWheel').disabled=true;
    const next=Game.day+1;
    if(STORY[next]){Game.day=next;Game.render();await this.chapter(next);}
    else {
      const c=await this.choose(`第 ${next} 天 · 安排行动`,'每次选择推进一天。整备只用于下一场战斗，不叠加。',[
        {label:'定向修炼',desc:'自己决定要提升的属性。',act:'train'},
        {label:'狩猎咒灵',desc:'实战获得成长；战败可能终止旅程。',act:'hunt'},
        {label:'出发前整备',desc:'护身或咒力补给，留给下一场战斗。',act:'prepare'},
        {label:'交给转盘',desc:'保留原版六种随机日常行动。',act:'wheel'}
      ]);
      if(c.act==='train'){
        const t=await this.choose('选择修炼方向','按原版固定增量成长，消耗一天。',[
          {label:'咒力总量',act:'cp'},{label:'体术修炼',act:'melee'},{label:'锻炼体质',act:'hp'},
          {label:'咒力操控',act:'ctl'},{label:'咒力效率',act:'eff'}]);
        Game.day=next;Game.addLog('lcyan',Player.train(Game.player,t.act));
      }else if(c.act==='prepare'){
        const t=await this.choose('出发前整备','当前整备会被替换。',[
          {label:'护身整备',act:'guard',desc:'下一场首轮保持防御，直到第一次行动；本场前 3 次受击伤害再减 20%。'},
          {label:'咒力补给',act:'supply',desc:'下一场第 2 次自己的行动开始时，恢复 25% 咒力。'}]);
        Game.day=next;this.state.preparation=t.act;Game.addLog('lcyan',`完成${t.label}，将在下一场战斗使用。`);
      }else{
        Game.day=next;
        const pick=c.act==='wheel'?await openWheelModal({title:`第 ${next} 天 · 行动转盘`,items:WHEEL_DAILY}):{act:'hunt'};
        if(pick.act==='hunt')await Game.hunt();else Game.addLog('lcyan',Player.train(Game.player,pick.act));
      }
    }
    Game.afterBattleRecover();Game.render();$('btnActionWheel').disabled=Save.phase==='ended';
  },
  async battle(day, index, stage, title){
    if(stage.intro)await Game.storyModal(title,stage.intro);
    const objective=stage.objective||{type:'defeat',label:'完成本场战斗挑战'};
    const win=await BattleUI.run({title,player:Game.player,enemies:deepCopy(stage.enemies||[]),allies:deepCopy(stage.allies||[]),objective,chapterDay:day,chapterStage:index,v3:true});
    Game.player.battleCount++;
    const id=day+':'+index;
    // A checkpoint is before the whole day: replay does not double-award a mission.
    if(!this.state.missions.some(m=>m.id===id)){
      this.state.missions.push({id,day,result:BattleUI.lastResult||'lose'});
      if(win){const li=Math.max(0,...stage.enemies.map(e=>e.li));Game.addLog('lgreen',`完成：${objective.label}。${Player.reward(Game.player,li)}`);}
      else Game.addLog('lred',`未完成：${objective.label}。本场撤出，主线时序继续。`);
    }
    if(win&&stage.winSkill==='blackFlash')Game.player.blackFlash=true;
    Game.afterBattleRecover();
    if(stage.after)await Game.storyModal('事件后续',stage.after);
    return win;
  },
  async chapter(day){
    if(this.state.completed.includes(day))return;
    const node=STORY[day],special=this.chapters[day];
    Game.addLog('lgold',`◆ ${node.title}`);
    let finalWin=false;
    if(special){
      await Game.storyModal(special.title,special.intro,node.chapter);
      for(let i=0;i<special.stages.length;i++)finalWin=await this.battle(day,i,special.stages[i],special.title);
      if(special.after)await Game.storyModal('事件后续',special.after);
    }else {
      // Unreviewed late battles remain openly labelled game challenges, without invented manga endings.
      await Game.storyModal(node.chapter+' · 战斗挑战','以下战斗沿用原游戏的能力与数值设计；玩家战绩不代表改写原著中人物的生死。');
      let stages=node.stages;
      if(node.wheel){
        const choices=node.wheel.items.filter(x=>x.battle).map(x=>({label:x.label,desc:'选择参与该战场的游戏挑战。',battle:x.battle}));
        stages=[(await this.choose('选择战场','自行选择本次参加的挑战。',choices)).battle];
      }
      for(let i=0;i<stages.length;i++){
        const stage={...stages[i],intro:null};
        if(node.final&&i<stages.length-1)stage.objective={type:'survive',turns:2,label:'支撑 2 次自身行动，或提前击退对手'};
        finalWin=await this.battle(day,i,stage,`${node.chapter} · 挑战 ${i+1}/${stages.length}`);
      }
    }
    this.state.completed.push(day);Game.player.eventsDone=[...this.state.completed];
    if(node.final)Game.ending(finalWin?'win':'loseFinal',{title:'新宿决战 · 游戏挑战'});
    Game.render();
  },
  chapters: {},
  install(){
    const finish=Game.finishCreate;Game.finishCreate=function(){finish.call(this);Campaign.applyStart();Game.render();};
    const daily=Game.dailyAction;Game.dailyAction=function(){return Campaign.modern()?Campaign.daily():daily.call(this);};
    const flip=Game.flipSides;Game.flipSides=function(enemies,allies,noFlip){return Campaign.modern()?{enemies:deepCopy(enemies||[]),allies:deepCopy(allies||[]),villain:false}:flip.call(this,enemies,allies,noFlip);};
  }
};

// Scoped chronology corrections verified against the official episode synopsis / Shibuya timeline.
Campaign.chapters[35]={title:'移动途中的急袭',intro:'五条在移动途中遭到漏瑚袭击，随后将修行中的虎杖带来观战。你的目标是在这场支援挑战中稳住自身。',stages:[{enemies:[E('漏壶',10)],allies:[E('五条悟',11,'咒术师')],objective:{type:'survive',turns:2,label:'支撑 2 次自身行动，或提前完成支援'}}],after:'五条展现了领域之间的差距。此次支援的成绩不改变漏瑚在后续篇章中的出场。'};
Campaign.chapters[88]={title:'涩谷 · 封印前后',intro:'五条在涩谷地下与漏瑚、花御、胀相交战；虎杖随冥冥班前往明治神宫前。你的支援任务属于游戏补充。',stages:[{intro:'虎杖在明治神宫前遭遇蝗虫咒灵。支援他清理通道。',enemies:[E('蝗虫',8)],allies:[E('虎杖悠仁',6,'咒术师')],objective:{type:'defeat',label:'协助清理通道'}}],after:'虎杖击败蝗虫后与冥冥、憂憂会合。另一边，羂索利用狱门疆封印五条；封印消息随后传到各小队。'};
Campaign.chapters[90]={title:'涩谷 · 按时序推进',intro:'封印消息传开后，解除帐与各处战斗先后展开。每场开始都会说明你的支援目标。',stages:[
  {intro:'虎杖、伏黑对付守护帐的粟坂。支撑到同伴找到突破口。',enemies:[E('粟坂二良',4,'诅咒师')],allies:[E('虎杖悠仁',6,'咒术师'),E('伏黑惠',3,'咒术师')],objective:{type:'survive',turns:2,label:'支援降帐：支撑 2 次自身行动或击退对手'},after:'阻挡术师进入的帐被解除。虎杖随后与胀相交战。'},
  {intro:'七海与真希、直毘人会合后遭遇陀艮。你的任务是维持防线，等待脱离机会。',enemies:[E('陀艮',9)],allies:[E('七海建人',6,'咒术师'),E('真希',4,'咒术师'),E('禅院家主',7,'咒术师')],objective:{type:'survive',turns:3,label:'维持防线：支撑 3 次自身行动或完成支援'},after:'伏黑、甚尔先后介入，陀艮被祓除。之后漏瑚袭击伤员；宿傩取得身体控制权，接连与漏瑚、魔虚罗交战。'},
  {intro:'虎杖重新掌握身体后，真人之战继续。七海已遇害，钉崎受重创；东堂到场支援虎杖。',enemies:[E('真人',9)],allies:[E('虎杖悠仁',6,'咒术师'),E('东堂葵',6,'咒术师')],objective:{type:'survive',turns:3,label:'支援虎杖：支撑 3 次自身行动或完成支援'}}
],after:'虎杖击败真人后，羂索将真人吸收。九十九等人随后介入；羂索最终带着封印五条的狱门疆离开。'};

// Tactical rules use a committed plan: opening a card or rerendering cannot reroll enemy intent.
const Tactics={
  target(eng,u,index){
    const foes=eng.alive(u.side==='enemy'?'ally':'enemy'),puppet=foes.find(t=>t.summonTag==='傀儡'),chosen=eng.units[index];
    return puppet||(chosen?.alive&&chosen.side!==u.side?chosen:foes[0]);
  },
  plan(eng,u){
    if(u.intent)return u.intent;
    const foes=eng.alive(u.side==='enemy'?'ally':'enemy');
    const target=foes.find(t=>t.summonTag==='傀儡')||foes.filter(t=>!t.summonTag).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]||foes[0];
    const base={target:eng.units.indexOf(target),scope:'one'},next=(u.buff.actCount||0)+1;
    let p;
    if(u.buff.charge)p={action:'release',label:u.skills.charge?'虚式 · 茈':'空间斩',danger:true};
    else if(u.skills.spaceSlash&&next===u.skills.spaceSlash.after)p={action:'release',label:'空间斩',danger:true,fixed:u.skills.spaceSlash.dmg};
    else if((u.skills.charge&&u.hp<u.maxHp*.8&&u.cp>=u.maxCp*.1)||(u.skills.chargeSlash&&u.hp<u.maxHp*.7&&!u.domainUsed))p={action:'charge',label:'蓄力 · 下一行动释放',danger:true};
    else if(u.canUlt&&!u.ultUsed&&u.hp<u.maxHp*.4&&u.cp>=u.maxCp*.5)p={action:'ult',label:'极之番',scope:'all',danger:true};
    else if(u.canDomain&&(u.domainCd||0)<=(u.reverse?1:0)&&u.cp>=Math.round(u.maxCp*.3)&&Math.random()<.6)p={action:'domain',label:'领域 · '+u.domainName,scope:'all',danger:true};
    else if(['五条悟','九十九由基'].includes(u.name)||u.name.includes('宿傩')){
      const move=u.name==='五条悟'?{label:'苍',mult:1.5,scope:'all'}:u.name==='九十九由基'?{label:'质量弹',mult:2.2}:{label:['解','捌','开'][(next-1)%3],mult:[1.2,1.3,2][(next-1)%3],scope:next%3===2?'one':'all'};
      p={action:'signature',...move,danger:move.scope==='all'};
    }else p=u.cp>=eng.techCost(u)&&Math.random()<.72?{action:'tech',label:u.techName}:{action:'melee',label:'体术攻击'};
    u.intent={...base,...p};return u.intent;
  },
  act(eng,u,ev){
    const p=this.plan(eng,u);u.intent=null;eng._actorLi=u.li;
    const target=this.target(eng,u,p.target);
    if(!target)return;
    if(p.action==='charge'){u.buff.charge=true;ev.push({type:'info',text:`${u.name} 开始蓄力，下一次行动释放。`});return;}
    if(p.action==='domain'&&eng.castDomain(u,ev))return;
    if(p.action==='ult'&&eng.castUltimate(u,ev))return;
    if(p.action==='signature'||p.action==='release'){
      const avg=(u.eff[0]+u.eff[1])/2;
      const damage=p.action==='release'?(p.fixed||u.skills.chargeSlash?.dmg||avg*(u.skills.charge||3)):avg*p.mult;
      u.buff.charge=false;
      ev.push({type:'skillcut',actorName:u.name,text:u.name+' · '+p.label});
      const targets=p.scope==='all'?eng.alive(target.side):[target];
      for(const t of targets)eng.dealDamage(u,t,Math.round(damage),1,'tech',ev,p.label,false,p.action==='release');
      eng.afterStrike(ev);return;
    }
    let action=p.action;
    if(!['tech','melee'].includes(action)){action='melee';ev.push({type:'info',text:`${u.name} 无法完成预告招式，改用体术。`});}
    if(action==='tech'){
      const cost=eng.techCost(u);
      if(u.cp>=cost)u.cp-=cost;else{action='melee';ev.push({type:'info',text:`${u.name} 咒力不足，改用体术。`});}
    }
    eng.performStrike(u,target,action,ev);
  },
  install(){
    const proto=BattleEngine.prototype;
    const npc=proto.makeNpcUnit;proto.makeNpcUnit=function(...args){const u=npc.apply(this,args);if(this.cfg.v3&&u.side==='enemy'){
      const d=Campaign.difficulty(this.cfg.cycle||1);u.maxHp=Math.round(u.maxHp*d.hp);u.hp=u.maxHp;u.speed*=d.speed;u.challengeDamage=d.damage;
    }
      // Story NPCs do not inherit the player's expanded/future abilities (both sides).
      if(this.cfg.v3&&this.cfg.chapterDay<118&&u.name==='虎杖悠仁'){u.flag=null;u.flags=[];u.techName='咒力打击';u.canDomain=false;}
      return u;
    };
    const summon=proto.addSummon;proto.addSummon=function(owner,...args){const u=summon.call(this,owner,...args);if(u)u.challengeDamage=owner.challengeDamage||1;return u;};
    const damage=proto.dealDamage;proto.dealDamage=function(att,tar,base,...args){if(!this.cfg.v3)return damage.call(this,att,tar,base,...args);let b=base*(att.challengeDamage||1);if(tar.isPlayer&&tar.preparedHits>0){b*=.8;tar.preparedHits--;}return damage.call(this,att,tar,Math.round(b),...args);};
    const act=proto.npcAct;proto.npcAct=function(u,ev){return this.cfg.v3&&u.side==='enemy'?Tactics.act(this,u,ev):act.call(this,u,ev);};
    const turn=proto.onTurnStart;proto.onTurnStart=function(u,ev){turn.call(this,u,ev);if(u.isPlayer&&this.cfg.preparation==='supply'&&u.buff.actCount===1){u.cp=Math.min(u.maxCp,u.cp+Math.round(u.maxCp*.25));ev.push({type:'info',text:'整备补给：恢复 25% 咒力。'});}};
    const check=proto.checkEnd;proto.checkEnd=function(ev){if(this.cfg.objective?.type==='survive'&&!this.ended&&(!this.player.alive||this.player.hp<=0)){this.guardPlayerDeath(ev);if(!this.player.alive||this.player.hp<=0){this.ended=true;this.result='lose';ev.push({type:'info',text:'你已倒下，支援目标未完成。'});return true;}}return check.call(this,ev);};
    const after=proto.afterAction;proto.afterAction=function(u,ev){after.call(this,u,ev);if(u.isPlayer&&this.cfg.objective?.type==='survive'&&u.alive&&u.hp>0){this.objectiveTurns=(this.objectiveTurns||0)+1;if(!this.ended&&this.objectiveTurns>=this.cfg.objective.turns){this.ended=true;this.result='win';ev.push({type:'info',text:'支援目标达成，成功脱离本场战斗。'});}}};
    const run=BattleUI.run;BattleUI.run=function(cfg){if(Campaign.modern()){cfg={...cfg,v3:true,cycle:Campaign.state.cycle,preparation:Campaign.state.preparation};Campaign.state.preparation=null;}return run.call(this,cfg);};
    const player=proto.makePlayerUnit;proto.makePlayerUnit=function(p){const u=player.call(this,p);if(this.cfg.preparation==='guard'){u.buff.defend=true;u.preparedHits=3;}return u;};
  }
};
window.Campaign=Campaign;window.Tactics=Tactics;Campaign.install();Tactics.install();
