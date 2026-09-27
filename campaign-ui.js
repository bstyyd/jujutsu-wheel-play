'use strict';
const CampaignUI={
  pending:null,
  open(slot, nextRun=null, priorDraws=null){
    if(Save.busy||Game.wheel?.spinning)return Save.message('请先完成当前行动或抽取');
    this.pending=nextRun?deepCopy(nextRun):Campaign.fresh('custom');
    const free=Array.from({length:6},(_,i)=>i+1).find(i=>!Save.hasSlot(i));
    $('journeySlot').replaceChildren();
    for(let i=1;i<=6;i++){const o=document.createElement('option');o.value=i;o.textContent=`存档 ${i} · ${Save.hasSlot(i)?'已有旅程（开始时确认替换）':'空槽位'}`;$('journeySlot').append(o);}
    $('journeySlot').value=slot||free||Save.slot;
    $('journeyHeading').textContent=nextRun?`进入第 ${nextRun.cycle} 周目`:'选择你的开局';
    $('journeyMode').value=nextRun?'custom':'random';
    const defaults={identity:2,era:0,age:6,gender:0,face:4,technique:4,cp:3,ctl:3,melee:3,hp:4,eff:3,growth:3};
    const root=$('customFields');root.replaceChildren();
    Game.createSteps.forEach(step=>{
      const label=document.createElement('label');label.className='config-field';label.textContent=step.title;
      const sel=document.createElement('select');sel.id='config-'+step.key;sel.dataset.setting=step.key;
      step.items.forEach((item,i)=>{const o=document.createElement('option');o.value=i;o.textContent=item.label;sel.append(o);});
      const from=priorDraws?.[step.key];sel.value=from?Math.max(0,step.items.findIndex(x=>x.label===from.label)):Math.min(defaults[step.key],step.items.length-1);
      sel.onchange=()=>this.preview();label.append(sel);root.append(label);
    });
    $('startProficiency').value='0';$('startReverse').checked=false;$('startBlackFlash').checked=false;
    $('journeyMessage').textContent='';this.preview();$('journeyDialog').showModal();
  },
  recommend(){
    const era=Campaign.eras[Number($('config-era').value)];
    for(const key of ['cp','ctl','melee','eff'])$('config-'+key).value=Math.min(era.tier,Game.createSteps.find(s=>s.key===key).items.length-1);
    $('config-hp').value=Math.min(era.tier+1,WHEEL_HP.length-1);
    $('startProficiency').value=era.day>=100?'100':era.day>=49?'60':'0';this.preview();
  },
  preview(){
    const custom=$('journeyMode').value==='custom';$('customSetup').hidden=!custom;
    const era=Campaign.eras[Number($('config-era')?.value)||0],r=this.pending,d=Campaign.difficulty(r.cycle);
    $('chapterBrief').textContent=era.brief;
    const flag=Game.createSteps[5].items[Number($('config-technique')?.value)||0];$('techniqueBrief').textContent=flag.desc;
    $('journeySummary').textContent=`第 ${r.cycle} 周目 · 敌人生命 ×${d.hp.toFixed(2)} / 伤害 ×${d.damage.toFixed(2)}${r.carry?` · 开局继承加成 ${r.carry}% · 继承熟练度 ${r.inheritedProf}%`:''}`;
    $('journeyStart').textContent=custom?'以此配置进入世界':'开始十二项抽取';
  },
  start(){
    try{
      if(Save.busy||Game.wheel?.spinning)throw Error('请先完成当前行动');
      const slot=Number($('journeySlot').value),custom=$('journeyMode').value==='custom';
      if(Save.hasSlot(slot)&&!confirm(`使用当前开局配置替换存档 ${slot}？其他槽位保留。`))return;
      if(Save.phase!=='title'&&slot!==Save.slot&&!Save.checkpoint())throw Error('请先导出当前未保存进度');
      const r=deepCopy(this.pending);r.mode=custom?'custom':'random';r.origin=custom?Campaign.eras[Number($('config-era').value)].day:0;
      const prof=custom?Number($('startProficiency').value):0;
      const reverse=custom&&$('startReverse').checked,blackFlash=custom&&$('startBlackFlash').checked;
      Save.select(slot);Campaign.state=r;Save.failed=false;Game.startCreate();
      if(custom){
        for(const step of Game.createSteps){const idx=Number($('config-'+step.key).value),d=deepCopy(step.items[idx]);if(step.key==='hp')d.tierIdx=idx;Game.draws[step.key]=d;}
        Game.stepIdx=11;Game.finishCreate();
        Player.gainProf(Game.player,Math.max(0,prof-Game.player.prof)/(Game.player.identity==='咒术师'?1.2:1));
        Game.player.reverse=reverse;Game.player.blackFlash=blackFlash;Game.render();Save.checkpoint();
      }
      $('journeyDialog').close();Save.refreshTitle();window.scrollTo(0,0);
    }catch(e){$('journeyMessage').textContent=e.message;}
  },
  world(){
    if(!Game.player||!Campaign.modern()){$('journeyStatus').hidden=true;return;}
    const r=Campaign.state,d=Campaign.difficulty(r.cycle),facts=Campaign.facts();$('journeyStatus').hidden=false;
    $('journeyStatus').textContent=`存档 ${Save.slot} · 第 ${r.cycle} 周目 · 敌人 HP ×${d.hp.toFixed(2)} / 伤害 ×${d.damage.toFixed(2)}${r.preparation?' · 已整备：'+(r.preparation==='guard'?'护身':'咒力补给'):''}`;
    const era=[...Campaign.eras].reverse().find(e=>e.day<=Game.day);document.querySelector('.scene-label b').textContent=era.place;
    const eraName=WHEEL_ERA.find(e=>e.day===era.day).label;$('dayEra').textContent=eraName;
    $('chapterTag').textContent=facts.gojoSealed?'五条被封印 · 主线继续':Game.day>=118?'新宿决战 · 最终挑战':eraName;
    const next=EVENT_DAYS.find(d=>d>Game.day);$('nextEvent').textContent=next?`距离${STORY[next].chapter}事件还有 ${next-Game.day} 天`:'本周目已到终点';
    $('btnActionWheel').textContent=STORY[Game.day+1]?'进入剧情事件':'安排今日行动';
    $('btnActionWheel').disabled=Save.busy||Save.phase==='ended'||Save.failed;
  },
  battle(){
    const eng=BattleUI.eng;if(!eng?.cfg.v3||!$('bfActions'))return;
    let banner=$('missionStatus');
    if(!banner){banner=document.createElement('div');banner.id='missionStatus';banner.className='mission-status';$('modalBox').querySelector('.seq-wrap').before(banner);}
    const obj=eng.cfg.objective;banner.textContent=(obj?.label||'击退敌人，赢得本场战斗')+(obj?.type==='survive'?` · ${Math.min(eng.objectiveTurns||0,obj.turns)}/${obj.turns} 次行动`:'');
    $('bfEnemy').querySelectorAll('.unit').forEach(card=>{
      const u=eng.units[Number(card.dataset.idx)];if(!u?.alive)return;
      card.querySelectorAll('.enemy-intent').forEach(el=>el.remove());
      const p=Tactics.plan(eng,u),intent=document.createElement('div');intent.className='enemy-intent'+(p.danger?' danger':'');
      const target=Tactics.target(eng,u,p.target);
      intent.innerHTML=u.buff.stun?'受控 · 本次行动跳过':`<b>${p.danger?'⚠ ':''}下次：${HD.escape(p.label)}</b><span class="intent-target">${p.action==='charge'?'蓄力 · 下一次行动释放':p.scope==='all'?'范围：己方全体':target?'目标：'+HD.escape(target.name):'准备行动'}</span>`;
      intent.title='预告会保留到行动执行；控制、目标倒下或咒力不足可能使行动取消或改用体术。';card.querySelector('.unit-info').append(intent);
    });
    $('actDefend').title='受到伤害减半，并恢复 8% 咒力；防御持续至下次自身行动。';
    if($('actDomain'))$('actDomain').disabled=!(eng.awaitingPlayer&&!eng.ended&&eng.player.canDomain&&(eng.player.domainCd||0)<=0&&eng.player.cp>=eng.player.maxCp*.3);
  },
  ending(kind,node){
    closeModal();$('mainScreen').classList.add('hidden');$('createScreen').classList.add('hidden');$('titleScreen').classList.add('hidden');
    const r=Campaign.state,p=Game.player,screen=document.createElement('section');screen.className='screen';
    screen.innerHTML=`<div class="ending-wrap"><p class="eyebrow">第 ${r.cycle} 周目 · 旅程记录</p><h1>${kind==='win'?'最终挑战完成':kind==='death'?'本次旅程结束':'最终挑战未通过'}</h1><p>${kind==='win'?'你完成了本周目的最终挑战。下一周目重新选择开局，敌人会变得更强。':'当前记录已保留，可以另开配置再次挑战。'}</p><div class="journey-records"><span>停留进度<b>第 ${Game.day} 天</b></span><span>生得术式<b>${HD.escape(p.technique.name)}</b></span><span>已完成事件<b>${r.completed.length}</b></span><span>支援与战斗成功<b>${r.missions.filter(m=>m.result==='win').length} / ${r.missions.length}</b></span></div><p class="muted">本页记录玩家挑战成绩，不改写原作结局。多周目是重玩规则。</p><div class="action-row">${kind==='win'&&r.cycle<99?'<button class="btn" id="nextCycle">进入下一周目</button>':''}<button class="btn ghost" id="endingNew">新建旅程</button><button class="btn ghost" id="endingSaves">存档管理</button></div>${r.chronicles.length?'<details><summary>历次周目</summary>'+r.chronicles.map(c=>`<p>第 ${c.cycle} 周目 · ${HD.escape(c.technique)}</p>`).join('')+'</details>':''}</div>`;
    $('gameApp').append(screen);
    if($('nextCycle'))$('nextCycle').onclick=()=>{try{const s=Save.snapshot();this.open(null,Campaign.nextRun(s),s.draws);}catch(e){Save.message(e.message);}};
    $('endingNew').onclick=()=>this.open();$('endingSaves').onclick=()=>HD.menu();window.scrollTo(0,0);
  },
  init(){
    $('journeyMode').onchange=()=>this.preview();$('recommendConfig').onclick=()=>this.recommend();$('journeyStart').onclick=()=>this.start();
    $('manageSlots').onclick=()=>HD.menu();
    const render=Game.render;Game.render=function(){render.call(this);CampaignUI.world();};
    const battle=BattleUI.render;BattleUI.render=function(){battle.call(this);CampaignUI.battle();};
    const wait=BattleUI.waitInput;BattleUI.waitInput=function(){wait.call(this);CampaignUI.battle();};
    $('journeyDialog').addEventListener('click',e=>{if(e.target.closest('[data-close]'))$('journeyDialog').close();});
    Save.init();
  }
};
window.CampaignUI=CampaignUI;CampaignUI.init();
