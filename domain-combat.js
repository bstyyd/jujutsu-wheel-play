/* Transient battle rules. Nothing in this module is written into a save. */
(() => {
  const scenes=window.BattleScenes, proto=BattleEngine.prototype;
  const fields=e=>e.domainFields||[];
  const active=(e,u)=>fields(e).find(f=>f.owner===e.units.indexOf(u));
  const opposite=(e,f)=>fields(e).find(g=>g.side!==f.side);
  const cost=u=>u.skills?.sixEyes?0:Math.round(u.maxCp*.30);
  const ready=(e,u)=>!!u?.alive&&!window.BattleTraits?.blocked(e,u,'domain')&&!e.ended&&u.canDomain&&!(u.domainCd>0)&&u.cp>=cost(u)&&!fields(e).some(f=>f.side===u.side);
  const snapshot=e=>fields(e).map(f=>({...f}));
  const emit=(e,ev,type,text,extra={})=>ev.push({type,text,domainSnapshot:snapshot(e),...extra});
  const mastery=u=>/五条悟|宿傩/.test(u.name)?260:/羂索/.test(u.name)?250:/真人/.test(u.name)?185:/漏[壶瑚]/.test(u.name)?180:/伏黑惠/.test(u.name)?110:160;
  const power=(e,u)=>Math.round((u.isPlayer?Math.max(100,Math.min(300,e.cfg.player.prof||100)):mastery(u))*.7+Math.min(120,Math.log2(1+Math.max(0,u.ctl))*7));
  const collapse=(e,f,ev,reason)=>{
    if(!fields(e).includes(f))return;
    e.domainFields=fields(e).filter(g=>g!==f);
    const owner=e.units[f.owner];if(owner)owner.domainCd=owner.reverse?2:9999;
    emit(e,ev,'domain_end',`【${f.name}】${reason}，领域崩解。`,{domainName:f.name,actorName:owner?.name});
  };
  const begin=(e,u,ev)=>{
    const n=scenes.name(u.domainName),p=scenes.profileFor({name:n,actorName:u.name,isPlayer:u.isPlayer});
    u.cp-=cost(u);u.domainUsed=1;u.domainCd=9001;
    const f={owner:e.units.indexOf(u),actorName:u.name,side:u.side,name:n,key:p?.key||null,open:!!p?.open,incomplete:!!p?.incomplete,nonlethal:!!p?.nonlethal,remaining:3,stability:100,power:power(e,u),born:e.actionsTotal,fresh:true};
    f.traitName=(u.isPlayer||scenes.npcDomain(u.name)===n)&&window.BattleTraits?.rules[n]?n:null;
    (e.domainFields||=[]).push(f);
    emit(e,ev,'domain',`${u.name} 展开【${n}】！`,{domainName:n,actorName:u.name,side:u.side,isPlayer:!!u.isPlayer});return f;
  };
  const clash=(e,ev)=>{
    if(fields(e).length<2)return;
    const [a,b]=fields(e),strong=a.power>=b.power?a:b,weak=strong===a?b:a;
    // An incomplete domain can contest a sure-hit, but cannot overpower a complete one.
    if(strong.power>=weak.power*1.5&&!strong.incomplete&&!weak.incomplete){
      emit(e,ev,'domain_clash',`领域对抗！【${strong.name}】的精炼度压过了【${weak.name}】。`);
      collapse(e,weak,ev,'在对抗中失守');
    }else emit(e,ev,'domain_clash','领域对抗僵持：双方必中抵消。攻击施术者，动摇对方领域！');
  };
  const pulse=(e,f,ev,opening=false)=>{
    if(!fields(e).includes(f)||e.ended)return;
    if(window.BattleTraits?.domainPulse(e,f,ev,opening))return;
    if(opposite(e,f))return;
    const u=e.units[f.owner];if(!u?.alive)return;
    if(f.incomplete){emit(e,ev,'domain_state',`【${f.name}】维持影之空间；不完整领域没有必中。`);return;}
    const targets=e.alive(u.side==='ally'?'enemy':'ally');
    if(f.nonlethal){
      targets.forEach(t=>t.buff.seal=Math.max(t.buff.seal,2));
      emit(e,ev,'domain_state','【诛伏赐死】判决压制：对手输出暂时降低。本作采用简化判决，不造成领域直接伤害。');return;
    }
    const avg=(u.eff[0]+u.eff[1])/2,total=u.isPlayer?avg*6+u.maxCp*.06:avg*(u.side==='enemy'?3.5:5);
    // Spread the old burst over the opening and three upkeep turns.
    const damage=Math.round(total*(opening?.4:.2));
    emit(e,ev,'domain_state',`【${f.name}】必中生效。`);
    for(const t of targets){if(!fields(e).includes(f)||e.ended)break;e.dealDamage(u,t,damage,1,'domain',ev,`${f.name}·必中`,false,true);}
    e.checkEnd(ev);
  };
  const resolveCast=(e,u,counter,ev)=>{
    if(!ready(e,u))return false;
    const canCounter=counter&&ready(e,counter);
    begin(e,u,ev);
    if(canCounter)begin(e,counter,ev).fresh=false;
    clash(e,ev);
    for(const f of [...fields(e)])pulse(e,f,ev,true);
    return true;
  };
  const npcCounter=(e,u)=>e.alive(u.side==='ally'?'enemy':'ally').filter(x=>!x.isPlayer&&ready(e,x)).sort((a,b)=>power(e,b)-power(e,a))[0];
  proto.castDomain=function(u,ev){
    if(this.pendingDomain||!ready(this,u)){
      if(u.isPlayer)ev.push({type:'info',text:fields(this).some(f=>f.side===u.side)?'我方领域正在维持。':u.domainCd>0?'领域熔断中，暂不能再次展开。':'咒力不足或尚未领悟领域。'});
      return false;
    }
    if(this.cfg.domainReactions&&u.side==='enemy'&&ready(this,this.player)){
      const id=this.domainRequestSerial=(this.domainRequestSerial||0)+1;
      this.pendingDomain={id,owner:this.units.indexOf(u)};
      ev.push({type:'domain_request',requestId:id,actorName:u.name,domainName:scenes.name(u.domainName),text:`${u.name} 正在展开领域，可以立即应对。`});return true;
    }
    return resolveCast(this,u,npcCounter(this,u),ev);
  };
  proto.resolveDomain=function(id,counter){
    const pending=this.pendingDomain;if(!pending||pending.id!==id)return null;
    this.pendingDomain=null;const ev=[],u=this.units[pending.owner];
    if(!this.ended&&u?.alive){resolveCast(this,u,counter&&ready(this,this.player)?this.player:null,ev);this.afterAction(u,ev);}
    return this.pack(ev);
  };
  const advance=proto.advance;
  proto.advance=function(){if(this.pendingDomain)return {events:[],needInput:false,waitingDomain:true,ended:this.ended};return advance.call(this);};
  const after=proto.afterAction;
  proto.afterAction=function(u,ev){
    if(this.pendingDomain?.owner===this.units.indexOf(u))return;
    after.call(this,u,ev);if(this.ended)return;
    const f=active(this,u);if(f){
      if(f.fresh){f.fresh=false;return;}
      // Includes a skipped (stunned) turn; keeping a barrier is not a free pause.
      const upkeep=u.skills?.sixEyes?0:Math.round(u.maxCp*.05);
      if(u.cp<upkeep){collapse(this,f,ev,'因咒力不足');return;}
      u.cp-=upkeep;
      const enemy=opposite(this,f);
      if(enemy){
        const erosion=8+Math.min(20,Math.max(0,(f.power/enemy.power-1)*30))+(f.open&&!enemy.open&&!enemy.incomplete?12:0);
        enemy.stability=Math.max(0,enemy.stability-erosion);
        if(f.incomplete)f.stability=Math.max(0,f.stability-12);
        emit(this,ev,'domain_clash',`领域对攻：【${f.name}】削减对方 ${Math.round(erosion)} 稳定度${f.open&&!enemy.open?'（含开放结界外侧侵蚀）':''}。${f.incomplete?'未完成结界额外损失12稳定度。':''}`);
        if(enemy.stability<=0)collapse(this,enemy,ev,'结界在对攻中破裂');
        if(f.stability<=0)collapse(this,f,ev,'未完成结界无法继续维持');
      }
      if(!fields(this).includes(f))return;
      pulse(this,f,ev);
      if(!fields(this).includes(f))return;
      f.remaining--;if(f.remaining<=0)collapse(this,f,ev,'维持时间结束');else emit(this,ev,'domain_state',`【${f.name}】剩余 ${f.remaining} 次自身行动。`);
    }
  };
  const hit=proto.dealDamage;
  proto.dealDamage=function(u,t,...args){
    const hp=t.hp,ev=args[3],result=hit.call(this,u,t,...args),f=active(this,t);
    if(f&&t.hp<hp){f.stability=Math.max(0,f.stability-(hp-t.hp)/Math.max(1,t.maxHp)*250);
      if(f.stability<=0)collapse(this,f,ev,'因施术者受到重创');else emit(this,ev,'domain_state',`【${f.name}】稳定度 ${Math.ceil(f.stability)}%。`);
    }return result;
  };
  const kill=proto.kill;
  proto.kill=function(u,ev,...args){kill.call(this,u,ev,...args);const f=active(this,u);if(f&&!u.alive)collapse(this,f,ev,'因施术者倒下');};
  const check=proto.checkEnd;
  proto.checkEnd=function(ev){
    const r=check.call(this,ev);
    for(const f of [...fields(this)])if(this.ended||!this.units[f.owner]?.alive)collapse(this,f,ev,this.ended?'随战斗结束':'失去施术者');
    if(this.ended)this.pendingDomain=null;return r;
  };
  const forecast=(e,a,b)=>{
    const pa=power(e,a),pb=power(e,b),incomplete=scenes.profileFor({name:a.domainName,actorName:a.name,isPlayer:a.isPlayer})?.incomplete||scenes.profileFor({name:b.domainName,actorName:b.name,isPlayer:b.isPlayer})?.incomplete;
    return {a:pa,b:pb,text:!incomplete&&pa>=pb*1.5?'预计我方压过对手':!incomplete&&pb>=pa*1.5?'预计对方压过我方':'预计进入僵持 · 必中抵消'};
  };
  window.DomainCombat={fields,active,ready,cost,power,snapshot,collapse,forecast};

  const ui=BattleUI, get=id=>document.getElementById(id),esc=s=>HD.escape(String(s));
  const state=()=>ui.domainShown||[];
  const clearReaction=()=>{get('domainReaction')?.remove();ui._domainDecision=null;};
  const draw=()=>{
    if(!ui.eng||!get('bfActions'))return;
    let hud=get('domainStatus');
    if(!hud){hud=document.createElement('section');hud.id='domainStatus';hud.className='domain-status';hud.setAttribute('aria-label','战场与领域状态');get('bfActions').closest('.modal').querySelector('.battle-field').before(hud);}
    const fs=[...state()].sort((a,b)=>(a.side==='ally'?0:1)-(b.side==='ally'?0:1)),loc=scenes.battle(ui.eng.cfg,Game.day),contested=fs.length>1;
    const html=`<div class="domain-heading"><span>${esc(loc.place)}</span><b>${fs.length?(contested?'领域对抗 · 必中抵消':fs[0].incomplete?'不完整领域':fs[0].nonlethal?'规则领域':fs[0].open?'开放领域':'领域维持'):'常规战场'}</b></div>`+
      (fs.length?`<div class="domain-pair">${fs.map(f=>`<div class="domain-meter ${f.side}"><span>${f.side==='ally'?'我方':'敌方'} · ${esc(f.actorName)}</span><strong>${esc(f.name)}</strong><small>稳定 ${Math.ceil(f.stability)}% · 剩余 ${f.remaining} 行动</small>${window.BattleTraits?`<p class="domain-trait"><b>${esc(window.BattleTraits.info(f.traitName).tag)}</b> · ${esc(window.BattleTraits.info(f.traitName).text)}</p>`:''}<meter min="0" max="100" value="${f.stability}" aria-label="${esc(f.name)}稳定度"></meter></div>`).join('')}</div>${contested?'<p class="clash-tactics">必中与附带控制暂停；攻击施术者削弱稳定度，防御可恢复己方领域15稳定度。影域与刀阵增幅保留。</p>':''}`:'');
    if(hud.innerHTML!==html)hud.innerHTML=html;
    const field=get('bfActions').closest('.modal').querySelector('.battle-field');field.dataset.domainClash=String(contested);field.dataset.baseEnvironment=loc.key;
    let fallback=field.querySelector('.domain-fallback');
    if(!fallback){fallback=document.createElement('div');fallback.className='domain-fallback';fallback.setAttribute('aria-hidden','true');field.prepend(fallback);}
    const shown=contested?['ally','enemy'].map(s=>fs.find(f=>f.side===s)):fs;
    const fallbackKey=shown.map(f=>f&&scenes.profileFor(f,ui.eng.units)?.key||'base').join('/');
    if(fallback.dataset.key!==fallbackKey){fallback.dataset.key=fallbackKey;fallback.innerHTML=shown.map(f=>{
      const p=f&&scenes.profileFor(f,ui.eng.units);if(!p)return '<i></i>';
      if(p.overlay)return '<i style="background:linear-gradient(transparent 48%,rgba(2,8,10,.86))"></i>';
      const bg=p.atlas?`url(assets/${p.file||'domains.webp'}) ${p.atlas[0]?'100%':'0%'} ${p.atlas[1]?'0%':'100%'} / 200% 200%`:`url(assets/${p.file}) center / cover`;
      return `<i class="${p.open||p.overlay?'domain-translucent':''}" style="background:${bg}"></i>`;
    }).join('');}
    const b=get('actDomain');if(b){const p=ui.eng.player;b.disabled=!ui.eng.awaitingPlayer||!ready(ui.eng,p);b.textContent=active(ui.eng,p)?'领域维持中':p.domainCd>0?'领域熔断中':p.cp<cost(p)?'领域 · 咒力不足':'领域展开';}
  };
  const run=ui.run;ui.run=function(cfg){clearReaction();this.domainShown=[];return run.call(this,{...cfg,domainReactions:true});};
  const render=ui.render;ui.render=function(...args){const r=render.apply(this,args);draw();return r;};
  const wait=ui.waitInput;ui.waitInput=function(...args){const r=wait.apply(this,args);draw();return r;};
  const sfx=ui.sfxFor;ui.sfxFor=function(e){if(e.domainSnapshot){this.domainShown=e.domainSnapshot;draw();}return sfx.call(this,e);};
  const animate=ui.eventsAnim;
  ui.eventsAnim=function(events,cb){
    const id=this.runId,eng=this.eng,idx=events.findIndex(e=>e.type==='domain_request');
    const done=()=>{if(id!==this.runId||this.eng!==eng)return;if(eng.ended){clearReaction();this.domainShown=[];draw();window.HDStage?.safely(()=>window.HDStage.sync());return this.finish(eng.result==='win');}cb();};
    if(idx<0)return animate.call(this,events,done);
    const request=events[idx];
    const ask=()=>{
      if(id!==this.runId||this.eng!==eng||eng.ended)return done();
      let settled=false;
      const choose=counter=>{
        if(settled||id!==this.runId||this.eng!==eng)return;settled=true;clearReaction();
        const result=eng.resolveDomain(request.requestId,counter);if(!result)return done();
        this.render();this.eventsAnim([...result.events,...events.slice(idx+1)],cb);
      };
      if(this.auto||!ready(eng,eng.player))return choose(!!this.auto);
      clearReaction();const n=document.createElement('section');n.id='domainReaction';n.className='domain-reaction';n.setAttribute('role','group');n.setAttribute('aria-label','领域应对');
      const forecast=window.DomainCombat.forecast(eng,eng.player,eng.units[eng.pendingDomain.owner]);
      n.innerHTML=`<div><span class="eyebrow">领域来袭</span><h3>${esc(request.actorName)} · ${esc(request.domainName)}</h3><p>迎击将立即消耗 ${cost(eng.player)} 咒力。${esc(forecast.text)}（精炼 ${forecast.a} : ${forecast.b}）。</p><p>${esc(window.BattleTraits?.info(request.domainName).text||'')}</p><p>对攻中攻击施术者可削弱结界，防御可稳固自己的领域；败方进入熔断。</p></div><div class="domain-choices"><button class="btn" data-counter>展开领域迎击</button><button class="btn ghost" data-accept>暂不展开</button></div>`;
      get('bfActions').before(n);this._awaitingInput=false;clearTimeout(this._autoTimer);
      this._domainDecision=choose;n.querySelector('[data-counter]').onclick=()=>choose(true);n.querySelector('[data-accept]').onclick=()=>choose(false);n.querySelector('button').focus({preventScroll:true});
      const bounds=n.getBoundingClientRect();if(bounds.bottom>window.innerHeight-110||bounds.top<20)n.scrollIntoView({block:'center',behavior:'instant'});
    };
    if(idx)animate.call(this,events.slice(0,idx),ask);else ask();
  };
  for(const key of ['finish','_battleFail']){const old=ui[key];ui[key]=function(...args){clearReaction();this.domainShown=[];return old.apply(this,args);};}
  document.addEventListener('click',e=>{if(e.target?.id==='btnAuto'&&ui.auto&&ui._domainDecision)ui._domainDecision(true);});
  window.DomainPresentation={draw,state};
})();
