/* Batch C4 原创咒具：5 件原创设计（不与原作武器同名，仅气质致敬）。
   通过 Equipment.register 挂入既有装备系统（解锁/渲染/存档校验自动生效）；
   特殊效果统一在本文件的 dealDamage/kill 补丁中结算，不改动引擎。 */
(() => {
'use strict';
const E=window.Equipment;if(!E)return;
const usable=(eng,u)=>!!u&&!window.BattleTraits?.toolSealed(eng,u);

E.register({id:'scissors',name:'断罪之剪',art:'assets/ui/v2/tools/scissors.png',tag:'原创咒具',role:'收割利刃',index:5,wins:15,bonus:.15,
 desc:'黑铁打造的双刃大剪，咬合时发出类似法槌落下的闷响。据说锻匠执念于「剪断罪孽」。',
 effect:'体术伤害 +15%；对生命低于 30% 的敌人，近战伤害再 +25%。',source:'原创咒具'});
E.register({id:'godBell',name:'鸣神之铃',art:'assets/ui/v2/tools/godBell.png',tag:'原创咒具',role:'护命铃音',index:6,wins:18,bonus:.10,
 desc:'系在刀镡上的黄铜小铃，持有者濒死时会无风自鸣。铃声只有一次——听过的人都还活着。',
 effect:'体术伤害 +10%；每场战斗首次受到致命伤害时，保留 1 点生命（铃响即碎）。',source:'原创咒具'});
E.register({id:'demonScroll',name:'百鬼夜行图',art:'assets/ui/v2/tools/demonScroll.png',tag:'原创咒具',role:'群战号令',index:7,wins:22,bonus:.15,
 desc:'一幅会自己变换内容的卷轴，展开时隐约能听到百鬼的脚步声。持卷者即夜行之主。',
 effect:'体术伤害 +15%；我方队友与召唤物伤害 +20%。',source:'原创咒具'});
E.register({id:'paradoxRing',name:'逆理之戒',art:'assets/ui/v2/tools/paradoxRing.png',tag:'原创咒具',role:'术式增幅',index:8,wins:26,bonus:.05,
 desc:'戒面刻着一句自相矛盾的咒文，念出来会让咒力回路短暂「打结」——结解开的瞬间，输出反而更顺。',
 effect:'体术伤害 +5%；术式伤害 +15%。',source:'原创咒具'});
E.register({id:'sheath',name:'无铭之鞘',art:'assets/ui/v2/tools/sheath.png',tag:'原创咒具',role:'居合一闪',index:9,wins:30,bonus:.12,
 desc:'没有刀铭的白鞘古刀，刀身只在出鞘的第一瞬映出使用者的杀气。鞘比刀更有名。',
 effect:'体术伤害 +12%；每场战斗第一次近战攻击伤害 ×1.6。',source:'原创咒具'});

// —— 特殊效果结算 ——
const proto=BattleEngine.prototype;
const deal=proto.dealDamage;
proto.dealDamage=function(att,tar,base,mult,kind,ev,...rest){
 // 断罪之剪：对残血（<30% 最大生命）目标近战 +25%
 if(usable(this,att)&&att.isPlayer&&kind==='melee'&&att.equipmentId==='scissors'&&tar.hp>0&&tar.hp<tar.maxHp*0.30){
  mult*=1.25;if(ev)ev.push({type:'skill',text:'【断罪之剪】剪刃咬合——收割残血目标，伤害 +25%。'});
 }
 // 百鬼夜行图：我方队友/召唤物伤害 +20%（玩家持卷才生效）
 if(att.side==='ally'&&!att.isPlayer&&this.player?.equipmentId==='demonScroll'&&usable(this,this.player))mult*=1.20;
 // 逆理之戒：术式伤害 +15%
 if(usable(this,att)&&att.isPlayer&&kind==='tech'&&att.equipmentId==='paradoxRing')base*=1.15;
 // 无铭之鞘：每场第一次近战 ×1.6
 if(usable(this,att)&&att.isPlayer&&kind==='melee'&&att.equipmentId==='sheath'&&!att.buff.sheathUsed){
  att.buff.sheathUsed=true;mult*=1.6;if(ev)ev.push({type:'skill',text:'【无铭之鞘】居合一闪——出鞘第一击，伤害 ×1.6！'});
 }
 return deal.call(this,att,tar,base,mult,kind,ev,...rest);
};
// 鸣神之铃：首次致命伤害保留 1 点生命（铃响即碎，每场一次）
const kill=proto.kill;
proto.kill=function(u,ev,...rest){
  if(usable(this,u)&&u.isPlayer&&u.equipmentId==='godBell'&&!u.buff.bellUsed){
  u.buff.bellUsed=true;u.alive=true;u.hp=1;
  if(ev)ev.push({type:'skill',text:'【鸣神之铃】铃声炸响又戛然而止——你从致命一击中撑住了最后 1 点生命！'});
  return;
 }
 return kill.call(this,u,ev,...rest);
};
})();
