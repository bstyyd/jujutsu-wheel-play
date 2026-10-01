/* Credited game samples; see GAME-SOURCES.json. Audio is unlocked by a gesture. */
(() => {
 class CombatAudio {
  constructor(){this.enabled=true;this.bank='jrpg';this.volume=.55;this.buffers=new Map();this.live=new Set();this.next=new Map();this.ctx=null;this.loading=null;this.failed=[];this.previewTimer=0;}
  async unlock(){
   try{
    if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.volume;const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=8;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.12;this.master.connect(limiter);limiter.connect(this.ctx.destination);}
    await this.ctx.resume();
    if(!this.loading)this.loading=fetch('assets/sfx/combat/catalog.json').then(r=>{if(!r.ok)throw Error('audio catalog');return r.json();}).then(async data=>{this.catalog=data;await Promise.all(Object.entries(data.clips).map(async([key,c])=>{try{const r=await fetch('assets/sfx/combat/'+c.file);if(!r.ok)throw Error(c.file);this.buffers.set(key,await this.ctx.decodeAudioData(await r.arrayBuffer()));}catch{this.failed.push(key);}}));}).catch(()=>this.failed.push('catalog'));
    await this.loading;
   }catch{this.failed.push('device');}
  }
  setEnabled(value){this.enabled=value;if(!value)this.stop();}
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.master)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.03);}
  stop(){clearTimeout(this.previewTimer);this.previewTimer=0;for(const s of this.live){try{s.stop();}catch{}}this.live.clear();}
  audition(kind){this.stop();this.play(kind,'windup');this.previewTimer=setTimeout(()=>{this.play(kind,'approach');this.previewTimer=setTimeout(()=>{this.previewTimer=0;this.play(kind,'impact');},180);},160);}
  play(kind,phase,pan=0){
   if(!this.enabled||!this.ctx||this.ctx.state!=='running'||!this.catalog)return;
   const cues=this.bank==='previous'?this.catalog.previousCues:this.bank==='jrpg'?this.catalog.jrpgCues:this.catalog.cues;
   const group=cues[kind]||cues.melee,list=group[phase]||[];
   if(this.bank==='jrpg'){for(const layer of list)this.layer(layer,pan);return;}
   if(!list.length)return;const k=kind+phase,n=this.next.get(k)||0;this.next.set(k,n+1);
   const key=list[n%list.length],buffer=this.buffers.get(key);if(!buffer)return;
   const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),panner=this.ctx.createStereoPanner();source.buffer=buffer;gain.gain.value=this.catalog.clips[key].gain;panner.pan.value=Math.max(-.25,Math.min(.25,pan));source.connect(gain);gain.connect(panner);panner.connect(this.master);this.live.add(source);source.onended=()=>{this.live.delete(source);source.disconnect();gain.disconnect();panner.disconnect();};const now=this.ctx.currentTime,duration=Math.min(buffer.duration,this.catalog.clips[key].duration||buffer.duration);gain.gain.setValueAtTime(this.catalog.clips[key].gain,now);if(duration<buffer.duration){gain.gain.setValueAtTime(this.catalog.clips[key].gain,now+Math.max(0,duration-.08));gain.gain.linearRampToValueAtTime(0,now+duration);}source.start(now);source.stop(now+duration);
  }
  layer(layer,pan){
   const clip=this.catalog.clips[layer.clip],buffer=this.buffers.get(layer.clip);if(!clip||!buffer)return;
   const ctx=this.ctx,now=ctx.currentTime+Math.max(0,Math.min(.25,layer.delay||0)),offset=Math.min(layer.offset||0,buffer.duration-.01),duration=Math.min(layer.duration||.3,buffer.duration-offset);
   if(duration<=0)return;
   const source=ctx.createBufferSource(),gain=ctx.createGain(),panner=ctx.createStereoPanner(),nodes=[source,gain,panner];source.buffer=buffer;
   let previous=source;
   for(const [type,value] of [['highpass',layer.highpass],['lowpass',layer.lowpass]])if(value){const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=value;filter.Q.value=.55;previous.connect(filter);previous=filter;nodes.push(filter);}
   previous.connect(gain);gain.connect(panner);panner.connect(this.master);panner.pan.value=Math.max(-.18,Math.min(.18,pan));
   const level=clip.gain*layer.gain,attack=Math.min(layer.attack||.006,duration*.25),release=Math.min(layer.release||.08,duration*.7);
   gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+attack);gain.gain.setValueAtTime(level,now+Math.max(attack,duration-release));gain.gain.linearRampToValueAtTime(0,now+duration);
   this.live.add(source);source.onended=()=>{this.live.delete(source);for(const n of nodes)n.disconnect();};source.start(now,offset);source.stop(now+duration);
  }
 }
 window.CombatAudio=CombatAudio;
})();

