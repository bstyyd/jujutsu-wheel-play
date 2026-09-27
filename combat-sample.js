(() => {
 'use strict';
 const $=id=>document.getElementById(id),audio=new CombatAudio();audio.volume=.45;
 let model=new SampleBattle(),catalog,frame,ready=false,loaded=false,selected=false,epoch=0,points=[],timer=0,loadTimer=0,waitingEnemy=false;
 const rosterKey=()=>`sample-${epoch}`;
 const send=payload=>{if(ready)frame.contentWindow.postMessage({channel:'jjk-battle',payload},location.origin);};
 $('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function snapshot(){return {type:'state',rosterKey:rosterKey(),active:!document.hidden,quality:'fine',reduced:$('reduced').checked,meleePrototype:true,formation:'duo',target:selected?2:-1,environment:{key:'abandoned',url:''},surfaceAtlas:new URL('assets/'+catalog.surfaceAtlas,location.href).href,domains:[],roster:['yuji-melee','nobara','curse'].map((key,index)=>{const sprite={...catalog.actors[key],...(key==='nobara'?{actionProfile:'nobara-nail'}:{})};return {index,name:model.units[index].name,side:index===2?'enemy':'ally',alive:model.units[index].hp>0,guarding:model.guard.has(index),height:sprite.height,url:new URL('assets/'+sprite.file,location.href).href,battleSprite:sprite};})};}
 function sync(){if(catalog)send(snapshot());}
 function describe(){const index=model.turn;return index===0?'不消耗咒力 · 接近目标，以直拳造成 42 点伤害。':'消耗 10 咒力 · 敲出钉子，命中后共鸣，造成 34 点伤害。';}
 function ui(message){
  $('order').replaceChildren();for(let i=0;i<3;i++){const n=document.createElement('span');n.textContent=(i===model.turn?'◆ ':'')+model.units[i].name;n.className=i===model.turn?'active':'';$('order').append(n);}
  if(!$('fighters').children.length)for(let i=0;i<3;i++){const n=document.createElement('div');n.className='fighter'+(i===2?' enemy':'');n.innerHTML=`<div class="name"><strong></strong><small></small></div><div class="track"><div class="trail"></div><div class="fill"></div></div><div class="track cp"><div class="fill"></div></div>`;$('fighters').append(n);}
  for(let i=0;i<3;i++){const n=$('fighters').children[i],u=model.units[i];n.classList.toggle('fallen',u.hp<=0);n.querySelector('strong').textContent=u.name;n.querySelector('small').textContent=`${u.hp} / ${u.max}`+(u.maxCp?` · 咒力 ${u.cp}`:'')+(model.guard.has(i)?' · 防御':'');n.querySelector('.track>.fill').style.transform=`scaleX(${u.hp/u.max})`;n.querySelector('.trail').style.transform=`scaleX(${u.hp/u.max})`;n.querySelector('.cp').hidden=!u.maxCp;n.querySelector('.cp .fill').style.transform=`scaleX(${u.maxCp?u.cp/u.maxCp:0})`;}
  const can=loaded&&!model.pending&&!model.done&&model.turn!==2;
  $('attack').disabled=!can||!selected||(model.turn===1&&model.units[1].cp<10);$('guard').disabled=!can;$('reset').disabled=!loaded;$('reduced').disabled=!!model.pending;
  $('attack').textContent=model.turn===1?'锤钉 · 共鸣  /  10 咒力':'体术 · 直拳';$('actor').textContent=model.done==='victory'?'祓除完成':model.done==='defeat'?'挑战结束':`第 ${model.round} 回合 · ${model.units[model.turn].name}`;
  $('intent').textContent=model.done?'战斗结束':`敌方意图 · 重击${model.units[model.enemyTarget()].name} · 34 伤害`;
  $('target').hidden=!loaded||!!model.pending||!!model.done||model.turn===2;$('target').setAttribute('aria-pressed',String(selected));
  $('description').textContent=describe();
  if(message)$('status').textContent=message;else if(model.done)$('status').textContent=model.done==='victory'?'配合祓除成功，可以重新挑战。':'两名队员均已倒下，可以重新挑战。';else if(!model.pending)$('status').textContent=model.turn===2?'对手准备反击…':selected?'选择攻击或防御':'点击咒灵选择目标';
 }
 function popup(result){const p=points.find(p=>p.index===result.index)||{x:result.index===2?.76:.25,y:.45};const n=document.createElement('span');n.className='damage'+(result.guarded?' guard':'');n.textContent=(result.guarded?'格挡 ':'')+result.amount;n.style.left=`${p.x*100}%`;n.style.top=`${p.y*100-8}%`;$('numbers').append(n);setTimeout(()=>n.remove(),900);}
 function finish(id){if(!model.finish(id))return;sync();ui();if(model.turn===2&&!model.done){waitingEnemy=true;timer=setTimeout(runEnemy,420);}}
 function runEnemy(){timer=0;if(!waitingEnemy||document.hidden||!loaded)return;waitingEnemy=false;act('attack');}
 function act(command){if(!loaded||model.turn!==2&&command==='attack'&&!selected)return;const p=model.begin(command);if(!p)return;audio.stop();ui(p.kind==='guard'?model.units[p.from].name+' · 防御架势':model.units[p.from].name+' · 蓄势');
  if(p.kind==='guard'){sync();timer=setTimeout(()=>{timer=0;finish(p.id);},420);return;}
  send({type:'event',eventType:'melee',id:p.id,fromIndex:p.from,toIndex:p.to,actionKind:p.kind,variant:p.kind==='nail'?'straw':''});
 }
 function fail(message){clearTimeout(timer);clearTimeout(loadTimer);waitingEnemy=false;ready=false;loaded=false;frame?.remove();frame=null;model=new SampleBattle();epoch++;$('entry').hidden=false;$('entryTitle').textContent='舞台未能载入';$('loadStatus').textContent=message;$('start').disabled=false;$('start').textContent='重新载入';ui();}
 async function boot(){
  $('start').disabled=true;$('loadStatus').textContent='正在载入舞台与本地音效…';
  try{await audio.unlock();catalog ||= await fetch('battle-sprites.json').then(r=>{if(!r.ok)throw Error('图集读取失败');return r.json();});frame=document.createElement('iframe');frame.title='联合祓除战斗舞台';frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.src='godot/embed.html';$('mount').replaceChildren(frame);loadTimer=setTimeout(()=>fail('载入超时，请重试。'),60000);}catch(e){fail(e.message);}
 }
 window.addEventListener('message',e=>{
  if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='jjk-battle')return;const d=e.data;
  if(d.type==='ready'){ready=true;sync();return;}if(d.type==='error'||d.type==='asset-error'){fail('战斗资源未能载入，请重试。');return;}
  if(d.type==='progress'&&d.total){$('loadStatus').textContent=`正在载入舞台 ${Math.round(d.done/d.total*100)}%`;return;}if(d.rosterKey!==rosterKey())return;
  if(d.type==='state'){points=d.points||[];const p=points.find(p=>p.index===2);if(p?.bounds){const b=p.bounds;Object.assign($('target').style,{left:b.left*100+'%',top:Math.max(0,b.top)*100+'%',width:(b.right-b.left)*100+'%',height:(b.bottom-b.top)*100+'%'});}if(d.loaded===3&&!loaded){loaded=true;clearTimeout(loadTimer);$('entry').hidden=true;ui(audio.failed.length?'舞台就绪；部分音效未载入。点击咒灵选择目标。':undefined);}return;}
  const p=model.pending;if(!p||p.id!==d.id)return;
  if(d.type==='melee-phase'){const phase={windup:'蓄势',approach:p.kind==='nail'?'敲钉 · 飞行':'接近目标',impact:'命中',recoil:p.kind==='nail'?'共鸣':'收拳 · 受击',return:'归位'}[d.phase];if(phase)ui(model.units[p.from].name+' · '+phase);if(['windup','approach'].includes(d.phase))audio.play(p.kind,d.phase,p.from===2?-.16:.16);}
  if(d.type==='melee-impact'){const result=model.impact(d.id);if(result){popup(result);audio.play(p.kind,'impact',p.from===2?-.16:.16);ui(model.units[p.from].name+' · 命中');}}
  if(d.type==='melee-complete')finish(d.id);
  if(d.type==='melee-rejected')fail('动作未能开始，请重新载入战斗。');
 });
 $('start').onclick=boot;$('attack').onclick=()=>act('attack');$('guard').onclick=()=>act('guard');$('target').onclick=()=>{selected=true;sync();ui();$('attack').focus({preventScroll:true});};
 $('reset').onclick=()=>{clearTimeout(timer);waitingEnemy=false;audio.stop();epoch++;model=new SampleBattle();selected=false;$('numbers').replaceChildren();sync();ui();};
 $('sound').onclick=()=>{audio.setEnabled(!audio.enabled);$('sound').textContent='音效 · '+(audio.enabled?'开':'关');$('sound').setAttribute('aria-pressed',String(audio.enabled));if(audio.enabled)audio.unlock();};$('volume').oninput=()=>audio.setVolume(Number($('volume').value)/100);$('reduced').onchange=sync;
 for(const type of ['mouseenter','focus']){$('attack').addEventListener(type,()=>{$('description').textContent=describe();});$('guard').addEventListener(type,()=>{$('description').textContent='本轮受到的伤害降低 55%；消耗当前角色的行动。';});}
 document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&!e.repeat&&e.target===document.body&&!$('attack').disabled){e.preventDefault();act('attack');}});
 document.addEventListener('visibilitychange',()=>{send({type:'pause',value:document.hidden});if(document.hidden)audio.stop();else if(waitingEnemy)runEnemy();});window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(loadTimer);audio.stop();});ui();
})();
