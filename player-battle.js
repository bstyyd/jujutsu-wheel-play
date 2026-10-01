(() => {
 'use strict';
 const $=id=>document.getElementById(id),rules=PlayerBattleRules,audio=new CombatAudio();audio.volume=.45;
 let catalog,frame,ready=false,loaded=false,busy=false,failed=false,requested=false,advancing=false,accepting=false,epoch=0,eng,player,selected=-1,views=[],points=[],serial=0,waiter=null,hover='attack',bootTimer=0,timer=0,styleMode='',styleChoice='',revealed=new Set(),stageLoaded=false;
 const CursedToolTraining=window.CursedToolTraining;
 const asset=file=>new URL('assets/'+file,location.href).href;
 const keepUnit=(u,i)=>!u.summonTag||u.alive&&(views[i]?.hp??u.hp)>0||waiter?.e.toIndex===i;
 const rosterKey=()=>epoch+'|'+eng.units.flatMap((u,i)=>keepUnit(u,i)?[i+':'+u.name]:[]).join('|');
 const send=data=>{if(ready)frame.contentWindow.postMessage({channel:'jjk-battle',payload:data},location.origin);};
 const fields=['profile','identity','technique','equipment','build','mastery','loadout'];
 for(const p of CombatPresentation.profiles)$('profile').add(new Option(p.label,p.key));
 for(const id of rules.identity)$('identity').add(new Option(id.label,id.label));
 $('loadout').replaceChildren(new Option('自行起步',''));for(const [id,b] of Object.entries(PlayerBuild.presets))$('loadout').add(new Option(b.name,id));
 for(const t of rules.techniques)$('technique').add(new Option(t.name,t.flag));
 for(const t of Equipment.catalog)$('equipment').add(new Option(t.name,t.id));
 $('identity').value=rules.identity.find(x=>x.label==='咒术师')?.label||rules.identity[2].label;$('technique').value='blood';
 $('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const options=()=>({...Object.fromEntries(fields.map(id=>[id,$(id).value])),learnBlackFlash:$('learnBlackFlash').checked});
 function prepare(){
  if(busy||advancing||accepting)return;
  for(const [id,key] of [['presetClose','close'],['presetSummon','summon'],['presetWeapon','weapon'],['presetRanged','ranged'],['presetStory','']])$(id).setAttribute('aria-pressed',String(styleMode===key));
  player=PlayerPractice.create(options());const selectedBuild=PlayerBuild.presets[$('loadout').value];if(selectedBuild?.flag&&selectedBuild.flag!==player.technique.flag)$('loadout').value='';eng=PlayerPractice.engine(player,$('equipment').value,styleMode,PlayerBuild.sample($('loadout').value,player));epoch++;revealed.clear();stageLoaded=false;
  views=eng.units.map(u=>({hp:u.hp,cp:u.cp}));selected=eng.units.findIndex(u=>u.side==='enemy');
  requested=false;loaded=false;$('result').hidden=true;$('entryParty').textContent=styleMode?(PlayerStyles.family(eng.player)?'你 ＋ 你的召唤物':'随机人物 · 单人演练'):'你 ＋ 剧情同伴';
  $('entry').hidden=false;$('entryTitle').textContent=player.isVillain?'以自己的身份迎战咒术师':'带上自己的术式出战';$('loadStatus').textContent=ready?'配置已更新，进入战斗继续':'选择配置，或随机一次人物。';$('start').textContent='进入战斗';$('start').disabled=false;
  $('buildSummary').textContent=player.identity+' · '+player.age+'岁 · '+player.gender+' / '+player.technique.name+' / '+(Equipment.find($('equipment').value)?.name||'徒手');
  $('buildDetails').replaceChildren();
  for(const [name,value] of [['体术',player.melee.join('–')],['术式伤害',player.eff.join('–')],['生命',player.maxHp],['咒力',player.maxCp],['操控',player.ctl],['熟练',player.prof+'%']]){
   const n=document.createElement('span');n.textContent=name;const b=document.createElement('b');b.textContent=value;n.append(b);$('buildDetails').append(n);
  }
  $('traitNotes').textContent=TechniqueBuilds.current(player)+' / '+PlayerBuild.summary(PlayerBuildCombat.config(eng));
  $('numbers').replaceChildren();$('callout').replaceChildren();makeCards();render();sync();
 }
 function sprite(u){
  if(u.isPlayer)return PlayerPresentation.sprite(catalog,player,{...u,weaponSealed:BattleTraits.toolSealed(eng,u)});
  return SummonPresentation.sprite(catalog,u,70)||catalog.actors.curse;
 }
 function sync(){
  document.body.classList.toggle('reduce-motion',$('reduced').checked);if(!catalog||!eng)return;
  for(let i=views.length;i<eng.units.length;i++)views.push({hp:eng.units[i].hp,cp:eng.units[i].cp});
  const domains=DomainCombat.fields(eng).map(d=>{const p=BattleScenes.profileFor(d,eng.units);if(!p)return null;const rect=p.atlas?[p.atlas[0],1-p.atlas[1]-p.atlas[3],p.atlas[2],p.atlas[3]]:[0,0,1,1];return {name:d.name,key:p.key,side:d.side,open:!!p.open,overlay:!!p.overlay,url:asset(p.file||'domains.png'),rect,floor:'#'+p.floor.toString(16).padStart(6,'0')};}).filter(Boolean).slice(0,2);
  const domainEntities=SummonPresentation.domainEntities(catalog,DomainCombat.fields(eng)).map(x=>({...x,url:asset(x.file),maskURL:asset(x.maskFile)}));
  send({type:'state',battleKey:'practice-'+epoch,rosterKey:rosterKey(),active:!document.hidden,quality:'fine',reduced:$('reduced').checked,presentation:'player-sample',formation:eng.units.length===4&&!eng.player.equipmentId?'duo-duo':'',target:selected,surfaceAtlas:asset(catalog.surfaceAtlas),environment:{key:'bridge',painted:true,url:asset('scenes/v1/bridge-night.png')},domains,domainEntities,domainContested:domains.length>1,victorySide:!busy&&eng.ended?(eng.result==='win'?'ally':'enemy'):'',
   roster:eng.units.map((u,index)=>{const art=sprite(u),tool=catalog.playerWeapons?.[u.equipmentId];return {index,name:u.name,side:u.side,isPlayer:!!u.isPlayer,spawnQueued:!!u.styleSpawn&&!revealed.has(index),alive:views[index].hp>0,guarding:!!u.buff.defend,weaponSealed:BattleTraits.toolSealed(eng,u),height:art.height,url:asset(art.file),maskURL:art.maskFile?asset(art.maskFile):'',weaponURL:tool?asset(tool.file):'',battleSprite:art};}).filter(u=>keepUnit(eng.units[u.index],u.index))});
 }
 function choose(i){if(!loaded||busy||!eng.awaitingPlayer||!eng.units[i]?.alive||eng.units[i].side!=='enemy')return;selected=i;render();sync();}
 function makeCards(){
  $('allies').replaceChildren();$('enemies').replaceChildren();$('targets').replaceChildren();
  eng.units.forEach((u,i)=>{const enemy=u.side==='enemy',c=document.createElement(enemy?'button':'div');c.className='fighter'+(enemy?' enemy':'')+(u.isPlayer?' player-battle-card':'');c.dataset.index=i;
   c.innerHTML='<div class="name"><strong></strong><span class="value"></span></div><div class="track"><div class="fill echo"></div><div class="fill hp"></div></div><div class="track cp"><div class="fill"></div></div><span class="state"></span>';
   if(enemy){c.onclick=()=>choose(i);c.setAttribute('aria-label','选择'+u.name);}
   $(enemy?'enemies':'allies').append(c);
   if(enemy){const b=document.createElement('button');b.id='target-'+i;b.className='target-hit';b.innerHTML='<b>⌄</b>';b.setAttribute('aria-label','战场选择'+u.name);b.onclick=()=>choose(i);$('targets').append(b);}
  });
 }
 function description(command){
  const u=eng.player,t=Equipment.find(u.equipmentId);
  if(command==='attack')return t?t.name+'：'+t.effect:'徒手近身出击。体术伤害由当前人物的体术属性决定。';
  if(command==='skill')return player.technique.name+' · 消耗 '+eng.techCost(u)+' 咒力。'+(BattleTraits.techniqueNotes?.[u.flag]||'');
  if(command==='domain')return u.canDomain?'消耗 '+DomainCombat.cost(u)+' 咒力，展开「'+u.domainName+'」。'+BattleTraits.info(u.domainName).text:'熟练度达到 100% 后领悟领域。';
  return '防御减轻来袭伤害，并恢复 8% 最大咒力。';
 }
 function render(message){
  if(!eng)return;
  if(eng.units[selected]?.alive!==true)selected=eng.units.findIndex(u=>u.alive&&u.side==='enemy');
  if(document.querySelectorAll('.fighter').length!==eng.units.length)makeCards();
  const can=loaded&&!busy&&!advancing&&!accepting&&eng.awaitingPlayer&&!eng.ended,u=eng.player;
  $('round').textContent='行动 '+eng.actionsTotal;$('order').replaceChildren();
  for(const v of eng.previewOrder(6,eng.awaitingPlayer?u:null)){const n=document.createElement('span');n.textContent=v.name==='你'?'你':v.name.slice(0,2);if(v===eng.lastActor)n.className='active';$('order').append(n);}
  eng.units.forEach((unit,i)=>{const c=document.querySelector('.fighter[data-index="'+i+'"]'),v=views[i]||unit;
   c.hidden=!!unit.summonTag&&!unit.alive;c.classList.toggle('fallen',v.hp<=0);c.classList.toggle('current',unit===eng.lastActor&&!eng.ended);c.classList.toggle('selected',i===selected);
   c.querySelector('strong').textContent=unit.name;c.querySelector('.value').textContent=Math.max(0,Math.round(v.hp))+' / '+unit.maxHp;
   for(const fill of c.querySelectorAll('.track:not(.cp) .fill'))fill.style.transform='scaleX('+Math.max(0,v.hp)/unit.maxHp+')';
   c.querySelector('.cp .fill').style.transform='scaleX('+unit.cp/unit.maxCp+')';
   const statuses=BattleTraits.status(eng,unit);
   c.querySelector('.state').textContent=v.hp<=0?'已退场':'CP '+Math.round(unit.cp)+' / '+unit.maxCp+(unit.buff.defend?' · 防御':'')+(unit.buff.poison?' · 毒 '+unit.buff.poison:'')+(statuses.length?' · '+statuses.join(' / '):'');
   if(unit.side==='enemy'){c.disabled=!can||!unit.alive;c.setAttribute('aria-pressed',String(i===selected));const b=$('target-'+i);b.hidden=!can||!unit.alive;b.setAttribute('aria-pressed',String(i===selected));b.querySelector('b').hidden=i!==selected;}
  });
  $('attack').disabled=!can;$('skill').disabled=!can||u.cp<eng.techCost(u)||!!BattleTraits.blocked(eng,u,'tech');$('domain').disabled=!can||!DomainCombat.ready(eng,u);$('guard').disabled=!can;
  $('attack').querySelector('strong').textContent=Equipment.find(u.equipmentId)?.name||'体术';
  $('attack').querySelector('small').textContent=Equipment.find(u.equipmentId)?'咒具近战':'徒手出击';
  $('skill').querySelector('strong').textContent=player.technique.name;$('skill').querySelector('small').textContent=eng.techCost(u)+' 咒力';
  $('domain').querySelector('small').textContent=u.canDomain?(DomainCombat.active(eng,u)?'领域维持中':u.domainCd>0?'术式熔断中':DomainCombat.cost(u)+' 咒力'):'熟练度不足';
  $('actor').textContent=eng.ended?'战斗结束':eng.awaitingPlayer?'你的行动':eng.lastActor?.name||'准备出战';
  $('description').textContent=description(hover);$('selectedName').textContent=eng.units[selected]?.name||'—';
  $('status').textContent=message||(!loaded?'选择进入战斗':eng.ended?'演练结束':busy?'行动演出中…':eng.awaitingPlayer?'选择右侧敌人，下达指令':'同伴与对手正在行动');
  renderStyles(can);
  $('intent').replaceChildren();for(const enemy of eng.alive('enemy')){const p=PlayerStyles.intent(eng,enemy),n=document.createElement('div');n.className='intent-row'+(p.danger?' danger':'');n.textContent=enemy.name+' · '+p.label+' → '+p.target;const hint=document.createElement('small');hint.textContent=p.danger?'高威胁 · 防御或护卫分担伤害':'下一次行动 · 目标倒下时重新选定';n.append(hint);$('intent').append(n);}
  const locked=busy||advancing||accepting;for(const id of fields)$(id).disabled=locked;for(const id of ['presetClose','presetSummon','presetWeapon','presetRanged','presetStory','learnBlackFlash'])$(id).disabled=locked;$('randomize').disabled=locked;$('reset').disabled=!loaded||locked;$('reduced').disabled=locked;
  $('result').hidden=!eng.ended||busy;
  if(eng.ended&&!busy){const s=PlayerStyles.state(u);$('resultKicker').textContent=eng.result==='win'?'演练完成':'暂时撤退';$('resultTitle').textContent=eng.result==='win'?'你的术式，赢下了这一战':'换一种应对再试一次';$('resultText').textContent='破势 '+s.burst+' 次 · 显现与融合 '+s.deployed+' 次 · 协攻 '+s.orders+' 次 · 护卫 '+s.intercepts+' 次 · 持械招式 '+PlayerArsenal.state(u).weaponUses+' 次 · 集中施术 '+PlayerArsenal.state(u).releases+' 次 · 蓄力被打断 '+PlayerArsenal.state(u).interruptions+' 次。演练不写入旅程存档。';const buildStats=PlayerBuildCombat.state(eng);$('resultText').textContent+=' 构筑追击 '+buildStats.followups+' 次 · 守势反击 '+buildStats.counters+' 次 · 炮击回补 '+buildStats.returnedTotal+' CP。';}
 }
 function renderStyles(can){
  const panel=$('stylePanel'),rows=PlayerStyles.commands(eng),s=PlayerStyles.state(eng.player);panel.replaceChildren();const buildLine=document.createElement('p');buildLine.className='build-battle-summary';buildLine.textContent=PlayerBuild.summary(PlayerBuildCombat.config(eng));panel.append(buildLine);
  const meter=document.createElement('div');meter.className='style-meter';const b=document.createElement('b');b.textContent=s.pressure===3?'满势 · 破势就绪':'连击势能';meter.append(b);for(let i=0;i<3;i++){const n=document.createElement('i');n.className=i<s.pressure?'lit':'';meter.append(n);}const count=document.createElement('small');count.textContent=PlayerStyles.family(eng.player)?'在场 '+PlayerStyles.owned(eng).length+'/'+PlayerStyles.limit(eng.player):s.pressure+'/3';meter.append(count);panel.append(meter);const summary=PlayerArsenal.summary(eng);if(summary){const n=document.createElement('small');n.className='arsenal-meter';n.textContent=summary;panel.append(n);}
  const group=document.createElement('div');group.className='style-command-row';panel.append(group);
  function button(row){const n=document.createElement('button');n.disabled=!can||!!row.reason;n.title=row.note;n.dataset.action=row.id;const label=document.createElement('b'),cp=document.createElement('small');label.textContent=row.label;cp.textContent=row.reason||row.cost+' CP';n.append(label,cp);n.onclick=()=>act(row.id);n.onfocus=n.onmouseenter=()=>{$('description').textContent=row.note;};return n;}
  group.append(button(rows[0]));const deploy=rows.filter(r=>r.id.startsWith('style_deploy:'));
  if(deploy.length){const slot=document.createElement('div');slot.className='style-deploy';const select=document.createElement('select');select.setAttribute('aria-label','选择显现单位');for(const r of deploy)select.add(new Option(r.label.replace('显现 · ',''),r.id));if(deploy.some(r=>r.id===styleChoice))select.value=styleChoice;select.disabled=!can;slot.append(select,button(deploy.find(r=>r.id===select.value)));group.append(slot);select.onchange=()=>{styleChoice=select.value;slot.replaceChild(button(deploy.find(r=>r.id===select.value)),slot.lastChild);};}
  for(const r of rows.filter(r=>r.id!==rows[0].id&&!r.id.startsWith('style_deploy:')))group.append(button(r));
 }
 function popup(index,amount,heal=false){const p=points.find(x=>x.index===index)||{x:.5,y:.5},n=document.createElement('span');n.className='damage'+(heal?' guard':'');n.textContent=(heal?'+':'')+amount;n.style.left=Math.max(.05,Math.min(.95,p.x))*100+'%';n.style.top=Math.max(.12,p.y-.08)*100+'%';$('numbers').append(n);setTimeout(()=>n.remove(),1000);}
 function applyEvent(e){
  const index=Number.isInteger(e.toIndex)?e.toIndex:eng.units.findIndex(u=>u.name===(e.to||e.actorName));
  if(e.dmg&&index>=0){views[index].hp=Math.max(0,views[index].hp-e.dmg);popup(index,e.dmg);}
  if(e.heal){const i=eng.units.findIndex(u=>u.name===(e.from||'你'));if(i>=0){views[i].hp=Math.min(eng.units[i].maxHp,views[i].hp+e.heal);popup(i,e.heal,true);}}
  render(e.text);sync();
 }
 function title(text){const n=document.createElement('span');n.className='skill-title';n.textContent=text;$('callout').replaceChildren(n);setTimeout(()=>n.remove(),1250);}
 async function move(e){
  const from=Number.isInteger(e.fromIndex)?e.fromIndex:eng.units.findIndex(u=>u.name===e.from),to=Number.isInteger(e.toIndex)?e.toIndex:eng.units.findIndex(u=>u.name===e.to);
  if(!e.dmg||from<0||to<0||from===to||!['melee','tech'].includes(e.attackKind)||/附加|持续|灼烧|中毒/.test(e.text||'')){applyEvent(e);return;}
  const unit=eng.units[from],art=sprite(unit),packet=unit.isPlayer?PlayerPresentation.action({...unit,battleSprite:art},e):SummonPresentation.action(art,e)||{kind:e.attackKind==='melee'?'melee':CombatPresentation.techniques[unit.flag]?.kind||'orb',variant:e.type==='flash'?'blackflash':unit.flag||''};
  if(/共鸣/.test(e.text||''))packet.variant='resonance';
  const sound=art.playerWeapon&&e.attackKind==='melee'?(art.playerWeapon.family==='blade'?'slash':art.playerWeapon.family==='chain'?'heavy':'ratio'):packet.variant==='blackflash'?'blackflash':packet.kind;
  await new Promise(resolve=>{
   const id=++serial;waiter={id,e,packet,sound,resolve,impacted:false};
   timer=setTimeout(()=>{if(waiter?.id===id){if(!waiter.impacted)applyEvent(e);waiter=null;resolve();}},3500);
   send({type:'event',eventType:'choreography',presentationOnly:true,id,fromIndex:from,toIndex:to,actionKind:packet.kind,variant:packet.variant,styleMove:e.styleMove||'',chargeLevel:e.chargeLevel||0,comboIndex:e.comboIndex||0});
  });
 }
 async function batch(packet){
  busy=true;for(let i=views.length;i<eng.units.length;i++)views.push({hp:eng.units[i].hp,cp:eng.units[i].cp});render();sync();
  for(const e of packet.events){
   if(failed)return;
   if(e.type==='style'){
    if(Number.isInteger(e.spawnIndex)){stageLoaded=false;sync();const until=performance.now()+2400;while(!stageLoaded&&performance.now()<until&&!failed)await new Promise(r=>setTimeout(r,50));revealed.add(e.spawnIndex);}
    send({type:'event',eventType:'player-style',phase:e.stylePhase,fromIndex:e.fromIndex,spawnIndex:e.spawnIndex??-1,guardIndex:e.guardIndex??-1,toIndex:e.toIndex??-1,summonFamily:e.summonFamily||'',techniqueFlag:eng.player.flag,weaponFamily:PlayerArsenal.family(eng.player),ordered:e.ordered||[]});title(e.text);await new Promise(r=>setTimeout(r,$('reduced').checked?180:800));sync();continue;
   }
   if(e.type==='domain'&&e.domainName){title('领域展开 · '+e.domainName);sync();await new Promise(resolve=>setTimeout(resolve,$('reduced').checked?250:1200));}
   else if(e.type==='skillcut'&&e.text)title(e.text);
   await move(e);
  }
  views=eng.units.map(u=>({hp:u.alive?u.hp:0,cp:u.cp}));busy=false;render();sync();
 }
 async function advance(){
  if(advancing)return;advancing=true;render();const run=epoch;
  try{while(run===epoch&&loaded&&!failed&&!eng.ended&&!eng.awaitingPlayer){const p=eng.advance();await batch(p);if(p.needInput)break;if(document.hidden)break;await new Promise(resolve=>setTimeout(resolve,180));}}
  finally{advancing=false;render();sync();}
 }
 async function act(command){if(!loaded||busy||advancing||accepting||!eng.awaitingPlayer)return;accepting=true;render();try{await audio.unlock();const packet=eng.playerAct(command,selected);await batch(packet);await advance();}finally{accepting=false;render();}}
 function fail(message){failed=true;loaded=false;busy=false;clearTimeout(bootTimer);clearTimeout(timer);audio.stop();if(waiter){waiter.resolve();waiter=null;}$('entry').hidden=false;$('entryTitle').textContent='载入未完成';$('loadStatus').textContent=message;$('start').textContent='重试载入';$('start').disabled=false;render(message);}
 async function boot(){
  if(busy||advancing||accepting)return;requested=true;$('start').disabled=true;$('loadStatus').textContent='载入玩家动作、场景与音效…';failed=false;
  try{
   await audio.unlock();catalog ||= await fetch('battle-sprites.json').then(r=>{if(!r.ok)throw Error('动作图集未载入');return r.json();});
   if(frame&&ready){sync();return;}
   ready=false;frame=document.createElement('iframe');frame.title='随机玩家 HD2D 战斗舞台';frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.src='godot/embed.html';$('mount').replaceChildren(frame);bootTimer=setTimeout(()=>fail('载入超时，请重试。'),60000);
  }catch(e){fail(e.message);}
 }
 window.addEventListener('message',e=>{
  if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.channel!=='jjk-battle')return;const d=e.data;
  if(d.type==='error'||d.type==='asset-error'){console.error(d.message||'舞台素材错误');fail('舞台资源未载入，请重试。');return;}
  if(d.type==='ready'){if(failed)return;ready=true;sync();return;}
  if(d.rosterKey!==rosterKey())return;
  if(d.type==='state'){
   stageLoaded=!!d.backgroundReady&&d.loaded===d.actors;
   points=d.points||[];
   for(const p of points){const b=$('target-'+p.index);if(b&&p.bounds){const r=p.bounds;Object.assign(b.style,{left:Math.max(0,r.left)*100+'%',top:Math.max(0,r.top)*100+'%',width:Math.max(.05,r.right-r.left)*100+'%',height:Math.max(.10,r.bottom-r.top)*100+'%'});}}
   if(requested&&!loaded&&d.backgroundReady&&d.loaded===d.actors){clearTimeout(bootTimer);loaded=true;$('entry').hidden=true;render();advance();}return;
  }
  if(!waiter||waiter.id!==d.id)return;
  if(d.type==='melee-phase'&&['windup','approach'].includes(d.phase))audio.play(waiter.sound,d.phase);
  if(d.type==='melee-impact'&&!waiter.impacted){waiter.impacted=true;applyEvent(waiter.e);audio.play(waiter.sound,'impact');}
  if(d.type==='melee-complete'||d.type==='melee-rejected'){clearTimeout(timer);if(!waiter.impacted)applyEvent(waiter.e);const done=waiter.resolve;waiter=null;done();}
 });
 for(const id of fields)$(id).onchange=prepare;
 $('loadout').onchange=()=>{const b=PlayerBuild.presets[$('loadout').value];if(b?.flag)$('technique').value=b.flag;if(b)styleMode=b.flag==='copy'?'':PlayerStyles.family({flag:b.flag})?'summon':b.flag==='cannon'?'ranged':'close';prepare();};
 function preset(mode){if(busy||advancing||accepting)return;styleMode=mode;for(const [id,key] of [['presetClose','close'],['presetSummon','summon'],['presetWeapon','weapon'],['presetRanged','ranged'],['presetStory','']])$(id).setAttribute('aria-pressed',String(mode===key));if(mode){$('identity').value='咒术师';$('technique').value=mode==='summon'?'shadows':mode==='weapon'?'ratio':'blood';$('build').value=['close','weapon'].includes(mode)?'brawler':'channeler';$('equipment').value=mode==='weapon'?'practice':'';$('mastery').value='100';$('loadout').value=mode==='summon'?'hunter':'';}$('practiceNote').textContent=mode==='weapon'?'持械样板：课题视为完成。普通持械攻击积攒2格刃势，刀具连斩、薙刀压制、游云收势各有不同；咒具原有能力生效。独立演练不读写存档。':mode==='ranged'?'远程样板：立即施术或消耗行动蓄力。轻击保留；单次直接伤害达到12%生命损失1层，防御可稳住，其他进攻会解除。集中施术沿用当前术式与防护规则，不模拟黑闪。独立演练不读写存档。':mode?'流派练习：敌方实力随你的面板设置，可选择是否已领悟黑闪，触发仍随机；十划咒法自带黑闪机会。显现、协攻、护卫与融合各消耗一次行动。人物形象可自由选。':'原配置：使用主游戏人物生成、术式和咒具规则；阵营决定双方人物。独立演练不读写存档。';prepare();}
 $('presetClose').onclick=()=>preset('close');$('presetSummon').onclick=()=>preset('summon');$('presetStory').onclick=()=>preset('');$('presetWeapon').onclick=()=>preset('weapon');$('presetRanged').onclick=()=>preset('ranged');
 $('learnBlackFlash').onchange=prepare;
 $('randomize').onclick=()=>{const o=PlayerPractice.randomOptions();for(const id of fields)$(id).value=o[id]||'';prepare();};
 $('start').onclick=boot;$('reset').onclick=()=>{prepare();boot();};$('again').onclick=()=>{prepare();boot();};
 for(const [id,command] of [['attack','melee'],['skill','tech'],['domain','domain'],['guard','defend']]){$(id).onclick=()=>act(command);for(const event of ['mouseenter','focus'])$(id).addEventListener(event,()=>{hover=id;$('description').textContent=description(id);});}
 $('sound').onclick=()=>{audio.setEnabled(!audio.enabled);$('sound').textContent='音效 · '+(audio.enabled?'开':'关');$('sound').setAttribute('aria-pressed',String(audio.enabled));};
 $('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);$('reduced').onchange=sync;
 document.addEventListener('visibilitychange',()=>{send({type:'pause',value:document.hidden});if(document.hidden)audio.stop();else if(loaded&&!busy)advance();});
 window.addEventListener('pagehide',()=>{clearTimeout(bootTimer);clearTimeout(timer);audio.stop();});
 const initialMode=new URLSearchParams(location.search).get('style');if(['close','summon','weapon','ranged'].includes(initialMode))preset(initialMode);else prepare();
 const initialLoadout=new URLSearchParams(location.search).get('loadout');if(PlayerBuild.presets[initialLoadout]){const sample=PlayerBuild.presets[initialLoadout];styleMode=sample.flag==='copy'?'':PlayerStyles.family({flag:sample.flag})?'summon':sample.flag==='cannon'?'ranged':'close';$('loadout').value=initialLoadout;if(sample.flag)$('technique').value=sample.flag;prepare();}
})();
