(() => {
 'use strict';
 const styles=window.PlayerStyles;
 function refresh(){
  const ui=BattleUI,e=ui.eng,actions=document.getElementById('bfActions');if(!e||!actions)return;
  let panel=document.getElementById('playerStylePanel');
  if(!panel){panel=document.createElement('section');panel.id='playerStylePanel';panel.className='player-style-panel';panel.setAttribute('aria-label','玩家流派指令');actions.before(panel);}
  const selected=panel.querySelector('select')?.value,s=styles.state(e.player),rows=styles.commands(e),deploy=rows.filter(r=>r.id.startsWith('style_deploy:'));
  panel.replaceChildren();
  if(window.PlayerBuildCombat){const line=document.createElement('p');line.id='battleBuildSummary';line.className='build-battle-summary';line.textContent=PlayerBuild.summary(PlayerBuildCombat.config(e));panel.append(line);}
  const header=document.createElement('div');header.className='style-meter';
  const label=document.createElement('b');label.textContent=s.pressure===3?'势能已满 · 可以破势':'连击势能';header.append(label);
  for(let i=0;i<3;i++){const n=document.createElement('i');n.className=i<s.pressure?'lit':'';n.setAttribute('aria-hidden','true');header.append(n);}
  const detail=document.createElement('small');detail.textContent=styles.family(e.player)?'在场 '+styles.owned(e).length+'/'+styles.limit(e.player):'体术命中积攒 · 术式行动减1';header.append(detail);panel.append(header);const summary=window.PlayerArsenal?.summary(e);if(summary){const n=document.createElement('small');n.className='arsenal-meter';n.textContent=summary;panel.append(n);}
  const group=document.createElement('div');group.className='style-command-row';panel.append(group);
  const can=ui._awaitingInput&&e.awaitingPlayer&&!e.ended&&!e.pendingDomain;
  function button(row){
   const b=document.createElement('button');b.type='button';b.disabled=!can||!!row.reason;b.title=row.reason||row.note;
   const name=document.createElement('b'),note=document.createElement('small');name.textContent=row.label;note.textContent=row.reason||row.cost+' CP';b.append(name,note);
   b.onclick=()=>{if(!ui._awaitingInput||!e.awaitingPlayer)return;ui.input(row.id);refresh();};
   b.onfocus=b.onmouseenter=()=>{const n=panel.querySelector('.style-note');if(n)n.textContent=row.note;};return b;
  }
  group.append(button(rows[0]));
  if(deploy.length){
   const select=document.createElement('select');select.setAttribute('aria-label','选择显现单位');
   for(const row of deploy){const o=new Option(row.label.replace('显现 · ',''),row.id);select.add(o);}
   if(deploy.some(r=>r.id===selected))select.value=selected;
   const slot=document.createElement('div');slot.className='style-deploy';slot.append(select,button(deploy.find(r=>r.id===select.value)||deploy[0]));group.append(slot);select.disabled=!can;
   select.onchange=()=>slot.replaceChild(button(deploy.find(r=>r.id===select.value)),slot.lastChild);
  }
  for(const row of rows.filter(r=>r.id!==rows[0].id&&!r.id.startsWith('style_deploy:')))group.append(button(row));
  const note=document.createElement('p');note.className='style-note';note.textContent=styles.family(e.player)?'每个流派指令消耗一次玩家行动。协攻推进式神的下一次行动，护卫分担下一次直接攻击。':'体术命中积攒势能；满3格后可选择破势一击，消耗4%最大咒力。';panel.append(note);
 }
 for(const key of ['render','waitInput','input']){const previous=BattleUI[key];BattleUI[key]=function(...args){const result=previous.apply(this,args);refresh();return result;};}
 const choose=BattleUI.autoChoose;
 BattleUI.autoChoose=function(){
  const e=this.eng,rows=styles.commands(e),can=id=>rows.find(r=>r.id===id&&!r.reason);
  if(can('arsenal_weapon'))return 'arsenal_weapon';
  if(window.PlayerArsenal?.state(e.player).focus&&can('arsenal_release'))return 'arsenal_release';
  if(can('style_burst'))return 'style_burst';
  if(window.PlayerBuildCombat?.has(e,'battery')&&can('build_barrage')&&!styles.owned(e).some(s=>s.summonOrder))return 'build_barrage';
  if(styles.family(e.player)){
   const mine=styles.owned(e),deploy=rows.find(r=>r.id.startsWith('style_deploy:')&&!r.reason);
   if(mine.length<styles.limit(e.player)&&deploy)return deploy.id;
   if(e.player.hp<e.player.maxHp*.35&&!e.player.summonGuard&&can('style_protect'))return 'style_protect';
   if(mine.length>=2&&!mine.some(s=>s.summonOrder)&&e.player.cp>e.player.maxCp*.2&&can('style_coordinate'))return 'style_coordinate';
  }
  return choose.call(this);
 };
})();
