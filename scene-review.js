/* Standalone rehearsal: does not read or write player saves. */
(() => {
 const $=id=>document.getElementById(id),frame=$('stage'),asset=f=>new URL('assets/'+f,location.href).href;
 const casts={
  rooftop:['megumi','sukuna-yuji','伏魔御厨子'],campus:['yuji','todo'],road:['gojo','jogo','盖棺铁围山'],
  abandoned:['nobara','curse'],detention:['megumi','finger-bearer'],forest:['yuji','hanami','朵颐光海'],
  bridge:['nobara','eso'],'bridge-cave':['megumi','finger-bearer'],school:['nanami','mahito','自闭圆顿裹'],
  'school-hall':['yuji','junpei'],passage:['yuji','koguy'],platform:['gojo','jogo','盖棺铁围山'],
  subway:['nanami','dagon','荡蕴平线'],restroom:['yuji','choso'],shibuya:['megumi','toji'],
  'shibuya-ruins':['sukuna-shibuya','mahoraga'],theatre:['yuji','higuruma','诛伏赐死'],
  sendai:['yuta','ryu'],harbor:['kashimo','hakari','坐杀博徒'],sakurajima:['maki','naoya','时胞月宫殿'],
  shinjuku:['gojo-shinjuku','sukuna-megumi','伏魔御厨子'],'shinjuku-ruins':['yuji','sukuna-heian','伏魔御厨子']
 };
 let sprites,ready=false,serial=0,expanded=false,current;
 const send=payload=>{if(ready)frame.contentWindow.postMessage({channel:'jjk-battle',payload},location.origin);};
 function state(){
  const key=$('location').value,roles=casts[key],scene=BattleScenes.locations[key];
  const keys=[...roles.slice(0,2),...($('group').checked?['nobara','nanami']:[])];
  const roster=keys.map((k,i)=>{const s=sprites.actors[k];return {index:i,name:s.label,side:i===1?'enemy':'ally',alive:true,height:s.height,url:asset(s.file),battleSprite:s};});
  const p=expanded&&BattleScenes.profile(roles[2]);
  const domains=p?[{name:roles[2],actorName:roster[1].name,side:'enemy',key:p.key,open:!!p.open,overlay:!!p.overlay,url:asset(p.file),rect:[0,0,1,1],floor:'#'+p.floor.toString(16).padStart(6,'0')}]:[];
  return {type:'state',rosterKey:'scene-'+serial,roster,domains,surfaceAtlas:asset(sprites.surfaceAtlas),environment:{key,url:asset(scene.file),painted:true},quality:'fine',active:!document.hidden,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,target:1};
 }
 function sync(){if(sprites){current=state();send(current);}}
 function choose(){
  serial++;expanded=false;const key=$('location').value,roles=casts[key],s=BattleScenes.locations[key];
  $('stageBox').style.backgroundImage='url("'+asset(s.file)+'")';$('place').textContent=s.place;
  $('cast').textContent=roles.slice(0,2).map(k=>sprites.actors[k].label).join('  /  ');
  $('domain').disabled=!roles[2];$('domain').textContent=roles[2]?'展开 · '+roles[2]:'此对手无专属领域演示';
  $('restore').disabled=true;$('status').textContent='正在切换战场…';sync();
 }
 $('location').onchange=choose;$('group').onchange=()=>{serial++;sync();};
 $('domain').onclick=()=>{expanded=true;$('restore').disabled=false;sync();};
 $('restore').onclick=()=>{expanded=false;$('restore').disabled=true;sync();};
 $('attack').onclick=()=>{if(current)send({type:'event',eventType:'hit',from:current.roster[0].name,to:current.roster[1].name});};
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='jjk-battle')return;
  const d=e.data;if(d.type==='ready'){ready=true;sync();}
  if(d.type==='state'&&d.rosterKey==='scene-'+serial&&d.backgroundReady&&d.loaded===current?.roster.length&&d.domainTextures===current.domains.length){
   $('stageBox').classList.add('loaded');$('status').textContent=expanded?'领域生效 · 可恢复原战场':'场景已就绪 · 己方在左，敌方在右';
  }
  if(d.type==='error'||d.type==='asset-error'){$('status').textContent='角色演出暂未载入，当前显示场景背景。';console.error('scene-stage',d.message||d.file||d.type);}
 });
 document.addEventListener('visibilitychange',()=>send({type:'pause',value:document.hidden}));
 fetch('battle-sprites.json').then(r=>{if(!r.ok)throw Error('角色素材读取失败');return r.json();}).then(data=>{
  sprites=data;for(const [key,p] of Object.entries(BattleScenes.locations)){const o=document.createElement('option');o.value=key;o.textContent=p.place;$('location').append(o);}
  $('location').value='forest';choose();
 }).catch(e=>{$('status').textContent=e.message;});
})();
