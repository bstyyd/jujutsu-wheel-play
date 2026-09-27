/* Deterministic rehearsal rules, isolated from campaign saves. */
(() => {
 class SampleBattle {
  constructor(){this.units=[{name:'虎杖悠仁',hp:120,max:120,cp:0,maxCp:0},{name:'钉崎野蔷薇',hp:100,max:100,cp:40,maxCp:40},{name:'二级咒灵',hp:240,max:240,cp:0,maxCp:0}];this.turn=0;this.round=1;this.pending=null;this.done='';this.serial=0;this.guard=new Set();}
  enemyTarget(){return this.units[this.round%2?0:1].hp>0?(this.round%2?0:1):this.units[0].hp>0?0:1;}
  begin(command){if(this.pending||this.done)return null;const from=this.turn,u=this.units[from];if(u.hp<=0)return null;if(from===1&&command==='attack'&&u.cp<10)return null;
   if(command==='guard'){if(from===2)return null;this.guard.add(from);this.pending={id:++this.serial,from,to:from,kind:'guard',amount:0,impact:true};return this.pending;}
   if(command!=='attack')return null;const to=from===2?this.enemyTarget():2;if(from===1)u.cp-=10;
   return this.pending={id:++this.serial,from,to,kind:from===1?'nail':'melee',amount:from===2?34:from===0?42:34,impact:false};
  }
  impact(id){const p=this.pending;if(!p||p.id!==id||p.impact||p.kind==='guard')return null;p.impact=true;const target=this.units[p.to],amount=Math.min(target.hp,Math.round(p.amount*(this.guard.has(p.to)?.45:1)));target.hp-=amount;return {index:p.to,amount,guarded:this.guard.has(p.to)};}
  finish(id){const p=this.pending;if(!p||p.id!==id||!p.impact)return false;this.pending=null;if(this.units[2].hp<=0){this.done='victory';return true;}if(this.units[0].hp<=0&&this.units[1].hp<=0){this.done='defeat';return true;}
   if(p.from===2){this.round++;this.turn=this.units[0].hp>0?0:1;this.guard.clear();this.units[1].cp=Math.min(40,this.units[1].cp+10);}else this.turn=p.from===0&&this.units[1].hp>0?1:2;return true;
  }
 }
 window.SampleBattle=SampleBattle;
})();
