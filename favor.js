/* Batch C2 好感度系统：10 名主线角色羁绊（0-100 四档），信赖以上解锁剧情战「请求支援」。
   数据存在 Game.player.favors（save.js validate 已兼容存量）。增强层：独立文件 + 猴子补丁接入。 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const CHARS=[
 {id:'gojo',  name:'五条悟',     li:11},
 {id:'yuji',  name:'虎杖悠仁',   li:7},
 {id:'megumi',name:'伏黑惠',     li:4},
 {id:'nobara',name:'钉崎野蔷薇', li:4},
 {id:'nanami',name:'七海建人',   li:6},
 {id:'todo',  name:'东堂葵',     li:7},
 {id:'hakari',name:'秤金次',     li:8},
 {id:'okt',   name:'乙骨忧太',   li:10},
  {id:'maki',  name:'禅院真希',   li:4,summon:'真希'},
  {id:'shoko', name:'家入硝子',   li:6,medical:true}
];
const TIERS=[[0,'陌生'],[30,'相识'],[60,'信赖'],[90,'生死之交']];
const tierOf=v=>{let t=TIERS[0][1];for(const [min,n] of TIERS)if(v>=min)t=n;return t;};
const byName=n=>CHARS.find(c=>c.name===n);
const canonical=n=>/^真希$|^禅院真希/.test(n)?'禅院真希':n;
const Favor={
 CHARS,TIERS,tierOf,byName,SUPPORT_MIN:60,
 map(){const p=Game.player;if(!p)return {};if(!p.favors||typeof p.favors!=='object'||Array.isArray(p.favors))p.favors={};return p.favors;},
 get(name){return this.map()[name]||0;},
 /** 增减好感（0-100 封顶）。返回 {value,tier,changed}；log=false 时静默（供事件引擎自行汇报） */
 add(name,pts,reason,log=true){
  const c=byName(name);if(!c||!Game.player)return null;
  const m=this.map(),before=m[name]||0,tierBefore=tierOf(before);
  const after=clamp(Math.round(before+pts),0,100);if(after===before)return {value:after,tier:tierBefore,changed:false};
  m[name]=after;
  const tierAfter=tierOf(after),changed=tierBefore!==tierAfter;
  if(log){
   Game.addLog(pts>0?'lp':'lred',`【羁绊】${name} ${pts>0?'+':''}${pts} → ${after}（${tierAfter}）${reason?'：'+reason:''}`);
   if(changed)Game.addLog(pts>0?'lgold':'lred',`【羁绊】你与 ${name} 的关系${pts>0?'晋升为':'跌落至'}「${tierAfter}」${after>=this.SUPPORT_MIN&&before<this.SUPPORT_MIN?'——剧情战中可以「请求支援」了！':''}`);
  }
  return {value:after,tier:tierAfter,changed};
 },
 /** 已相识（favor>0）的角色，供事件随机选取 */
  met(){return CHARS.filter(c=>this.get(c.name)>0&&this.available(c.name));},
  /** Only timeline-compatible support is available. Day/stage use the active chapter,
      so the three Shibuya fights cannot revive characters from earlier scenes. */
  available(name,day=Game.day,eng=null){
   const c=byName(canonical(name));if(!c)return false;
   const stage=eng?.cfg?.chapterStage??0,chapter=eng?.cfg?.chapterDay;
   if(name==='五条悟')return day>=5&&!Campaign.facts(day).gojoSealed&&!(day>=88&&day<118)&&!(chapter===120&&stage>0);
   if(name==='虎杖悠仁')return day>=5&&!(day>=34&&day<49);
   if(name==='伏黑惠')return day>=5&&day<118;
   if(name==='七海建人')return day>=25&&(day<90||(chapter===90&&stage<2));
   if(name==='钉崎野蔷薇')return day>=5&&(day<90||(chapter===90&&stage<2)||(day===120&&chapter===120&&stage>=5));
   if(c.id==='maki')return day>=5&&!(day>=90&&day<100&&!(chapter===90&&stage<2));
   if(name==='乙骨忧太'||name==='秤金次')return day>=100;
   if(name==='东堂葵')return day>=40&&(day<90||chapter===90||day>=118);
   return day>=5;
  },
  profile(c,day){
   if(c.id==='maki'&&day>=105)return {...c,li:8,summon:'禅院真希·天裕暴君'};
   if(c.id==='yuji')return {...c,li:day>=118?7:day>=49?6:day>=25?5:3};
   return c;
  },
 /** 信赖以上、可请求支援的角色 */
  supporters(eng=null){
   const day=eng?.cfg?.chapterDay??Game.day;
   return CHARS.filter(c=>this.get(c.name)>=this.SUPPORT_MIN&&this.available(c.name,day,eng)&&
    !eng?.units?.some(u=>canonical(u.name)===c.name)&&
    (c.medical||!eng||eng.alive('ally').length<5));
  },
 /** 支援条件：剧情战（chapterDay）、非反派路线、本场未叫过、至少一名信赖角色 */
  canSupport(eng){return !!(eng&&eng.cfg&&eng.cfg.chapterDay!=null&&!eng.cfg.villain&&!eng.supportUsed&&this.supporters(eng).length);},
 /** 随机一名信赖角色加入我方战场 */
 callSupport(eng,ev){
   const pool=this.supporters(eng);if(!pool.length)return null;
   const c=this.profile(pool[rand(0,pool.length-1)],eng.cfg.chapterDay);
   if(c.medical){
    eng.supportUsed=true;
    for(const target of eng.alive('ally')){
     const heal=Math.min(target.maxHp-target.hp,Math.round(target.maxHp*.20));target.hp+=heal;
     if(heal>0)ev.push({type:'heal',from:target.name,heal,text:`【家入硝子 · 医疗支援】${target.name} 恢复 ${heal} 生命。`});
    }
    ev.push({type:'skill',text:'【请求支援】家入硝子提供远程医疗支援。本作将医疗能力改编为全体恢复20%生命。'});
    return {name:c.name,medical:true};
   }
  const u=eng.makeNpcUnit(c.summon||c.name,c.li,'咒术师','ally');
   // Preserve the form name for character art/voice mapping; no future domain in early support.
   if(c.id==='megumi'&&eng.cfg.chapterDay<78)u.canDomain=false;
   u.atb=randF(20,50);u.supportEnter=true;
  eng.units.push(u);eng.supportUsed=true;
  ev.push({type:'skillcut',actorName:c.name,text:`${c.name} · 驰援到场`});
  ev.push({type:'skill',text:`【请求支援】${c.name} 响应了你的呼唤，加入我方战场！（羁绊 ${this.get(c.name)} · ${this.tierOf(this.get(c.name))}）`});
  return u;
 }
};
window.Favor=Favor;

