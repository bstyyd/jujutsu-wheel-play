/* Independent rehearsal: no Game, no save import, and no storage writes. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),names=['你','无名咒灵'],maxHp=[100,126];
 let previewRequest=0;
 let frame=null,catalog=null,ready=false,loaded=false,selected=false,hp=[...maxHp],pending=null,serial=0,epoch=0,points=[],nextAttack=0,loadTimer=0,sound=true;
 const presentation=window.CombatPresentation,sfx=new window.CombatAudio();
 for(const p of presentation.profiles){const o=document.createElement('option');o.value=p.key;o.textContent=p.label;$('profile').append(o);}
 for(const t of Object.values(presentation.techniques)){const o=document.createElement('option');o.value=t.flag;o.textContent=t.label;$('technique').append(o);}
 $('profile').value='young-m';$('technique').value='limitless';
 const technique=()=>presentation.techniques[$('technique').value];
 const selectedSprite=()=>catalog.actors['player-'+$('profile').value]?'player-'+$('profile').value:'player';
 function describe(){ $('techniqueNote').textContent=technique().description;$('profileLabel').textContent=presentation.profiles.find(p=>p.key===$('profile').value).label; }
 describe();
 const handled=new Set(),phaseCopy={windup:'蓄势',approach:'接近',impact:'命中',recoil:'受击',return:'归位'};
 $('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const rosterKey=()=>`melee-lab-${epoch}`;
 function send(payload){if(frame&&ready)frame.contentWindow.postMessage({channel:'jjk-battle',payload},location.origin);}
 function snapshot(){return {type:'state',rosterKey:rosterKey(),active:!document.hidden,quality:'fine',reduced:$('reduced').checked,meleePrototype:true,target:selected?1:-1,environment:{key:'abandoned',url:''},surfaceAtlas:new URL('assets/'+catalog.surfaceAtlas,location.href).href,domains:[],roster:[selectedSprite(),'curse'].map((key,index)=>({index,name:names[index],side:index?'enemy':'ally',isPlayer:index===0,alive:hp[index]>0,url:new URL('assets/'+catalog.actors[key].file,location.href).href,height:catalog.actors[key].height,battleSprite:catalog.actors[key]}))};}
 function sync(){document.body.classList.toggle('reduced',$('reduced').checked);if(catalog)send(snapshot());}
 function ui(){
  for(let i=0;i<2;i++){const p=i?'enemy':'player';$(p+'Hp').textContent=`${hp[i]} / ${maxHp[i]}`;$(p+'Bar').style.transform=`scaleX(${hp[i]/maxHp[i]})`;$(p+'Trail').style.transform=`scaleX(${hp[i]/maxHp[i]})`;}
  $('target').hidden=!loaded||hp[1]<=0||!!pending;
  $('target').setAttribute('aria-pressed',String(selected));
  $('attack').disabled=!loaded||!selected||!!pending||hp.some(x=>x<=0)||!!nextAttack;
  $('skill').disabled=$('attack').disabled;for(const id of ['previewMelee','previewSkill','audioBank'])$(id).disabled=!!pending||!!nextAttack; $('profile').disabled=!!pending||!!nextAttack||!!frame&&!loaded; $('technique').disabled=!!pending||!!nextAttack;
  $('reset').disabled=!loaded;$('reduced').disabled=!!pending||!!nextAttack;
  if(!loaded)return;
  if(hp[1]<=0){$('actionStatus').textContent='祓除完成 · 可以重置再试';$('turnLabel').textContent='试战完成';$('intent').textContent='已祓除';}
  else if(hp[0]<=0){$('actionStatus').textContent='试战结束 · 可以重置再试';$('turnLabel').textContent='试战结束';}
  else if(!pending&&!nextAttack){$('actionStatus').textContent=selected?'选择体术攻击，或按 Enter':'点击场中的咒灵选择目标';$('turnLabel').textContent='你的回合';}
 }
 async function audioReady(){await sfx.unlock();$('sound').title=sfx.failed.length?'部分音效未能加载，可重新进入试战':'本地音效已就绪';$('sound').dataset.loaded=String(sfx.buffers.size);}
 function effect(phase){sfx.play(pending?.kind||'melee',phase,pending?.to? .2:-.2);}
 function popup(index,amount){const p=points.find(p=>p.index===index)||{x:index?.75:.25,y:.47},n=document.createElement('span');n.className='damage'+(index?' enemy-hit':'');n.textContent=String(amount);n.style.left=`${p.x*100}%`;n.style.top=`${p.y*100-8}%`;$('damageLayer').append(n);setTimeout(()=>n.remove(),900);}
 function act(from=0,kind='melee'){
  if(!loaded||pending||hp.some(x=>x<=0)||from===0&&!selected)return;
  previewRequest++;sfx.stop();const id=++serial;pending={id,from,to:presentation.selfKinds.includes(kind)?from:1-from,amount:from?24:42,kind};
  $('actionStatus').textContent=names[from]+' · 准备出手';$('turnLabel').textContent=from?'敌方行动':'你的行动';
  send({type:'event',eventType:'melee',actionKind:kind,variant:from?'':technique().flag,id,fromIndex:from,toIndex:1-from});ui();
 }
 function fail(message){clearTimeout(loadTimer);clearTimeout(nextAttack);nextAttack=0;pending=null;loaded=false;ready=false;frame?.remove();frame=null;$('entry').hidden=false;$('entry').dataset.state='error';$('entryTitle').textContent='舞台未能载入';$('loadStatus').textContent=message;$('start').disabled=false;$('start').textContent='重新载入';ui();}
 async function boot(){
  audioReady();$('start').disabled=true;$('entry').dataset.state='loading';$('entryTitle').textContent='正在布置战场';$('loadStatus').textContent='首次载入需要下载战斗引擎，请稍等。';
  try{catalog ||= await fetch('battle-sprites.json').then(r=>{if(!r.ok)throw Error('角色资源读取失败');return r.json();});frame=document.createElement('iframe');frame.title='近身交锋战斗舞台';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.src='godot/embed.html';$('stageMount').replaceChildren(frame);loadTimer=setTimeout(()=>fail('载入超时，请检查浏览器是否支持 WebGL 2，或重新载入。'),60000);ui();}catch(error){fail(error.message);}
 }
 window.addEventListener('message',e=>{
  if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='jjk-battle')return;
  const d=e.data;
  if(d.type==='ready'){ready=true;sync();return;}
  if(d.type==='error'||d.type==='asset-error'){fail('场景载入失败：'+String(d.message||(d.file?new URL(d.file,location.href).pathname+'（'+(d.code||'读取超时')+'）':'请重试')));return;}
  if(d.type==='progress'){if(d.total>0)$('loadStatus').textContent=`载入战斗引擎 ${Math.min(100,Math.round(d.done/d.total*100))}%`;return;}
  if(d.rosterKey!==rosterKey())return;
  if(d.type==='state'){
   points=d.points||[];const p=points.find(p=>p.index===1);if(p){
    const b=p.bounds;if(b){const top=Math.max(0,b.top-.075);$('target').classList.add('body-target');$('target').style.left=`${b.left*100}%`;$('target').style.top=`${top*100}%`;$('target').style.width=`${(b.right-b.left)*100}%`;$('target').style.height=`${(b.bottom-top)*100}%`;}
    else{$('target').style.left=`${p.x*100}%`;$('target').style.top=`${p.y*100-12}%`;}
   }
   if(d.actors===2&&d.loaded===2&&!loaded){loaded=true;clearTimeout(loadTimer);$('entry').hidden=true;ui();$('target').focus({preventScroll:true});}return;
  }
  if(!pending||pending.id!==d.id)return;
  if(d.type==='melee-phase'&&phaseCopy[d.phase]){$('actionStatus').textContent=names[pending.from]+' · '+phaseCopy[d.phase];$('turnLabel').textContent=pending.from?'敌方行动':'你的行动';if(d.phase==='windup'||d.phase==='approach')effect(d.phase);}
  if(d.type==='melee-impact'&&!handled.has(d.id)){
   handled.add(d.id);if(pending.kind==='heal'){const n=Math.min(maxHp[pending.from]-hp[pending.from],22);hp[pending.from]+=n;popup(pending.from,'+'+n);}else if(!presentation.selfKinds.includes(pending.kind)){const amount=Math.min(hp[pending.to],pending.amount);hp[pending.to]-=amount;popup(pending.to,amount);}effect('impact');ui();
  }
  if(d.type==='melee-complete'){
   const from=pending.from;pending=null;
   if(from===0&&hp.every(x=>x>0)){nextAttack=setTimeout(()=>{nextAttack=0;act(1);},180);$('actionStatus').textContent='对手准备反击';}
   sync();ui();
  }
  if(d.type==='melee-rejected'){pending=null;sync();ui();$('actionStatus').textContent='动作未开始，请再次选择攻击';}
 });
 $('start').onclick=boot;
 async function audition(kind){const request=++previewRequest;sfx.stop();$('audioStatus').textContent='正在载入音效…';await sfx.unlock();if(request!==previewRequest)return;if(!sound){$('audioStatus').textContent='音效已关闭，请先开启音效';return;}sfx.audition(kind);$('audioStatus').textContent=sfx.failed.length?'部分音效未能加载，请刷新后重试':({jrpg:'日式 RPG 分层',games:'游戏原声直放',previous:'旧版通用素材'}[sfx.bank])+' · '+(kind==='melee'?'体术':technique().label);}
 $('sfxVolume').oninput=()=>{sfx.setVolume(Number($('sfxVolume').value)/100);$('volumeValue').textContent=$('sfxVolume').value+'%';};
 $('previewMelee').onclick=()=>audition('melee');$('previewSkill').onclick=()=>audition(technique().kind);
 $('stopPreview').onclick=()=>{previewRequest++;sfx.stop();$('audioStatus').textContent='已停止试听';};
 $('audioBank').onchange=()=>{previewRequest++;sfx.stop();sfx.bank=$('audioBank').value;$('audioStatus').textContent='已切换为 '+({jrpg:'日式 RPG 分层',games:'游戏原声直放',previous:'旧版通用素材'}[sfx.bank]);};
 $('skill').onclick=()=>{audioReady();act(0,technique().kind);};
 $('technique').onchange=describe;
 $('profile').onchange=()=>{previewRequest++;sfx.stop();describe();if(!catalog)return;epoch++;handled.clear();loaded=false;selected=false;sync();ui();};
 $('target').onclick=()=>{if(!loaded||pending)return;selected=true;sync();ui();$('attack').focus({preventScroll:true});};
 $('attack').onclick=()=>{audioReady();act(0);};
 $('reset').onclick=()=>{previewRequest++;sfx.stop();clearTimeout(nextAttack);nextAttack=0;pending=null;epoch++;hp=[...maxHp];handled.clear();selected=false;$('intent').textContent='行动预告 · 近身反击';$('damageLayer').replaceChildren();sync();ui();};
 $('sound').onclick=()=>{previewRequest++;sound=!sound;sfx.setEnabled(sound);$('sound').setAttribute('aria-pressed',String(sound));$('sound').textContent=sound?'音效 · 开':'音效 · 关';if(sound)audioReady();};
 $('reduced').onchange=sync;
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.repeat&&!$('attack').disabled&&e.target===document.body){e.preventDefault();$('attack').click();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){previewRequest++;sfx.stop();}send({type:'pause',value:document.hidden});});
 window.addEventListener('pagehide',()=>{clearTimeout(nextAttack);clearTimeout(loadTimer);sfx.stop();sfx.ctx?.close().catch(()=>{});});
 ui();
})();
