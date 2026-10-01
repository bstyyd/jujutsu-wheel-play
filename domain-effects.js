/* Domain presentation only. No RNG, combat values, inventory or save writes. */
(() => {
 'use strict';
 const themes={void:['无量空处','信息过载'],shrine:['伏魔御厨子','开放结界 · 连续斩击'],shadow:['嵌合暗翳庭','未完成结界 · 影之增幅'],lava:['盖棺铁围山','熔岩环境 · 灼热'],hands:['自闭圆顿裹','灵魂触及'],beach:['荡蕴平线','死累累涌军'],court:['诛伏赐死','规则领域 · 简化判决'],jackpot:['坐杀博徒','规则领域 · 咒力奖金'],womb:['胎藏遍野','开放结界 · 重力压制'],love:['真赝相爱','刀阵 · 交替连携'],moon:['时胞月宫殿','帧规则'],blossom:['朵颐光海','花海牵制 · 游戏演绎'],station:['领域（名称未公开）','展开后的车站'],mass:['领域（名称未公开）','术式主题 · 质量'],sky:['领域（名称未公开）','术式主题 · 天空'],output:['领域（名称未公开）','术式主题 · 咒力输出'],orbit:['领域（名称未公开）','术式主题 · 式神轨迹'],frost:['领域（扩展设定）','游戏扩展 · 冰凝'],swarm:['领域（扩展设定）','游戏扩展 · 虫群'],barrier:['领域','基础结界 · 游戏演绎']};
 const techniqueThemes={limitless:'void',shadows:'shadow',cleave:'shrine',fire:'lava',idleTrans:'hands',judge:'court',copy:'love',blood:'blood',puppet:'machine',construct:'forge',crows:'swarm',seance:'orbit',spiritControl:'orbit',sky:'sky',mass:'mass',grow:'blossom',amber:'lightning',moon:'water',rot:'blood',gu:'swarm',projection:'moon',cannon:'output',cursedSpeech:'wave',straw:'forge',ratio:'forge'};
 const reduced=()=>document.body.classList.contains('reduced-motion')||document.body.classList.contains('reduce-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches;
 function describe(who,name){
  const player=who==='你',scene=BattleScenes.presentationFor({actorName:who,name,isPlayer:player});
  const unit=typeof BattleUI!=='undefined'?BattleUI.eng?.units?.find(u=>u.name===who):null,flag=player?Game.player?.technique?.flag:unit?.flag;
  const key=scene?.key==='barrier'?(techniqueThemes[flag]||(/血/.test(name)?'blood':/冰/.test(name)?'frost':/影/.test(name)?'shadow':/机甲|机械/.test(name)?'machine':'barrier')):scene?.key||'barrier';
  const canon=!!scene&&scene.key!=='barrier'&&!scene.cinemaOnly&&!scene.referenceKind;
  return {key,scene,label:themes[key]?.[1]||'术式主题 · 游戏演绎',interpretation:!canon,voiceEligible:!player&&!!BattleScenes.npcDomain(who)};
 }
 // IDs are shared with Godot's director. Art, voices and rule outcomes remain separate.
 const specs=Object.fromEntries([
  ['barrier',0,'#b7cadb','结界缝线'],['void',1,'#98e7ff','信息流'],['shrine',2,'#ed7180','斩线'],['shadow',3,'#79b2a2','影池'],
  ['lava',4,'#ffac63','地裂与余烬'],['hands',5,'#cbb4ef','掌印合拢'],['beach',6,'#b1efff','潮汐与水光'],['court',7,'#efcf91','审判幕与天平'],
  ['jackpot',8,'#81e5b5','转轴与轨道'],['womb',9,'#d4b49a','重力沉降'],['love',10,'#c4d7ff','交错刀阵'],['moon',11,'#e2b8ed','分帧轨迹'],
  ['blossom',12,'#f3e6af','花瓣与花粉'],['station',13,'#d3e1dc','车站灯带'],['mass',14,'#e8c494','重压波纹'],['sky',15,'#a3ddf2','天空折痕'],
  ['output',16,'#d4bcf3','咒力脉冲'],['orbit',17,'#e0d1a7','式神巡游轨迹'],['frost',18,'#bfeaff','冰晶生长'],['swarm',19,'#bcce8d','虫群轨迹'],
  ['blood',20,'#d97486','血珠与血线'],['machine',21,'#9ecbdc','机械装配环'],['forge',22,'#dcc098','咒具成形'],['lightning',23,'#b9d4ff','电弧'],
  ['water',24,'#a6e4ef','水纹'],['wave',25,'#ddd1fa','咒言声波']
 ].map(([key,id,color,motif])=>[key,{id,color,motif}]));
 function stageFields(shown,units,asset){
  return (shown||[]).slice().sort((a,b)=>a.side==='ally'&&b.side!=='ally'?-1:b.side==='ally'&&a.side!=='ally'?1:0).slice(0,2).flatMap(f=>{
   const p=BattleScenes.presentationFor(f,units);if(!p)return [];
   const owner=units[f.owner],who=owner?.isPlayer?'你':f.actorName||owner?.name,meta=describe(who,f.name),scene=BattleScenes.profileFor(f,units),effectOnly=!scene;
   return [{name:f.name,actorName:who,owner:f.owner,stability:f.stability,power:f.power,advantage:f.advantage,shellStress:f.shellStress||0,condition:f.barrierCondition||'',momentum:f.momentum||0,key:meta.key,theme:(specs[meta.key]||specs.barrier).id,side:f.side,open:!!scene?.open,overlay:!!scene?.overlay,effectOnly,url:scene?.file?asset(scene.file):'',rect:scene?.atlas?[scene.atlas[0],1-scene.atlas[1]-scene.atlas[3],scene.atlas[2],scene.atlas[3]]:[0,0,1,1],floor:'#'+(scene?.floor??0x101b22).toString(16).padStart(6,'0')}];
  });
 }
 const arc=(c,x,y,rx,ry,a=0,b=Math.PI*2)=>{c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,a,b);c.stroke();};
 // Deterministic code-native motifs; no generated character art and no random game calls.
 function draw(c,w,h,t,key,color,options={}){
  if(options.clear!==false)c.clearRect(0,0,w,h);c.save();const spec=specs[key]||specs.barrier;
  c.strokeStyle=color||spec.color;c.fillStyle=color||spec.color;c.lineWidth=Math.max(1,Math.min(w,h)/550);
  const d=Math.min(w,h),x=w*.5,y=h*.5,collapse=options.phase==='collapse',p=options.progress??1;
  const strength=(options.alpha??1)*Math.min(1,Math.max(0,(t-.2)/.9))*(collapse?Math.pow(1-p,1.2):1);
  const line=(points,alpha=.4,width=1)=>{c.globalAlpha=alpha*strength;c.lineWidth=width*d/550;c.beginPath();points.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy));c.stroke();};
  const ring=(xx,yy,rx,ry,alpha=.4)=>{c.globalAlpha=alpha*strength;arc(c,xx,yy,rx,ry);};
  const cycle=(i,speed=.16)=>(t*speed+i*.137)%1;
  const mote=(xx,yy,r,alpha)=>{c.globalAlpha=alpha*strength;c.beginPath();c.arc(xx,yy,r,0,Math.PI*2);c.fill();};
  const blade=(xx,yy,len,angle,alpha)=>{c.save();c.translate(xx,yy);c.rotate(angle);line([[0,0],[0,-len]],alpha,1.5);line([[-len*.11,-len*.72],[len*.11,-len*.72]],alpha,1.6);line([[0,-len],[len*.03,-len*1.08]],alpha,1);c.restore();};
  const palm=(xx,yy,size,angle,alpha)=>{c.save();c.translate(xx,yy);c.rotate(angle);c.globalAlpha=alpha*strength;c.lineWidth=d/550;
   c.beginPath();c.moveTo(-size*.35,size*.8);c.lineTo(-size*.45,size*.1);c.lineTo(-size*.9,-size*.3);c.quadraticCurveTo(-size*.95,-size*.55,-size*.72,-size*.46);c.lineTo(-size*.38,-size*.1);
   for(let i=0;i<4;i++){const a=-.32+i*.21,tip=-size*(1.15+Math.sin((i+1)*.8)*.23);c.lineTo(a*size,tip+size*.16);c.quadraticCurveTo((a+.04)*size,tip,(a+.1)*size,tip+size*.16);c.lineTo((a+.12)*size,-size*.14);}
   c.lineTo(size*.44,size*.12);c.lineTo(size*.35,size*.8);c.stroke();line([[-size*.23,size*.27],[size*.2,size*.1]],alpha*.6);c.restore();};
  if(key==='void'){
   for(let i=0;i<42;i++){const a=i*2.399,r=(i*31+t*75)%(w*.8);line([[x+Math.cos(a)*r,y+Math.sin(a)*r*.6],[x+Math.cos(a)*(r+20),y+Math.sin(a)*(r+20)*.6]],(1-r/(w*.8))*.28);}
  }else if(key==='shrine'){
   for(let i=0;i<7;i++){const z=cycle(i,.35);line([[w*(.05+i*.15)-d*.12,h*.08],[w*(.05+i*.15)+d*.17,h*.9]],Math.max(0,1-z*4)*.65,1.5);}
  }else if(key==='shadow'){
   for(let i=0;i<7;i++){const z=cycle(i);ring(w*.43,h*.86,d*(.08+z*.75),d*(.015+z*.1),(1-z)*.35);}
  }else if(key==='lava'){
   for(let i=0;i<8;i++){const xx=w*(.08+i*.13),yy=h*(.86+(i%2)*.06);line([[xx-d*.11,yy+d*.06],[xx,yy-d*.01],[xx+d*.07,yy-d*.05],[xx+d*.13,yy-d*.02]],.16+Math.sin(t*1.3+i)*.07,2);}
   for(let i=0;i<30;i++){const z=cycle(i,.13);mote(w*((i*37%101)/101)+Math.sin(t+i)*9,h*(1-z),d*.003*(1+i%3),Math.sin(z*Math.PI)*.6);}
  }else if(key==='hands'){
   for(let i=0;i<6;i++){const side=i%2?1:-1,xx=side<0?w*.04:w*.96,yy=h*(.18+Math.floor(i/2)*.29),pulse=.85+Math.sin(t*.8+i)*.09;palm(xx+side*(collapse?p*d*.3:0),yy,d*.095*pulse,-side*Math.PI*.5,.44);}
   for(let i=0;i<3;i++)ring(x,h*.85,d*(.18+i*.22),d*(.035+i*.027),.11);
  }else if(['beach','water'].includes(key)){
   for(let i=0;i<7;i++){const yy=h*(.76+i*.032),pts=[];for(let j=0;j<=40;j++)pts.push([w*j/40,yy+Math.sin(j*.43-t*1.6+i)*d*.009]);line(pts,.32-i*.03,1.5);}
   for(let i=0;i<16;i++){const z=cycle(i,.08);ring(w*((i*29%97)/97),h*(.78+(i%4)*.06),d*(.012+z*.025),d*(.004+z*.009),Math.sin(z*Math.PI)*.23);}
  }else if(key==='court'){
   const yy=h*.21,sway=Math.sin(t*.65)*d*.009;line([[x,yy-d*.08],[x,yy+d*.12]],.6,1.7);line([[x-d*.18,yy-sway],[x+d*.18,yy+sway]],.6,1.7);
   for(const side of [-1,1]){const xx=x+side*d*.16,base=yy+side*sway+d*.12;line([[xx,yy+side*sway],[xx-d*.065,base],[xx+d*.065,base],[xx,yy+side*sway]],.45);ring(xx,base,d*.065,d*.013,.4);}
   for(const side of [-1,1])for(let i=0;i<5;i++)line([[x+side*w*(.26+i*.025),h*.1],[x+side*w*(.26+i*.025),h*.69]],.10+i*.024);
   line([[w*.2,h*.86],[w*.8,h*.86]],.3,2);
  }else if(key==='jackpot'){
   // Reels never declare a bonus. Winning feedback must come from the actual rules.
   const sz=d*.11;for(let i=0;i<3;i++){const xx=x+(i-1)*sz*1.25;line([[xx-sz*.5,h*.16],[xx-sz*.5,h*.37],[xx+sz*.5,h*.37],[xx+sz*.5,h*.16],[xx-sz*.5,h*.16]],.4);
    c.save();c.beginPath();c.rect(xx-sz*.5,h*.16,sz,h*.21);c.clip();for(let j=0;j<4;j++){const z=(t*.6+j*.25+i*.09)%1;ring(xx,h*.14+z*h*.27,sz*.2,sz*.16,.4);}c.restore();}
   for(const side of [-1,1])line([[x+side*w*.08,h*.87],[x+side*w*.25,h],[x+side*w*.33,h]],.32,1.5);
  }else if(['womb','mass'].includes(key)){
   for(let i=0;i<6;i++){const z=cycle(i,.13),yy=h*(.38+z*.47);ring(x,yy,d*(.18+z*.75),d*(.035+z*.035),(1-z)*.27);}
   for(let i=0;i<22;i++){const z=cycle(i,.17),xx=w*((i*37%101)/101);line([[xx,h*(.05+z*.8)],[xx,h*(.07+z*.8)]],Math.sin(z*Math.PI)*.32,1.7);}
  }else if(key==='love'){
   for(let i=0;i<13;i++)blade(w*(.03+(i*23%94)/100),h*(.83+(i%3)*.055),d*(.12+(i%3)*.025),((i%5)-2)*.12,.3+Math.sin(t+i)*.055);
   for(let i=0;i<4;i++){const z=cycle(i,.23);line([[w*z-d*.07,h*.18],[w*z+d*.08,h*.34]],Math.max(0,1-z)*.26);}
  }else if(key==='moon'){
   const tick=Math.floor(t*24)%24;for(let i=0;i<24;i++){const xx=w*(.05+i*.9/24);c.globalAlpha=(i===tick?.6:.09)*strength;c.strokeRect(xx,h*.17,w*.9/24*.8,h*.16);}
   for(let i=0;i<6;i++){const z=(Math.floor(t*24)/24*.11+i*.167)%1;line([[w*z,h*.74],[w*z,h*.95]],.2);}
  }else if(key==='blossom'){
   for(let i=0;i<26;i++){const z=cycle(i,.07),xx=w*((i*37%101)/101)+Math.sin(t*.7+i)*d*.03,yy=h*(1-z);c.save();c.translate(xx,yy);c.rotate(t*.45+i);c.globalAlpha=Math.sin(z*Math.PI)*.5*strength;c.beginPath();c.ellipse(0,0,d*.004,d*.009,0,0,Math.PI*2);c.fill();c.restore();}
   for(let i=0;i<12;i++)mote(w*((i*41%99)/99),h*(.4+Math.sin(t*.4+i)*.3),d*.0018,.3);
  }else if(key==='station'){
   for(let i=0;i<6;i++){const xx=w*(.08+i*.17);line([[xx,h*.14],[xx+w*.07,h*.14]],.17+Math.sin(t*.45+i)*.035,2);}
   line([[0,h*.9],[w,h*.9]],.27,2);line([[0,h*.925],[w,h*.925]],.16);for(let i=0;i<22;i++)line([[w*i/21,h*.91],[w*i/21+w*.016,h*.91]],.28,2);
  }else if(key==='sky'){
   for(let i=0;i<5;i++){const z=(i*.193+t*.018)%1;line([[w*z,0],[w*z+d*.08,h*.35],[w*z-d*.04,h*.52],[w*z+d*.12,h*.78]],.25,1.4);}
  }else if(key==='output'){
   for(let i=0;i<5;i++){const z=cycle(i,.24);ring(w*.5,h*.2,d*(.03+z*.2),d*(.017+z*.11),(1-z)*.42);}
   for(let i=0;i<12;i++){const a=i*Math.PI*2/12;line([[x+Math.cos(a)*d*.09,h*.2+Math.sin(a)*d*.045],[x+Math.cos(a)*d*.2,h*.2+Math.sin(a)*d*.10]],.15);}
  }else if(key==='orbit'){
   for(let i=0;i<3;i++){const a=t*.35+i*Math.PI*2/3,rx=d*(.25+i*.06),ry=rx*.18;ring(x,h*.86,rx,ry,.23);mote(x+Math.cos(a)*rx,h*.86+Math.sin(a)*ry,d*.005,.65);}
  }else if(key==='frost'){
   for(let i=0;i<12;i++){const xx=w*((i*29%97)/97),base=h*(.9+(i%3)*.035),len=d*(.035+i%4*.021),spread=collapse?1-p:1;line([[xx,base],[xx-len*.26,base-len*spread],[xx+len*.14,base-len*spread*1.7],[xx+len*.42,base-len*spread*.7],[xx,base]],.42,1.4);}
   for(let i=0;i<20;i++){const z=cycle(i,.08);mote(w*((i*37%101)/101),h*z,d*.002,Math.sin(z*Math.PI)*.3);}
  }else if(key==='swarm'){
   for(let i=0;i<22;i++){const a=t*(.16+i%3*.02)+i*2.39,xx=x+Math.cos(a)*w*(.24+i%5*.035),yy=y+Math.sin(a*1.7)*h*.33;line([[xx-d*.008,yy],[xx,yy-d*.005],[xx+d*.008,yy]],.32,1.5);}
  }else if(key==='blood'){
   for(let i=0;i<14;i++){const z=cycle(i,.14);mote(w*((i*37%101)/101),h*(.96-z*.76),d*(.003+i%3*.002),Math.sin(z*Math.PI)*.47);}
   for(let i=0;i<3;i++){const a=t*.2+i*2.1;line([[x+Math.cos(a)*d*.35,h*.83],[x+Math.cos(a+.35)*d*.34,h*.76],[x+Math.cos(a+.8)*d*.3,h*.71]],.22,2);}
  }else if(key==='machine'){
   for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.18,xx=x+Math.cos(a)*d*.36,yy=h*.8+Math.sin(a)*d*.09;line([[xx-d*.025,yy-d*.015],[xx+d*.025,yy-d*.015],[xx+d*.025,yy+d*.015],[xx-d*.025,yy+d*.015]],.24);}
   ring(x,h*.8,d*.3,d*.08,.3);
  }else if(key==='forge'){
   for(let i=0;i<6;i++){const z=cycle(i,.1);blade(w*(.13+i*.15),h*.9,d*(.06+z*.12),0,Math.sin(z*Math.PI)*.36);}
  }else if(key==='lightning'){
   for(let i=0;i<5;i++){const xx=w*(.1+i*.2),f=Math.sin(t*4+i);line([[xx,h*.12],[xx+d*.04,h*.26],[xx-d*.016,h*.34],[xx+d*.02,h*.5]],Math.max(0,f)*.4,1.5);}
  }else if(key==='wave'){
   for(let i=0;i<5;i++){const z=cycle(i,.23);ring(x,h*.4,d*(.08+z*.65),d*(.07+z*.4),(1-z)*.27);}
  }else{
   for(let i=0;i<4;i++){const z=cycle(i,.09);ring(x,h*.84,d*(.16+z*.75),d*(.03+z*.13),(1-z)*.24);}
   for(let i=0;i<10;i++){const xx=w*(.02+i*.108);line([[xx,h*.13],[xx,h*.26]],.13);}
  }
  c.restore();
 }
 function installCinema(){
  if(!window.Cinema||Cinema.domainEffectsInstalled)return;Cinema.domainEffectsInstalled=true;
  const play=Cinema.play.bind(Cinema),paint=Cinema.draw.bind(Cinema);
  const portrait=Cinema.portrait.bind(Cinema);Cinema.portrait=function(who,text,kind){
   // Moon Palace is the cursed-spirit stage. Until its atlas is ready, show its
   // domain artwork rather than the existing human-stage portrait.
   if(kind==='domain'&&who==='禅院直哉'&&BattleScenes.name(text)==='时胞月宫殿')return '';
   if(kind==='domain'&&who==='你'){
   const custom=window.DomainEffects?.playerPortrait?.();if(custom)return custom;
   const catalog=window.HDStage?.sprites,p=typeof Game!=='undefined'?Game.player:null,art=window.PlayerPresentation?.sprite(catalog,p||{}),file=art?.poseFiles?.[art.poses.cast]||art?.posterFile;
   if(file)return `<img src="assets/${HD.escape(file)}" alt="你的领域展开" style="width:100%;height:100%;object-fit:contain">`;
   return '';
  }return portrait(who,text,kind);};
  const background=Cinema.background.bind(Cinema);Cinema.background=function(who,text,kind){background(who,text,kind);if(kind!=='domain')return;const meta=describe(who,text);if(meta.scene?.key==='barrier'){
   this._procType=null;const world=this.el.querySelector('.cinema-world'),cfg=typeof BattleUI!=='undefined'?BattleUI.eng?.cfg:null,base=BattleScenes.battle(cfg||{},Game.day||0);
   world.style.backgroundImage=`linear-gradient(var(--color-shade),var(--color-shade)),url("assets/${BattleScenes.background(base.key)}")`;world.style.backgroundSize='cover';world.style.backgroundPosition='center';world.dataset.domain=meta.key;
   this.el.querySelector('.cinema-motif').replaceChildren();this.el.dataset.domainNote='术式主题演出 · 保留战场';this.el.dataset.interpretation='true';
  }};
  Cinema.draw=function(w,h,t,type,kind){
   if(kind!=='domain')return paint(w,h,t,type,kind);
   const meta=this.domainEffectMeta||{key:'barrier'},color=getComputedStyle(this.el).getPropertyValue('--domain-light').trim()||getComputedStyle(document.documentElement).getPropertyValue('--color-cyan').trim();
   draw(this.ctx,w,h,reduced()?2.4:t,meta.key,color);
   const delay=parseFloat(this.el.style.getPropertyValue('--domain-name-delay'))||1.25;
   const phase=t<.6?'结印':t<delay?'领域展开':t<delay+1.2?'领域成形':'领域维持';
   this.el.dataset.domainPhase=phase;
   const label=this.el.querySelector('.domain-stage-caption');if(label)label.textContent=phase+' · '+meta.label;
  };
  Cinema.play=function(cfg){
   if(cfg.kind!=='domain'){this.domainEffectMeta=null;return play(cfg);}
   const meta=describe(cfg.who,cfg.text);this.domainEffectMeta=meta;
   const promise=play(cfg);this.domainEffectMeta=meta;this.el.dataset.domainTheme=meta.key;
   this.el.style.setProperty('--domain-light',`var(--effect-${themes[meta.key]?meta.key:'barrier'})`);
   // Existing artwork, portrait and character-matched full voice remain authoritative.
   const oldCaption=this.el.querySelector('.domain-stage-caption');oldCaption?.remove();
   const caption=document.createElement('p');caption.className='domain-stage-caption';caption.textContent='结印 · '+meta.label;this.el.append(caption);
   const credit=this.el.querySelector('.cinema-actor');if(meta.interpretation&&!credit.textContent.includes('游戏演绎'))credit.textContent+=' · 游戏演绎';
   const voice=window.AnimeVoice?.active;this.el.dataset.voice=voice?'matched':'silent';
   this.el.querySelector('.cinema-close').textContent='收起演出 ×';
   return promise;
  };
 }
 function burst(host,event,{duration=1400,units=[]}={}){
  const realtime=window.DomainRealtime?.battleBurst(host,event,{duration,units});if(realtime)return realtime;
  const initial=event.type==='domain_clash'&&event.domainPhase==='engage',ending=event.type==='domain_end';
  if(!host||(!initial&&!ending))return Promise.resolve();
  const shown=event.domainSnapshot||[],esc=s=>HD.escape(String(s??'')),node=document.createElement('div');node.className='domain-impact-film '+(ending?'collapse':'clash');node.setAttribute('aria-hidden','true');
  const participants=[event.winner,event.loser].filter(Number.isInteger).map(i=>({owner:i,actorName:units[i]?.name,name:units[i]?.domainName,side:units[i]?.side,isPlayer:units[i]?.isPlayer}));
  const pair=['ally','enemy'].map(side=>shown.find(f=>f.side===side)||participants.find(f=>f.side===side));
  node.innerHTML=initial?`<div class="domain-film-world"></div><div class="domain-film-world enemy"></div><div class="domain-film-copy"><p>領域対抗</p><h3>领域对攻</h3><div><span>${esc(pair[0]?.name||'我方领域')}</span><b>×</b><span>${esc(pair[1]?.name||'敌方领域')}</span></div><small>${event.outcome==='overpower'?'精炼度压制 · 结界失守':'必中抵消 · 攻击施术者或防御稳固'}</small></div>`:`<div class="domain-film-copy"><p>结界崩解</p><h3>${esc(event.domainName)}</h3><small>${esc(event.reason)}${shown.length?' · 剩余领域继续生效':' · 恢复常规战场'}</small></div>`;
  if(initial)node.querySelectorAll('.domain-film-world').forEach((part,i)=>{const profile=pair[i]&&BattleScenes.profileFor(pair[i],units);if(profile?.file&&!profile.overlay)part.style.backgroundImage=`url("assets/${profile.file}")`;});
  host.append(node);let timer;const done=()=>{clearTimeout(timer);node.remove();};
  return new Promise(resolve=>{timer=setTimeout(()=>{done();resolve();},reduced()?350:duration);node.cancel=()=>{done();resolve();};});
 }
 window.DomainEffects={themes,specs,describe,stageFields,draw,burst,installCinema,reduced};installCinema();
 const menu=document.getElementById('menuDialog');if(menu&&!menu.querySelector('[data-domain-duel]')){const link=document.createElement('a');link.className='btn ghost';link.dataset.domainDuel='true';link.href='domain-duel.html';link.textContent='领域迎击演练';menu.append(link);}
 if(typeof BattleUI!=='undefined'&&typeof BattleUI.sfxFor==='function'&&typeof BattleUI.render==='function'){
  const sound=BattleUI.sfxFor;BattleUI.sfxFor=function(e){const result=sound.call(this,e);if(e.domainPhase==='engage'||e.type==='domain_end'){document.getElementById('domainClashFlash')?.remove();burst(document.querySelector('.battle-field'),e,{units:this.eng?.units||[],duration:e.type==='domain_end'?850:650});}return result;};
  for(const name of ['finish','_battleFail','run'])if(typeof BattleUI[name]==='function'){const old=BattleUI[name];BattleUI[name]=function(...a){document.querySelectorAll('.domain-impact-film,.realtime-clash').forEach(n=>n.cancel?.());return old.apply(this,a);};}
 }
})();
