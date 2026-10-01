(() => {
 'use strict';
 const $=id=>document.getElementById(id),audio=new CombatAudio();audio.volume=.45;
 let model=new SampleBattle(),catalog,frame,ready=false,loaded=false,loadFailed=false,selected=2,epoch=0,points=[],timer=0,loadTimer=0,waitingEnemy=false,hoverCommand='attack',impactTimer=0;
 const rosterKey=()=>`canon-sample-${epoch}`;
 const send=payload=>{if(ready)frame.contentWindow.postMessage({channel:'jjk-battle',payload},location.origin);};
 $('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function snapshot(){return {type:'state',rosterKey:rosterKey(),active:!document.hidden,quality:'fine',reduced:$('reduced').checked,meleePrototype:true,formation:'duo-duo',presentation:'canon-sample',target:selected,environment:{key:'bridge',painted:true,url:new URL('assets/scenes/v1/bridge-night.png',location.href).href},surfaceAtlas:new URL('assets/'+catalog.surfaceAtlas,location.href).href,domains:[],roster:model.units.map((u,index)=>{const sprite=catalog.actors[u.key];return {index,name:u.name,side:index>=2?'enemy':'ally',alive:u.hp>0,guarding:model.guard.has(index),height:sprite.height,url:new URL('assets/'+sprite.file,location.href).href,battleSprite:sprite};})};}
 function sync(){document.body.classList.toggle('reduce-motion',$('reduced').checked);if(catalog)send(snapshot());}
 function description(command){
  if(command==='guard')return '本次行动防御：减少 60% 来袭伤害，挡住新的沾血；钉崎恢复 12 咒力。';
  if(model.turn===0)return command==='skill'?'消耗两层专注，近身黑闪造成 96 伤害。':'贴身直拳造成 48 伤害，命中积累一层专注。';
  if(model.turn===1)return command==='skill'?'消耗 14 咒力，借沾血联系反击：目标 72，另一兄弟 32；中断蚀烂并削弱下一次敌方行动。':'消耗 6 咒力，远程敲出铁钉造成 40 伤害。';
  return '留意敌方预告；攻击将在命中动作发生时结算。';
 }
 function choose(index){if(!loaded||model.pending||model.done||model.turn>=2||model.units[index]?.hp<=0)return;selected=index;sync();ui();}
 function makeCards(){
  for(let i=0;i<4;i++){const n=document.createElement(i>=2?'button':'div');n.className='fighter'+(i>=2?' enemy':'');n.dataset.index=i;
   n.innerHTML='<div class="name"><strong></strong><span class="value"></span></div><div class="track"><div class="fill echo"></div><div class="fill hp"></div></div><div class="track cp"><div class="fill"></div></div><span class="state"></span>';
   if(i>=2){n.onclick=()=>choose(i);n.setAttribute('aria-label','选择'+model.units[i].name);n.setAttribute('aria-pressed','false');}
   $(i<2?'allies':'enemies').append(n);
  }
  for(let i=2;i<4;i++){const b=document.createElement('button');b.id='target-'+i;b.className='target-hit';b.setAttribute('aria-label','战场选择'+model.units[i].name);b.innerHTML='<b>⌄</b>';b.onclick=()=>choose(i);$('targets').append(b);}
 }
 function ui(message){
  if(model.units[selected]?.hp<=0)selected=model.living('enemy')[0]??-1;
  $('round').textContent='第 '+model.round+' 回合';$('order').replaceChildren();
  model.units.forEach((u,i)=>{const n=document.createElement('span');n.textContent=['虎杖','钉崎','坏相','血涂'][i];n.className=(i===model.turn?'active ':'')+(u.hp<=0?'fallen':'');$('order').append(n);
   const c=document.querySelector('.fighter[data-index="'+i+'"]');c.classList.toggle('fallen',u.hp<=0);c.classList.toggle('current',i===model.turn&&!model.done);c.classList.toggle('selected',i===selected);
   c.querySelector('strong').textContent=u.name;c.querySelector('.value').textContent=u.hp+' / '+u.max;for(const f of c.querySelectorAll('.track:not(.cp) .fill'))f.style.transform='scaleX('+u.hp/u.max+')';
   c.querySelector('.cp').hidden=!u.maxCp;c.querySelector('.cp .fill').style.transform='scaleX('+(u.maxCp?u.cp/u.maxCp:0)+')';
   c.querySelector('.state').textContent=u.hp<=0?'已退场':model.guard.has(i)?'防御中':i===0?'专注 '+'◆'.repeat(u.focus)+'◇'.repeat(3-u.focus)+(model.corrosion[0].size?' · 蚀烂':''):i===1?'咒力 '+u.cp+' / 40'+(model.corrosion[1].size?' · 蚀烂':''):model.disrupted.has(i)?'术式受扰':'九相图兄弟';
   if(i>=2){c.disabled=!loaded||!!model.pending||!!model.done||model.turn>=2||u.hp<=0;c.setAttribute('aria-pressed',String(i===selected));}
  });
  const can=loaded&&!model.pending&&!model.done&&model.turn<2;
  $('attack').disabled=!can||(model.turn===1&&model.units[1].cp<6);$('skill').disabled=!can||!!model.skillReason();$('guard').disabled=!can;$('reset').disabled=!loaded;$('reduced').disabled=!!model.pending;
  const nail=model.turn===1;
  $('attack').querySelector('strong').textContent=nail?'锤钉':'直拳';$('attack').querySelector('small').textContent=nail?'6 咒力':'积累专注';
  $('skill').querySelector('strong').textContent=nail?'共鸣':'黑闪';$('skill').querySelector('small').textContent=nail?(model.linked?'14 咒力 · 反制':'沾血后解锁'):(model.units[0].focus>=2?'消耗 2 专注':'需要 2 专注');
  $('skill').title=model.skillReason();$('skill').classList.toggle('charged',can&&!model.skillReason());$('actor').textContent=model.done==='victory'?'祓除完成':model.done==='defeat'?'挑战结束':model.units[model.turn].name;
  $('selectedName').textContent=model.units[selected]?.name||'—';$('description').textContent=description(hoverCommand);
  $('intent').replaceChildren();for(const i of model.living('enemy')){const p=model.intent(i),n=document.createElement('div');n.className='intent-row';const a=document.createElement('span'),b=document.createElement('b');a.textContent=model.units[i].name+' · '+p.label;b.textContent='→ '+model.units[p.to]?.name;n.append(a,b);$('intent').append(n);}
  for(let i=2;i<4;i++){const b=$('target-'+i);b.hidden=!can||model.units[i].hp<=0;b.setAttribute('aria-pressed',String(selected===i));b.querySelector('b').hidden=selected!==i;}
  if(message)$('status').textContent=message;else $('status').textContent=model.done?'战斗结束':model.pending?model.units[model.pending.from].name+' · '+model.pending.label:model.turn>=2?'对手准备行动…':model.linked?'沾血联系已建立，可用共鸣反制':'点选右侧敌人，下达指令';
  $('result').hidden=!model.done;
  if(model.done){$('resultKicker').textContent=model.done==='victory'?'任务完成':'任务失败';$('resultTitle').textContent=model.done==='victory'?'联合祓除成功':'暂时撤退';$('resultText').textContent=model.done==='victory'?'两名九相图已倒下。再试一次不同的配合。':'队员已失去战斗能力。尝试防御血羽，再用共鸣打断蚀烂。';}
 }
 function popup(result,move){const p=points.find(p=>p.index===result.index)||{x:result.index>=2?.72:.25,y:.5};const n=document.createElement('span');n.className='damage'+(result.guarded?' guard':'')+(result.status?' dot':'')+(move?.variant==='blackflash'?' heavy':'')+(move?.variant==='resonance'?' resonance':'');n.textContent=(result.status?result.status+' ':result.guarded?'格挡 ':'')+result.amount;n.style.left=Math.max(.06,Math.min(.94,p.x))*100+'%';n.style.top=Math.max(.15,p.y-.08)*100+'%';$('numbers').append(n);setTimeout(()=>n.remove(),950);
  const c=document.querySelector('.fighter[data-index="'+result.index+'"]');c.classList.remove('hit');void c.offsetWidth;c.classList.add('hit');setTimeout(()=>c.classList.remove('hit'),350);
 }
 function announce(p){if(!['blackflash','resonance','blood'].includes(p.variant))return;const n=document.createElement('span');n.className='skill-title'+(p.variant==='blackflash'?' blackflash':'');n.textContent=p.label;$('callout').replaceChildren(n);setTimeout(()=>n.remove(),1100);}
 function impact(move){if($('reduced').checked)return;clearTimeout(impactTimer);const n=$('impact'),p=points.find(p=>p.index===move.to)||{x:.5,y:.5};n.style.setProperty('--hit-x',p.x*100+'%');n.style.setProperty('--hit-y',p.y*100+'%');n.className='';void n.offsetWidth;n.className=move.variant==='blackflash'?'heavy-hit':move.variant==='blood'||move.variant==='resonance'?'curse-hit':'physical-hit';impactTimer=setTimeout(()=>{n.className='';impactTimer=0;},300);}
 function finish(id){if(!model.finish(id))return;model.lastTicks.forEach(h=>popup(h));ui();sync();if(model.turn>=2&&!model.done){waitingEnemy=true;timer=setTimeout(runEnemy,180);}}
 function runEnemy(){timer=0;if(!waitingEnemy||document.hidden||!loaded)return;waitingEnemy=false;act('attack');}
 function soundKind(p){return p.variant==='blackflash'?'blackflash':p.variant==='resonance'?'resonance':p.kind;}
 function act(command){if(!loaded)return;const p=model.begin(command,selected);if(!p)return;audio.stop();ui();announce(p);
  if(p.kind==='guard'){sync();timer=setTimeout(()=>{timer=0;finish(p.id);},240);return;}
  send({type:'event',eventType:'melee',id:p.id,fromIndex:p.from,toIndex:p.to,actionKind:p.kind,variant:p.variant});
 }
 function fail(message){clearTimeout(timer);clearTimeout(loadTimer);clearTimeout(impactTimer);$('impact').className='';waitingEnemy=false;loaded=false;ready=false;loadFailed=true;audio.stop();$('entry').hidden=false;$('entryTitle').textContent='载入未完成';$('loadStatus').textContent=message;$('start').disabled=false;$('start').textContent='重试载入';ui(message);}
 async function boot(){
  epoch++;ready=false;loaded=false;loadFailed=false;$('start').disabled=true;$('loadStatus').textContent='正在载入战场和本地音效…';
  try{await audio.unlock();catalog ||= await fetch('battle-sprites.json').then(r=>{if(!r.ok)throw Error('图集读取失败');return r.json();});
   configureAudio();frame=document.createElement('iframe');frame.title='八十八桥战斗舞台';frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.src='godot/embed.html';$('mount').replaceChildren(frame);loadTimer=setTimeout(()=>fail('载入超时，请重试。'),60000);
  }catch(e){fail(e.message);}
 }
 function configureAudio(){if(!audio.catalog?.jrpgCues)return;const cues=audio.catalog.jrpgCues;
  const fist=cues.melee.impact[0],shock=cues.orb.impact.find(l=>l.clip==='flare-powers-shock'),quake=cues.heavy.impact.find(l=>l.clip==='flare-powers-quake');
  cues.blackflash={windup:[],approach:cues.heavy.approach,impact:[{...fist,duration:.19},{...shock,gain:.26,delay:.025,duration:.32,release:.19,lowpass:4800},{...quake,gain:.13,delay:.025,duration:.22,release:.16}]};
  cues.resonance={windup:[],approach:cues.nail.approach,impact:[{...cues.nail.impact[0],gain:.32,duration:.14},{...shock,gain:.25,delay:.03,duration:.36,release:.22,lowpass:5800}]};
 }
 window.addEventListener('message',e=>{
  if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='jjk-battle')return;const d=e.data;
  if(d.type==='ready'){if(loadFailed)return;ready=true;sync();return;}
  if(d.type==='error'||d.type==='asset-error'){console.error('Battle stage',JSON.stringify(d));fail('资源未能载入：'+String(d.message||d.file||'请重试'));return;}
  if(d.type==='progress'&&d.total){$('loadStatus').textContent='载入战场 '+Math.round(d.done/d.total*100)+'%';return;}
  if(d.rosterKey!==rosterKey())return;
  if(d.type==='state'){
   if(!ready)return;
   points=d.points||[];for(let i=2;i<4;i++){const p=points.find(p=>p.index===i);if(p?.bounds){const b=p.bounds;Object.assign($('target-'+i).style,{left:Math.max(0,b.left)*100+'%',top:Math.max(0,b.top)*100+'%',width:Math.max(.06,b.right-b.left)*100+'%',height:Math.max(.10,b.bottom-b.top)*100+'%'});}}
   if(d.loaded===4&&d.backgroundReady&&!loaded){loaded=true;clearTimeout(loadTimer);$('entry').hidden=true;ui(audio.failed.length?'部分音效未载入，画面可正常游玩':undefined);}return;
  }
  const p=model.pending;if(!p||p.id!==d.id)return;const pan=Math.max(-.18,Math.min(.18,((points.find(point=>point.index===p.to)?.x||.5)-.5)*.5));
  if(d.type==='melee-phase'){if(['windup','approach'].includes(d.phase))audio.play(soundKind(p),d.phase,pan);}
  if(d.type==='melee-impact'){const hits=model.impact(d.id);if(hits){hits.forEach(h=>popup(h,p));impact(p);for(const h of hits.slice(1))send({type:'event',eventType:'linked-hit',targetIndex:h.index});audio.play(soundKind(p),'impact',pan);ui(model.units[p.from].name+' · '+p.label+'命中');}}
  if(d.type==='melee-complete')finish(d.id);
  if(d.type==='melee-rejected')fail('动作未能开始，请重新载入战斗。');
 });
 function reset(){clearTimeout(timer);clearTimeout(impactTimer);$('impact').className='';waitingEnemy=false;audio.stop();epoch++;model=new SampleBattle();selected=2;hoverCommand='attack';$('numbers').replaceChildren();$('callout').replaceChildren();ui();sync();}
 makeCards();$('start').onclick=boot;$('attack').onclick=()=>act('attack');$('skill').onclick=()=>act('skill');$('guard').onclick=()=>act('guard');$('reset').onclick=reset;$('again').onclick=reset;
 $('sound').onclick=()=>{audio.setEnabled(!audio.enabled);$('sound').textContent='音效 · '+(audio.enabled?'开':'关');$('sound').setAttribute('aria-pressed',String(audio.enabled));if(audio.enabled)audio.unlock();};
 $('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);$('reduced').onchange=sync;
 for(const key of ['attack','skill','guard'])for(const type of ['mouseenter','focus'])$(key).addEventListener(type,()=>{hoverCommand=key;$('description').textContent=description(key);});
 document.addEventListener('keydown',e=>{if(e.repeat||e.target.matches('input,summary')||!loaded)return;const commands={'Enter':'attack',' ':'attack','s':'skill','S':'skill','d':'guard','D':'guard'};
  if(e.key==='1'||e.key==='2'){choose(e.key==='1'?2:3);e.preventDefault();}else if(commands[e.key]&&e.target===document.body){e.preventDefault();act(commands[e.key]);}
 });
 document.addEventListener('visibilitychange',()=>{send({type:'pause',value:document.hidden});if(document.hidden)audio.stop();else if(waitingEnemy)runEnemy();});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(loadTimer);clearTimeout(impactTimer);audio.stop();});ui();
})();
