/* Single-slot cursed tools. Bonuses belong to a battle snapshot, never permanent stats. */
(() => {
 'use strict';
 const catalog=Object.freeze([
  {id:'practice',name:'制式咒刀',tag:'基础咒具',role:'稳定近战',index:0,wins:0,bonus:.10,desc:'注入咒力的制式刀具，作为这段旅程的第一件武器。',effect:'体术伤害 +10%。',source:'本作基础装备'},
  {id:'naginata',name:'薙刀',tag:'长柄咒具',role:'近战进阶',index:1,wins:2,bonus:.20,desc:'红色长柄、宽刃与白色系穗，参考真希使用的长柄咒具。',effect:'体术伤害 +20%。',source:'参考原作咒具造型'},
  {id:'cloud',name:'游云',tag:'特级咒具',role:'纯粹力量',index:2,wins:5,bonus:.35,desc:'以短链连接的三节棍。没有附加术式，以使用者的力量发挥威力。',effect:'体术伤害 +35%；不增加术式或领域伤害。',source:'原作咒具'},
  {id:'spear',name:'天逆鉾',tag:'特级咒具',role:'突破防护',index:3,wins:8,bonus:.10,desc:'具有强制解除术式性质的特殊短刃，适合应对术式防护。',effect:'体术伤害 +10%；近战可突破无下限与天空术式防护。仍受防御、闪避和适应影响，不解除领域。',source:'原作咒具 · 能力按本作规则改编'},
  {id:'soul',name:'释魂刀',tag:'特级咒具',role:'破防利刃',index:4,wins:12,bonus:.20,desc:'白色绒毛刀柄与宽阔刀身。原作中，发挥其力量需要感知灵魂。',effect:'体术伤害 +20%；熟练度达到 100% 时，近战无视「防御」的减伤。不能突破无下限或适应。',source:'原作咒具 · 以熟练度模拟领悟'}
 ].map(Object.freeze));
 const find=id=>catalog.find(t=>t.id===id);
 const Equipment={catalog,find,
  fresh:()=>({version:1,owned:['practice'],equipped:null}),
  validate(e){
   if(e===undefined)return;
   if(!e||e.version!==1||!Array.isArray(e.owned)||e.owned.length>catalog.length||!e.owned.includes('practice')||new Set(e.owned).size!==e.owned.length||e.owned.some(id=>!find(id))||(e.equipped!==null&&!e.owned.includes(e.equipped)))throw Error('咒具数据异常');
  },
  state(){const r=Campaign.state;if(!r)return null;return r.equipment||(r.equipment=this.fresh());},
  victories(){return (Game.player?.huntCount||0)+(Campaign.state?.missions||[]).filter(m=>m.result==='win').length;},
  sync(){
   if(!Game.player)return [];
   const e=this.state();if(!e)return [];
   const unlocked=catalog.filter(t=>t.wins<=this.victories()&&!e.owned.includes(t.id));
   for(const t of unlocked)e.owned.push(t.id);
   return unlocked;
  },
  owned(){return this.state()?.owned.slice()||[];},
  current(){return find(this.state()?.equipped)||null;},
  blocked(){return !Game.player||Save.phase!=='world'||Save.busy||Save.failed||Save.restoring;},
  equip(id){
   if(this.blocked())throw Error('请在每日行动结束后更换咒具。');
   const e=this.state();if(!e||(id!==null&&!e.owned.includes(id)))throw Error('尚未获得这件咒具。');
   if(e.equipped===id)return;
   const previous=e.equipped;e.equipped=id;
   if(!Save.checkpoint()){e.equipped=previous;throw Error('未能保存装备，请先导出存档或检查浏览器存储。');}
   Game.render();
  },
  combatDescription(unit){const t=find(unit?.equipmentId);return t?t.name+'：'+t.effect:'';},
  rewardHTML(before=[]){const items=catalog.filter(t=>this.owned().includes(t.id)&&!before.includes(t.id));return items.length?`<div class="equipment-reward"><span>咒具库 · 新增藏品</span>${items.map(t=>`<b>${t.name}</b>`).join('')}<small>返回日程后，在角色下方的咒具库装备。</small></div>`:'';}
 };
 const fresh=Campaign.fresh;Campaign.fresh=function(...a){return {...fresh.apply(this,a),equipment:Equipment.fresh()};};
 const validate=Campaign.validate;Campaign.validate=function(r,...a){const out=validate.call(this,r,...a);Equipment.validate(r.equipment);return out;};
 const render=Game.render;Game.render=function(...a){Equipment.sync();return render.apply(this,a);};
 const run=BattleUI.run;BattleUI.run=function(cfg){Equipment.sync();return run.call(this,{...cfg,equipment:Equipment.current()?.id||null});};
 const make=BattleEngine.prototype.makePlayerUnit;
 BattleEngine.prototype.makePlayerUnit=function(p){const u=make.call(this,p);u.equipmentId=find(this.cfg.equipment)?.id||null;u.equipmentMastered=p.prof>=100;return u;};
 const damage=BattleEngine.prototype.dealDamage;
 BattleEngine.prototype.dealDamage=function(att,tar,base,mult,kind,ev,label,flash,ignoreImmune){
  const tool=att.isPlayer&&kind==='melee'&&!window.BattleTraits?.toolSealed(this,att)?find(att.equipmentId):null;
  if(!tool)return damage.call(this,att,tar,base,mult,kind,ev,label,flash,ignoreImmune);
  const nullify=att.toolNullify,pierce=att.toolPierceGuard,start=ev.length;
  att.toolNullify=tool.id==='spear';att.toolPierceGuard=tool.id==='soul'&&att.equipmentMastered;
  try{
   const amount=damage.call(this,att,tar,base*(1+tool.bonus),mult,kind,ev,`${tool.name} · ${label}`,flash,ignoreImmune);
   for(const e of ev.slice(start))if(e.from===att.name&&e.dmg)e.equipment=tool.id;
   return amount;
  }finally{att.toolNullify=nullify;att.toolPierceGuard=pierce;}
 };
 window.Equipment=Equipment;
})();