// —— 战斗指令「请求支援」：消耗一次行动，不耗咒力 ——
const proto=BattleEngine.prototype,playerAct=proto.playerAct;
proto.playerAct=function(action,targetIdx){
 if(action!=='support')return playerAct.call(this,action,targetIdx);
 const ev=[];
 if(!Favor.canSupport(this)){
  ev.push({type:'info',text:'当前无法请求支援（需剧情战、且至少一名角色羁绊达到「信赖」）。'});
  this.awaitingPlayer=true;
  return {events:ev,ended:false,result:null,needInput:true,retryInput:true};
 }
 this.awaitingPlayer=false;
 Favor.callSupport(this,ev);
 this.afterAction(this.player,ev);
 return {events:ev,ended:this.ended,result:this.result,needInput:false};
};

// —— 按钮注入与状态刷新 ——
function injectButton(){
 const bar=$('bfActions');if(!bar||$('actSupport'))return;
 const b=document.createElement('button');
 b.className='btn small support-btn';b.id='actSupport';
 b.onclick=()=>{SFX.click();b.disabled=true;BattleUI.input('support');};
 bar.insertBefore(b,$('actFlee')||null);
 refreshButton();
}
function refreshButton(){
 const b=$('actSupport'),eng=BattleUI.eng;if(!b)return;
 if(!eng){b.disabled=true;return;}
 const sup=Favor.supporters(eng),n=sup.length;
 const ok=Favor.canSupport(eng)&&eng.awaitingPlayer&&!eng.ended&&!BattleUI.auto;
 b.disabled=!ok;
 b.innerHTML=`<span>请求支援</span><small>${eng.supportUsed?'已使用':eng.cfg.chapterDay==null?'仅剧情战':!n?'暂无可用支援':n+' 人可支援'}</small>`;
 b.title=n?'可驰援：'+sup.map(c=>`${c.name}（${Favor.get(c.name)} · ${Favor.tierOf(Favor.get(c.name))}）`).join('、'):'没有羁绊达到「信赖」的角色';
}
const runUi=BattleUI.run;BattleUI.run=function(cfg){const p=runUi.call(this,cfg);injectButton();introHint(cfg);return p;};
for(const k of ['render','waitInput']){const f=BattleUI[k];BattleUI[k]=function(...a){const r=f.apply(this,a);refreshButton();return r;};}

// —— E1 战前提示：剧情战开打时告知哪些羁绊角色可驰援 ——
function introHint(cfg){
 if(!cfg||cfg.chapterDay==null||cfg.villain)return;
 const eng=BattleUI.eng;if(!eng)return;
 const sup=Favor.supporters(eng);if(!sup.length)return;
 const names=sup.map(c=>c.name).join('、');
 setTimeout(()=>{if(BattleUI.eng===eng&&!eng.supportUsed)BattleUI.appendLog({type:'info',text:`【羁绊】${names} 信赖着你——本场战斗可点击「请求支援」获得其中一位的帮助（每场一次）。`});},0);
}
Favor._introHint=introHint; // QA 钩子（qa-batch-e）

// —— E1 支援入场演出：新加入的支援单位卡片带金色滑入 ——
if(BattleUI.unitHtml){
 const unitHtml=BattleUI.unitHtml;
 BattleUI.unitHtml=function(u,side){
  const html=unitHtml.call(this,u,side);
  if(!u.supportEnter)return html;
  u.supportEnter=false; // 一次性消费
  return html.replace('class="unit ','class="unit support-enter ');
 };
}

// —— 世界屏「羁绊」面板（角色卡下方，HD.refreshWorld 只重写 compactStats 内部，兄弟节点不受影响）——
function drawPanel(){
 const host=$('compactStats');if(!host)return;
 let box=$('favorPanel');
 if(!box){box=document.createElement('div');box.id='favorPanel';box.className='favor-panel';host.after(box);}
 if(!Game.player){box.innerHTML='';return;}
 const entries=CHARS.filter(c=>Favor.get(c.name)>0);
 box.innerHTML=entries.length?'<h3>羁绊</h3>'+entries.map(c=>{
  const v=Favor.get(c.name);
  const available=Favor.available(c.name);
  return `<div class="favor-row ${available?'':'favor-unavailable'}"><span>${HD.escape(c.name)}</span><div class="favor-bar"><i style="width:${v}%"></i></div><b>${v}</b><small>${!available?'暂不可联系':Favor.tierOf(v)+(v>=Favor.SUPPORT_MIN?' · 可支援':'')}</small></div>`;
 }).join(''):'';
}
const render=Game.render;Game.render=function(...a){const r=render.apply(this,a);drawPanel();return r;};
})();
