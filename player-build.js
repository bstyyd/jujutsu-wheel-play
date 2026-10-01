/* Optional run progression; no named character replaces the randomized player. */
(() => {
 'use strict';
 const talents=[
  {id:'pursuit',name:'召唤追击',family:'summon',note:'自己的召唤物实际命中留下追击窗口；你的下一次直接命中使目标行动值后退18。窗口保留至两次自身行动。'},
  {id:'shelter',name:'护卫接力',family:'summon',note:'护卫指令分担比例由35%提高到50%；仍只分担一次直接攻击，不能挡领域必中。'},
  {id:'relay',name:'影之调度',family:'shadows',note:'协攻推进自己的式神行动值60，而非40；每只式神仍需等到自己的行动。'},
  {id:'battery',name:'炮击回路',family:'puppet',note:'傀儡默认使用耗咒力炮击。实际炮击命中补回你2%咒力，每次自身行动之间最多4%。'},
  {id:'counter',name:'守势反击',family:'any',note:'防御期间承受实际直接伤害后，下一次体术命中推进自己行动值20；只能触发一次。'},
  {id:'flow',name:'收束回路',family:'any',note:'防御准备下一次施术：实际术式命中返还该次基础术式消耗的25%（向上取整），只返还一次。'},
  {id:'blade',name:'持械压制',family:'any',note:'装备咒具时，专属持械招式第一次实际命中令目标行动值后退15；仍需完成咒具课题。'},
  {id:'focus',name:'聚能压制',family:'ranged',note:'集中施术第一次实际命中令目标行动值后退20；不会凭空获得蓄力或黑闪。'}
 ].concat(window.TechniqueBuilds?.talents||[]);
 const vows={none:{name:'不立束缚',note:'保持正常消耗与防护。'},rush:{name:'舍守求攻',note:'你的直接攻击伤害+15%，承受的直接攻击伤害也+15%；不影响领域必中。'},reserve:{name:'节律回补',note:'你的基础术式消耗+20%；防御额外恢复4%最大咒力。'}};
 const domains={balanced:{name:'均衡',note:'保留当前领域规则。'},anchor:{name:'稳守结界',note:'自身领域维持时，承受直接攻击-15%，自身直接输出-10%。'},pressure:{name:'加压对攻',note:'维持时额外消耗2%最大咒力；每次自身行动对攻额外削减对方4稳定度。'},escort:{name:'协同争夺',note:'维持时额外消耗2%最大咒力；自己的召唤物实际命中对方施术者削减3稳定度，每次自身行动之间最多6。'}};
 const fresh=()=>({version:1,stage:0,lastDay:0,retrains:2,unlocked:[],equipped:[],vow:'none',domain:'balanced'});
 const state=()=>Campaign.state?.build||fresh();
 const family=p=>window.PlayerStyles.family({flag:p?.technique?.flag,flags:p?.technique?.flags||[]});
 const compatible=(t,p)=>!!t&&(t.family==='any'||t.family==='technique'&&window.TechniqueBuilds.compatible(t,p)||t.family==='summon'&&!!family(p)||t.family===family(p)||t.family==='ranged'&&window.PlayerArsenal.isRanged({flag:p?.technique?.flag}));
 function validate(b,day=120,p=null){
  if(b===undefined)return;
  if(b.rewardDays!==undefined&&(!Array.isArray(b.rewardDays)||b.rewardDays.length>120||new Set(b.rewardDays).size!==b.rewardDays.length||b.rewardDays.some(d=>!Number.isInteger(d)||d<1||d>day)))throw Error('战后构筑领取记录异常');
  if(!b||b.version!==1||!Number.isInteger(b.stage)||b.stage<0||b.stage>120||!Number.isInteger(b.lastDay)||b.lastDay<0||b.lastDay>day||b.stage>b.lastDay||!Number.isInteger(b.retrains)||b.retrains<0||b.retrains>8||!Array.isArray(b.unlocked)||b.unlocked.length>talents.length||new Set(b.unlocked).size!==b.unlocked.length||b.unlocked.some(id=>!talents.some(t=>t.id===id))||!Array.isArray(b.equipped)||b.equipped.length>2||new Set(b.equipped).size!==b.equipped.length||b.equipped.some(id=>!b.unlocked.includes(id)||p&&!compatible(talents.find(t=>t.id===id),p))||!Object.hasOwn(vows,b.vow)||!Object.hasOwn(domains,b.domain)||(b.stage<3&&(b.vow!=='none'||b.domain!=='balanced'))||(p&&b.domain==='escort'&&!family(p)))throw Error('构筑数据或专精条件异常');
 }
 const copy=b=>JSON.parse(JSON.stringify(b));
 const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
 function offers(b=state(),p=Game.player,day=Game.day+1){
  if(b.stage===2)return Object.entries(domains).filter(([id])=>id!=='balanced'&&(id!=='escort'||family(p))).map(([id,d])=>({label:d.name,desc:d.note,buildLesson:{stage:b.stage,kind:'domain',id}})).concat([{label:'保持均衡，增加一次重训',desc:'不改变领域规则，重训次数+1。',buildLesson:{stage:b.stage,kind:'domain',id:'balanced'}}]).slice(0,3);
  const pool=talents.filter(t=>compatible(t,p)&&!b.unlocked.includes(t.id));
  const relevant=pool.filter(t=>!['any'].includes(t.family)),general=pool.filter(t=>t.family==='any');
  const rotate=a=>a.length?a.slice(hash(`${Campaign.state?.eventSeed||0}:${day}:${b.stage}`)%a.length).concat(a.slice(0,hash(`${Campaign.state?.eventSeed||0}:${day}:${b.stage}`)%a.length)):[];
  const ordered=[...rotate(relevant).slice(0,1),...rotate(general).slice(0,1),...rotate(relevant).slice(1),...rotate(general).slice(1)];
  const choices=ordered.slice(0,b.retrains===0?2:3).map(t=>({label:'掌握 · '+t.name,desc:t.note+' 未满两槽时自动装备；槽满后进入已掌握列表。',buildLesson:{stage:b.stage,kind:'talent',id:t.id}}));
  if(choices.length<3)choices.push({label:'复盘与重训',desc:'完成一次咒力操控修炼，重训次数+1，最多8次。',stat:'ctl',buildLesson:{stage:b.stage,kind:'retrain',id:'retrain'}});
  for(const [stat,label] of [['melee','稳固体术节奏'],['eff','稳固术式输出']])if(choices.length<3)choices.push({label,desc:'进行一次基础修炼，保留现有专精搭配。',stat,buildLesson:{stage:b.stage,kind:'train',id:stat}});
  return choices;
 }
 function event(){const b=state(),p=Game.player;return {label:p.technique.name+' · '+(b.stage<3?['找到出手节奏','补足另一种应对','确定领域与束缚方向'][b.stage]:'构筑进修'),scene:(window.TechniqueBuilds?.lesson(p)||'围绕你自己的术式复盘实战。')+' 选择改变配合，不替换你的随机人物。'+(b.stage===2?'此课只确定领域方向；仍需按原规则领悟领域后才能展开。':''),image:'assets/events/b-v1/tool-training.png',choices:offers()};}
 function apply(c,day){
  const b=state(),x=c?.buildLesson;
  if(!x||day!==Game.day||day<=b.lastDay||day>120||x.stage!==b.stage||!offers(b,Game.player,day).some(o=>o.buildLesson.kind===x.kind&&o.buildLesson.id===x.id))throw Error('此课题已经结算或不适合当前人物。');
  const next=copy(b);
  if(x.kind==='talent'){next.unlocked.push(x.id);if(next.equipped.length<2)next.equipped.push(x.id);}
  else if(x.kind==='domain')next.domain=x.id;
  if(x.kind==='retrain'||x.kind==='domain'&&x.id==='balanced')next.retrains=Math.min(8,next.retrains+1);
  next.stage++;next.lastDay=day;validate(next,day,Game.player);Campaign.state.build=next;
  return x.kind==='talent'?'专精掌握 · '+talents.find(t=>t.id===x.id).name:x.kind==='domain'?'领域方向 · '+domains[x.id].name:x.kind==='retrain'?'重训机会 +1':'保留构筑，完成基础修炼。';
 }
 function equip(ids,vow,domain){
  if(window.Equipment.blocked())throw Error('请在每日行动结束后调整构筑。');
  const old=Campaign.state.build,next=copy(state());next.equipped=ids.slice();next.vow=vow;next.domain=domain;validate(next,Game.day,Game.player);
  const changed=JSON.stringify([...next.equipped].sort())!==JSON.stringify([...state().equipped].sort())||vow!==state().vow||domain!==state().domain;
  if(!changed)return;
  if(next.retrains<=0)throw Error('重训次数不足；安排构筑课题可补充。');next.retrains--;
  Campaign.state.build=next;if(!Save.checkpoint()){if(old===undefined)delete Campaign.state.build;else Campaign.state.build=old;throw Error('保存失败，构筑未改变。');}Game.render();
 }
 function rewardOffers(day=Game.day,p=Game.player){return offers({...state(),stage:state().stage+120},p,day);}
 function claimReward(choice,day=Game.day){
  const b=state(),x=choice?.buildLesson;
  if(day!==Game.day||!Number.isInteger(day)||day<1||day>120||(b.rewardDays||[]).includes(day)||!x||!rewardOffers(day).some(c=>c.buildLesson.kind===x.kind&&c.buildLesson.id===x.id))throw Error('本日战后奖励已领取或选项不适用。');
  const next=copy(b);next.rewardDays=[...(b.rewardDays||[]),day];
  if(x.kind==='talent'){next.unlocked.push(x.id);if(next.equipped.length<2)next.equipped.push(x.id);}
  else if(x.kind==='retrain')next.retrains=Math.min(8,next.retrains+1);
  validate(next,day,Game.player);Campaign.state.build=next;
  return x.kind==='talent'?'战后掌握 · '+talents.find(t=>t.id===x.id).name:x.kind==='retrain'?'战后复盘 · 重训机会 +1':'战后基础训练';
 }
 const presets={
  hunter:{name:'十影 · 追击调度',flag:'shadows',ids:['pursuit','relay'],vow:'rush',domain:'escort'},
  keeper:{name:'十影 · 护卫反击',flag:'shadows',ids:['shelter','counter'],vow:'none',domain:'anchor'},
  artillery:{name:'傀儡 · 炮击连携',flag:'puppet',ids:['battery','pursuit'],vow:'reserve',domain:'escort'},
  fortress:{name:'傀儡 · 护卫反击',flag:'puppet',ids:['shelter','counter'],vow:'none',domain:'anchor'},
  counter:{name:'通用 · 守势施术',ids:['counter','flow'],vow:'reserve',domain:'anchor'},
  ratio:{name:'十划 · 弱点连击',flag:'ratio',ids:['weakFollow','cadence'],vow:'none',domain:'balanced'},
  resonance:{name:'刍灵 · 共鸣衔接',flag:'straw',ids:['weakFollow','alternation'],vow:'none',domain:'pressure'},
  control:{name:'咒言 · 控后追打',flag:'cursedSpeech',ids:['controlFollow','controlFlow'],vow:'reserve',domain:'balanced'},
  toxin:{name:'淀月 · 毒蚀攻守',flag:'moon',ids:['toxicBurst','toxicCover'],vow:'none',domain:'anchor'},
  blood:{name:'赤血 · 血偿爆发',flag:'blood',ids:['bloodRecovery','bloodEdge'],vow:'none',domain:'balanced'},
  cannon:{name:'大炮 · 聚能破界',flag:'cannon',ids:['castChain','castBreak'],vow:'reserve',domain:'pressure'},
  barrier:{name:'无下限 · 守势反攻',flag:'limitless',ids:['guardCast','guardRiposte'],vow:'none',domain:'anchor'},
  renewal:{name:'生长 · 复原追击',flag:'grow',ids:['healFollow','healReserve'],vow:'none',domain:'anchor'},
  judge:{name:'判决 · 识别应变',flag:'judge',ids:['typeFollow','adaptCast'],vow:'none',domain:'balanced'},
  hybrid:{name:'无为 · 交替衔接',flag:'idleTrans',ids:['alternation','cadence'],vow:'none',domain:'balanced'},
  construction:{name:'构筑 · 造物适配',flag:'construct',ids:['constructKit','castChain'],vow:'reserve',domain:'balanced'},
  copy:{name:'复制 · 借式研习',flag:'copy',ids:['copyStudy','alternation'],vow:'none',domain:'balanced'},
  speed:{name:'付丧 · 抢势节奏',flag:'tsukumo',ids:['tempo','cadence'],vow:'none',domain:'balanced'}
 };
 function sample(id,p){const s=presets[id];if(!s||s.flag&&s.flag!==p.technique.flag)return fresh();return {...fresh(),stage:3,lastDay:3,unlocked:s.ids.slice(),equipped:s.ids.slice(),vow:s.vow,domain:s.domain};}
 function summary(b){return (b.equipped.map(id=>talents.find(t=>t.id===id)?.name).join(' ＋ ')||'尚未装备专精')+' / '+vows[b.vow].name+' / '+domains[b.domain].name;}
 const oldFresh=Campaign.fresh;Campaign.fresh=function(...a){return {...oldFresh.apply(this,a),build:fresh()};};
 const oldCheck=Campaign.validate;Campaign.validate=function(r,day,...a){const result=oldCheck.call(this,r,day,...a);validate(r.build,Number.isInteger(day)?day:120);return result;};
 if(Save.validate){const check=Save.validate;Save.validate=function(s){const r=check.call(this,s);if(s.phase!=='create')validate(s.run?.build,s.day,s.player);return r;};}
 const run=BattleUI.run;BattleUI.run=function(cfg){return run.call(this,{...cfg,playerBuild:copy(state())});};
 window.PlayerBuild={talents,vows,domains,fresh,state,family,compatible,validate,offers,event,apply,equip,rewardOffers,claimReward,presets,sample,summary};
})();
