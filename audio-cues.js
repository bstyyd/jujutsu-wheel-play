'use strict';
// Character-matched local clips. Provenance and listening status: assets/audio/sources.json.
const AnimeVoice={
 cues:[
  {
  "id": "dagon_domain_name",
  "actor": 19,
  "match": [
    "荡蕴平线"
  ],
  "file": "assets/audio/v4/dagon_domain_name.mp3",
  "durationMs": 4400,
  "nameAtMs": 1290,
  "source": "https://www.bilibili.com/video/BV1RVXTB3E2z/",
  "note": "动画原声，仅完整领域名；未拼接归属待核实的展开喊声。音色与混音待人工试听"
},
  {
    "id": "gojo_void",
    "actor": 0,
    "match": [
      "无量空处"
    ],
    "file": "assets/audio/v3/gojo_void.mp3",
    "durationMs": 5750,
    "nameAtMs": 3130,
    "source": "https://www.bilibili.com/video/BV1RVXTB3E2z/",
    "note": "原片重新剪取，保留喊招、领域名称及自然收音"
  },
  {
    "id": "megumi_shadow",
    "actor": 2,
    "match": [
      "嵌合暗翳庭"
    ],
    "file": "assets/audio/v3/megumi_shadow.mp3",
    "durationMs": 11350,
    "nameAtMs": 8340,
    "source": "https://www.bilibili.com/video/BV1RVXTB3E2z/",
    "note": "原片重新剪取，保留喊招、领域名称及自然收音"
  },
  {
    "id": "higuruma_domain",
    "actor": 33,
    "match": [
      "诛伏赐死"
    ],
    "file": "assets/audio/v3/higuruma_domain.mp3",
    "durationMs": 4200,
    "nameAtMs": 1880,
    "source": "https://www.bilibili.com/video/BV1RVXTB3E2z/",
    "note": "原片重新剪取，保留喊招、领域名称及自然收音"
  },
  {
    "id": "sukuna_shrine",
    "actor": 12,
    "match": [
      "伏魔御厨子"
    ],
    "file": "assets/audio/v3/sukuna_shrine.mp3",
    "durationMs": 7600,
    "nameAtMs": 4780,
    "source": "https://www.bilibili.com/video/BV1RVXTB3E2z/",
    "note": "原片重新剪取，保留喊招、领域名称及自然收音"
  },
  {
    "id": "mahito_domain",
    "actor": 16,
    "match": [
      "自闭圆顿裹"
    ],
    "file": "assets/audio/v3/mahito_domain.mp3",
    "durationMs": 7300,
    "nameAtMs": 4060,
    "source": "https://www.bilibili.com/video/BV1RVXTB3E2z/",
    "note": "原片重新剪取，保留喊招、领域名称及自然收音"
  },
  {
    "id": "jogo_domain",
    "actor": 17,
    "match": [
      "盖棺铁围山"
    ],
    "file": "assets/audio/v3/jogo_domain.mp3",
    "durationMs": 3550,
    "nameAtMs": 2750,
    "source": "https://tuna.voicemod.net/sound/a3f9ed16-5315-450a-9cca-ce2b1688115c",
    "note": "保留完整展开喊声与原片收音；原片未念出领域名称"
  },
  {
  "id": "hanami_domain",
  "actor": 18,
  "match": [
    "朵颐光海"
  ],
  "file": "assets/audio/v4/hanami_game_domain.mp3",
  "durationMs": 8650,
  "nameAtMs": 1500,
  "source": "https://www.bilibili.com/video/BV1oc41167UZ/",
  "note": "《幻影夜行》花御领域演出原音，含游戏音效；完整喊招台词未核实，按用户选择接入。领域名显字按画面定时，非台词对齐。"
}
],active:null,until:0,originalSpeak:null,voiceJob:null,presentation:null,tailMs:1000,
 remainingMs(){const a=this.active;if(a&&!a.paused&&Number.isFinite(a.duration))return Math.max(100,(a.duration-a.currentTime)*1000);return Math.max(0,this.until-performance.now());},
 finishVoice(job,cancelled=false){
  if(!job||job.finished)return;job.finished=true;clearTimeout(job.timer);
  if(this.voiceJob===job){this.active=null;this.fallbackUtterance=null;this.fallbackDomain=false;this.until=0;}
  job.resolve({cancelled,endedAt:performance.now()});
 },
 stop(){const a=this.active,u=this.fallbackUtterance;this.finishVoice(this.voiceJob,true);this.active=null;this.until=0;this.fallbackDomain=false;if(a){a.pause();a.currentTime=0;}if(u&&window.speechSynthesis)window.speechSynthesis.cancel();},
 fallback(text){
  const job=this.voiceJob;if(!job||job.finished)return;
  if(job.domain||SFX.muted||SFX.voiceOn===false){this.finishVoice(job,true);return;}
  this.fallbackDomain=String(text).includes('领域展开');
  const estimated=Math.min(9000,Math.max(3500,(String(text).length+5)*320));this.until=performance.now()+estimated;
  const u=this.originalSpeak(text);this.fallbackUtterance=u;
  const done=()=>{if(this.voiceJob===job)this.finishVoice(job);};
  if(u?.addEventListener){u.addEventListener('end',done,{once:true});u.addEventListener('error',done,{once:true});}
  // A watchdog prevents an unavailable speech engine from blocking the battle.
  clearTimeout(job.timer);job.timer=setTimeout(()=>{if(this.voiceJob!==job||job.finished)return;if(u&&window.speechSynthesis)window.speechSynthesis.cancel();done();},u?20000:estimated);
 },
 select(text,who){let actor=HD.artIndex(who);if(actor===13||actor===14)actor=12;const raw=String(text).replace(/^领域展开[，,:：\s]*/, '').trim(),name=window.BattleScenes?.name(raw)||raw;return this.cues.find(c=>c.file&&(who==='你'||actor===c.actor)&&c.match.includes(name));},
 speak(text,who='',{domain=/^领域展开/.test(String(text))}={}){
  this.stop();if(SFX.muted||SFX.voiceOn===false)return;
  const job={createdAt:performance.now(),finished:false,attached:false,domain};job.done=new Promise(resolve=>job.resolve=resolve);this.voiceJob=job;
  this.attachVoice(job);const cue=this.select(text,who);
  if(!cue||!/^assets\/audio\/[a-zA-Z0-9_./-]+\.(mp3|ogg|wav|m4a)$/.test(cue.file)||cue.file.includes('..')){this.fallback(text);return job.done;}
  if(window.speechSynthesis)window.speechSynthesis.cancel();const a=new Audio(cue.file);this.active=a;this.until=performance.now()+Math.min(12000,Math.max(1000,cue.durationMs));
  a.onended=()=>{if(this.active===a)this.finishVoice(job);};
  a.onplaying=()=>{const p=this.presentation;if(this.active===a&&job.domain&&p?.voice===job)Cinema.el.style.setProperty('--domain-name-delay',Math.max(0,((cue.nameAtMs||1250)+performance.now()-p.startedAt-a.currentTime*1000))/1000+'s');};
  const failed=()=>{if(this.active!==a||job.finished)return;this.active=null;a.pause();clearTimeout(job.timer);this.fallback(text);};
  a.onerror=failed;a.onloadedmetadata=()=>{if(this.active===a&&Number.isFinite(a.duration))this.until=performance.now()+a.duration*1000;};
  job.timer=setTimeout(failed,Math.max(15000,cue.durationMs+8000));a.play().catch(failed);return job.done;
 },
 attachVoice(job,p=this.presentation){
  if(!p||Cinema.el.hidden)return;job.attached=true;p.voice=job;clearTimeout(Cinema.timer);
  job.done.then(({cancelled,endedAt})=>{
   if(this.presentation!==p||p.voice!==job||Cinema.el.hidden)return;
   const delay=Math.max(0,p.minUntil-performance.now(),cancelled?0:endedAt+this.tailMs-performance.now());
   Cinema.timer=setTimeout(()=>{if(this.presentation===p)Cinema.hide();},delay);
  });
 },
 init(){this.originalSpeak=SFX.speak.bind(SFX);SFX.speak=text=>this.speak(text);for(const name of ['setMuted','setVoice']){const fn=SFX[name].bind(SFX);SFX[name]=v=>{fn(v);if(SFX.muted||SFX.voiceOn===false)this.stop();};}
  const later=BattleUI.laterFixed;BattleUI.laterFixed=function(ms,fn){
   const p=AnimeVoice.presentation,id=this.runId;
   if(p&&(p.voice||p.kind==='domain'))return later.call(this,0,()=>p.done.then(()=>{if(id===this.runId&&!this._finished)fn();}));
   return later.call(this,Math.max(ms,AnimeVoice.remainingMs()+120),fn);
  };
  const play=Cinema.play.bind(Cinema);Cinema.play=cfg=>{
   if(cfg.kind==='domain'){
    const cue=this.select(cfg.text,cfg.who);
    Cinema.el.style.setProperty('--domain-name-delay',((cue&&!SFX.muted&&SFX.voiceOn!==false?cue.nameAtMs:1250)||1250)/1000+'s');
   }
   // The original ultimate event starts speech immediately before opening its cut-in.
   const pending=cfg.kind!=='domain'&&this.voiceJob&&!this.voiceJob.attached&&!this.voiceJob.finished&&performance.now()-this.voiceJob.createdAt<1000?this.voiceJob:null;
   this.preservePending=!!pending;let result;try{result=play(cfg);}finally{this.preservePending=false;}
   const p={done:result,startedAt:performance.now(),minUntil:performance.now()+(cfg.duration??1800),kind:cfg.kind,voice:null};this.presentation=p;
   if(cfg.kind==='domain')this.speak('领域展开，'+cfg.text,cfg.who,{domain:true});
   else if(pending)this.attachVoice(pending,p);
   return result;
  };
  const hide=Cinema.hide.bind(Cinema);Cinema.hide=()=>{this.presentation=null;hide();if(!this.preservePending)this.stop();};
  const p=document.createElement('p');p.className='muted';p.textContent='领域演出：仅播放已匹配的角色原声；扩展领域或缺少原声时为无声画面。原声结束后停留一秒。';$('motionToggle').parentElement.after(p);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
 }
};window.AnimeVoice=AnimeVoice;AnimeVoice.init();
