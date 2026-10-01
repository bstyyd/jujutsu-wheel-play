/* In-scene direction. Host rules, cast identity and the existing voice lifecycle are authoritative. */
(() => {
 'use strict';
 let active=null,serial=0;
 const closeups={gojo:'五条悟',sukuna:'宿傩',megumi:'伏黑惠'};
 const originalHide=Cinema.hide.bind(Cinema);
 function clean(run){
  if(!run||run.cleaned)return;run.cleaned=true;cancelAnimationFrame(run.raf);
  run.send({type:'event',eventType:'domain-cinema-finish'});
  if(active===run){active=null;Cinema.el.classList.remove('domain-realtime');Cinema.el.style.left='';Cinema.el.style.top='';Cinema.el.style.width='';Cinema.el.style.height='';Cinema.el.style.right='';Cinema.el.style.bottom='';delete Cinema.el.dataset.realtime;delete Cinema.el.dataset.rtPhase;}
  // Restore layout after Cinema.hide has changed the overlay's visibility.
  queueMicrotask(()=>run.onDone?.());
 }
 Cinema.hide=function(){clean(active);return originalHide();};
 function portrait(e,catalog,units){
  // Only the Yuji-vessel close-up may serve this Sukuna stage. Other stages keep their own atlas.
  const who=e.actorName||units[e.owner]?.name;if(who==='禅院直哉'&&e.domainName==='时胞月宫殿')return '';const key=who==='五条悟'&&Number(Game.day||0)<118?'gojo':who==='伏黑惠'?'megumi':/^(?:宿傩|15指宿傩|16指宿傩)$/.test(who||'')?'sukuna':null;
  if(!e.isPlayer&&key)return `<img src="assets/domains/realtime-v1/${key}.png" alt="${HD.escape(closeups[key])}结印">`;
  const u=units[e.owner],art=u?.isPlayer?window.PlayerPresentation?.sprite(catalog,Game.player||{},u):catalog?.actors?.[window.CombatPresentation?.battleActorKey(HD.artIndex(who),Game.day||0,who)];
  const file=art?.poseFiles?.[art.poses?.domain??art.poses?.cast]||art?.posterFile;
  if(file)return `<img src="assets/${HD.escape(file)}" alt="${HD.escape(who||'你')}施术">`;
  // Avoid enlarging an entire multi-pose atlas or a silhouette borrowed from a canon actor.
  return '';
 }
 function sparks(ctx,w,h,t,nameAt,key,reduced){
  ctx.clearRect(0,0,w,h);if(reduced)return;
  const p=Math.max(0,Math.min(1,(t-nameAt+.25)/1.55)),opacity=Math.min(1,p*4);if(!opacity)return;
  ctx.save();ctx.strokeStyle=key==='shrine'?'#ee6d79':key==='shadow'?'#74aaa2':'#a5dcf2';ctx.fillStyle=ctx.strokeStyle;
  if(key==='void'){
   const x=w*.5,y=h*.42;
   for(let i=0;i<42;i++){const a=i*2.399,r=(i*37+t*110)%(w*.85),f=Math.min(w,h)/w;ctx.globalAlpha=opacity*(1-Math.min(1,r/w))*.26;ctx.lineWidth=1+i%2;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r*f);ctx.lineTo(x+Math.cos(a)*(r+18+p*30),y+Math.sin(a)*(r+18+p*30)*f);ctx.stroke();}
  }else if(key==='shrine'){
   for(let i=0;i<6;i++){const phase=(t*.4+i*.167)%1;ctx.globalAlpha=Math.max(0,1-phase*4)*opacity*.65;ctx.lineWidth=i%2+1;const x=w*(.12+i*.16);ctx.beginPath();ctx.moveTo(x-w*.13,h*.16);ctx.lineTo(x+w*.12,h*.86);ctx.stroke();}
  }else if(key==='shadow'){
   for(let i=0;i<7;i++){const r=(t*24+i*35)%(w*.58);ctx.globalAlpha=(1-r/(w*.58))*.23*opacity;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(w*.43,h*.85,r,r*.09,0,0,Math.PI*2);ctx.stroke();}
  }else DomainEffects.draw(ctx,w,h,t-nameAt+.5,key,DomainEffects.specs[key]?.color,{alpha:.85});
  ctx.restore();
 }
 async function play({event:e,host,send,units=[],catalog,onDone}){
  if(!host?.isConnected)return Cinema.play({who:e.isPlayer?'你':e.actorName,text:e.domainName,kind:'domain',duration:3600});
  Cinema.hide();delete host.dataset.voiceTailMs;
  const who=e.isPlayer?'你':e.actorName,name=e.domainName||BattleScenes.npcDomain(who)||'领域';
  const reduced=DomainEffects.reduced(),meta=DomainEffects.describe(who,name),cue=AnimeVoice.select(name,who);
  const done=Cinema.play({who,text:name,kind:'domain',duration:reduced?1600:3600});
  cancelAnimationFrame(Cinema.raf);
  const run={id:++serial,send,host,onDone,key:meta.key,started:performance.now(),nameAt:cue&&!SFX.muted&&SFX.voiceOn!==false?cue.nameAtMs/1000:1.25};active=run;
  const voiceJob=cue&&!SFX.muted&&SFX.voiceOn!==false?AnimeVoice.voiceJob:null;voiceJob?.done.then(result=>{if(!result.cancelled)run.voiceEndedAt=result.endedAt;});
  const el=Cinema.el;el.classList.add('domain-realtime');el.dataset.realtime='true';el.dataset.rtPhase='sign';el.querySelector('.cinema-kicker').textContent='领域展开';
  el.querySelector('.cinema-portrait').innerHTML=portrait(e,catalog,units);el.querySelector('.cinema-close').textContent='跳过演出';el.querySelector('.cinema-close').setAttribute('aria-label','跳过领域演出');
  send({type:'pause',value:document.hidden});send({type:'event',eventType:'domain-cinema-start',fromIndex:e.owner,nameDelay:run.nameAt});
  function tick(now){
   if(active!==run||el.hidden)return;
   if(!host.isConnected||document.hidden){Cinema.hide();return;}
   const r=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),t=(now-run.started)/1000;
   Object.assign(el.style,{left:r.left+'px',top:r.top+'px',right:'auto',bottom:'auto',width:r.width+'px',height:r.height+'px'});
   const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(Cinema.cv.width!==w||Cinema.cv.height!==h){Cinema.cv.width=w;Cinema.cv.height=h;Cinema.ctx.setTransform(dpr,0,0,dpr,0,0);}
   const nameAt=parseFloat(el.style.getPropertyValue('--domain-name-delay'))||run.nameAt;
   if(Math.abs(run.nameAt-nameAt)>.04){run.nameAt=nameAt;send({type:'event',eventType:'domain-cinema-clock',nameDelay:nameAt});}
   const phase=t<.4?'sign':t<nameAt?'call':t<nameAt+1.45?'unfold':'hold';
   el.dataset.rtPhase=phase;el.dataset.domainPhase={sign:'结印',call:'领域展开',unfold:'领域成形',hold:'领域维持'}[phase];
   const caption=el.querySelector('.domain-stage-caption');if(caption)caption.textContent=(phase==='hold'?'结界维持':phase==='unfold'?'空间展开':phase==='call'?'咒力凝聚':'结印')+' · '+meta.label;
   sparks(Cinema.ctx,r.width,r.height,t,nameAt,meta.key,reduced);
   run.raf=requestAnimationFrame(tick);
  }
  tick(run.started);run.onStart?.();
  try{await done;}finally{if(run.voiceEndedAt)host.dataset.voiceTailMs=String(Math.round(performance.now()-run.voiceEndedAt));clean(run);}
 }
 function battleBurst(host,event,{duration=1000,units=[]}={}){
  if(event.type!=='domain_end'&&!(event.type==='domain_clash'&&event.domainPhase==='engage'))return null;
  const live=host&&(host.querySelector('iframe')||host.querySelector('.godot-stage')&&window.HDStage?.present);
  if(!live)return null;
  const end=event.type==='domain_end',node=document.createElement('div');node.className='realtime-clash '+(end?'breaking':'');node.setAttribute('aria-hidden','true');
  const who=event.actorName||units[event.owner]?.name||units[event.loser]?.name||'',meta=DomainEffects.describe(who,event.domainName);
  node.dataset.theme=meta.key;node.style.setProperty('--break-light',DomainEffects.specs[meta.key]?.color||'#b7cadb');
  const label=document.createElement('strong'),sub=document.createElement('small');label.textContent=end?'结界崩解':'领域对攻';sub.textContent=end?(event.domainName+' · '+(event.reason||'结界失守')):event.outcome==='overpower'?'精炼度压制 · 强者领域夺取战场':'必中抵消 · 攻击施术者争夺结界';node.append(label,sub);
  const cv=document.createElement('canvas');node.prepend(cv);host.append(node);
  return new Promise(resolve=>{
   let timer,raf;const started=performance.now(),reduced=DomainEffects.reduced(),life=reduced?350:duration;
   node.cancel=()=>{clearTimeout(timer);cancelAnimationFrame(raf);node.remove();resolve();};timer=setTimeout(node.cancel,life);
   function tick(now){
    if(!node.isConnected||!host.isConnected||document.hidden){node.cancel();return;}
    if(reduced)return;const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5),ctx=cv.getContext('2d'),t=(now-started)/1000,p=Math.min(1,(now-started)/life);
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.max(1,Math.round(w*dpr));cv.height=Math.max(1,Math.round(h*dpr));}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    if(end)DomainEffects.draw(ctx,w,h,t+1,meta.key,DomainEffects.specs[meta.key]?.color,{phase:'collapse',progress:p,alpha:.8});
    else{
     const seam=Number(host.dataset.seam||.5),pair=['ally','enemy'].map(side=>(event.domainSnapshot||[]).find(f=>f.side===side));
     for(let i=0;i<2;i++){const f=pair[i];if(!f)continue;const m=DomainEffects.describe(units[f.owner]?.isPlayer?'你':f.actorName||units[f.owner]?.name,f.name);ctx.save();ctx.beginPath();ctx.rect(i?seam*w:0,0,i?(1-seam)*w:seam*w,h);ctx.clip();DomainEffects.draw(ctx,w,h,t+1,m.key,DomainEffects.specs[m.key]?.color,{alpha:.65,clear:false});ctx.restore();}
     ctx.strokeStyle='#e8eef5';ctx.globalAlpha=Math.sin(p*Math.PI)*.65;ctx.lineWidth=1.5;ctx.beginPath();for(let j=0;j<=35;j++){const xx=seam*w+Math.sin(j*2.3+t*8)*4,yy=h*j/35;j?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.stroke();ctx.globalAlpha=1;
    }
    raf=requestAnimationFrame(tick);
   }
   tick(started);
  });
 }
 window.DomainRealtime={play,battleBurst,get active(){return !!active;}};
 const previousCut=BattleUI.playDomainCut;
 BattleUI.playDomainCut=function(e){const stage=window.HDStage;if(stage?.present&&!stage.failed&&stage.quality!=='static')return play({event:e,host:stage.host,send:p=>stage.send(p),units:this.eng.units,catalog:stage.sprites,onDone:()=>stage.layout()});return previousCut.call(this,e);};
 const menu=document.getElementById('menuDialog');if(menu&&!menu.querySelector('[data-domain-stage]')){const a=document.createElement('a');a.className='btn ghost';a.dataset.domainStage='true';a.href='domain-stage-review.html';a.textContent='战场内领域演出';menu.append(a);}
 window.addEventListener('pagehide',()=>Cinema.hide());
})();
