/* Godot owns the battle picture; the original BattleUI owns every game action. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),visible=n=>n&&!n.hidden&&!n.classList.contains('hidden');

 const asset=file=>new URL('assets/'+file,document.baseURI).href;
 class BattleStage {
  constructor(){
   this.ready=false;this.failed=false;this.points=[];this.art=null;this.host=null;this.key='';this.message='';
   try{this.quality=localStorage.getItem('jjk_hd_quality')||'balanced';}catch{this.quality='balanced';}
   if(!['balanced','fine','low','static'].includes(this.quality))this.quality='balanced';
   this.observer=new MutationObserver(()=>this.schedule());
   for(const node of [$('mainScreen'),$('titleScreen'),$('createScreen'),$('modalMask')])this.observer.observe(node,{attributes:true,attributeFilter:['class']});
   this.observer.observe($('modalBox'),{childList:true});
   if($('cinema'))this.observer.observe($('cinema'),{attributes:true,attributeFilter:['hidden']});
   this.ro=new ResizeObserver(()=>this.layout());
   document.addEventListener('scroll',()=>this.layout(),true);window.addEventListener('resize',()=>this.layout());
   document.addEventListener('visibilitychange',()=>this.sync());document.addEventListener('close',()=>this.schedule(),true);
   document.addEventListener('click',()=>this.schedule(),true);
   window.addEventListener('message',e=>this.receive(e));
   const label=document.createElement('label');label.className='config-field quality-setting';
   label.innerHTML='战斗画质<select id="sceneQuality"><option value="balanced">均衡</option><option value="fine">精细</option><option value="low">省电</option><option value="static">静态画面</option></select><small id="sceneStatus">战斗时加载场景与角色演出</small>';
   $('menuMessage').before(label);$('sceneQuality').value=this.quality;
   $('sceneQuality').onchange=()=>{this.quality=$('sceneQuality').value;try{localStorage.setItem('jjk_hd_quality',this.quality);}catch{}this.sync();};
   Promise.all(['stage-art.json','battle-sprites.json'].map(file=>fetch(file).then(r=>{if(!r.ok)throw Error('art metadata');return r.json();}))).then(([art,sprites])=>{this.art=art;this.sprites=sprites;this.sync();}).catch(e=>this.fallback(e.message));
   const wrap=(owner,key,after)=>{const prior=owner[key];owner[key]=function(...args){const result=prior.apply(this,args);after(...args);return result;};};
   wrap(Game,'render',()=>this.schedule());wrap(BattleUI,'render',()=>this.sync());wrap(BattleUI,'sfxFor',e=>{this.event(e);this.sync();});
   const float=BattleUI.floatNum;BattleUI.floatNum=(...args)=>this.float(...args)||float.apply(BattleUI,args);
   document.documentElement.dataset.hdStage='battle-only';
  }
  safely(fn){try{return fn();}catch(e){this.fallback(e.message);return false;}}
  schedule(){if(this.queued)return;this.queued=true;requestAnimationFrame(()=>{this.queued=false;this.safely(()=>this.sync());});}
  ensureFrame(){
   if(this.frame||this.failed||this.quality==='static')return;
   this.portal=document.createElement('div');this.portal.className='godot-portal';this.portal.hidden=true;
   this.frame=document.createElement('iframe');this.frame.title='战斗舞台';this.frame.tabIndex=-1;this.frame.setAttribute('aria-hidden','true');this.frame.src='godot/embed.html';
   this.frame.setAttribute('sandbox','allow-scripts allow-same-origin');this.portal.append(this.frame);$('modalMask').append(this.portal);
   this.timeout=setTimeout(()=>{if(!this.ready)this.fallback('舞台载入超时');},45000);
  }
  send(payload){if(this.ready)this.frame.contentWindow.postMessage({channel:'jjk-battle',payload},location.origin);}
  receive(e){
   if(e.origin!==location.origin||e.source!==this.frame?.contentWindow||e.data?.channel!=='jjk-battle')return;
   const data=e.data;
   if(data.type==='ready'){clearTimeout(this.timeout);this.ready=true;this.sync();}
   else if(data.type==='error'||data.type==='asset-error')this.fallback(data.message||'场景素材加载失败');
   else if(data.type==='state'&&data.rosterKey===this.key&&this.host){
    this.points=data.points||[];this.host.dataset.actors=data.actors;this.host.dataset.loadedActors=data.loaded;
    this.host.dataset.domainTextures=data.domainTextures;this.host.dataset.environment=data.environment;
    this.present=data.backgroundReady&&data.actors>0&&data.loaded===data.actors&&data.domainTextures===(this.domains?.length||0);
    this.layout();
   }
  }
  snapshot(){
   const ui=BattleUI,environment=BattleScenes.battle(ui.eng.cfg,Game.day);
   const roster=ui.eng.units.map((unit,index)=>{
    const i=unit.isPlayer?HD.silhouette().index:HD.artIndex(unit.name),generic=i<0;
    const domain=(ui.domainShown||[]).find(d=>d.owner===index||d.actorName===unit.name);
    const art=(!unit.isPlayer&&BattleScenes.portrait(unit.name,domain?.name))||this.art[generic?(/咒灵|咒胎/.test(unit.name)?23:2):i];
    const poseKey=unit.isPlayer?('player-'+CombatPresentation.playerKey(Game.player)):CombatPresentation.battleActorKey(i,Game.day,unit.name)||(environment.key==='abandoned'&&/^二级咒灵$/.test(unit.name)?'curse':null);
    const sprite=poseKey&&this.sprites?.actors[poseKey];
    return {index,name:unit.name,side:unit.side,alive:unit.alive!==false,guarding:!!unit.buff?.defend,silhouette:!!unit.isPlayer||generic,isPlayer:!!unit.isPlayer,url:sprite?asset(sprite.file):art?asset(art.file):'',rect:art?.rect||[0,0,1,1],height:sprite?sprite.height:/魔虚罗|神武真身/.test(unit.name)?4.1:unit.isPlayer?3.15:3.5,...(sprite?{battleSprite:sprite}:{})};
   });
   const domains=(ui.domainShown||[]).filter(d=>BattleScenes.profileFor(d,ui.eng.units)).slice().sort((a,b)=>a.side==='ally'?-1:b.side==='ally'?1:0).slice(0,2).map(d=>{
    const p=BattleScenes.profileFor(d,ui.eng.units),rect=p.atlas?[p.atlas[0],1-p.atlas[1]-p.atlas[3],p.atlas[2],p.atlas[3]]:[0,0,1,1];
    return {name:d.name,actorName:d.actorName,key:p.key,side:d.side,open:!!p.open,overlay:!!p.overlay,url:asset(p.file||'domains.webp'),rect,floor:'#'+p.floor.toString(16).padStart(6,'0')};
   });
   const key=ui.runId+'/'+roster.map(u=>u.name+u.url).join('|');
   return {type:'state',rosterKey:key,roster,domains,domainContested:(ui.domainShown||[]).length>1,surfaceAtlas:asset(this.sprites.surfaceAtlas),environment:{key:environment.key,url:BattleScenes.background(environment.key)?asset(BattleScenes.background(environment.key)):'',painted:true},target:ui.selectedTargetIdx??-1,quality:this.quality,reduced:document.body.classList.contains('reduced-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches,active:true};
  }
  sync(){
   const battle=visible($('modalMask'))&&$('bfActions')&&BattleUI.eng;
   if(!battle){this.present=false;if(this.portal)this.portal.hidden=true;this.send({type:'pause',value:true});return;}
   const field=$('bfActions').closest('.modal').querySelector('.battle-field');
   let host=field.querySelector('.godot-stage');
   if(!host){
    host=document.createElement('div');host.className='godot-stage hd-stage hd-battle';host.setAttribute('aria-label','战斗演出，使用敌方名单选择目标');host.setAttribute('role','img');
    field.prepend(host);host.addEventListener('click',e=>this.select(e));
   }
   const modal=field.closest('.modal');
   let tools=modal.querySelector('.battle-tools');
   if(!tools){tools=document.createElement('div');tools.className='battle-tools';$('bfActions').before(tools);}
   for(const selector of ['.battle-history','#battleDetails','.battle-ctl']){const node=modal.querySelector(selector);if(node&&node.parentElement!==tools)tools.append(node);}
   if(this.host!==host){this.host=host;this.present=false;this.ro.disconnect();this.ro.observe(host);}
   const env=BattleScenes.battle(BattleUI.eng.cfg,Game.day);field.dataset.baseEnvironment=env.key;
   if(BattleScenes.background(env.key))field.style.backgroundImage=`url("${asset(BattleScenes.background(env.key))}")`;else field.style.backgroundImage='none';
   field.dataset.renderer=this.failed||this.quality==='static'?'static':this.present?'godot':'loading';
   document.querySelectorAll('#bfEnemy [role=button]').forEach(n=>n.setAttribute('aria-pressed',String(n.classList.contains('selected'))));
   if(this.failed||this.quality==='static'){this.present=false;this.layout();return;}
   if(!this.art)return;
   this.ensureFrame();const state=this.snapshot();
   if(this.key!==state.rosterKey){this.present=false;this.key=state.rosterKey;this.points=[];}
   this.domains=state.domains;
   // Incidental unnamed enemies use a dark silhouette and keep their own name.
   this.compatible=state.roster.every(u=>!!u.url);
   state.active=!!this.wasActive;this.send(state);this.layout();
  }
  layout(){
   if(!this.host||!this.portal)return;
   const paused=document.hidden||!!document.querySelector('dialog[open]')||visible($('cinema'))||!visible($('modalMask'))||!this.host.isConnected;
   const show=this.present&&this.compatible&&!this.failed&&this.quality!=='static';
   const field=this.host.parentElement;if(field.classList.contains('has-hd')!==!!show)field.classList.toggle('has-hd',!!show);field.dataset.renderer=show?'godot':this.failed||this.quality==='static'?'static':'loading';
   const rect=this.host.getBoundingClientRect(),box=$('modalBox').getBoundingClientRect();
   this.portal.hidden=!show||paused||rect.width<1;
   Object.assign(this.portal.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',clipPath:`inset(${Math.max(0,box.top-rect.top)}px 0 ${Math.max(0,rect.bottom-box.bottom)}px 0)`});
   const active=show&&!paused;
   if(this.wasActive!==active){this.wasActive=active;this.send({type:'pause',value:!active});}
   $('sceneStatus').textContent=this.failed?'此设备使用静态战斗画面':this.quality==='static'?'已选择静态战斗画面':this.ready?'战斗舞台已就绪':'战斗时加载场景与角色演出';
  }
  select(e){
   if(!this.present||!this.points.length)return;const r=this.host.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
   const candidates=this.points.filter(p=>BattleUI.eng.units[p.index]?.side==='enemy'&&BattleUI.eng.units[p.index]?.alive!==false);
   const target=candidates.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
   if(target&&Math.hypot(target.x-x,target.y-y)<.27)$('bfEnemy')?.querySelector(`[data-idx="${target.index}"]`)?.click();
  }
  event(e){if(this.present&&!this.failed)this.send({type:'event',from:e.from,to:e.to,actorName:e.actorName,eventType:e.type});}
  float(index,value,cls){
   if(!this.present||!value||this.portal?.hidden)return false;const point=this.points.find(p=>p.index===index);if(!point)return false;
   const node=document.createElement('span');node.className='hd-damage '+(cls||'');node.textContent=(cls==='heal'?'+':'−')+Math.round(value);node.style.left=point.x*100+'%';node.style.top=point.y*100+'%';this.portal.append(node);setTimeout(()=>node.remove(),950);return true;
  }
  fallback(message){this.failed=true;this.present=false;clearTimeout(this.timeout);this.send({type:'pause',value:true});this.host?.parentElement.classList.remove('has-hd');if(this.portal)this.portal.hidden=true;if($('sceneStatus'))$('sceneStatus').textContent='此设备使用静态战斗画面';document.documentElement.dataset.hdStage='fallback';console.warn('Battle presentation fallback:',message);}
 }
 window.HDStage=new BattleStage();
})();
