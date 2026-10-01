/* Optional, versioned equipment lessons. Old saves begin with no certified moves. */
(() => {
 'use strict';
 const E=window.Equipment, families={practice:'blade',naginata:'pole',cloud:'chain',spear:'blade',soul:'blade'};
 const moves={blade:{label:'错步连斩',note:'消耗2格刃势 · 两次体术各×0.80，保留咒具特性'},pole:{label:'穿突压制',note:'消耗2格刃势 · 体术×1.50；目标下次行动的首次直接攻击降低20%'},chain:{label:'回旋收势',note:'消耗2格刃势 · 体术×1.50；收势进入防御，不恢复咒力'}};
 const lesson=(id,e=E.state())=>e?.training?.lessons?.[id]||{stage:0,focus:null,day:0};
 const certified=(id,e=E.state())=>lesson(id,e).stage===3;
 function validate(e,day=120){
  if(e?.training===undefined)return;
  const t=e.training;
  if(!t||t.version!==1||!t.lessons||typeof t.lessons!=='object'||Array.isArray(t.lessons)||Object.keys(t.lessons).length>5)throw Error('咒具课题数据异常');
  for(const [id,l] of Object.entries(t.lessons)){
   if(!families[id]||!e.owned.includes(id)||!l||!Number.isInteger(l.stage)||l.stage<1||l.stage>3||!Number.isInteger(l.day)||l.day<0||l.day>day||l.day>120||(l.stage===1?l.focus!==null:!['edge','flow'].includes(l.focus)))throw Error('咒具课题进度异常');
  }
 }
 function eligible(e=E.state()){
  if(!e)return null;
  const ids=[e.equipped,...e.owned].filter((id,i,a)=>families[id]&&a.indexOf(id)===i);
  return ids.find(id=>!certified(id,e))||null;
 }
 function event(id=eligible()){
  if(!id)return null;
  const tool=E.find(id),l=lesson(id),move=moves[families[id]],prefix='咒具课题 · '+tool.name;
  const change=(label,focus,desc,stat)=>({label,desc,stat,toolLesson:{id,stage:l.stage,focus}});
  const delay={label:'留待下次，稳定修炼',stat:'ctl'};
  const scenes=[
   '从自己的咒具收藏中取出这件武器，检查握柄、重心和残留的咒力。先建立正确的握持，再追求威力。',
   '将同一套动作重复到稳定。可以专注步伐与刃口，也可以练习咒力沿武器流动；两种训练都会进入最后的动作演练。',
   '从起手、命中到回收，完成一套不失去重心的动作。通过这次演练后，只有携带这件咒具时才能使用它的专属持械指令。'
  ];
  const choices=l.stage===0?[change('取出并装备咒具',null,'建立持械训练档案，装备此咒具；替换当前主武器。'),delay]:l.stage===1?[change('步伐与刃口训练','edge','进行一次体术修炼；进入动作演练。','melee'),change('咒力贯通训练','flow','进行一次咒力操控修炼；进入动作演练。','ctl')]:[change('完成 '+move.label+' 演练',l.focus,'永久解锁本件咒具的「'+move.label+'」；不叠加永久伤害。'),delay];
  return {label:prefix+' · '+['取用登记','适应训练','动作演练'][l.stage],scene:scenes[l.stage],image:'assets/events/b-v1/tool-training.png',choices};
 }
 function apply(c,day){
  if(!c?.toolLesson)return '';
  const {id,stage,focus}=c.toolLesson,e=E.state(),l=lesson(id,e);
  if(!families[id]||!e?.owned.includes(id)||l.stage!==stage||stage>=3||!Number.isInteger(day)||day<=l.day||day>120||(stage===0?focus!==null:!['edge','flow'].includes(focus)))throw Error('此课题已完成或不属于当前收藏。');
  e.training ||= {version:1,lessons:{}};
  e.training.lessons[id]={stage:stage+1,focus,day};
  if(stage===0)e.equipped=id;
  return stage===2?'动作解锁 · '+E.find(id).name+' / '+moves[families[id]].label:'咒具课题推进 · '+(stage+1)+'/3';
 }
 const old=E.validate;E.validate=function(e){old.call(this,e);validate(e);};
 const check=Campaign.validate;Campaign.validate=function(r,day,...rest){const out=check.call(this,r,day,...rest);validate(r.equipment,Number.isInteger(day)?day:120);return out;};
 const run=BattleUI.run;BattleUI.run=function(cfg){const training=E.state()?.training;return run.call(this,{...cfg,weaponTraining:training?JSON.parse(JSON.stringify(training)):null});};
 window.CursedToolTraining={families,moves,lesson,certified,eligible,event,apply,validate};
})();
