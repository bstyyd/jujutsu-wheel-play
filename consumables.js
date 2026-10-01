/* Batch C3 轻量消耗品：战斗中「道具」指令，每场限用 2 次。
   库存归属 Campaign.state.inventory，随独立存档与日初检查点保存。 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const ITEMS={
 healCharm:  {name:'急疗符',   icon:'✚',desc:'恢复 40% 最大生命。',use(eng,p,ev){const h=Math.round(p.maxHp*0.4);p.hp=Math.min(p.maxHp,p.hp+h);ev.push({type:'heal',text:`【急疗符】符纸燃成温热的灰，生命 +${h}。`,heal:h});}},
 cpElixir:   {name:'咒力补给', icon:'◈',desc:'恢复 50% 最大咒力。',use(eng,p,ev){const c=Math.round(p.maxCp*0.5);p.cp=Math.min(p.maxCp,p.cp+c);ev.push({type:'heal',text:`【咒力补给】冰凉的液体滑进喉咙，咒力 +${c}。`,heal:c});}},
 atkCharm:   {name:'攻击增幅符',icon:'▲',desc:'本场战斗伤害 +25%。',use(eng,p,ev){p.buff.atkCharm=true;ev.push({type:'skill',text:'【攻击增幅符】咒纹爬上手臂——本场伤害 +25%。'});}},
 defCharm:   {name:'防御符',   icon:'■',desc:'接下来 3 次受击伤害减半。',use(eng,p,ev){p.buff.defCharm=(p.buff.defCharm||0)+3;ev.push({type:'skill',text:'【防御符】三道半透明屏障依次展开——接下来 3 次受击伤害减半。'});}},
 purifyCharm:{name:'净化符',   icon:'✦',desc:'清除毒素、蛊毒、眩晕与封印。',use(eng,p,ev){p.buff.poison=0;p.buff.gu=0;p.buff.stun=0;p.buff.seal=0;ev.push({type:'skill',text:'【净化符】异种咒力被洗涤一空（毒素/蛊毒/眩晕/封印已清除）。'});}},
 smokeBomb:  {name:'烟幕弹',   icon:'☁',desc:'敌方全体行动值 -40。',use(eng,p,ev){eng.alive('enemy').forEach(u=>{u.atb=Math.max(0,u.atb-40);});ev.push({type:'skill',text:'【烟幕弹】浓烟封锁视野——敌方全体行动值 -40。'});}}
};
const PER_BATTLE=2;
const Consumables={
 ITEMS,PER_BATTLE,
  get bag(){const r=Campaign.state;return r?(r.inventory||(r.inventory={})):{};},
  set bag(value){if(Campaign.state)Campaign.state.inventory={...value};},
  grant(id,n=1,log=true){if(!Campaign.state||!ITEMS[id]||!Number.isInteger(n)||n<=0)return 0;this.bag[id]=Math.min(999,(this.bag[id]||0)+n);if(log&&window.Game?.addLog)Game.addLog('lp',`【道具】获得 ${ITEMS[id].name} ×${n}。`);return this.bag[id];},
 count(id){return this.bag[id]||0;},
 owned(){return Object.keys(this.bag).filter(id=>this.bag[id]>0);},
 used(eng){return eng?.itemUsed||0;},
 canUse(eng,id){return !!(eng&&!eng.ended&&ITEMS[id]&&this.count(id)>0&&this.used(eng)<PER_BATTLE);},
 use(eng,id,ev){
  if(!this.canUse(eng,id))return false;
  this.bag[id]--;eng.itemUsed=this.used(eng)+1;
  ITEMS[id].use(eng,eng.player,ev);
  return true;
 }
};
window.Consumables=Consumables;

// —— 新周目 starter：2 急疗符 + 1 咒力补给 ——
const fresh=Campaign.fresh;
Campaign.fresh=function(...a){const r=fresh.apply(this,a);r.inventory=r.mode==='legacy'?{}:{healCharm:2,cpElixir:1};return r;};
const validate=Campaign.validate;
Campaign.validate=function(r,...a){
 const result=validate.call(this,r,...a);
 // Older saves had no persistent bag. Migrating them never grants new items.
 if(r.inventory===undefined)r.inventory={};
 const b=r.inventory;
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length>Object.keys(ITEMS).length||
    !Object.entries(b).every(([id,n])=>Object.hasOwn(ITEMS,id)&&Number.isInteger(n)&&n>=0&&n<=999))throw Error('道具库存数据异常');
 return result;
};

// —— 战斗指令「item:<id>」：消耗一次行动 ——
const proto=BattleEngine.prototype,playerAct=proto.playerAct;
proto.playerAct=function(action,targetIdx){
 if(typeof action!=='string'||!action.startsWith('item:'))return playerAct.call(this,action,targetIdx);
 const id=action.slice(5),ev=[];
 if(!Consumables.canUse(this,id)){
  ev.push({type:'info',text:Consumables.used(this)>=PER_BATTLE?`道具每场战斗限用 ${PER_BATTLE} 次，本场已用完。`:'这件道具已经用完了。'});
  this.awaitingPlayer=true;
  return {events:ev,ended:false,result:null,needInput:true,retryInput:true};
 }
 this.awaitingPlayer=false;
 Consumables.use(this,id,ev);
 this.afterAction(this.player,ev);
 return {events:ev,ended:this.ended,result:this.result,needInput:false};
};

// —— 增幅符/防御符结算（wrapper 链最外层，mult 透传，不动引擎）——
const deal=proto.dealDamage;
proto.dealDamage=function(att,tar,base,mult,kind,ev,...rest){
 if(att.buff&&att.buff.atkCharm)mult*=1.25;
 if(tar.buff&&tar.buff.defCharm>0){tar.buff.defCharm--;mult*=0.5;if(ev)ev.push({type:'skill',text:`【防御符】屏障挡下冲击（剩余 ${tar.buff.defCharm} 层）。`});}
 return deal.call(this,att,tar,base,mult,kind,ev,...rest);
};

// —— 「道具」按钮 + 道具行 ——
function injectUI(){
 const bar=$('bfActions');if(!bar)return;
 if(!$('actItem')){
  const b=document.createElement('button');
  b.className='btn small ghost item-btn';b.id='actItem';
  b.onclick=()=>{SFX.click();const row=$('itemRow');if(row)row.classList.toggle('open');refreshUI();};
  bar.insertBefore(b,$('actFlee')||null);
 }
 if(!$('itemRow')){
  const row=document.createElement('div');row.id='itemRow';row.className='item-row';
  bar.after(row);
 }
}
function refreshUI(){
 const eng=BattleUI.eng,b=$('actItem'),row=$('itemRow');
 if(!b||!row)return;
 if(!eng){b.disabled=true;row.innerHTML='';return;}
 const left=PER_BATTLE-Consumables.used(eng),n=Consumables.owned().length;
 b.disabled=!eng.awaitingPlayer||eng.ended||left<=0||!n||BattleUI.auto;
 b.innerHTML=`<span>道 具</span><small>${left<=0?'本场已用完':n?`剩 ${left} 次 · ${n} 种`:'背包空空'}</small>`;
 if(!row.classList.contains('open')){row.innerHTML='';return;}
 row.innerHTML=Consumables.owned().map(id=>{
  const it=ITEMS[id],ok=Consumables.canUse(eng,id)&&eng.awaitingPlayer&&!eng.ended;
  return `<button class="item-chip" data-item="${id}" ${ok?'':'disabled'}><i>${it.icon}</i><b>${it.name} ×${Consumables.count(id)}</b><small>${it.desc}</small></button>`;
 }).join('')||'<p class="item-empty">背包空空——日常事件中可以获取道具。</p>';
 row.querySelectorAll('[data-item]').forEach(chip=>chip.onclick=()=>{
  SFX.click();row.classList.remove('open');row.innerHTML='';
  BattleUI.input('item:'+chip.dataset.item);
 });
}
const runUi=BattleUI.run;BattleUI.run=function(cfg){const p=runUi.call(this,cfg);injectUI();refreshUI();return p;};
for(const k of ['render','waitInput']){const f=BattleUI[k];BattleUI[k]=function(...a){const r=f.apply(this,a);refreshUI();return r;};BattleUI[k]._consumablesWrapped=true;}
})();
