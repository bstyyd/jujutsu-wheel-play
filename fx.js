'use strict';
// Event-driven presentation: no timers, random calls or values from this layer feed combat simulation.
const Cinema={raf:0,timer:0,resolve:null,
 presets:[['五条悟','无量空处','void'],['宿傩','伏魔御厨子','shrine'],['伏黑惠','嵌合暗翳庭','shadow'],['漏壶','盖棺铁围山','lava'],['真人','自闭圆顿裹','hands'],['陀艮','荡蕴平线','beach'],['日车宽见','诛伏赐死','court'],['虎杖悠仁','黑闪','flash'],['五条悟','虚式 · 茈','purple'],['胀相','穿血','blood'],['七海建人','十划咒法','ratio'],['鹿紫云一','幻兽琥珀','lightning'],['里梅','冰凝咒法','ice'],['钉崎野蔷薇','共鸣','straw']],
 type(who,text){const s=who+' '+text+(who==='你'?' '+(Game.player?.technique?.name||''):'');if(/黑闪/.test(text))return 'flash';if(/无量空处/.test(text))return 'void';if(/伏魔御厨子/.test(text))return 'shrine';if(/嵌合暗翳庭/.test(text))return 'shadow';if(/盖棺铁围山/.test(text))return 'lava';if(/自闭圆顿裹/.test(text))return 'hands';if(/五条|无下限/.test(s))return 'purple';if(/漏壶|火灾|熔岩|陨石/.test(s))return 'lava';if(/宿傩|御厨|解·|捌/.test(s))return 'slash';if(/胀相|穿血|赤血/.test(s))return 'blood';if(/七海|十划/.test(s))return 'ratio';if(/鹿紫云|琥珀/.test(s))return 'lightning';if(/里梅|冰凝/.test(s))return 'ice';if(/钉崎|刍灵|共鸣|簪/.test(s))return 'straw';if(/九十九|星之怒/.test(s))return 'gravity';return 'energy';},
 init(){const el=document.createElement('div');el.id='cinema';el.hidden=true;el.innerHTML='<div class="cinema-world"></div><canvas id="cinemaCanvas"></canvas><div class="cinema-motif" aria-hidden="true"></div><div class="cinema-portrait"></div><div class="cinema-copy"><p class="cinema-kicker"></p><h2></h2><p class="cinema-actor"></p></div><button class="cinema-close" aria-label="收起技能演出">收起演出 ×</button>';document.body.append(el);this.el=el;this.cv=$('cinemaCanvas');this.ctx=this.cv.getContext('2d');el.querySelector('button').onclick=()=>this.hide();
  Fx.show=(kind,who,text,dur)=>this.play({who,text,kind:kind==='fx-quote'?'quote':kind==='fx-ult'?'ultimate':'skill',duration:dur||(kind==='fx-quote'?2200:kind==='fx-ult'?2200:1600)});
  BattleUI.playDomainCut=e=>{const name=(!e.isPlayer&&window.BattleScenes?.npcDomain(e.actorName))||e.domainName||'领域展开';return this.play({who:e.isPlayer?'你':e.actorName,text:name,kind:'domain',duration:3600});};
  const sound=BattleUI.sfxFor;BattleUI.sfxFor=function(e){sound.call(this,e);Cinema.hit(e);};
  BattleUI.floatNum=function(idx,val,cls){if(idx<0||!val)return;const field=document.querySelector('.battle-field');if(!field)return;requestAnimationFrame(()=>{const target=field.querySelector(`[data-idx="${idx}"]`);if(!target)return;const r=target.getBoundingClientRect(),f=field.getBoundingClientRect(),n=document.createElement('span');n.className='cinema-damage '+(cls||'');n.textContent=(cls==='heal'?'+':'−')+Math.round(val);n.style.left=r.left-f.left+r.width/2+'px';n.style.top=r.top-f.top+r.height*.38+'px';field.append(n);setTimeout(()=>n.remove(),850);});};
  const button=document.createElement('button');button.className='btn ghost';button.textContent='角色与技能演出';button.onclick=()=>{$('menuDialog').close();this.gallery();};$('menuDialog').append(button);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.hide();});
 },
 hide(){cancelAnimationFrame(this.raf);clearTimeout(this.timer);if(this.el)this.el.hidden=true;const done=this.resolve;this.resolve=null;if(done)done();},
 portrait(who,text,kind){
  const art=kind==='domain'?window.BattleScenes?.portrait(who,text):null;
  return art?`<img class="sprite verified-art" src="assets/${art.file}" alt="${HD.escape(who)} · 领域展开" style="object-fit:contain">`:HD.sprite(who,who==='你');
 },
 background(who,text,kind){
  let p=kind==='domain'?window.BattleScenes?.presentationFor({actorName:who,name:text,isPlayer:who==='你'}):null,world=this.el.querySelector('.cinema-world');
  /* 未登记领域（24 种扩展术式）：presentationFor 兜底为 barrier「保留当前战场」，
   * 即"灰屏翻页"的来源。改按领域名哈希生成专属程序演出，色相+纹样由名字决定，
   * 每个领域都有可辨认的独立演出。无名杂兵领域（'领域'）保持 barrier 兜底不变。 */
  this._procType=null;
  if(kind==='domain'&&p&&p.key==='barrier'&&String(text||'')!=='领域'){
   const PROC=['energy','void','slash','shadow','lava','ice','lightning','blood','ratio'];
   let h=0;for(const ch of String(text||'领域'))h=(h*31+ch.charCodeAt(0))>>>0;
   const type=PROC[h%PROC.length];
   const hue=h%360;
   this._procType=type;
   p={key:'proc',motif:true,cinemaOnly:true,note:'扩展领域 · 程序演绎',
      light:`oklch(75% .12 ${hue})`,_procHue:hue};
  }
  const motif=this.el.querySelector('.cinema-motif');
  motif.dataset.kind=p&&(p.motif||!p.file)?p.key:'';
  motif.innerHTML=p&&(p.motif||!p.file)?Array.from({length:24},(_,i)=>'<i style="--i:'+i+';--x:'+((i*37)%100)+'%;--y:'+((i*23)%100)+'%;--r:'+((i*47)%360)+'deg;--size:'+(0.5+(i*7%13)/13)+';--tilt:'+((i*11%31)-15)+'deg"></i>').join(''):'';
  this.el.style.setProperty('--domain-light',p?._procHue!=null?p.light:(p?.light||({love:'#d6c8fb',jackpot:'#a7e5c1',womb:'#d4b477',moon:'#ccb5ed',station:'#e4ebee',shrine:'#ff665f',lava:'#ffb669',hands:'#c9a9ff',court:'#ffe0a6'})[p?.key]||'#d2e9ff'));
  // The same approved profile drives both the battlefield and the character cut-in.
  // Ordinary techniques and unnamed domains cannot inherit a caster's domain background.
  world.style.background='radial-gradient(ellipse at 65% 40%,var(--color-paper-3),var(--color-black))';
  world.style.backgroundRepeat='no-repeat';
  world.dataset.domain=p?.key||'';
  this.el.dataset.domainArt=p?.file?'true':'false';
  this.el.dataset.domainNote=p?.note||'';
  this.el.dataset.interpretation=p?.cinemaOnly?'true':'false';
  if(p?.file){
   // Incomplete domains get a shadow cut-in; their battlefield overlay remains unchanged.
   world.style.backgroundImage=`url("assets/${p.file}")`;
   world.style.backgroundSize=p.atlas?'200% 200%':'cover';
   world.style.backgroundPosition=p.atlas?`${p.atlas[0]*200}% ${(1-p.atlas[1]-p.atlas[3])*200}%`:'center';
  }else if(p&&p.key==='proc'){
   /* 程序演绎领域：名字哈希色相的全屏结界底色，不用战场旧图 */
   world.style.backgroundImage=`radial-gradient(ellipse at 50% 42%,oklch(35% .12 ${p._procHue} / .95),oklch(12% .03 ${p._procHue} / .98) 75%)`;
  }else{
   const base=document.querySelector('.battle-field')?.style.backgroundImage;
   if(base&&base!=='none'){world.style.backgroundImage=`linear-gradient(var(--color-shade),var(--color-shade)),${base}`;world.style.backgroundSize='cover';world.style.backgroundPosition='center';}
  }
 },
 play({who='',text='',kind='skill',duration=1800,type}){this.hide();return new Promise(resolve=>{this.resolve=resolve;this.el.hidden=false;this.el.className='cinema '+kind;this.background(who,text,kind);const domKey=this.el.querySelector('.cinema-world').dataset.domain;this.el.dataset.effect=kind==='domain'?(domKey==='proc'?(this._procType||'energy'):(domKey||'neutral')):(type||this.type(who,text));this.el.querySelector('.cinema-portrait').innerHTML=this.portrait(who,text,kind);this.el.querySelector('h2').textContent=kind==='domain'&&/^领域（/.test(text)?'领域':text;this.el.querySelector('.cinema-kicker').textContent=kind==='domain'?'領域展開':kind==='ultimate'?'極 ノ 番':kind==='quote'?'':'術 式 発 動';this.el.querySelector('.cinema-actor').textContent=who+(kind==='domain'&&/^领域（/.test(text)?' · '+text.slice(3,-1):'')+(this.el.dataset.interpretation==='true'?' · 游戏演绎':'');this.timer=setTimeout(()=>this.hide(),duration);
   const rect=this.el.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);this.cv.width=rect.width*dpr;this.cv.height=rect.height*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);const start=performance.now();
   const frame=now=>{const t=Math.max(0,(now-start)/1000);this.draw(rect.width,rect.height,t,this.el.dataset.effect,kind);if(!this.el.hidden&&!document.body.classList.contains('reduced-motion')&&kind!=='quote')this.raf=requestAnimationFrame(frame);};frame(start+200);
  });},
 draw(w,h,t,type,kind){const c=this.ctx;c.clearRect(0,0,w,h);if(kind==='quote')return;
  /* 领域演出：仅程序演绎（未登记）领域叠加 canvas 动画；登记领域保持原验证视觉不动。 */
  if(kind==='domain'){if(!this._procType)return;type=this._procType;}const x=w*.58,y=h*.48,dim=Math.min(w,h),p=Math.min(1,t*2.3),colors={void:'#8ceaff',shrine:'#e05058',shadow:'#6a9c9d',lava:'#ff8b39',hands:'#c39bce',flash:'#ee354a',purple:'#b581ff',blood:'#e65268',ratio:'#f0cf8e',lightning:'#8de2f4',ice:'#b9efff',straw:'#e8b980',gravity:'#a49bd4',slash:'#eb9e9e',energy:'#87cddd'};c.strokeStyle=colors[type]||colors.energy;c.fillStyle=c.strokeStyle;c.lineWidth=1.5;
  if(type==='void'||type==='purple'||type==='gravity'||type==='energy'){for(let i=0;i<12;i++){const r=(i*29+t*130)%(dim*.78);c.globalAlpha=(1-r/(dim*.8))*.48;c.beginPath();c.ellipse(x,y,r,r*.55,t*.24+i*.04,0,Math.PI*2);c.stroke();}for(let i=0;i<70;i++){const a=i*2.399+t*.12,r=dim*.10+(i*37+t*95)%(dim*.85);c.globalAlpha=.14+(i%6)/15;c.beginPath();c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r*.75);c.lineTo(x+Math.cos(a)*(r+28*p),y+Math.sin(a)*(r+28*p)*.75);c.stroke();}c.globalAlpha=.8;const g=c.createRadialGradient(x,y,1,x,y,dim*.15);g.addColorStop(0,type==='purple'?'#e4ccff':'#d9f7ff');g.addColorStop(.13,colors[type]);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-dim*.2,y-dim*.2,dim*.4,dim*.4);}
  else if(type==='shrine'||type==='slash'||type==='ratio'||type==='straw'){for(let i=0;i<12;i++){const phase=(t*1.25+i*.12)%1;if(phase>.7)continue;const xx=(i*137)%w,yy=(i*89)%h;c.globalAlpha=(.7-phase)*p;c.lineWidth=type==='straw'?3:1+i%2;c.beginPath();c.moveTo(xx-w*.3,yy+h*.2);c.lineTo(xx+w*.5,yy-h*.3);c.stroke();}if(type==='ratio'){c.globalAlpha=.85;c.lineWidth=2;c.beginPath();c.moveTo(w*.2,y);c.lineTo(w*.86,y);c.stroke();for(let i=0;i<=10;i++){const xx=w*.2+w*.066*i;c.beginPath();c.moveTo(xx,y-10);c.lineTo(xx,y+10);c.stroke();}c.fillRect(w*.2+w*.066*7-2,y-23,4,46);}}
  else if(type==='flash'||type==='lightning'){for(let i=0;i<9;i++){const a=i*Math.PI*2/9+t*.18;c.beginPath();c.moveTo(x,y);for(let j=1;j<9;j++){const r=dim*j*.065,aa=a+Math.sin(j*17+i+t*9)*.17;c.lineTo(x+Math.cos(aa)*r,y+Math.sin(aa)*r);}c.globalAlpha=.8;c.lineWidth=type==='flash'?9:5;c.strokeStyle=type==='flash'?'#130d18':'#d5fcff';c.stroke();c.lineWidth=2;c.strokeStyle=colors[type];c.stroke();}}
  else if(type==='shadow'||type==='hands'){for(let i=0;i<16;i++){const xx=w*(i/15),phase=t*.8+i*.71;c.globalAlpha=.18+(i%3)*.06;c.lineWidth=10+i%4*5;c.beginPath();c.moveTo(xx,h);c.bezierCurveTo(xx-50,h*.8,xx+50,h*.68,xx+Math.sin(phase)*70,h*(.4+.15*Math.sin(phase)));c.stroke();}for(let i=0;i<8;i++){c.globalAlpha=.4;c.lineWidth=2;c.beginPath();c.ellipse(x,h*.72,(i*37+t*50)%(dim*.7),12+i*9,0,0,Math.PI*2);c.stroke();}}
  else if(type==='lava'){for(let i=0;i<65;i++){const xx=(i*97)%w,yy=h-((t*90+i*47)%(h*.8));c.globalAlpha=.2+(i%5)*.1;c.fillRect(xx+Math.sin(t+i)*10,yy,2+i%3,5+i%4);}}
  else if(type==='blood'){c.globalAlpha=.8;c.lineWidth=6;c.beginPath();c.moveTo(w*.2,h*.64);c.lineTo(w*(.2+.7*p),h*.35);c.stroke();c.globalAlpha=.3;c.lineWidth=18;c.stroke();}
  else if(type==='ice'){for(let i=0;i<12;i++){const xx=i*w/11,hh=(90+i%4*40)*p;c.globalAlpha=.3;c.beginPath();c.moveTo(xx-20,h);c.lineTo(xx,h-hh);c.lineTo(xx+25,h);c.closePath();c.fill();c.globalAlpha=.7;c.stroke();}}
  c.globalAlpha=1;
 },
 hit(e){if(e.type==='flash')this.play({who:e.actorName||e.from||BattleUI.eng?.lastActor?.name||'你',text:'黑闪',kind:'skill',type:'flash',duration:700});if(e.type==='hit'&&e.to)requestAnimationFrame(()=>{const u=BattleUI.eng?.units.findIndex(x=>x.name===e.to),el=document.querySelector(`.battle-field [data-idx="${u}"]`);if(el&&!document.body.classList.contains('reduced-motion'))el.animate([{filter:'brightness(1)'},{filter:'brightness(1.7)',transform:'translateX(5px)'},{filter:'brightness(1)',transform:'none'}],{duration:220});});},
 gallery(){const entries=[...(window.BattleScenes?.domainRoster||[]).map(p=>[p.who,p.name,p.key,'domain']),...this.presets.slice(7).map(p=>[...p,'skill'])];let d=$('artGallery');if(!d){d=document.createElement('dialog');d.id='artGallery';d.className='utility-dialog art-gallery';d.innerHTML='<div class="dialog-heading"><h2>角色与技能演出</h2><button class="text-btn">关闭 ×</button></div><p class="muted">点击预览，实战会触发相同演出。<a href="domain-review.html">查看领域新图与原作参考</a></p><div class="effect-grid"></div><details><summary>角色美术</summary><div class="cast-grid"></div></details>';d.querySelector('.dialog-heading button').onclick=()=>d.close();d.querySelector('.effect-grid').innerHTML=entries.map((p,i)=>`<button class="gctl-btn" data-fx="${i}">${HD.escape(p[1])}<small>${HD.escape(p[0])}</small></button>`).join('');d.querySelector('.cast-grid').innerHTML=HD.cast.map(n=>`<figure>${HD.sprite(n)}<figcaption>${HD.escape(n)}</figcaption></figure>`).join('');d.querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>{const p=entries[+b.dataset.fx];d.close();this.play({who:p[0],text:p[1],type:p[2],kind:p[3],duration:p[3]==='domain'?3600:2400}).then(()=>d.showModal());});document.body.append(d);}d.showModal();}
};window.Cinema=Cinema;Cinema.init();
