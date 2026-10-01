'use strict';
// Saves contain data only. Mid-action checkpoints intentionally replay from the day's start.
const Save={key:'jjk_hd2d_save_v1',backupKey:'jjk_hd2d_backup_v1',phase:'title',busy:false,restoring:false,current:null,
 message(t){$('saveStatus').textContent=t;$('menuMessage').textContent=t;},
 clean(value,depth=0){if(depth>18)throw Error('存档层级异常');if(typeof value==='string'){if(value.length>12000||/[<>]/.test(value))throw Error('存档文本异常');return;}if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>1e18)throw Error('存档数值异常');return;}if(value===null||typeof value==='boolean')return;if(typeof value!=='object')throw Error('存档格式异常');if(Object.keys(value).length>1500)throw Error('存档数据过多');for(const [k,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))throw Error('存档字段异常');this.clean(v,depth+1);}},
 validate(s){this.clean(s);if(s.version!==1||s.game!=='jujutsu-hd2d'||!['create','world','ended'].includes(s.phase))throw Error('不是兼容的游戏存档');if(!Number.isInteger(s.step)||s.step<0||s.step>11||!s.draws||typeof s.draws!=='object')throw Error('角色抽取数据不完整');
  for(let i=0;i<12;i++){const step=Game.createSteps[i],d=s.draws[step.key];if((s.phase!=='create'||i<s.step)&&!d)throw Error('缺少角色抽取项');if(d){const idx=step.items.findIndex(x=>x.label===d.label);if(idx<0)throw Error('抽取项不受支持');const expected=deepCopy(step.items[idx]);if(step.key==='hp')expected.tierIdx=idx;if(JSON.stringify(d)!==JSON.stringify(expected))throw Error('抽取项与游戏规则不一致');}}
  if(s.phase!=='create'){const p=s.player;if(!p||!Number.isInteger(s.day)||s.day<0||s.day>121)throw Error('旅程数据缺失');for(const k of ['hp','maxHp','cp','maxCp','ctl','prof','levelIndex','startDay','growthMult','statBoost','battleCount','huntCount','flashCount'])if(!Number.isFinite(p[k]))throw Error('属性数据不完整：'+k);if(p.maxHp<=0||p.maxCp<0||p.levelIndex< -2||p.levelIndex>11||s.day<p.startDay)throw Error('角色属性超出范围');for(const k of ['melee','eff'])if(!Array.isArray(p[k])||p[k].length!==2||p[k].some(x=>typeof x!=='number'||x<0))throw Error('伤害属性异常');for(const k of ['stolen','stolenTechs','absorbed','notes','eventsDone'])if(!Array.isArray(p[k]))throw Error('技能数据缺失');if(!p.technique||!WHEEL_TECHNIQUE.some(t=>t.flag===p.technique.flag))throw Error('术式数据不兼容');if(!Array.isArray(s.logs)||s.logs.length>500)throw Error('手记数据异常');if(s.phase==='ended'&&!['win','loseFinal','death'].includes(s.ending?.kind))throw Error('结局数据异常');}
  if(s.phase!=='create'){
   const p=s.player,strings=v=>Array.isArray(v)&&v.every(x=>typeof x==='string'),pair=v=>Array.isArray(v)&&v.length===2&&v.every(x=>Number.isFinite(x)&&x>=0)&&v[0]<=v[1];
   const tech=t=>t&&typeof t==='object'&&typeof t.name==='string'&&typeof t.flag==='string'&&(t.domain===undefined||typeof t.domain==='string')&&(t.flags===undefined||strings(t.flags));
   if(!tech(p.technique)||!p.stolenTechs.every(t=>tech(t)&&Number.isFinite(t.prof)&&t.prof>=0&&t.prof<=300))throw Error('术式字段格式异常');
   if(!strings(p.notes)||!strings(p.stolen)||!s.logs.every(l=>l&&typeof l.cls==='string'&&typeof l.text==='string'))throw Error('手记字段格式异常');
   if(!pair(p.melee)||!pair(p.eff)||!Number.isInteger(p.levelIndex)||!Number.isInteger(p.startDay))throw Error('属性范围异常');
   if(p.absorbed.length>24||!p.absorbed.every(a=>a&&typeof a.name==='string'&&Number.isInteger(a.li)&&a.li>=-2&&a.li<=11&&Number.isFinite(a.maxHp)&&a.maxHp>0&&Number.isFinite(a.maxCp)&&a.maxCp>=0&&pair(a.melee)&&pair(a.eff)))throw Error('吸收角色数据异常');
   // Batch C2 好感度：存量存档缺失时补空表，再校验取值范围
   if(p.favors===undefined)p.favors={};
   if(!p.favors||typeof p.favors!=='object'||Array.isArray(p.favors)||Object.keys(p.favors).length>50||!Object.entries(p.favors).every(([k,v])=>typeof k==='string'&&k.length<=20&&Number.isInteger(v)&&v>=0&&v<=100))throw Error('好感度数据异常');
  }
  return s;
 },
 snapshot(){const logs=[...$('mainLog').children].slice(-350).map(n=>({cls:n.className,text:n.textContent}));return {game:'jujutsu-hd2d',version:1,savedAt:new Date().toISOString(),phase:this.phase,step:Game.stepIdx,draws:deepCopy(Game.draws),day:Game.day,player:Game.player?deepCopy(Game.player):null,logs,ending:this.ending||null};},
 write(s){this.current=s;try{const old=localStorage.getItem(this.key);if(old)localStorage.setItem(this.backupKey,old);localStorage.setItem(this.key,JSON.stringify(s));this.message('已保存 · '+new Date(s.savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));return true;}catch{this.message('浏览器未能保存，请导出备份');return false;}},
 checkpoint(){if(this.restoring||this.busy||this.phase==='title')return false;return this.write(this.snapshot());},
 read(){for(const k of [this.key,this.backupKey]){try{const v=localStorage.getItem(k);if(v){const s=this.validate(JSON.parse(v));if(k===this.backupKey)this.message('主存档损坏，已找到备份');return s;}}catch{}}return this.current;},
 describe(){const s=this.read();$('slotInfo').textContent=s?`${s.phase==='create'?'角色创建 · 第'+(s.step+1)+'项':s.phase==='ended'?'旅程结局':'第'+s.day+'天 · '+s.player.identity} / ${new Date(s.savedAt).toLocaleString('zh-CN')}`:'还没有存档，开始穿越后自动保存。';},
 restore(s){if(this.busy||Game.wheel?.spinning)throw Error('请等待当前行动或抽取结束再读档');this.validate(s);this.restoring=true;try{this.busy=false;this.phase=s.phase;this.ending=s.ending;Game.player=null;Game.startCreate();Game.draws=deepCopy(s.draws);Game.loadStep(s.step);Game.renderCreateAttrs();const key=Game.createSteps[s.step].key;if(s.draws[key]){$('wheelResult').textContent=s.draws[key].label;$('btnSpin').classList.add('hidden');$('btnNextWheel').classList.remove('hidden');HD.refreshCreation();}
   if(s.phase!=='create'){Game.player=deepCopy(s.player);Game.day=s.day;Game.logEl=$('mainLog');Game.logEl.replaceChildren();for(const l of s.logs){const d=document.createElement('div');d.className=['lg','lp','lgold','lred','lgreen','lcyan'].includes(l.cls)?l.cls:'lg';d.textContent=l.text;Game.logEl.append(d);}$('lastEvent').textContent=s.logs.at(-1)?.text||'';$('titleScreen').classList.add('hidden');$('createScreen').classList.add('hidden');$('mainScreen').classList.remove('hidden');Game.render();$('btnActionWheel').disabled=false;if(s.phase==='ended')Game.ending(s.ending.kind,STORY[s.ending.day]||{title:s.ending.title||'狩猎咒灵'});}
   this.current=s;this.phase=s.phase;this.message('存档已恢复');$('menuDialog').close();window.scrollTo(0,0);
  }finally{this.restoring=false;}},
 download(){const s=this.busy?this.read():(this.phase==='title'?this.read():this.snapshot());if(!s)return this.message('没有可导出的存档');const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='咒术轮回-存档'+(this.slot||1)+'-第'+(s.run?.cycle||1)+'周目-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.message(this.busy?'已导出本日行动前的存档':'存档已导出');},
 init(){
  const start=Game.startCreate;Game.startCreate=function(){document.querySelectorAll('.ending-wrap').forEach(e=>e.closest('section').remove());$('mainLog').replaceChildren();$('lastEvent').textContent='';Save.phase='create';Save.ending=null;Game.player=null;start.call(this);if(!Save.restoring)Save.checkpoint();};
  const attr=Game.renderCreateAttrs;Game.renderCreateAttrs=function(){attr.call(this);if(Save.phase==='create')Save.checkpoint();};
  const next=Game.nextStep;Game.nextStep=function(){next.call(this);Save.checkpoint();};
  const finish=Game.finishCreate;Game.finishCreate=function(){finish.call(this);Save.phase='world';Save.checkpoint();};
  const daily=Game.dailyAction;Game.dailyAction=async function(){if(Save.busy)return;Save.checkpoint();Save.busy=true;Save.message('行动中 · 已保留行动前存档');try{await daily.call(this);}finally{Save.busy=false;Save.checkpoint();}};
  const ending=Game.ending;Game.ending=function(kind,node){document.querySelectorAll('.ending-wrap').forEach(e=>e.closest('section').remove());Save.phase='ended';Save.ending={kind,day:Game.day,title:node?.title||''};ending.call(this,kind,node);if(!Save.restoring)Save.write(Save.snapshot());};
  $('btnStart').onclick=()=>{if(this.read()&&!confirm('开始新的旅程会替换当前自动存档。需要保留旧旅程时，请先在菜单中导出。继续？'))return;Game.startCreate();};
  $('btnContinue').onclick=()=>{try{const s=this.read();if(s)this.restore(s);}catch(e){this.message(e.message);}};
  $('manualSave').onclick=()=>{if(this.busy)return this.message('行动进行中，已保留行动前存档');if(this.phase==='title')return this.message('请先开始或继续旅程');this.checkpoint();this.describe();};
  $('exportSave').onclick=()=>this.download();$('importSave').onclick=()=>$('saveFile').click();
  $('saveFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(this.busy||Game.wheel?.spinning)throw Error('请先完成当前行动或抽取再导入');if(f.size>1500000)throw Error('存档文件过大');const s=this.validate(JSON.parse(await f.text()));if(this.read()&&!confirm('导入将替换当前存档，是否继续？'))return;this.restore(s);this.write(s);this.describe();}catch(err){this.message('导入失败：'+err.message);}finally{e.target.value='';}};
  $('backTitle').onclick=()=>{if(!this.busy)this.checkpoint();location.reload();};
  const s=this.read();if(s){this.current=s;$('btnContinue').classList.remove('hidden');$('btnStart').classList.add('ghost');$('btnStart').textContent='新的旅程';$('continueMeta').textContent=s.phase==='create'?'继续完成角色创建':s.phase==='ended'?'上一段旅程已结束，可查看结局':'上次停留：第 '+s.day+' 天 · '+s.player.identity;}
 }
};window.Save=Save;
