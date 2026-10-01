/* Daily choices share the original growth, hunt, preparation and checkpoint rules. */
(() => {
 'use strict';
 const guard='下一场首轮保持防御至首次行动；前 3 次受击额外减伤 20%。';
 const supply='下一场第 2 次自身行动开始时，恢复 25% 咒力。';
 const train=(label,stat)=>({label,stat});
 const train2=(label,stat)=>({label,stat,mult:2}); // 双倍成长事件
 const gamble=(label,stat,odds)=>({label,gamble:{stat,odds:odds??0.55,mult:2}}); // 押注：赢双倍，输空手
 const flashGamble=(label,odds)=>({label,flashGamble:{odds:odds??0.20}}); // 感悟黑闪
 const huntHard={label:'深入巢穴，挑战强敌',huntHard:true,desc:'遭遇比自身高 1 级的咒灵（封顶强特级）。战胜按强敌等级结算奖励；可撤退，战败可能结束旅程。'};
 const prep=(label,preparation)=>({label,preparation,desc:preparation==='guard'?guard:supply});
 const hunt={label:'接受祓除任务',hunt:true,desc:'随机遭遇不高于自身等级的咒灵。获胜获得战斗奖励；可撤退，战败可能结束旅程。'};
 const pools={
  train:[
   {label:'拆解连击',scene:'训练场上，连续出手与稳住架势需要不同的练习。今天把时间留给哪一项？',choices:[train('磨练近身连击','melee'),train('加强身体承受力','hp')]},
   {label:'咒力回路',scene:'反复输出时，你察觉到了咒力流失。扩大总量，或练习更准确地控制它。',choices:[train('积累咒力总量','cp'),train('压低出手消耗','ctl')]},
   {label:'术式复盘',scene:'重做上次没能掌握的术式动作，也可以先练习应对敌人的反击。',choices:[train('钻研术式效率','eff'),prep('练习护身架势','guard')]},
   {label:'地下赌场的邀约',scene:'训练归来的巷子里，一家地下赌场的掮客拦住了你：「术师老爷，玩一把？坐杀博徒的规矩——赢了翻倍，输了认栽。」',choices:[gamble('押上今日的修行手感','eff'),train('转身离开，回去稳定复盘','eff')]},
   {label:'七海的加班指导',scene:'七海建人罕见地出现在训练场。「劳动就是狗屎……但既然来了。」他把公文包放在场边，「十划咒法的节奏，看好了。」',choices:[train2('接受十划特训（双倍成长）','melee'),train('请教省力工作的诀窍','ctl')]}
  ],
  mission:[
   {label:'残秽调查',scene:'巡查中发现了咒灵留下的痕迹。可以就此练习追踪，也可以继续寻找目标。',choices:[train('观察残秽，练习操控','ctl'),hunt]},
   {label:'清理委托',scene:'新的祓除委托送到了手中。确认自身状态，再决定是否出发。',choices:[hunt,prep('暂缓出发，准备补给','supply')]},
   {label:'巡查结束前',scene:'巡查即将结束。你可以继续接取实战任务，或带着这次的观察返回训练。',choices:[hunt,train('复盘实战，磨练体术','melee')]},
   {label:'未登记的巢穴',scene:'「窗」没有记录过的咒灵巢穴被发现。情报模糊，里面的东西可能比想象中危险——当然，猎物也更肥。',choices:[huntHard,hunt]},
   {label:'东堂的突然袭击',scene:'「兄弟——！！」东堂葵从树后跃出，不由分说摆开架势，「和我打一场！让我确认你的器量！」',choices:[train2('全力应战（体术双倍成长）','melee'),flashGamble('在交锋中感悟黑闪的间隙')]}
  ],
  prepare:[
   {label:'防线演练',scene:'模拟敌人接近时的第一轮攻击。将准备留给下一场战斗，或化为长期训练。',choices:[prep('做好护身整备','guard'),train('锻炼体质','hp')]},
   {label:'补给整理',scene:'检查下一场战斗的咒力补给，也可以借机练习更稳定的咒力积累。',choices:[prep('携带咒力补给','supply'),train('积累咒力总量','cp')]},
   {label:'临战准备',scene:'有限的准备时间，只够带走一种优势。下一场更需要撑住伤害，还是持续输出？',choices:[prep('护身优先','guard'),prep('咒力优先','supply')]},
   {label:'硝子的诊疗室',scene:'家入硝子掐灭了烟：「过来，给你看看。」反转术式的微光漫过全身，旧伤隐隐松动。',choices:[train2('接受反转术式调理（体质双倍成长）','hp'),prep('带一枚急救符以防万一','guard')]},
   {label:'赌上明天的护身符',scene:'地摊上的老人笑眯眯地推来一枚符咒：「灵不灵，试试才知道。」灵验固然血赚，不灵今天就白忙了。',choices:[gamble('买下这枚来路不明的符咒','hp'),prep('不信邪，老老实实做好整备','guard')]}
  ]
 };
 const names={train:'修炼',mission:'任务',prepare:'整备',wheel:'经典转盘',tool:'咒具课题',build:'构筑课题'};
 function index(seed,day,direction,length){
  let n=(seed??0x4a554a55)>>>0;
  for(const c of `${day}:${direction}`)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;
  n^=n>>>16;n=Math.imul(n,0x45d9f3b);n^=n>>>16;
  return (n>>>0)%length;
 }
 const snapshot=()=>deepCopy(Game.player);
 function gains(a,b){
  const list=[];
  for(const [key,name] of [['maxHp','最大生命'],['maxCp','咒力总量'],['ctl','咒力操控'],['prof','术式熟练度']]){
   const d=Math.round((b[key]-a[key])*10)/10;if(d)list.push({name,value:`+${d}${key==='prof'?'%':''}`});
  }
  for(const [key,name] of [['melee','体术伤害'],['eff','术式效率']]){
   const d=b[key].map((v,i)=>v-a[key][i]);if(d.some(Boolean))list.push({name,value:`+${d[0]}～${d[1]}`});
  }
  if(b.levelIndex>a.levelIndex)list.push({name:'综合评级',value:lvName(b.levelIndex)});
  return list;
 }
 function outcome(choice){
  if(choice.gamble){const g=choice.gamble;const p=snapshot();for(let i=0;i<g.mult;i++)Player.train(p,g.stat);const up=gains(Game.player,p).map(x=>x.name+' '+x.value).join('；');return `${Math.round(g.odds*100)}% 赢：${up}｜${100-Math.round(g.odds*100)}% 输：一无所获`;}
  if(choice.flashGamble)return `${Math.round(choice.flashGamble.odds*100)}% 领悟黑闪（已会则熟练度+10%）｜保底：熟练度+3%`;
  if(choice.huntHard)return `强敌（${lvName(Math.min((Game.player.levelIndex??0)+1,10))}咒灵）· 战胜按强敌等级结算`;
  if(choice.stat){const p=snapshot();for(let i=0;i<(choice.mult||1);i++)Player.train(p,choice.stat);return gains(Game.player,p).map(g=>g.name+' '+g.value).join('；')+(choice.mult>1?'（双倍）':'');}
  return choice.desc+(choice.preparation?' 本次替换已有整备，不叠加。':'');
 }
 /** 深入巢穴：高 1 级咒灵、奖励按强敌等级结算 */
 async function runHardHunt(){
  const P=Game.player,tier=clamp(P.levelIndex+1,-2,10);
  Game.addLog('lg',`你循着残秽深入巢穴，遭遇了【${lvName(tier)}咒灵】——气息明显强于平日。`);
  let win;
  try{win=await BattleUI.run({title:`巢穴深处 · ${lvName(tier)}咒灵`,player:P,enemies:[{name:lvName(tier)+'咒灵',li:tier,type:'咒灵',wild:true}],allies:[]});}
  catch(err){console&&console.error&&console.error('巢穴狩猎异常:',err);win=false;}
  P.battleCount++;Game.afterBattleRecover();
  if(win){P.huntCount++;P.killCount++;const t=Player.reward(P,tier);Game.addLog('lgreen',`险胜强敌！${t}`);}
  else if(BattleUI.lastResult==='flee')Game.addLog('lg','你且战且退，从巢穴中脱身，未获收益。');
  else if(P.isVillain)Game.addLog('lgold','【反派路线】你从巢穴中脱身，未致死亡。');
  else Game.ending('death',{title:'巢穴强敌'});
 }
 async function respond(event){
  return new Promise(resolve=>{
   showModal(`<section class="daily-event"><p class="eyebrow">第 ${Game.day+1} 天 · 命运已揭晓</p><h2>${HD.escape(event.label)}</h2>${event.image?`<img class="daily-event-illustration" src="${event.image}" alt="咒具训练场">`:''}<p class="event-narrative">${HD.escape(event.scene)}</p><p class="event-caption">选择处理方式 · 确认后推进一天</p><div class="daily-responses">${event.choices.map((c,i)=>`<button class="daily-response" data-response="${i}"><span>${c.buildLesson?'我的构筑 · 三选一':c.toolLesson?'咒具成长 · 推进一步':c.huntHard?'死斗 · 高回报':c.hunt?'实战 · 有风险':c.gamble?'赌局 · 看运气':c.flashGamble?'感悟 · 看悟性':c.preparation?'下一战优势':c.mult>1?'双倍成长':'永久成长'}</span><b>${HD.escape(c.label)}</b><small>${HD.escape(outcome(c))}</small><i aria-hidden="true">↗</i></button>`).join('')}</div></section>`);
   document.querySelectorAll('[data-response]').forEach(b=>b.onclick=()=>{closeModal();resolve(event.choices[Number(b.dataset.response)]);});
   document.querySelector('[data-response]')?.focus({preventScroll:true});
  });
 }
 async function settle(before,label,missionsBefore,gearBefore,buildBefore){
  if(Save.phase==='ended')return;
  const changes=gains(before,Game.player),missions=Campaign.state.missions.slice(missionsBefore),next=EVENT_DAYS.find(d=>d>Game.day);
  await new Promise(resolve=>{
   showModal(`<section class="daily-settlement"><p class="eyebrow">第 ${Game.day} 天 · 行动完成</p><h2>${HD.escape(label)}</h2>${missions.length?`<p>${missions.map(m=>m.result==='win'?'任务完成':m.result==='flee'?'已安全撤出':'支援结束').join(' · ')}</p>`:''}${window.Equipment?.rewardHTML(gearBefore)||''}${window.CursedToolTraining?.eligible()?`<p class="lesson-result">咒具课题：${Equipment.find(CursedToolTraining.eligible()).name} · ${CursedToolTraining.lesson(CursedToolTraining.eligible()).stage}/3</p>`:window.CursedToolTraining&&Equipment.state()?.training?'<p class="lesson-result">现有咒具课题已完成，专属持械动作可在战斗中使用。</p>':''}${window.PlayerBuild&&(DailyUI.direction==='build'||buildBefore&&JSON.stringify(buildBefore)!==JSON.stringify(PlayerBuild.state()))?`<div class="ready-result"><b>构筑成长已收下</b><p>${HD.escape(PlayerBuild.summary(PlayerBuild.state()))}</p><small>已掌握 ${PlayerBuild.state().unlocked.length} 种专精 · 日程中可调整两个专精槽。</small></div>`:''}<div class="growth-results">${changes.map(g=>`<div><span>${g.name}</span><b>${HD.escape(g.value)}</b></div>`).join('')||'<p>本日没有永久属性变化。</p>'}</div>${Campaign.state.preparation?`<div class="ready-result"><b>${Campaign.state.preparation==='guard'?'护身已备妥':'咒力补给已备妥'}</b><p>${Campaign.state.preparation==='guard'?guard:supply}</p><small>保留至下一场战斗，进入战斗时消耗。</small></div>`:''}<p class="settlement-next">${next?`接下来：${HD.escape(STORY[next].chapter)} · 还有 ${next-Game.day} 天`:'本轮日程已完成'}</p><button class="btn" id="dailyReturn">收下成果，返回日程</button></section>`);
   $('dailyReturn').onclick=()=>{closeModal();resolve();};$('dailyReturn').focus({preventScroll:true});
  });
 }
 const daily=async function(){
  if(Game.day>=120||Save.phase==='ended')return;
  const gearBefore=window.Equipment?.owned()||[];
  const before=snapshot(),buildBefore=window.PlayerBuild?deepCopy(PlayerBuild.state()):null,missionsBefore=this.state.missions.length,next=Game.day+1;
  let label;
  if(STORY[next]){Game.day=next;Game.render();await this.chapter(next);label=STORY[next].chapter;}
  else {
   const direction=window.DailyUI?.direction||'train';
   if(direction==='wheel'){
    const pick=await openWheelModal({title:`第 ${next} 天 · 经典行动转盘`,items:WHEEL_DAILY});
    Game.day=next;label=pick.label;
    if(pick.act==='hunt')await Game.hunt();else Game.addLog('lcyan',Player.train(Game.player,pick.act));
   }else{
    const lesson=direction==='build'?window.PlayerBuild?.event():direction==='tool'?window.CursedToolTraining?.event():null;
    const basePool=pools[direction]||pools.train;
    const pool=['train','prepare'].includes(direction)&&window.PlayerBuild&&next>PlayerBuild.state().lastDay?[...basePool,PlayerBuild.event()]:basePool;
    const event=lesson||await openWheelModal({title:`第 ${next} 天 · ${names[direction]}际遇`,items:pool,selectedIndex:index(this.state.eventSeed,next,direction,pool.length),delay:600});
    const choice=await respond(event);Game.day=next;label=event.label+' · '+choice.label;
    Game.addLog('lgold',`第 ${next} 天 · ${label}`);
    if(choice.toolLesson)Game.addLog('lgold',CursedToolTraining.apply(choice,next));
    if(choice.buildLesson)Game.addLog('lgold',PlayerBuild.apply(choice,next));
    if(choice.stat){for(let i=0;i<(choice.mult||1);i++)Game.addLog('lcyan',Player.train(Game.player,choice.stat));}
    else if(choice.gamble){
     const g=choice.gamble,roll=Math.random();
     if(roll<g.odds){Game.addLog('lgold',`【赌局获胜】坐杀博徒从不亏待好运的人。`);for(let i=0;i<g.mult;i++)Game.addLog('lcyan',Player.train(Game.player,g.stat));}
     else Game.addLog('lred','【赌局落败】骰子停在糟糕的一面——今日的修行手感付诸东流。');
    }
    else if(choice.flashGamble){
     const fg=choice.flashGamble;
     if(!Game.player.blackFlash&&Math.random()<fg.odds){Game.player.blackFlash=true;Game.addLog('lgold','★ 在与东堂的交锋中，你触碰到了那道间隙——【黑闪】领悟！');}
     else{const n=Game.player.blackFlash?10:3;Player.gainProf(Game.player,n);Game.addLog('lcyan',`交锋结束，术式熟练度 +${n}%。`);}
    }
    else if(choice.huntHard)await runHardHunt();
    else if(choice.preparation){this.state.preparation=choice.preparation;Game.addLog('lcyan',`${choice.label}：${choice.desc}`);}
    else if(choice.hunt)await Game.hunt();
   }
  }
  Game.afterBattleRecover();Game.render();await settle(before,label,missionsBefore,gearBefore,buildBefore);
 };
 Campaign.daily=daily;
 // Only the day-10 gameplay brief changes; original enemy, ally and reward rules remain.
 Campaign.chapters[10]={title:'废楼 · 初次协同',intro:'钉崎来到东京后，开始了初次祓除任务。你将以支援术师的身份参与这场游戏挑战，与钉崎一同对付废楼中的咒灵。先观察敌方预告，再决定进攻或防御。',stages:STORY[10].stages.map(s=>({...s,objective:{type:'defeat',label:'与钉崎协同，祓除废楼咒灵'}}))};
 window.DailyEvents={pools,names,index,gains,outcome,guard,supply};
})();
