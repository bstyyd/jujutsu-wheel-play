/* Batch C1 事件引擎：非剧情日的日常行动 40% 概率触发原创事件（与 daily-events.js 共存——
   触发则替换当日际遇，未触发/无候选/经典转盘方向时完全走原逻辑）。
   事件结构 {id,title,scene,cond,choices[{label,req,odds,reward,penalty}]}。
   已触发事件记录在 Campaign.state.eventsSeen（供 Batch E 图鉴使用）。 */
(() => {
'use strict';
const $=id=>document.getElementById(id);

/* ===================== 确定性哈希（与 daily-events 同一套 FNV 风格，QA 可复现） ===================== */
function hash01(seed,salt){
 let n=(seed??0x4a554a55)>>>0;
 for(const c of String(salt))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;
 n^=n>>>16;n=Math.imul(n,0x45d9f3b);n^=n>>>16;
 return (n>>>0)/4294967296;
}
const seed=()=>Campaign.state?.eventSeed??0x4a554a55;

/* ===================== 事件库（16 个原创事件） ===================== */
/* cond: {day, prof, favor:{名:值}, villainOk}  villainOk 缺省 false——羁绊角色事件不对反派路线开放
   req:  {prof, favor:{名:值}, item, stat:{ctl}}  不满足则选项禁用
   结果:  odds 存在时按比例 roll 成功(reward)/失败(penalty)，否则必中 reward
   outcome 字段: train/trainMult, prof, favor{}, randomFavorMet, item, items{},
                 healPct, cpPct, hpLossPct, cpLossPct, battle{title,enemies[{name,li|liOffset,type}]}, battleWin(嵌套outcome) */
const EVENTS=[
 {id:'gojo_blindfold',title:'眼罩之下',cond:{day:10,character:'五条悟'},
  scene:'走廊拐角撞上一堵墙——不，是五条悟。他把眼罩推到额头，蹲下来平视你，看了足足三秒。「让我看看——嗯，有意思。」',
  choices:[
   {label:'坦然对视',reward:{favor:{'五条悟':8},prof:3},odds:0.5,penalty:{favor:{'五条悟':4}}},
   {label:'「别挡路，我要去训练」',reward:{favor:{'五条悟':5},train:'eff'}}]},
 {id:'yuji_lunch',title:'半份饭团',cond:{character:'虎杖悠仁'},
  scene:'天台，虎杖悠仁把便利店饭团掰成两半，大的那半递过来。「你上次训练完脸色很差。吃。」',
  choices:[
   {label:'接过来，陪他吃完',reward:{favor:{'虎杖悠仁':8},healPct:0.10}},
   {label:'吃完饭拉他加练',reward:{favor:{'虎杖悠仁':4},train:'melee'}}]},
 {id:'megumi_shadow',title:'被叼走的笔记',cond:{day:5,character:'伏黑惠'},
  scene:'你的训练笔记摊在地上，伏黑的玉犬正叼着其中一页往走廊尽头跑。伏黑惠站在原地，耳尖发红：「……它平时不这样。」',
  choices:[
   {label:'陪玉犬玩到伏黑来领',reward:{favor:{'伏黑惠':8}}},
   {label:'「让它把调动式神的方法也叼一份给我」',req:{prof:30},reward:{favor:{'伏黑惠':5},prof:4}}]},
 {id:'nobara_shopping',title:'拎包的',cond:{day:10,character:'钉崎野蔷薇'},
  scene:'商场镜子前，钉崎野蔷薇正比着一条裙子。她从镜子里看到你，头也不回：「看什么看。拎包的，跟上。」',
  choices:[
   {label:'拎包一下午（腿会酸）',reward:{favor:{'钉崎野蔷薇':10},hpLossPct:0.05}},
   {label:'坚决拒绝',reward:{favor:{'钉崎野蔷薇':-3},train:'ctl'}}]},
 {id:'nanami_overtime',title:'末班车之前',cond:{day:25,character:'七海建人'},
  scene:'天黑透了，七海建人看了眼表。「到点了。加班是狗屎。」他拎起公文包，又停下，「……不过你刚才那一式，重心偏了三公分。」',
  choices:[
   {label:'请他指点到末班车',reward:{favor:{'七海建人':8},train:'melee'}},
   {label:'目送他下班',reward:{favor:{'七海建人':3},cpPct:0.10}}]},
 {id:'todo_question',title:'灵魂拷问',cond:{day:40,character:'东堂葵'},
  scene:'东堂葵从单杠上翻下来拦在你面前，双眼放光，声如洪钟：「兄弟——！你喜欢什么样的女人？！」',
  choices:[
   {label:'认真回答',odds:0.5,reward:{favor:{'东堂葵':12}},penalty:{favor:{'东堂葵':-4},train:'melee'}},
   {label:'「先回答我，你偶像是谁」',reward:{favor:{'东堂葵':6},prof:3}}]},
 {id:'hakari_table',title:'分我一半运气',cond:{day:100,character:'秤金次'},
  scene:'地下赌场最里面那张台，秤金次把一把筹码推到你面前，笑得吊儿郎当：「坐。输了算我的，赢了——分我一半运气。」',
  choices:[
   {label:'上桌',odds:0.55,reward:{item:'cpElixir',favor:{'秤金次':8}},penalty:{favor:{'秤金次':3},cpLossPct:0.10}},
   {label:'「我不赌」',reward:{train:'ctl',favor:{'秤金次':2}}}]},
 {id:'okt_ring',title:'擦戒指的人',cond:{day:100,prof:20,character:'乙骨忧太'},
  scene:'训练场角落，乙骨忧太坐在器械箱上，一遍遍擦着无名指上的戒指。察觉到你，他没有躲：「能和我说说……你的战斗方式吗？」',
  choices:[
   {label:'陪他喂招到天黑',req:{prof:40},reward:{favor:{'乙骨忧太':10},prof:5}},
   {label:'聊聊那枚戒指',reward:{favor:{'乙骨忧太':8}}}]},
 {id:'maki_spar',title:'别指望我放水',cond:{day:15,endDay:89,character:'禅院真希'},
  scene:'禅院真希把长枪往肩上一扛，枪尖点了点你的胸口。「来一场。别指望我放水——放水是侮辱。」',
  choices:[
   {label:'全力应战',reward:{battle:{title:'真希的私人特训',enemies:[{name:'真希',li:4,type:'咒术师',nonlethal:true}]},battleWin:{favor:{'禅院真希':10},train:'melee',trainMult:2}}},
   {label:'讨教咒具保养',reward:{favor:{'禅院真希':5},item:'healCharm'}}]},
 {id:'shoko_clinic',title:'烟灰缸与旧伤',cond:{day:10,character:'家入硝子'},
  scene:'诊疗室的烟灰缸堆成小山。家入硝子掐灭烟，拍了拍诊疗床：「躺下。你肋骨下面那处旧伤，再拖就不是躺一晚能解决的了。」',
  choices:[
   {label:'老实接受治疗',reward:{healPct:0.30,favor:{'家入硝子':8}}},
   {label:'「教我反转术式的门槛」',req:{prof:60},reward:{favor:{'家入硝子':5},prof:4}}]},
 {id:'stray_vending',title:'贩卖机后面',cond:{day:5,villainOk:true},
  scene:'后巷的自动贩卖机后面，传来指甲刮擦金属的声音。一下，两下。节奏不像人。',
  choices:[
   {label:'追进去',reward:{battle:{title:'后巷的刮擦声',enemies:[{name:'巷中咒灵',liOffset:-1,type:'咒灵',wild:true}]},battleWin:{train:'eff',item:'smokeBomb'}}},
   {label:'记下位置，绕开走',reward:{train:'ctl'}}]},
 {id:'old_shop',title:'柜台下面',cond:{day:8,villainOk:true},
  scene:'深夜杂货铺，老婆婆眼皮都不抬，从柜台下面摸出一叠符纸推过来：「识货的孩子。挑一张，别问来路。」',
  choices:[
   {label:'拿一张急疗符',reward:{item:'healCharm'}},
   {label:'拿一枚烟幕弹',reward:{item:'smokeBomb'}},
   {label:'「这些符纸是谁画的？」',req:{favor:{'家入硝子':30}},reward:{prof:3,item:'defCharm'}}]},
 {id:'window_report',title:'涂黑的报告',cond:{day:30,villainOk:true},
  scene:'「窗」的联络员把一份报告塞进你手里，一半内容被涂黑了。他的手指在抖：「这段……你最好别看。真的。」',
  choices:[
   {label:'坚持看完涂黑的部分',odds:0.5,reward:{prof:6},penalty:{cpLossPct:0.05,favor:{'七海建人':-3}}},
   {label:'按规矩归档',reward:{train:'ctl',favor:{'七海建人':3}}}]},
 {id:'riverbank_child',title:'数石头的孩子',cond:{day:12,villainOk:true},
  scene:'河岸边，一个浑身湿透的孩子蹲在那里数石头。数到第七块，就把石头全扔回河里，从头再数。',
  choices:[
   {label:'蹲下来陪他数完这一轮',reward:{healPct:0.10,prof:2}},
   {label:'后退一步——这不是孩子',odds:0.6,reward:{train:'ctl'},penalty:{battle:{title:'河岸的饵',enemies:[{name:'水边咒灵',liOffset:0,type:'咒灵',wild:true}]}}}]},
 {id:'rooftop_wind',title:'想通的一瞬间',cond:{villainOk:true},
  scene:'天台的风把训练服吹得猎猎作响。一个发力细节忽然在脑子里咔哒一声对上了——像钥匙转进锁孔。',
  choices:[
   {label:'立刻下场验证',reward:{train:'eff'}},
   {label:'记下来，讲给同期听',reward:{randomFavorMet:4,prof:2}}]},
 {id:'midnight_eyes',title:'六楼窗外的眼睛',cond:{day:60,villainOk:true},
  scene:'半夜醒来，窗外有一双眼睛。你盯着天花板数了三秒，确认了一件事：你住在六楼。',
  choices:[
   {label:'开窗迎战',reward:{battle:{title:'窗外的注视者',enemies:[{name:'窥视的咒灵',liOffset:0,type:'咒灵'}]},battleWin:{prof:8,item:'atkCharm'}}},
   {label:'装作没看见（一夜无眠）',reward:{hpLossPct:0.05,train:'ctl'}}]}
];

/* ===================== 条件与要求 ===================== */
function condOk(cond,day){
 if(!cond)return true;
 const P=Game.player;
 if(cond.day&&day<cond.day)return false;
 if(cond.endDay!==undefined&&day>cond.endDay)return false;
 if(cond.character&&!Favor.available(cond.character,day))return false;
 if(cond.prof&&P.prof<cond.prof)return false;
 if(P.isVillain&&!cond.villainOk)return false;
 if(cond.favor)for(const [n,v] of Object.entries(cond.favor))if(Favor.get(n)<v)return false;
 return true;
}
function reqReason(req){
 if(!req)return '';
 const P=Game.player;
 if(req.prof&&P.prof<req.prof)return `需熟练度 ${req.prof}%`;
 if(req.favor)for(const [n,v] of Object.entries(req.favor))if(Favor.get(n)<v)return `需 ${n} 羁绊 ${v}`;
 if(req.item&&!Consumables.count(req.item))return `需道具「${Consumables.ITEMS[req.item].name}」`;
 if(req.stat)for(const [k,v] of Object.entries(req.stat))if((P[k]||0)<v)return `需属性 ${k} ${v}`;
 return '';
}
const candidates=day=>EVENTS.filter(e=>condOk(e.cond,day));
const shouldFire=day=>hash01(seed(),'fire:'+day)<0.40;
const pickOf=(day,pool)=>pool[Math.floor(hash01(seed(),'pick:'+day)*pool.length)%pool.length];

/* ===================== 结果预览与结算 ===================== */
function outcomeText(o){
 if(!o)return '';
 const parts=[];
 if(o.train){const p=Game.player,snapshot=deepCopy(p);for(let i=0;i<(o.trainMult||1);i++)Player.train(snapshot,o.train);
  const names={melee:'体术',hp:'体质',cp:'咒力总量',ctl:'咒力操控',eff:'术式效率'};parts.push(`${names[o.train]||o.train} 成长${o.trainMult>1?' ×'+o.trainMult:''}`);}
 if(o.prof)parts.push(`熟练度 +${o.prof}%`);
 if(o.favor)for(const [n,v] of Object.entries(o.favor))parts.push(`${n} 羁绊 ${v>0?'+':''}${v}`);
 if(o.randomFavorMet)parts.push(`随机已相识角色 羁绊 +${o.randomFavorMet}`);
 if(o.item)parts.push(`获得「${Consumables.ITEMS[o.item].name}」`);
 if(o.items)for(const [id,n] of Object.entries(o.items))parts.push(`获得「${Consumables.ITEMS[id].name}」×${n}`);
 if(o.healPct)parts.push(`生命恢复 ${Math.round(o.healPct*100)}%`);
 if(o.cpPct)parts.push(`咒力恢复 ${Math.round(o.cpPct*100)}%`);
 if(o.hpLossPct)parts.push(`生命 -${Math.round(o.hpLossPct*100)}%`);
 if(o.cpLossPct)parts.push(`咒力 -${Math.round(o.cpLossPct*100)}%`);
 if(o.battle)parts.push('进入战斗'+(o.battleWin?'（胜利有追加收获）':'')+' · 不会战死');
 return parts.join('；');
}
async function applyOutcome(o,summary){
 if(!o)return;
 const P=Game.player;
 if(o.train){for(let i=0;i<(o.trainMult||1);i++)Game.addLog('lcyan',Player.train(P,o.train));summary.push('修行有了实感。');}
 if(o.prof){Player.gainProf(P,o.prof);summary.push(`术式熟练度 +${o.prof}%`);}
 if(o.favor)for(const [n,v] of Object.entries(o.favor)){const r=Favor.add(n,v,'',false);if(r&&r.value!==undefined)summary.push(`${n} 羁绊 ${v>0?'+':''}${v}（${r.value} · ${r.tier}）`);}
 if(o.randomFavorMet){const met=Favor.met();if(met.length){const c=met[rand(0,met.length-1)],r=Favor.add(c.name,o.randomFavorMet,'',false);summary.push(`${c.name} 羁绊 +${o.randomFavorMet}（${r.value} · ${r.tier}）`);}}
 if(o.item){Consumables.grant(o.item,1,false);summary.push(`获得道具「${Consumables.ITEMS[o.item].name}」`);}
 if(o.items)for(const [id,n] of Object.entries(o.items)){Consumables.grant(id,n,false);summary.push(`获得「${Consumables.ITEMS[id].name}」×${n}`);}
 if(o.healPct){const h=Math.round(P.maxHp*o.healPct);P.hp=Math.min(P.maxHp,P.hp+h);summary.push(`生命 +${h}`);}
 if(o.cpPct){const c=Math.round(P.maxCp*o.cpPct);P.cp=Math.min(P.maxCp,P.cp+c);summary.push(`咒力 +${c}`);}
 if(o.hpLossPct){const h=Math.max(1,Math.round(P.maxHp*o.hpLossPct));P.hp=Math.max(1,P.hp-h);summary.push(`生命 -${h}`);}
 if(o.cpLossPct){const c=Math.max(1,Math.round(P.maxCp*o.cpLossPct));P.cp=Math.max(0,P.cp-c);summary.push(`咒力 -${c}`);}
 if(o.battle){
  const b=o.battle,P2=Game.player,tier=v=>clamp((P2.levelIndex??0)+v,-2,10);
  const enemies=b.enemies.map(e=>({name:e.name,li:e.li!==undefined?e.li:tier(e.liOffset||0),type:e.type||'咒灵',wild:!!e.wild}));
  let win=false;
  try{win=await BattleUI.run({title:b.title,player:P2,enemies:deepCopy(enemies),allies:[],v3:true});}
  catch(err){console&&console.error&&console.error('事件战斗异常:',err);win=false;}
  P2.battleCount++;Game.afterBattleRecover();
  if(win){P2.huntCount++;P2.killCount++;summary.push('战斗胜利。');if(o.battleWin)await applyOutcome(o.battleWin,summary);}
  else summary.push(BattleUI.lastResult==='flee'?'你且战且退，安全脱身。':'战斗失利……好在只是切磋，没有伤及性命。');
 }
 if(o.log)summary.push(o.log);
}
/** 选项结算：odds 存在则 roll，返回 {success, text[]} */
async function resolveChoice(choice,summary){
 if(choice.odds===undefined){await applyOutcome(choice.reward,summary);return {success:true};}
 if(Math.random()<choice.odds){await applyOutcome(choice.reward,summary);return {success:true};}
 await applyOutcome(choice.penalty,summary);
 return {success:false};
}

/* ===================== UI ===================== */
function ask(event,day){
 return new Promise(resolve=>{
  showModal(`<section class="daily-event engine-event"><p class="eyebrow">第 ${day} 天 · 突发事件</p><h2>${HD.escape(event.title)}</h2><p class="event-narrative">${HD.escape(event.scene)}</p><p class="event-caption">选择如何应对 · 确认后推进一天</p><div class="daily-responses">${event.choices.map((c,i)=>{
   const reason=reqReason(c.req);
   const risk=c.odds!==undefined?`${Math.round(c.odds*100)}% 成功：${outcomeText(c.reward)}｜${100-Math.round(c.odds*100)}% 失败：${outcomeText(c.penalty)||'一无所获'}`:outcomeText(c.reward);
   return `<button class="daily-response" data-choice="${i}" ${reason?'disabled':''}><span>${reason?'条件不足':c.odds!==undefined?'博弈':c.reward?.battle?'实战':'际遇'}</span><b>${HD.escape(c.label)}</b><small>${HD.escape(reason||risk)}</small><i aria-hidden="true">↗</i></button>`;
  }).join('')}</div></section>`);
  document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{closeModal();resolve(event.choices[Number(b.dataset.choice)]);});
  document.querySelector('[data-choice]:not([disabled])')?.focus({preventScroll:true});
 });
}
function settle(event,choice,success,summary){
 return new Promise(resolve=>{
  const flavor=success?(choice.successText||'事情朝着好的方向发展了。'):(choice.failText||'结果不算理想——但至少攒下了经验。');
  showModal(`<section class="daily-settlement"><p class="eyebrow">第 ${Game.day} 天 · 事件落幕</p><h2>${HD.escape(event.title)}</h2><p class="event-narrative">${HD.escape(flavor)}</p><div class="growth-results">${summary.map(s=>`<div><b>${HD.escape(s)}</b></div>`).join('')||'<p>这一天平静地过去了。</p>'}</div><button class="btn" id="eventReturn">继续旅程</button></section>`);
  $('eventReturn').onclick=()=>{closeModal();resolve();};
  $('eventReturn').focus({preventScroll:true});
 });
}

/* ===================== 主流程 ===================== */
async function run(next){
 const pool=candidates(next);
 if(!pool.length)return false;
 const event=pickOf(next,pool);
 const seen=Campaign.state.eventsSeen||(Campaign.state.eventsSeen=[]);
 if(!seen.includes(event.id))seen.push(event.id);
 const choice=await ask(event,next);
 Game.day=next;
 Game.addLog('lgold',`第 ${next} 天 · ${event.title} · ${choice.label}`);
 const summary=[];
 const {success}=await resolveChoice(choice,summary);
 Game.render();
 await settle(event,choice,success,summary);
 return true;
}

/* ===================== 存档字段：eventsSeen ===================== */
const fresh=Campaign.fresh;
Campaign.fresh=function(...a){const r=fresh.apply(this,a);r.eventsSeen=[];return r;};
const validate=Campaign.validate;
Campaign.validate=function(r,...a){
 const out=validate.call(this,r,...a);
 if(r.eventsSeen===undefined)r.eventsSeen=[];
 if(!Array.isArray(r.eventsSeen)||r.eventsSeen.length>200||r.eventsSeen.some(x=>typeof x!=='string'||x.length>40))throw Error('事件记录异常');
 return out;
};

/* ===================== 与 daily-events 共存：40% 择一 ===================== */
const priorDaily=Campaign.daily;
Campaign.daily=async function(){
 if(Game.day>=120||Save.phase==='ended')return priorDaily.call(this);
 const next=Game.day+1;
 if(STORY[next]||['wheel','tool','build'].includes(window.DailyUI?.direction)||!shouldFire(next))return priorDaily.call(this);
 const done=await run(next);
 if(!done)return priorDaily.call(this);
};

window.EventEngine={EVENTS,condOk,reqReason,candidates,shouldFire,pickOf,resolveChoice,applyOutcome,outcomeText,hash01};
})();
