(() => {
 'use strict';
 const get=id=>document.getElementById(id),audio=new CombatAudio(),asset=file=>new URL('assets/'+file,location.href).href;
 let catalog,frame,ready=false,loaded=false,busy=false,advancing=false,accepting=false,requested=false,failed=false,epoch=0,serial=0,engine,player,scenario,shown=[],views=[],points=[],waiter=null,actionTimer=0,bootTimer=0,hover='attack',log=[],stats;
 const configuration=['scenario','profile','equipment'];
 const send=payload=>{if(ready)frame.contentWindow.postMessage({channel:'jjk-battle',payload},location.origin);};
 const keep=(u,i)=>!u.summonTag||(views[i]?.hp??u.hp)>0||waiter?.e.toIndex===i;
 const rosterKey=()=>epoch+'|'+engine.units.flatMap((u,i)=>keep(u,i)?[i+':'+u.name]:[]).join('|');
 for(const s of DomainDuelModel.scenarios)get('scenario').add(new Option(s.label,s.id));
 for(const p of CombatPresentation.profiles)get('profile').add(new Option(p.label,p.key));
 for(const tool of Equipment.catalog.filter(x=>x.index<5))get('equipment').add(new Option(tool.name,tool.id));
 get('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const art=u=>u.isPlayer?PlayerPresentation.sprite(catalog,player,{...u,weaponSealed:BattleTraits.toolSealed(engine,u)}):SummonPresentation.sprite(catalog,u,scenario.day)||catalog.actors[CombatPresentation.battleActorKey(HD.artIndex(u.name),scenario.day,u.name)]||catalog.actors.curse;
 function prepare(){
  if(busy||advancing||accepting)return;
  Cinema?.hide();const run=DomainDuelModel.create(Object.fromEntries(configuration.map(id=>[id,get(id).value])));
  ({player,engine,scenario}=run);BattleUI.eng=engine;epoch++;views=engine.units.map(u=>({hp:u.hp,cp:u.cp}));shown=[];log=[];stats={counter:false,contested:false,breaks:0,fortify:0,damage:0};loaded=false;requested=false;
  get('location').textContent=BattleScenes.location(scenario.environment).place;get('objective').textContent=scenario.goal;
  get('buildSummary').textContent=player.age+'岁 · '+player.gender+' / '+player.technique.name+' / '+(Equipment.find(get('equipment').value)?.name||'徒手');
  get('entry').hidden=false;get('result').hidden=true;get('reaction').hidden=true;get('start').disabled=false;get('start').dataset.state='default';get('loadStatus').textContent='第一轮敌方行动将展开领域，选择你的应对。';
  get('numbers').replaceChildren();get('callout').replaceChildren();get('battleLog').replaceChildren();makeCards();render();sync();
 }
 function makeCards(){
  get('allies').replaceChildren();get('enemies').replaceChildren();
  engine.units.forEach((u,i)=>{const c=document.createElement(u.side==='enemy'?'button':'div');c.className='fighter'+(u.side==='enemy'?' enemy selected':'');c.dataset.index=i;c.innerHTML='<div class="name"><strong></strong><span class="value"></span></div><div class="track"><div class="fill hp"></div></div><div class="track cp"><div class="fill"></div></div><span class="state"></span>';if(u.side==='enemy')c.onclick=()=>{if(loaded&&!busy)send({type:'target',index:i});};get(u.side==='enemy'?'enemies':'allies').append(c);});
 }
 function sync(){
  document.body.classList.toggle('reduced-motion',get('reduced').checked);document.body.classList.toggle('reduce-motion',get('reduced').checked);if(!engine||!catalog)return;
  for(let i=views.length;i<engine.units.length;i++)views.push({hp:engine.units[i].hp,cp:engine.units[i].cp});
  const domains=DomainEffects.stageFields(shown,engine.units,asset);
  send({type:'state',rosterKey:rosterKey(),active:!document.hidden&&(Cinema.el.hidden||Cinema.el.classList.contains('domain-realtime')),quality:'fine',reduced:get('reduced').checked,presentation:'domain-duel',target:1,surfaceAtlas:asset(catalog.surfaceAtlas),environment:{key:scenario.environment,painted:true,url:asset(BattleScenes.background(scenario.environment))},domains,domainContested:shown.length>1,domainEntities:SummonPresentation.domainEntities(catalog,shown).map(x=>({...x,url:asset(x.file),maskURL:asset(x.maskFile)})),victorySide:!busy&&engine.ended?(engine.result==='win'?'ally':'enemy'):'',roster:engine.units.map((u,index)=>{const sprite=art(u),tool=catalog.playerWeapons?.[u.equipmentId];return {index,name:u.name,side:u.side,isPlayer:!!u.isPlayer,alive:views[index].hp>0,guarding:!!u.buff.defend,height:sprite.height,url:asset(sprite.file),maskURL:sprite.maskFile?asset(sprite.maskFile):'',weaponURL:tool?asset(tool.file):'',battleSprite:sprite};}).filter(u=>keep(engine.units[u.index],u.index))});
 }
 function description(id){
  const u=engine.player,f=DomainCombat.active(engine,u);
  if(id==='guard')return '本次受伤减半，恢复8%最大咒力。'+(f?'领域稳定度恢复最多15；仍结算自身行动维持消耗。':'防御持续至下次自身行动。');
  if(id==='domain')return '展开「'+u.domainName+'」需 '+DomainCombat.cost(u)+' 咒力；每次自身行动维持 '+DomainCombat.upkeep(u,f)+' 咒力。'+BattleTraits.info(u.domainName).text;
  if(id==='skill')return player.technique.name+'：'+engCost()+' 咒力。'+(BattleTraits.techniqueNotes[u.flag]||'命中施术者会削弱其领域稳定度。');
  return (Equipment.find(u.equipmentId)?.name||'体术')+'：命中施术者后削弱领域稳定度。当前黑闪机会 '+Math.round(BattleResonance.flashChance(engine,u,'melee')*100)+'%（控制 / 连击 / 心流影响）。';
 }
 const engCost=()=>engine.techCost(engine.player);
 function render(message){
  if(!engine)return;
  if(document.querySelectorAll('.fighter').length!==engine.units.length)makeCards();
  const locked=busy||advancing||accepting,can=loaded&&!locked&&engine.awaitingPlayer&&!engine.ended&&!engine.pendingDomain;
  get('round').textContent='行动 '+engine.actionsTotal;get('order').replaceChildren();
  for(const unit of engine.previewOrder(5,engine.awaitingPlayer?engine.player:null)){const n=document.createElement('span');n.textContent=unit.isPlayer?'你':unit.name.includes('宿傩')?'宿傩':unit.name.slice(0,2);if(unit===engine.lastActor)n.className='active';get('order').append(n);}
  engine.units.forEach((u,i)=>{const card=document.querySelector('.fighter[data-index="'+i+'"]'),v=views[i]||u;card.querySelector('strong').textContent=u.name;card.querySelector('.value').textContent=Math.max(0,Math.round(v.hp))+' / '+u.maxHp;card.querySelector('.hp').style.transform='scaleX('+Math.max(0,v.hp)/u.maxHp+')';card.querySelector('.cp .fill').style.transform='scaleX('+u.cp/u.maxCp+')';card.querySelector('.state').textContent=v.hp<=0?'已退场':'CP '+Math.round(u.cp)+' / '+u.maxCp+(u.buff.defend?' · 防御':'')+(BattleTraits.status(engine,u).length?' · '+BattleTraits.status(engine,u).join(' / '):'');card.classList.toggle('fallen',v.hp<=0);});
  get('domainLedger').innerHTML=[...shown].sort((a,b)=>(a.side==='ally'?0:1)-(b.side==='ally'?0:1)).map(f=>`<article class="duel-domain ${f.side}"><small>${f.side==='ally'?'我方':'敌方'} · ${HD.escape(f.actorName)}</small><strong>${HD.escape(f.name)}</strong><meter min="0" max="100" value="${f.stability}" aria-label="${HD.escape(f.name)}稳定度"></meter><span>稳定 ${Math.ceil(f.stability)}% · ${HD.escape(BattleResonance.fieldText(engine,f,shown.length>1))}</span><small>${HD.escape(BattleTraits.info(f.traitName).tag)} · 维持 ${DomainCombat.upkeep(engine.units[f.owner],f)} CP</small></article>`).join('')+(shown.length>1?'<p class="duel-clash-note">必中抵消 · 进攻 / 黑闪争取优势 · 防御稳固结界</p>':'');
  const options=BattleResonance.buttons(engine,engine.player,can);if(get('barrierOptions').innerHTML!==options)get('barrierOptions').innerHTML=options;
  get('attack').disabled=!can;get('skill').disabled=!can||engine.player.cp<engCost()||!!BattleTraits.blocked(engine,engine.player,'tech');get('domain').disabled=!can||!DomainCombat.ready(engine,engine.player);get('guard').disabled=!can;
  get('skill').querySelector('strong').textContent=player.technique.name;get('skill').querySelector('small').textContent=engCost()+' 咒力';get('domain').querySelector('small').textContent=DomainCombat.active(engine,engine.player)?'领域维持中':engine.player.domainCd>0?'术式熔断中':DomainCombat.cost(engine.player)+' 咒力';
  const pending=engine.pendingDomain;get('reaction').hidden=!pending||busy;get('commands').hidden=!!pending;
  get('counter').disabled=locked||!pending||!DomainCombat.ready(engine,engine.player);get('accept').disabled=locked||!pending;
  if(pending){const enemy=engine.units[pending.owner],forecast=DomainCombat.forecast(engine,engine.player,enemy);get('reactionName').textContent=enemy.name+' · '+enemy.domainName;get('reactionTrait').textContent=BattleTraits.info(enemy.domainName).text;get('forecast').textContent=forecast.text+'。消耗 '+forecast.cost+' CP，余量 '+forecast.cpAfter+'；每次维持 '+forecast.upkeep+' CP。';}
  get('actor').textContent=engine.ended?'战斗结束':pending?'领域来袭':engine.awaitingPlayer?'你的行动':'对手行动';get('status').textContent=message||(loaded?(busy?'行动演出中…':engine.ended?'本次演练已结束':pending?'选择迎击或保留领域':engine.awaitingPlayer?'选择战斗指令':'等待对手行动'):'准备进入战斗');get('description').textContent=description(hover);
  get('tactic').textContent=!loaded?'敌方准备展开领域。可迎击抵消必中，也可保留咒力。':engine.pendingDomain?'迎击会消耗咒力并开始维持结界；保留领域可等待自己的行动再展开。':shown.length>1?'对攻期间持续消耗咒力。进攻削弱结界，黑闪与连击推动空间边界；面对开放领域，可调整结界条件。':shown.length?shown[0].side==='enemy'?'对方独占战场。领域破裂后进入术式熔断，用体术或防御等待恢复。':shown[0].incomplete?'影域没有必中，利用术式和式神增幅进攻。':'我方领域维持，继续进攻并留意咒力。':'双方领域消失才恢复原场景。熔断期间用体术与防御，恢复后可再次展开。';
  for(const id of configuration)get(id).disabled=locked||!!pending;get('randomize').disabled=locked||!!pending;get('reset').disabled=!loaded||locked;get('reduced').disabled=locked;get('result').hidden=!engine.ended||busy;
  if(engine.ended&&!busy){get('result').dataset.state=engine.result==='win'?'success':'error';get('resultKicker').textContent=engine.result==='win'?'演练胜利':'本次撤退';get('resultTitle').textContent=engine.result==='win'?'你的选择，打开了胜机':'换一种应对，再试一次';get('resultRewards').replaceChildren();for(const text of [stats.counter?'完成领域迎击':null,stats.contested?'抵消敌方必中':null,stats.breaks?'击破敌方领域':null,stats.fortify?'稳固结界 '+stats.fortify+' 次':null,'造成伤害 '+Math.round(stats.damage)].filter(Boolean)){const n=document.createElement('span');n.textContent=text;get('resultRewards').append(n);}}
 }
 function event(e){
  if(e.domainSnapshot)shown=e.domainSnapshot;
  const i=Number.isInteger(e.toIndex)?e.toIndex:engine.units.findIndex(u=>u.name===(e.to||e.actorName));
  if(e.dmg&&i>=0){views[i].hp=Math.max(0,views[i].hp-e.dmg);if(engine.units[Number.isInteger(e.fromIndex)?e.fromIndex:engine.units.findIndex(u=>u.name===e.from)]?.side==='ally')stats.damage+=e.dmg;const p=points.find(p=>p.index===i)||{x:.5,y:.5},n=document.createElement('span');n.className='damage';n.textContent=e.dmg;n.style.left=p.x*100+'%';n.style.top=Math.max(.12,p.y-.08)*100+'%';get('numbers').append(n);setTimeout(()=>n.remove(),950);}
  if(e.heal){const who=engine.units.findIndex(u=>u.name===(e.from||'你'));if(who>=0)views[who].hp=Math.min(engine.units[who].maxHp,views[who].hp+e.heal);}
  if(e.domainPhase==='engage'&&e.outcome==='contested')stats.contested=true;
  if(e.domainPhase==='fortify')stats.fortify++;
  if(e.type==='domain_end'&&e.side==='enemy'&&/重创|破裂|失守/.test(e.reason))stats.breaks++;
  if(e.text){log.push(e.text);log=log.slice(-50);const n=document.createElement('li');n.textContent=e.text;get('battleLog').append(n);while(get('battleLog').children.length>50)get('battleLog').firstChild.remove();}
  render(e.text);sync();
 }
 async function animate(e){
  const from=Number.isInteger(e.fromIndex)?e.fromIndex:engine.units.findIndex(u=>u.name===e.from),to=Number.isInteger(e.toIndex)?e.toIndex:engine.units.findIndex(u=>u.name===e.to);
  if(!e.dmg||from<0||to<0||from===to||!['melee','tech'].includes(e.attackKind)||/附加|持续|灼烧|中毒/.test(e.text||'')){event(e);return;}
  const u=engine.units[from],sprite=art(u),packet=u.isPlayer?PlayerPresentation.action({...u,battleSprite:sprite},e):SummonPresentation.action(sprite,e)||{kind:e.attackKind==='melee'?'melee':CombatPresentation.techniques[u.flag]?.kind||'orb',variant:u.flag};
  await new Promise(resolve=>{const id=++serial;waiter={id,e,sound:packet.kind,resolve,impacted:false};actionTimer=setTimeout(()=>{if(waiter?.id===id){if(!waiter.impacted)event(e);waiter=null;resolve();}},3500);send({type:'event',eventType:'choreography',presentationOnly:true,id,fromIndex:from,toIndex:to,actionKind:packet.kind,variant:e.type==='flash'?'blackflash':packet.variant});});
 }
 async function batch(packet){
  busy=true;for(let i=views.length;i<engine.units.length;i++)views.push({hp:engine.units[i].hp,cp:engine.units[i].cp});render();sync();
  for(const e of packet.events){if(failed)break;if(e.type==='domain_request'){event(e);continue;}
   if(e.type==='domain'){event(e);await DomainRealtime.play({event:e,host:document.querySelector('.arena'),send,units:engine.units,catalog,onDone:sync});send({type:'pause',value:document.hidden});sync();}
   else if(e.domainPhase==='engage'||e.type==='domain_end'){event(e);await DomainEffects.burst(document.querySelector('.arena'),e,{units:engine.units,duration:e.type==='domain_end'?850:650});}
   else await animate(e);
  }
  views=engine.units.map(u=>({hp:u.alive?u.hp:0,cp:u.cp}));busy=false;render();sync();
 }
 async function advance(){
  if(advancing)return;advancing=true;const run=epoch;
  try{while(run===epoch&&loaded&&!failed&&!engine.ended&&!engine.awaitingPlayer&&!engine.pendingDomain&&!document.hidden){await batch(engine.advance());if(engine.pendingDomain||engine.awaitingPlayer)break;await new Promise(r=>setTimeout(r,100));}}
  finally{advancing=false;render();sync();}
 }
 async function act(action){if(!loaded||busy||advancing||accepting||!engine.awaitingPlayer||engine.pendingDomain)return;accepting=true;try{await audio.unlock();await batch(engine.playerAct(action,1));await advance();}finally{accepting=false;render();}}
 async function react(counter){if(busy||advancing||accepting||!engine.pendingDomain)return;accepting=true;const id=engine.pendingDomain.id;stats.counter=counter;get('reaction').hidden=true;render();try{await audio.unlock();const packet=engine.resolveDomain(id,counter);if(packet)await batch(packet);await advance();}finally{accepting=false;render();sync();}}
 get('barrierOptions').addEventListener('click',e=>{const button=e.target.closest('[data-barrier]');if(button&&!button.disabled)act('barrier_'+button.dataset.barrier);});
 function fail(message){failed=true;loaded=false;busy=false;clearTimeout(bootTimer);clearTimeout(actionTimer);Cinema.hide();audio.stop();if(waiter){waiter.resolve();waiter=null;}get('entry').hidden=false;get('loadStatus').textContent=message;get('loadStatus').dataset.state='error';get('start').dataset.state='error';get('start').disabled=false;render(message);}
 async function boot(){
  if(busy||advancing||accepting)return;requested=true;failed=false;get('start').disabled=true;get('start').dataset.state='loading';get('loadStatus').textContent='载入角色动作与战场…';
  try{await audio.unlock();catalog ||= await fetch('battle-sprites.json').then(r=>{if(!r.ok)throw Error('角色图集载入失败');return r.json();});
   DomainEffects.playerPortrait=()=>{const sprite=art(engine.player),file=sprite.poseFiles?.[sprite.poses.cast]||sprite.posterFile;return file?`<img src="assets/${HD.escape(file)}" alt="你的领域展开" style="width:100%;height:100%;object-fit:contain">`:'';};
   if(frame&&ready){sync();return;}frame=document.createElement('iframe');frame.title='领域对攻 HD2D 战斗舞台';frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.src='godot/embed.html';get('mount').replaceChildren(frame);bootTimer=setTimeout(()=>fail('舞台载入超时，请重试。'),60000);
  }catch(e){fail(e.message);}
 }
 window.addEventListener('message',e=>{
  if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.channel!=='jjk-battle')return;const d=e.data;
  if(d.type==='error'||d.type==='asset-error'){console.error(d.message);fail('舞台资源载入失败，请重试。');return;}
  if(d.type==='ready'){if(failed)return;ready=true;sync();return;}if(d.rosterKey!==rosterKey())return;
  if(d.type==='state'){const host=document.querySelector('.arena');host.dataset.seam=d.domainSeam;host.dataset.themes=JSON.stringify(d.domainThemes||[]);points=d.points||[];if(requested&&!loaded&&d.backgroundReady&&d.loaded===d.actors){clearTimeout(bootTimer);loaded=true;get('entry').hidden=true;render();advance();}return;}
  if(!waiter||waiter.id!==d.id)return;
  if(d.type==='melee-phase'&&['windup','approach'].includes(d.phase))audio.play(waiter.sound,d.phase);
  if(d.type==='melee-impact'&&!waiter.impacted){waiter.impacted=true;event(waiter.e);audio.play(waiter.sound,'impact');}
  if(d.type==='melee-complete'||d.type==='melee-rejected'){clearTimeout(actionTimer);if(!waiter.impacted)event(waiter.e);const done=waiter.resolve;waiter=null;done();}
 });
 const again=()=>{prepare();boot();};get('start').onclick=boot;get('again').onclick=again;get('reset').onclick=again;
 for(const id of configuration)get(id).onchange=prepare;get('randomize').onclick=()=>{get('profile').value=CombatPresentation.profiles[Math.floor(Math.random()*CombatPresentation.profiles.length)].key;prepare();};
 for(const [id,command] of [['attack','melee'],['skill','tech'],['domain','domain'],['guard','defend']]){get(id).onclick=()=>act(command);for(const ev of ['mouseenter','focus'])get(id).addEventListener(ev,()=>{hover=id;get('description').textContent=description(id);});}
 get('counter').onclick=()=>react(true);get('accept').onclick=()=>react(false);
 get('sound').onclick=()=>{audio.setEnabled(!audio.enabled);SFX.setMuted(!audio.enabled);get('sound').textContent='音效 · '+(audio.enabled?'开':'关');get('sound').setAttribute('aria-pressed',String(audio.enabled));};get('voice').onchange=e=>SFX.setVoice(e.target.checked);get('reduced').onchange=sync;
 document.addEventListener('visibilitychange',()=>{send({type:'pause',value:document.hidden});if(document.hidden){audio.stop();Cinema.hide();}else if(loaded&&!busy)advance();});
 window.addEventListener('pagehide',()=>{clearTimeout(bootTimer);clearTimeout(actionTimer);Cinema.hide();audio.stop();document.querySelectorAll('.domain-impact-film,.realtime-clash').forEach(n=>n.cancel?.());if(waiter){waiter.resolve();waiter=null;}});
 window.DomainDuel={get engine(){return engine;},get stats(){return {...stats};},get shown(){return shown;},get loaded(){return loaded;}};
 prepare();
})();
