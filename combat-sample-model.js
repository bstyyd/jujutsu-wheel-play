/* Canon-inspired sample rules. No campaign state, storage or random outcomes. */
(() => {
 'use strict';
 class SampleBattle {
  constructor(){
   this.units=[{key:'yuji',name:'虎杖悠仁',hp:320,max:320,cp:0,maxCp:0,focus:0},
    {key:'nobara',name:'钉崎野蔷薇',hp:270,max:270,cp:40,maxCp:40},
    {key:'eso',name:'坏相',hp:280,max:280,cp:0,maxCp:0},
    {key:'kechizu',name:'血涂',hp:220,max:220,cp:0,maxCp:0}];
   this.turn=0;this.round=1;this.serial=0;this.pending=null;this.done='';
   this.guard=new Set();this.disrupted=new Set();this.corrosion=[new Map(),new Map()];this.lastTicks=[];
  }
  get linked(){return this.corrosion.some(s=>[...s.keys()].some(i=>this.units[i].hp>0));}
  living(side){return this.units.map((u,i)=>i).filter(i=>(side==='ally'?i<2:i>=2)&&this.units[i].hp>0);}
  enemyTarget(from=this.turn){const living=this.living('ally'),wanted=(this.round+from)%2;return living.includes(wanted)?wanted:living[0];}
  intent(from){
   const blood=this.round%2===1&&!this.disrupted.has(from);
   return {from,to:this.enemyTarget(from),kind:blood?(from===2?'wave':'poison'):'melee',variant:blood?'blood':'',
    label:blood?(from===2?'翅王 · 血羽':'蚀烂 · 吐血'):(from===2?'掌击':'爪击'),amount:this.disrupted.has(from)?14:from===2?30:24,blood};
  }
  skillReason(){if(this.turn===0)return this.units[0].focus<2?'先用直拳积累两层专注':'';
   if(this.turn===1)return !this.linked?'沾血后可借联系发动共鸣':this.units[1].cp<14?'咒力不足':'';return '等待己方行动';}
  begin(command,target){
   if(this.pending||this.done||this.units[this.turn].hp<=0)return null;
   const from=this.turn,u=this.units[from];let move;
   if(from>=2){if(command!=='attack')return null;move=this.intent(from);this.disrupted.delete(from);}
   else {
    if(command==='guard'){this.guard.add(from);if(from===1)u.cp=Math.min(u.maxCp,u.cp+12);return this.pending={id:++this.serial,from,to:from,kind:'guard',label:'防御',amount:0,impact:true};}
    if(!['attack','skill'].includes(command)||!this.living('enemy').includes(target))return null;
    if(command==='skill'&&this.skillReason())return null;
    if(from===0){move={to:target,kind:command==='skill'?'heavy':'melee',variant:command==='skill'?'blackflash':'',amount:command==='skill'?96:48,label:command==='skill'?'黑闪':'体术 · 直拳'};if(command==='skill')u.focus-=2;}
    else {const cost=command==='skill'?14:6;if(u.cp<cost)return null;u.cp-=cost;move={to:target,kind:'nail',variant:command==='skill'?'resonance':'straw',amount:command==='skill'?72:40,label:command==='skill'?'刍灵咒法 · 共鸣':'锤钉'};}
   }
   return this.pending={id:++this.serial,from,...move,impact:false};
  }
  impact(id){
   const p=this.pending;if(!p||p.id!==id||p.impact)return null;p.impact=true;const hits=[];
   const hit=(index,value)=>{const u=this.units[index],guarded=this.guard.has(index);const amount=Math.min(u.hp,Math.round(value*(guarded?.4:1)));u.hp-=amount;hits.push({index,amount,guarded});};
   hit(p.to,p.amount);
   if(p.from===0&&p.kind==='melee')this.units[0].focus=Math.min(3,this.units[0].focus+1);
   if(p.blood&&!this.guard.has(p.to)&&this.units[p.to].hp>0)this.corrosion[p.to].set(p.from,2);
   if(p.variant==='resonance'){
    for(const index of this.living('enemy')){if(index!==p.to)hit(index,32);this.disrupted.add(index);}
    // Game adaptation: one disrupted action and cancellation of current corrosion.
    this.corrosion.forEach(s=>s.clear());
   }
   this.cleanLinks();return hits;
  }
  cleanLinks(){for(const s of this.corrosion)for(const source of s.keys())if(this.units[source].hp<=0)s.delete(source);}
  checkEnd(){if(!this.living('enemy').length)this.done='victory';else if(!this.living('ally').length)this.done='defeat';return !!this.done;}
  tickRound(){
   this.lastTicks=[];this.cleanLinks();
   this.corrosion.forEach((links,index)=>{if(!links.size||this.units[index].hp<=0)return;
    const u=this.units[index],amount=Math.min(u.hp,index===0?4:10);u.hp-=amount;this.lastTicks.push({index,amount,status:'蚀烂'});
    for(const [source,rounds] of links)if(rounds<=1)links.delete(source);else links.set(source,rounds-1);
   });
   this.units[1].cp=Math.min(40,this.units[1].cp+6);this.checkEnd();
  }
  finish(id){
   const p=this.pending;if(!p||p.id!==id||!p.impact)return false;this.pending=null;this.lastTicks=[];
   if(this.checkEnd())return true;
   for(let step=1;step<=4;step++){
    const next=(p.from+step)%4;
    if(next===0){this.round++;this.tickRound();if(this.done)return true;}
    if(this.units[next].hp>0){this.turn=next;this.guard.delete(next);return true;}
   }
   return true;
  }
 }
 window.SampleBattle=SampleBattle;
})();
