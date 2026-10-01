(() => {
 'use strict';
 const frame=$('stage'),host=$('arena'),asset=f=>new URL('assets/'+f,location.href).href;
 const arts={void:'gojo',shrine:'sukuna-shibuya',shadow:'megumi',lava:'jogo',hands:'mahito',beach:'dagon',court:'higuruma',jackpot:'hakari',womb:'kenjaku',love:'yuta',blossom:'hanami',station:'yuji',mass:'yuki',sky:'uro',output:'ryu',orbit:'dhruv',frost:'uraume',swarm:'kurourushi'};
 const environments={shadow:'detention',lava:'road',hands:'platform',beach:'subway',court:'theatre',love:'shinjuku',mass:'shibuya-ruins',sky:'sendai',output:'sendai',orbit:'sendai',frost:'shibuya-ruins'};
 const scenarios=Object.fromEntries(BattleScenes.domainRoster.map(f=>[f.key,{name:f.key==='shrine'?'15指宿傩':f.who,art:arts[f.key],domain:f.name,key:f.key,environment:environments[f.key]||'shibuya',note:(DomainEffects.specs[f.key]?.motif||'结界')+' · '+(f.cinemaOnly?'术式主题演绎，保留原战场':f.key==='blossom'?'参考《幻影夜行》的花海演出':f.key==='shadow'?'未完成领域，保留原场景':f.open?'开放结界，叠加原战场':'专属领域空间')} ]));
 let catalog,ready=false,loaded=false,busy=false,caseId='void',epoch=0,domains=[],roster=[];
 const send=payload=>{if(ready)frame.contentWindow.postMessage({channel:'jjk-battle',payload},location.origin);};
 const option=(id)=>new Option(scenarios[id].name+' · '+scenarios[id].domain,id);
 for(const id of Object.keys(scenarios)){
  const group=$(scenarios[id].note.includes('术式主题演绎')?'extraDomains':'canonDomains');group.append(option(id));
  $('clashAlly').add(option(id));$('clashEnemy').add(option(id));
 }
 $('clashAlly').value='void';$('clashEnemy').value='shrine';$('domainSelect').value='void';
 function selected(){return caseId==='clash'?[scenarios[$('clashAlly').value],scenarios[$('clashEnemy').value]]:[scenarios[caseId]];}
 function unit(index,s,side){const a=catalog.actors[s.art];if(!a)return null;return {index,name:s.name,side,alive:true,height:a.height,url:asset(a.file),maskURL:a.maskFile?asset(a.maskFile):'',battleSprite:a};}
 function sync(){const s=selected()[0];send({type:'state',rosterKey:'domain-stage/'+epoch,active:!document.hidden,quality:'fine',reduced:!$('motion').checked,presentation:'canon-sample',environment:{key:s.environment,url:asset(BattleScenes.background(s.environment)),painted:true},domains:DomainEffects.stageFields(domains,selected().map(s=>({name:s.name})),asset),domainContested:domains.length>1,roster});}
 function controls(){
  document.querySelectorAll('[data-case],#domainSelect,#clashAlly,#clashEnemy').forEach(b=>b.disabled=busy||!catalog);
  $('expand').disabled=busy||!loaded;$('clear').disabled=busy||!loaded;$('endDomain').disabled=busy||!loaded||!domains.length;$('voice').disabled=busy;$('motion').disabled=busy;
  document.querySelectorAll('#stabilityControls input,#stabilityControls button').forEach(n=>n.disabled=busy||domains.length!==2);
 }
 function select(id){
  if(busy||!catalog)return;Cinema.hide();document.querySelectorAll('.realtime-clash').forEach(n=>n.cancel?.());caseId=id;epoch++;domains=[];loaded=false;
  const [s,opponent]=selected();roster=[unit(0,s,'ally'),opponent?unit(1,opponent,'enemy'):unit(1,{name:'特级咒灵',art:'curse'},'enemy')].filter(Boolean);
  if(caseId==='clash')document.querySelector('[data-case=clash] small').textContent=s.domain+' × '+opponent.domain;
  $('place').textContent=BattleScenes.location(s.environment).place;$('note').textContent=s.note+(caseId==='clash'?'；对攻边界由实际稳定度决定':'')+(s.key==='moon'||opponent?.key==='moon'?'。咒灵直哉阶段动作待补齐，本页只审核领域空间。':'');
  $('space').textContent='常规战场';$('status').textContent='准备角色与场景';$('loading').hidden=false;$('clashControls').hidden=id!=='clash';
  if(id!=='clash')$('domainSelect').value=id;
  for(const side of ['Ally','Enemy']){$('stability'+side).value=100;$(side.toLowerCase()+'Value').value=100;}
  document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.case===id)));controls();sync();
 }
 function field(owner,s){return {name:s.domain,actorName:s.name,owner,side:owner?'enemy':'ally',stability:100};}
 async function expand(){
  if(busy||!loaded)return;busy=true;controls();domains=[];sync();
  try{
   const pair=selected();
   for(let i=0;i<pair.length;i++){const s=pair[i];domains.push(field(i,s));sync();$('status').textContent='正在结印 · '+s.name;
    await DomainRealtime.play({event:{owner:i,actorName:s.name,domainName:s.domain},host,send,units:roster,catalog});
   }
   if(domains.length>1)await DomainEffects.burst(host,{type:'domain_clash',domainPhase:'engage',domainSnapshot:domains},{units:roster,duration:1100});
   $('space').textContent=domains.length>1?'领域对攻 · 必中抵消':domains[0]?.name||'常规战场';$('status').textContent=domains.length>1?'调整稳定度，观察双方空间争夺':'领域已成形 · '+pair[0].name;
  }finally{busy=false;controls();}
 }
 async function end(enemyOnly=false){
  if(busy||!domains.length)return;busy=true;controls();const lost=enemyOnly?domains.find(d=>d.side==='enemy'):domains[domains.length-1];
  domains=enemyOnly?domains.filter(d=>d.side==='ally'):[];sync();
  await DomainEffects.burst(host,{type:'domain_end',actorName:lost.actorName,owner:lost.owner,domainName:lost.name,reason:enemyOnly?'敌方稳定度归零':'演出审核 · 结束维持',domainSnapshot:domains},{units:roster,duration:1000});
  $('space').textContent=domains[0]?.name||'常规战场';$('status').textContent=domains.length?'敌方结界破裂 · 我方空间接管':'结界已收起 · 恢复原战场';busy=false;controls();
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='jjk-battle')return;
  const d=e.data;if(d.type==='ready'){ready=true;if(catalog)select(caseId);}
  else if(d.type==='error'||d.type==='asset-error'){host.dataset.loadError=JSON.stringify(d);console.warn('Domain stage load',d);$('status').textContent='舞台载入失败，请刷新重试';$('loading').textContent='场景素材未能载入';}
  else if(d.type==='state'&&d.rosterKey==='domain-stage/'+epoch){host.dataset.seam=d.domainSeam;host.dataset.split=d.domainSplit;host.dataset.reveals=JSON.stringify(d.domainReveals);host.dataset.casting=String(d.domainCasting);host.dataset.themes=JSON.stringify(d.domainThemes);host.dataset.collapsing=d.domainCollapsing;loaded=d.backgroundReady&&d.loaded===roster.length;
   if(loaded){$('loading').hidden=true;if(!busy&&domains.length===0)$('status').textContent='角色已就位 · 选择领域展开';controls();}
  }
 });
 document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>select(b.dataset.case));$('domainSelect').onchange=()=>select($('domainSelect').value);
 for(const id of ['clashAlly','clashEnemy'])$(id).onchange=()=>select('clash');
 $('expand').onclick=expand;$('clear').onclick=()=>select(caseId);$('endDomain').onclick=()=>end();$('breakEnemy').onclick=()=>end(true);
 $('voice').onchange=()=>SFX.setVoice($('voice').checked);$('motion').onchange=()=>{document.body.classList.toggle('reduced-motion',!$('motion').checked);sync();};
 for(const side of ['Ally','Enemy'])$('stability'+side).oninput=()=>{const n=Number($('stability'+side).value);$(side.toLowerCase()+'Value').value=n;const f=domains.find(d=>d.side===side.toLowerCase());if(f)f.stability=n;sync();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){Cinema.hide();document.querySelectorAll('.realtime-clash').forEach(n=>n.cancel?.());}send({type:'pause',value:document.hidden});});window.addEventListener('pagehide',()=>send({type:'pause',value:true}));
 const initial=new URLSearchParams(location.search).get('domain');if(scenarios[initial])caseId=initial;
 fetch('battle-sprites.json').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(c=>{catalog=c;select(caseId);}).catch(()=>{$('status').textContent='人物素材载入失败，请刷新';});
})();
