'use strict';
// Independent slots; legacy keys are read-only migration inputs and are never removed.
Object.assign(Save,{
  slot:1,slotCount:6,cache:new Map(),expected:new Map(),slotPrefix:'jjk_hd2d_slot_v2_',
  selectKey:'jjk_hd2d_selected_v2',migrationKey:'jjk_hd2d_migrated_v2',
  slotKey(id){if(!Number.isInteger(id)||id<1||id>this.slotCount)throw Error('存档槽位无效');return this.slotPrefix+id;},
  raw(id=this.slot){try{return localStorage.getItem(this.slotKey(id));}catch{return null;}},
  hasSlot(id){return !!this.raw(id)||!!this.read(id);},
  select(id){this.slotKey(id);this.slot=id;this.current=this.cache.get(id)||null;this.expected.set(id,this.raw(id));try{localStorage.setItem(this.selectKey,String(id));}catch{}},
  read(id=this.slot){
    const key=this.slotKey(id);
    for(const k of [key,key+'_backup']){
      try{const raw=localStorage.getItem(k);if(raw){const s=this.validate(JSON.parse(raw));if(k.endsWith('_backup')&&id===this.slot)this.message('主存档损坏，已找到备份');return s;}}catch{}
    }
    return this.cache.get(id)||null;
  },
  write(s){
    try{s=this.validate(s);}catch(e){this.message('保存数据异常：'+e.message);return false;}
    try{
      const old=this.raw();
      if(this.expected.has(this.slot)&&this.expected.get(this.slot)!==old){this.message('其他标签页已更新此存档。请重新读档，或导出当前进度。');return false;}
      const raw=JSON.stringify(s);
      if(old){try{this.validate(JSON.parse(old));localStorage.setItem(this.backupKey,old);}catch{/* Keep the last valid backup when the primary was corrupt. */}}
      localStorage.setItem(this.key,raw);this.expected.set(this.slot,raw);this.cache.set(this.slot,deepCopy(s));this.current=s;
      this.message(`存档 ${this.slot} · 已保存 ${new Date(s.savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`);return true;
    }catch{this.cache.set(this.slot,deepCopy(s));this.current=s;this.message('浏览器未能保存，请导出当前进度备份');return false;}
  },
  migrate(){
    try{
      if(localStorage.getItem(this.migrationKey))return;
      let legacy;
      for(const key of ['jjk_hd2d_save_v1','jjk_hd2d_backup_v1']){try{const raw=localStorage.getItem(key);if(raw){legacy=this.validate(JSON.parse(raw));break;}}catch{}}
      if(legacy){
        const free=Array.from({length:this.slotCount},(_,i)=>i+1).find(id=>!this.hasSlot(id));
        if(!free){this.message('槽位已满，旧版存档仍保留，可导出后导入。');return;}
        this.select(free);if(!this.write(legacy))return;
      }
      localStorage.setItem(this.migrationKey,'done');
    }catch{this.message('存储不可用；游戏仍可运行，请及时导出。');}
  },
  describe(){
    const s=this.read();$('slotInfo').textContent=s?`当前存档 ${this.slot} · ${this.summary(s)}`:`当前存档 ${this.slot} · 尚未创建`;
    $('importTarget').value=String(this.slot);
    const list=$('slotList');if(!list)return;
    list.replaceChildren();
    for(let id=1;id<=this.slotCount;id++){
      const v=this.read(id),row=document.createElement('div');row.className='save-slot'+(id===this.slot?' current':'');
      const info=document.createElement('div'),name=document.createElement('b'),sub=document.createElement('small');name.textContent=`存档 ${id}${id===this.slot?' · 当前':''}`;sub.textContent=v?this.summary(v):this.hasSlot(id)?'数据无法读取，可导入备份':'空槽位';info.append(name,sub);row.append(info);
      const action=document.createElement('button');action.className='btn small ghost';action.textContent=v?'读取':'新建';action.disabled=this.busy||!!Game.wheel?.spinning;
      action.onclick=()=>{try{if(v){if(this.slot!==id&&!this.checkpoint()&&this.phase!=='title')throw Error('当前进度未保存，请先导出');this.select(id);this.restore(v);}else{$('menuDialog').close();CampaignUI.open(id);}}catch(e){this.message(e.message);}};
      row.append(action);
      if(v||this.hasSlot(id)){const del=document.createElement('button');del.className='text-btn slot-delete';del.textContent='删除';del.setAttribute('aria-label',`删除存档 ${id}`);del.disabled=this.busy||!!Game.wheel?.spinning||(id===this.slot&&this.phase!=='title');del.onclick=()=>{
        if(!confirm(`删除存档 ${id} 及该槽位的备份？此操作不能撤销。`))return;
        try{localStorage.removeItem(this.slotKey(id));localStorage.removeItem(this.slotKey(id)+'_backup');this.cache.delete(id);this.expected.delete(id);if(id===this.slot)this.current=null;this.describe();this.refreshTitle();}catch{this.message('删除失败，浏览器存储不可用');}
      };row.append(del);}
      list.append(row);
    }
  },
  summary(s){return `${s.run.mode==='legacy'?'旧版旅程':s.run.mode==='custom'?'自定义':'随机'} · 第 ${s.run.cycle} 周目 · ${s.phase==='create'?'创建角色 '+(s.step+1)+'/12':s.phase==='ended'?'已结局':'第 '+s.day+' 天'}${s.player?' · '+s.player.technique.name:''}`;},
  refreshTitle(){const s=this.read();$('btnContinue').classList.toggle('hidden',!s);$('btnStart').textContent='新的旅程';$('continueMeta').textContent=s?`存档 ${this.slot} · ${this.summary(s)}`:'六个独立存档，支持导入与导出。';},
  init(){
    const selected=Number((()=>{try{return localStorage.getItem(this.selectKey);}catch{return 1;}})());this.select(selected>=1&&selected<=6&&Number.isInteger(selected)?selected:1);
    this.migrate();
    const start=Game.startCreate;Game.startCreate=function(){
      document.querySelectorAll('.ending-wrap').forEach(e=>e.closest('section').remove());$('mainLog').replaceChildren();$('lastEvent').textContent='';Game.player=null;
      if(!Save.restoring){Save.phase='create';Save.ending=null;Campaign.state=Campaign.state||Campaign.fresh();Game.day=Campaign.state.origin;}
      start.call(this);if(!Save.restoring)Save.checkpoint();
    };
    const attr=Game.renderCreateAttrs;Game.renderCreateAttrs=function(){attr.call(this);if(Save.phase==='create')Save.checkpoint();};
    const next=Game.nextStep;Game.nextStep=function(){next.call(this);Save.checkpoint();};
    const finish=Game.finishCreate;Game.finishCreate=function(){finish.call(this);Save.phase='world';Save.checkpoint();};
    const daily=Game.dailyAction;Game.dailyAction=async function(){if(Save.busy||Save.failed||Save.phase!=='world')return;Save.checkpoint();Save.busy=true;Save.message('行动中 · 已保留行动前存档');let complete=false;try{await daily.call(this);complete=true;}catch(e){Save.failed=true;closeModal();Game.addLog('lred','本次行动未完成，请在菜单中重新读取行动前存档。');Save.message('行动中断：'+e.message);}finally{Save.busy=false;if(complete)Save.checkpoint();if(Campaign.modern())CampaignUI.world();}};
    const ending=Game.ending;Game.ending=function(kind,node){
      document.querySelectorAll('.ending-wrap').forEach(e=>e.closest('section').remove());Save.phase='ended';Save.ending={kind,day:Game.day,title:node?.title||''};
      if(Campaign.modern())CampaignUI.ending(kind,node);
      else{
        ending.call(this,kind,node);
        if(kind==='win'&&Game.day===120){const b=document.createElement('button');b.className='btn';b.textContent='进入新版第二周目';b.onclick=()=>{const s=Save.snapshot();CampaignUI.open(null,Campaign.nextRun(s),s.draws);};document.querySelector('.ending-wrap').append(b);}
      }
      if(!Save.restoring)Save.write(Save.snapshot());
    };
    $('btnStart').onclick=()=>CampaignUI.open();
    $('btnContinue').onclick=()=>{try{const s=this.read();if(s)this.restore(s);}catch(e){this.message(e.message);}};
    $('manualSave').onclick=()=>{if(this.busy)return this.message('行动中已保留开始前存档');if(this.phase==='title')return this.message('请先开始或继续旅程');this.checkpoint();this.describe();};
    $('exportSave').onclick=()=>this.download();$('importSave').onclick=()=>$('saveFile').click();
    $('saveFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{
      if(this.busy||Game.wheel?.spinning)throw Error('请先完成当前行动或抽取');if(f.size>1500000)throw Error('存档文件过大');
      const target=Number($('importTarget').value);this.slotKey(target);
      const s=this.validate(JSON.parse(await f.text()));if(this.hasSlot(target)&&!confirm(`用导入文件替换存档 ${target}？其他槽位不受影响。`))return;
      if(target!==this.slot&&this.phase!=='title'&&!this.checkpoint())throw Error('当前进度未保存，请先导出');
      this.select(target);this.restore(s);this.write(s);this.describe();
    }catch(err){this.message('导入失败：'+err.message);}finally{e.target.value='';}};
    $('backTitle').onclick=()=>{if(this.busy)return this.message('请先完成当前行动');if(this.phase!=='title'&&!this.checkpoint())return;location.reload();};
    this.refreshTitle();
  }
});
Object.defineProperties(Save,{key:{get(){return this.slotKey(this.slot);}},backupKey:{get(){return this.slotKey(this.slot)+'_backup';}}});
const validateV1=Save.validate.bind(Save);
Save.validate=function(input){
  if(!input||![1,2].includes(input.version))throw Error('不是兼容的游戏存档');
  validateV1({...input,version:1});
  const s=deepCopy(input);
  if(input.version===1){s.version=2;s.run=Campaign.fresh('legacy',s.draws.era?.day||0);}
  Campaign.validate(s.run,s.day,s.phase);
  if(s.phase!=='create'&&(s.player.startDay!==s.run.origin||(s.run.mode!=='legacy'&&s.player.isVillain)))throw Error('开局与剧情阵营数据不一致');
  return s;
};
const snapshotV1=Save.snapshot.bind(Save);
Save.snapshot=function(){return {...snapshotV1(),version:2,run:deepCopy(Campaign.state||Campaign.fresh('legacy'))};};
const checkpointV1=Save.checkpoint.bind(Save);
Save.checkpoint=function(){if(this.failed)return false;return checkpointV1();};
const downloadV1=Save.download.bind(Save);
Save.download=function(){const busy=this.busy;if(this.failed)this.busy=true;try{return downloadV1();}finally{this.busy=busy;}};
const restoreV1=Save.restore.bind(Save);
Save.restore=function(input){const s=this.validate(input);if(this.busy||Game.wheel?.spinning)throw Error('请先完成当前行动');Campaign.state=deepCopy(s.run);this.failed=false;this.expected.set(this.slot,this.raw());restoreV1(s);this.cache.set(this.slot,deepCopy(s));this.refreshTitle();};
