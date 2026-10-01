/* Generated from current original game rules; no UI, save or campaign startup. */

'use strict';
/* =====================================================================================
 * 咒术回战 · 轮回转盘   —— 全部逻辑单文件实现
 * 模块：I 工具/随机 | II 数值档位与全部转盘数据 | III 角色与成长 | IV 通用转盘组件
 *       V 战斗引擎(ATB轮轴) | VI 剧情引擎 | VII 主循环/界面渲染 | VIII 启动
 * ===================================================================================== */

/* ============================ I. 工具与随机 ============================ */
const G = (typeof window!=='undefined'?window:globalThis);
const $=id=>document.getElementById(id);
const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const randF=(a,b)=>Math.random()*(b-a)+a;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((x,y)=>x+y,0);
const deepCopy=o=>JSON.parse(JSON.stringify(o));

/* Batch B 机制化数值表：原「一击定胜负」术式的机制向改造参数。
   先按交接定稿值填入，Batch D Monte Carlo 模拟后统一在此调平，勿散落修改。 */
const MECHANIC_TUNING={
  jacob:{executeP:0.80,trueDmg:0.70,vulnTurns:2,vulnBonus:0.25}, // 雅各布天梯：受肉体80%概率秒杀 / 非受肉体70%最大生命真伤+2回合易伤(+25%)
  judge:{trueDmg:0.60},                                           // 判决术式：非式神60%最大生命真伤（式神秒杀保留）
  negate:{trueDmg:0.50},                                          // 万象拒绝：50%最大生命真伤+自身咒力消耗翻倍（仅对咒力上限更低者）
  mass:{trueDmg:0.45,selfCost:0.50},                              // 星之怒：全体敌人45%最大生命真伤+自身损50%当前生命（近战不再×2）
  reviveWin:{hpRatio:0.50,cpRatio:0.50,stealProf:30,dmgBoost:0.30}, // 死而替生：半血半咒力复活+随机夺式(熟练30%)+本场伤害+30%（不再自动获胜）
  requiem:{reduce:0.70,domainBoost:1.5},                          // 黄金体验镇魂曲：减伤70%+自身领域伤害×1.5（不再全免）
  swap:{min:0.15,max:0.60},                                       // 不义游戏：闪避率 min(0.6, max(0.15, (ctl差)/(ctl和+10)))
};

// Display current mechanics without changing canonical draw data used by old saves.
function techniqueDescription(t){
 if(!t)return '';const m=MECHANIC_TUNING,pct=n=>Math.round(n*100)+'%';
 const descriptions={
  negate:`术式攻击咒力上限低于自己的目标时，消耗双倍咒力，造成目标最大生命${pct(m.negate.trueDmg)}的真实伤害；否则正常攻击。`,
  jacob:`术式攻击受肉体有${pct(m.jacob.executeP)}概率直接击败目标；对其他目标造成最大生命${pct(m.jacob.trueDmg)}的真实伤害，并附加${m.jacob.vulnTurns}次自身行动的易伤（受伤+${pct(m.jacob.vulnBonus)}）。`,
  judge:`术式攻击直接祓除式神；对其他目标造成最大生命${pct(m.judge.trueDmg)}的真实伤害。`,
  mass:`术式攻击后追加敌方全体最大生命${pct(m.mass.trueDmg)}的真实伤害，代价为自身当前生命${pct(m.mass.selfCost)}。体术没有额外翻倍。`,
  reviveWin:`每场首次被击败时恢复${pct(m.reviveWin.hpRatio)}生命与${pct(m.reviveWin.cpRatio)}咒力，随机夺取敌方一项术式（熟练度${m.reviveWin.stealProf}%），本场伤害+${pct(m.reviveWin.dmgBoost)}；战斗继续。`,
  requiem:`领域以外的攻击伤害减少${pct(m.requiem.reduce)}，自身领域伤害×${m.requiem.domainBoost}。`,
  swap:`根据双方咒力操控差计算闪避率，最低${pct(m.swap.min)}、最高${pct(m.swap.max)}；不能闪避领域攻击。`
 };
 return descriptions[t.flag]?descriptions[t.flag]+(t.domain?'领域：'+t.domain+'。':''):(t.desc||'');
}

/* ============================ 音效 & 语音（Web Audio 程序化合成，零外部文件；无音频环境自动静默降级） ============================ */
const SFX={
  muted:false,voiceOn:true,ctx:null,
  _ensure(){
    try{
      if(this.muted)return null;
      const AC=G.AudioContext||G.webkitAudioContext;if(!AC)return null;
      if(!this.ctx)this.ctx=new AC();
      if(this.ctx.state==='suspended')this.ctx.resume();
      return this.ctx;
    }catch(e){return null;}
  },
  unlock(){this._ensure();try{if(G.speechSynthesis&&G.speechSynthesis.getVoices().length===0)G.speechSynthesis.getVoices();}catch(e){}},
  tone(f0,f1,dur,type='sine',vol=.18,delay=0){
    const ctx=this._ensure();if(!ctx)return;
    try{
      const t0=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
      o.type=type;o.frequency.setValueAtTime(f0,t0);
      if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t0+dur);
      g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+.012);
      g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
      o.connect(g);g.connect(ctx.destination);o.start(t0);o.stop(t0+dur+.03);
    }catch(e){}
  },
  noise(dur,vol=.12,delay=0,lp=1200){
    const ctx=this._ensure();if(!ctx)return;
    try{
      const len=Math.max(1,Math.floor(ctx.sampleRate*dur)),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
      const src=ctx.createBufferSource();src.buffer=buf;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=lp;
      const g=ctx.createGain();g.gain.value=vol;src.connect(f);f.connect(g);g.connect(ctx.destination);src.start(ctx.currentTime+delay);
    }catch(e){}
  },
  click(){this.tone(620,520,.06,'triangle',.07);},
  tick(){this.tone(680,420,.035,'triangle',.022);},
  spinStart(){this.tone(220,330,.12,'sine',.025);},
  spinEnd(){this.tone(523.25,523.25,.16,'sine',.045);this.tone(783.99,783.99,.22,'sine',.032,.075);},
  hit(){this.noise(.12,.09,0,900);this.tone(180,90,.12,'sawtooth',.07);},
  crit(){this.noise(.28,.18,0,1800);this.tone(120,45,.4,'sawtooth',.16);this.tone(900,200,.28,'square',.09,.02);},
  heal(){this.tone(520,780,.16,'sine',.09);this.tone(780,1040,.2,'sine',.07,.09);},
  die(){this.tone(300,70,.5,'sawtooth',.11);this.noise(.3,.07,0,500);},
  domain(){this.tone(70,150,1.1,'sawtooth',.2);this.tone(140,60,1.1,'square',.09);this.noise(1,.11,0,420);this.tone(440,880,.5,'sine',.11,.12);},
  skill(){this.tone(660,990,.18,'triangle',.10);this.tone(990,1480,.22,'sine',.08,.05);this.noise(.18,.06,1200,3600);},
  ult(){this.tone(55,120,1.2,'sawtooth',.22);this.noise(1.1,.14,0,500);this.tone(300,1200,.7,'square',.12,.18);this.tone(1200,1800,.5,'sine',.10,.35);},
  speak(text){
    try{
      if(this.muted||this.voiceOn===false||!G.speechSynthesis||!G.SpeechSynthesisUtterance)return;
      const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=1.02;u.pitch=.8;u.volume=Math.min(1,Math.max(0,G.AnimeVoice?.voiceVolume??1));
      const vs=G.speechSynthesis.getVoices();const zh=vs.find(v=>/zh|chinese/i.test(v.lang));if(zh)u.voice=zh;
      G.speechSynthesis.cancel();G.speechSynthesis.speak(u);return u;
    }catch(e){}
  },
  setMuted(m){this.muted=m;try{localStorage.setItem('jjk_muted',m?'1':'0');}catch(e){}
    if(m&&G.speechSynthesis){try{G.speechSynthesis.cancel();}catch(e){}}},
  setVoice(v){this.voiceOn=v;try{localStorage.setItem('jjk_voice',v?'1':'0');}catch(e){}
    if(!v&&G.speechSynthesis){try{G.speechSynthesis.cancel();}catch(e){}}}
};
try{SFX.muted=localStorage.getItem('jjk_muted')==='1';}catch(e){}
 try{SFX.voiceOn=localStorage.getItem('jjk_voice')!=='0';}catch(e){}
if(typeof document!=='undefined'&&document.addEventListener)
  ['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>SFX.unlock(),{passive:true}));

/** 加权随机：items=[{...weight}]，返回选中下标 */
function weightedIndex(items){
  let total=0; const ws=items.map(it=>{const w=Math.max(0,(it.weight??1));total+=w;return w;});
  let r=Math.random()*total;
  for(let i=0;i<ws.length;i++){r-=ws[i];if(r<0)return i;}
  return items.length-1;
}
function weightedPick(items){return items[weightedIndex(items)];}
/* 等级名：tier 0~11 为正式十二级；-1=准四级、-2=不入流（仅狩猎低级咒灵出现） */
const lvName=li=>li<=-2?'不入流':li===-1?'准四级':LEVELS[clamp(li,0,LEVELS.length-1)];

/* ============================ II. 数值档位 & 转盘数据 ============================ */
/** 十二级等级序列（贯穿全游戏的强度标尺） */
const LEVELS=['四级','三级','准二级','二级','准一级','一级','特别一级','准特级','弱特级','标准特级','强特级','超特级'];

/** 咒力总量档位 [min,max] + 权重 */
const CP_TIERS=[
 [0,10],[11,50],[51,99],[100,500],[501,999],[1000,5000],[5001,8999],
 [9000,9999],[10000,19999],[20000,49999],[50000,99999],[100000,999999]];
const TIER_W=[5,5,10,15,20,15,10,5,5,5,4,1];
/** 咒力操控档位：每次术式攻击消耗减免 [min,max] */
const CTL_TIERS=[
 [0,2],[3,5],[6,9],[10,19],[20,50],[51,99],[100,299],
 [300,499],[500,699],[700,899],[900,999],[1000,9999]];
/** 伤害档位（体术 / 咒力效率通用） [min,max] */
const DMG_TIERS=[
 [0,5],[6,10],[11,30],[31,50],[51,99],[100,500],[501,899],
 [900,999],[1000,1999],[2000,4999],[5000,9999],[10000,99999]];
/** 体质（血量）档位：名称 + [min,max]，等概率 */
const HP_TIERS=[
 ['普通人',[10,30]],['肉身堪比四级咒灵',[31,80]],['肉身堪比三级咒灵',[81,200]],
 ['肉身堪比准二级咒灵',[201,499]],['肉身堪比二级咒灵',[500,999]],
 ['肉身堪比准一级咒灵',[1000,4999]],['肉身堪比一级咒灵',[5000,9999]],
 ['肉身堪比准级咒灵',[10000,19999]],['肉身堪比弱特级咒灵',[20000,39999]],
 ['肉身堪比标准特级咒灵',[40000,49999]],['肉身堪比强特级咒灵',[50000,59999]],
 ['肉身堪比天与暴君',[60000,99999]],['肉身堪比超地表级',[100000,999999]]];
/** 低于「四级」的两档（tier -1 准四级 / -2 不入流），仅狩猎低级咒灵时使用 */
const LOW_TIERS={
 [-1]:{cp:[0,5],dmg:[0,3],ctl:[0,1],hp:[13,30]},
 [-2]:{cp:[0,2],dmg:[0,2],ctl:[0,0],hp:[6,12]}};
const tierCp =li=>li<0?LOW_TIERS[li].cp :CP_TIERS[li];
const tierDmg=li=>li<0?LOW_TIERS[li].dmg:DMG_TIERS[li];
const tierCtl=li=>li<0?LOW_TIERS[li].ctl:CTL_TIERS[li];
/** NPC 敌人生命区间：tier 越低越弱 */
function npcHpRange(li){
  if(li<=-2)return LOW_TIERS[-2].hp;
  if(li===-1)return LOW_TIERS[-1].hp;
  return HP_TIERS[clamp(li+1,0,HP_TIERS.length-1)][1];
}
/** 按当前数值反查所处档位索引（区间表 [[min,max],...]） */
function tierIndexOf(v,table){let idx=0;for(let i=0;i<table.length;i++)if(v>=table[i][0])idx=i;return idx;}
/** 按当前生命反查体质档位（HP_TIERS 元素为 [名称,[min,max]]） */
function hpTierIndexOf(v){let idx=0;for(let i=0;i<HP_TIERS.length;i++)if(v>=HP_TIERS[i][1][0])idx=i;return idx;}

const GROWTH=[
 {label:'夭折之资',mult:0.5,weight:5},
 {label:'平庸之才',mult:0.75,weight:10},
 {label:'中规中矩',mult:0.9,weight:15},
 {label:'资质良好',mult:1.0,weight:20},
 {label:'出类拔萃',mult:1.15,weight:17},
 {label:'精英之才',mult:1.3,weight:12},
 {label:'百年天才',mult:1.5,weight:11},
 {label:'旷世奇才',mult:1.75,weight:7},
 {label:'天选之人',mult:2.1,weight:3}];
 /** 固定增量基数表（资质良好 mult=1 时每次修炼/战胜奖励的固定值），索引=综合等级li+2，覆盖li -2~11。
  *  只与等级有关、与玩家已累积属性无关 → 线性可控，后期不膨胀。 */
 const GAIN_BASE={ // 第五版：固定成长值整体翻倍
  cp:  [2,2,4,8,12,50,60,440,460,700,1100,3000,5200,40000],
  hp:  [4,4,8,16,30,60,240,520,800,1400,1800,2200,3200,24000],
  dmg: [2,2,2,4,6,8,14,44,60,70,120,280,520,3600],
  ctl: [2,2,2,2,2,4,6,12,20,28,36,44,56,600]
 };
 /** 取某次成长的固定增量：type=cp/hp/dmg/ctl，li=当前综合等级，k=成长固定系数 */
 function fixedGain(type,li,k){const arr=GAIN_BASE[type];const idx=Math.max(0,Math.min(arr.length-1,li+2));return Math.max(1,Math.round(arr[idx]*k));}

/** 转盘1：初始身份（附带游戏化身份天赋，在面板内说明） */
const WHEEL_IDENTITY=[
 {label:'普通人类',desc:'没有家世的普通穿越者。血量+10%，百折不挠。',mod:{hp:1.10}},
 {label:'咒灵',desc:'由负面情绪孕育的存在。咒力总量+30%、术式伤害+10%。',mod:{cp:1.30,eff:1.10}},
 {label:'咒术师',desc:'正统咒术界出身。咒力消耗减免额外+15%，术式熟练度成长+20%。',mod:{ctl:1.15,prof:1.20}},
 {label:'诅咒师',desc:'作恶的咒术师。术式伤害+20%、体术伤害+10%。',mod:{eff:1.20,melee:1.10}},
 {label:'受肉体',desc:'被强大存在寄宿的容器。血量+40%、体术+20%，咒力总量-10%。',mod:{hp:1.40,melee:1.20,cp:0.90}}];

/** 转盘2：穿越时间点（游戏开始天数） */
const WHEEL_ERA=[
 {label:'宿傩受肉虎杖时期',day:0,desc:'故事原点，一切诅咒的开端。'},
 {label:'钉崎野蔷薇登场篇',day:5,desc:'钉崎野蔷薇入学，三人组集结前夜。'},
 {label:'少年院篇',day:25,desc:'特级咒灵盘踞的废弃少年院。'},
 {label:'幼鱼与逆罚篇',day:34,desc:'真人与漏壶的阴影逼近。'},
 {label:'京都姐妹校交流会篇',day:49,desc:'两校交流会，花御来袭。'},
 {label:'八十八桥篇',day:69,desc:'咒胎与九相图兄弟的战场。'},
 {label:'涩谷事变时期',day:85,desc:'10月31日，涩谷，最惨烈的一夜。'},
 {label:'死灭回游时期',day:100,desc:'泳者们的杀阵，天元存亡之秋。'},
 {label:'新宿决战时期',day:118,desc:'最终决战前两日，几乎没有成长时间。'}];

const WHEEL_AGE=[16,17,18,19,20,21,22,23,25,27,30,35,40,50,60].map(n=>({label:n+'岁'}));
const WHEEL_GENDER=[{label:'男'},{label:'女'}];
const WHEEL_FACE=['E','D','C','B','A','S','EX'].map(n=>({label:n+' 级颜值'}));

/** 转盘6：生得术式（严格按设定录入；name=名称，desc=完整设定，flag=特殊机制标识） */
const WHEEL_TECHNIQUE=[
 {name:'无下限术式',flag:'limitless',domain:'无量空处',desc:'【被动·无穷】免疫一切非“领域”类攻击；但每次轮到自己行动时咒力消耗+1000（可被咒力操控减免抵消）。领域：无量空处。'},
 {name:'十种影法术',flag:'shadows',domain:'嵌合暗翳庭',desc:'每次自己行动随机召唤一个式神助战，强度继承自身总属性：玉犬5%、脱兔3%、蟾蜍7%、大蛇15%、圆鹿20%、贯牛30%、鵺25%、满象35%、虎杖40%；多个式神在场时融合为「嵌合兽」且强度叠加。领域：嵌合暗翳庭。'},
 {name:'御厨子',flag:'cleave',domain:'伏魔御厨子',desc:'掌握解/捌/开/灶四式：解=咒力效率120%、捌=130%、开=200%、灶=250%伤害，依次轮换。领域：伏魔御厨子。'},
 {name:'刍灵咒法',flag:'straw',domain:'灵魂共鸣',desc:'近战攻击附加自身咒力效率50%的额外伤害（共鸣/簪，可伤及灵魂）。领域：灵魂共鸣。'},
 {name:'十划咒法',flag:'ratio',domain:'真视斩击',desc:'近战伤害+50%；接触攻击更容易触发黑闪，控制力、连击与心流影响成功率。领域：真视斩击。'},
 {name:'咒言',flag:'cursedSpeech',domain:'真我言灵',desc:'辅助型：行动时可强制命令一个对手，使其下回合无法行动；对手总实力越强，固定咒力消耗越高。领域：真我言灵。'},
 {name:'咒灵操术',flag:'spiritControl',domain:'万鬼来朝',desc:'击败的咒灵化为式神（数值固定不成长）；每次自己行动随机召唤已拥有的3个咒灵式神助战。领域：万鬼来朝。'},
 {name:'无为转变',flag:'idleTrans',domain:'自闭圆顿裹',desc:'近战附加咒力效率100%伤害、咒术攻击附加体术100%伤害；每次行动无消耗恢复10%总血量。领域：自闭圆顿裹。'},
 {name:'不义游戏',flag:'swap',domain:'天手力',desc:'只要自身咒力操控高于对方，就永远闪避其攻击（无法闪避领域攻击）。领域：天手力。'},
 {name:'赤血操术',flag:'blood',domain:'超红莲真新星',desc:'以血为武：攻击消耗自身10%生命值，战斗中咒力效率+100%。领域：超红莲真新星。'},
 {name:'黑鸟操术',flag:'crows',domain:'百鸟共舞',desc:'进入战斗立即召唤3只拥有自身30%总属性的乌鸦式神助战。领域：百鸟共舞。'},
 {name:'投射咒法',flag:'projection',domain:'时胞月宫殿',desc:'每次行动结束后下一次行动值立即拉条80%；但近战伤害-90%、咒术伤害-70%。领域：时胞月宫殿。'},
 {name:'构筑术式',flag:'construct',domain:'三重疾苦',desc:'咒力效率+50%（咒力具现为物质攻击）。领域：三重疾苦。'},
 {name:'傀儡操术',flag:'puppet',domain:'超巨大机甲',desc:'进战召唤一个继承自身70%总属性的傀儡，之后每次行动再召唤一个；傀儡在场时敌人优先攻击傀儡。领域：超巨大机甲。'},
 {name:'淀月',flag:'moon',domain:'恶毒邪月',desc:'每次攻击给目标叠1层毒素；目标每次行动时，每层毒素造成其血量上限5%的伤害。领域：恶毒邪月。'},
 {name:'蚀烂腐术',flag:'rot',domain:'暗蚀',desc:'攻击造成的伤害会同步腐蚀、降低对方的血量上限。领域：暗蚀。'},
 {name:'奇迹',flag:'miracle',domain:'鸿运齐天',desc:'每次死亡时消耗自身咒力总量的30%，得以复活并恢复100%血量；咒力不足则无法复活。领域：鸿运齐天。'},
 {name:'雅各布天梯',flag:'jacob',domain:'天使之息',desc:'行动时可直接秒杀名字带有“受肉体”字样的对手。领域：天使之息。'},
 {name:'幻兽琥珀',flag:'amber',domain:'死门雷兽',desc:'每次行动燃烧自身20%血量，并将这20%血量转化为本次攻击的附加伤害。领域：死门雷兽。'},
 {name:'判决术式',flag:'judge',domain:'诛伏赐死',desc:'行动时可直接秒杀名字带有“式神”字样的敌人。领域：诛伏赐死。'},
 {name:'咒力大炮',flag:'cannon',domain:'咒力加农炮',desc:'咒力输出效率+100%（术式伤害翻倍）。领域：咒力加农炮。'},
 {name:'质量术式',flag:'mass',domain:'星之怒',desc:'近战攻击+100%；大招「星之怒」可与一个敌人同归于尽。领域：星之怒。'},
 {name:'鬼臂罗网',flag:'arms',domain:'百臂魔神',desc:'近战攻击附加自身咒力效率10%的额外伤害（百臂追踪）。领域：百臂魔神。'},
 {name:'付丧操术',flag:'tsukumo',domain:'跑得很快',desc:'自身行动值加速20%（速度+20%）。领域：跑得很快。'},
 {name:'降灵术',flag:'seance',domain:'秽土转生',desc:'每次行动召唤一个曾经击败过的对手作为本场临时队友。领域：秽土转生。'},
 {name:'天空术式',flag:'sky',domain:'虚化神威',desc:'敌人对自己造成的近战伤害为0。领域：虚化神威。'},
 {name:'生长术式',flag:'grow',domain:'超高速再生',desc:'每次行动恢复自身10%血量与10%咒力。领域：超高速再生。'},
 {name:'火灾操术',flag:'fire',domain:'盖棺铁围山',desc:'近战攻击附加自身咒力效率80%的火焰伤害。领域：盖棺铁围山。'},
 {name:'蛊毒术式',flag:'gu',domain:'巫蛊',desc:'每次攻击给目标叠1层蛊毒；目标每次行动时，每层蛊毒造成其血量上限10%的伤害。领域：巫蛊。'},
 {name:'复制术式',flag:'copy',domain:'真赝相爱',desc:'复制并肩作战队友的术式：每名存活队友使自身术式伤害提升。领域：真赝相爱。'},
 {name:'万象拒绝',flag:'negate',domain:'我拒绝',desc:'拒绝一切：直接秒杀咒力总量比自己低的对手。领域：我拒绝。'},
 {name:'黄金体验镇魂曲',flag:'requiem',domain:'万象虚无',desc:'将一切攻击无效化：免疫领域以外的所有攻击伤害。领域：万象虚无。'},
 {name:'界王拳',flag:'kaioken',domain:'十倍界王拳',desc:'进入战斗全属性临时+50%，但每次行动减少10%血量。领域：十倍界王拳。'},
 {name:'超级赛亚人变身',flag:'ssj',domain:'超级赛亚人变身第二阶段',desc:'进入战斗全属性+5000%（×51），仅持续5次攻击，之后恢复常态。领域：超赛第二阶段。'},
 {name:'仙人模式',flag:'sage',domain:'仙法之术',desc:'进入战斗后每次行动恢复30%血量。领域：仙法之术。'},
 {name:'死而替生',flag:'reviveWin',domain:'替死鬼',desc:'每次战斗被杀死后直接获得战斗胜利，并夺取敌人的术式。领域：替死鬼。'}];

/** 转盘7/8/9/11：四类十二级数值转盘（统一工厂生成） */
function buildStatWheel(type){
  const nameMap={cp:'初始咒力总量',ctl:'初始咒力操控',melee:'初始体术水平',eff:'初始咒力效率'};
  return TIER_W.map((w,i)=>{
    let label='',desc='';
    if(type==='cp'){label=`${lvName(i)}（咒力 ${CP_TIERS[i][0]}~${CP_TIERS[i][1]} 点）`;desc='咒力总量，释放术式的资源。';}
    if(type==='ctl'){label=`${lvName(i)}咒力操控（消耗减免 ${CTL_TIERS[i][0]}~${CTL_TIERS[i][1]} 点）`;desc='每次咒力攻击消耗的咒力减少对应点数。';}
    if(type==='melee'){label=`${lvName(i)}体术水平（近战伤害 ${DMG_TIERS[i][0]}~${DMG_TIERS[i][1]} 点）`;desc='每次近战攻击的输出伤害区间。';}
    if(type==='eff'){label=`${lvName(i)}咒力效率（术式伤害 ${DMG_TIERS[i][0]}~${DMG_TIERS[i][1]} 点）`;desc='每次咒力攻击的输出伤害区间。';}
    return {label,desc,weight:w,tier:i};
  });
}
/** 转盘10：体质（等概率） */
const WHEEL_HP=HP_TIERS.map(([label,range])=>({label:`${label}（血量 ${range[0]}~${range[1]}）`,desc:'生命值区间。'}));
/** 转盘12：成长值 */
const WHEEL_GROWTH=GROWTH.map(g=>({label:`${g.label}（固定增量×${g.mult}）`,mult:g.mult,desc:'决定每次修炼/战胜后增加的【固定数值】：按当前等级取固定基数再乘该系数，不随已有属性滚动，后期不会膨胀。',weight:g.weight}));

/** 常规行动转盘（非剧情日，等概率） */
const WHEEL_DAILY=[
 {label:'咒力总量提升修炼',act:'cp',desc:'根据天赋等级与成长值，提升咒力总量上限。'},
 {label:'体术修炼',act:'melee',desc:'根据天赋等级与成长值，提升体术伤害区间。'},
 {label:'锻炼体质',act:'hp',desc:'根据天赋等级与成长值，提升最大生命值。'},
 {label:'学习修炼咒力操控',act:'ctl',desc:'根据天赋等级与成长值，提升咒力消耗减免。'},
 {label:'钻研咒力效率',act:'eff',desc:'根据天赋等级与成长值，提升术式伤害区间与术式熟练度。'},
 {label:'狩猎咒灵',act:'hunt',desc:'进入狩猎转盘：按当前等级分配咒灵强度权重（同级咒灵必占50%），战胜获得成长。'}];

/* ============================ III. 角色：生成 / 成长 / 评估 ============================ */
const Player={
  /** draws: 12 步抽取结果对象，由创建流程收集 */
  create(draws){
    const id=draws.identity, era=draws.era, age=draws.age.label.match(/\d+/)[0]*1,
          faceToken=(draws.face.label.match(/EX|^[EDCBAS]/)||['E'])[0],
          faceIdx=['E','D','C','B','A','S','EX'].indexOf(faceToken);
    const cpT=draws.cp.tier, ctlT=draws.ctl.tier, meleeT=draws.melee.tier,
          effT=draws.eff.tier, hpT=draws.hp.tierIdx;
    const growth=draws.growth.mult*1; // 固定增量系数，不随年龄/当前属性百分比变动
    // 年龄仅影响初始属性（年长者起步更高），不再改动成长
    let ageInit=1.0,ageNote='';
    if(age<=18){ageNote='年少，成长空间充足';}
    else if(age<=25){ageNote='正值黄金年龄';}
    else if(age<=35){ageInit=1.10;ageNote='初始属性×1.10';}
    else if(age<=50){ageInit=1.20;ageNote='初始属性×1.20';}
    else{ageInit=1.30;ageNote='初始属性×1.30';}
    const m=id.mod||{};
    const r=(arr,i)=>rand(arr[i][0],arr[i][1]);
    let maxCp=Math.round(r(CP_TIERS,cpT)*ageInit*(m.cp||1));
    let ctl=Math.round(r(CTL_TIERS,ctlT)*ageInit*(m.ctl||1));
    let melee=[Math.round(DMG_TIERS[meleeT][0]*ageInit*(m.melee||1)),Math.round(DMG_TIERS[meleeT][1]*ageInit*(m.melee||1))];
    let eff=[Math.round(DMG_TIERS[effT][0]*ageInit*(m.eff||1)),Math.round(DMG_TIERS[effT][1]*ageInit*(m.eff||1))];
    let maxHp=Math.round(rand(HP_TIERS[hpT][1][0],HP_TIERS[hpT][1][1])*ageInit*(m.hp||1)); // HP_TIERS元素是[name,[min,max]]
    maxCp=Math.max(maxCp,1);maxHp=Math.max(maxHp,10);
    if(melee[1]<1)melee[1]=1;if(eff[1]<1)eff[1]=1;
    const P={
      identity:id.label, identityDesc:id.desc, eraLabel:era.label, startDay:era.day, eraDesc:era.desc,
      isVillain:['咒灵','诅咒师','受肉体'].includes(id.label), // 反派路线：咒灵/诅咒师/受肉体，剧情阵营翻转
      age, gender:draws.gender.label, face:['E','D','C','B','A','S','EX'][faceIdx],
      faceIdx, ageNote,
      technique:draws.technique,
      growthLabel:draws.growth.label.match(/^[^（]+/)[0], growthMult:+growth.toFixed(3),
      cpTier:cpT,ctlTier:ctlT,meleeTier:meleeT,effTier:effT,hpTier:hpT,
      maxCp,cp:maxCp,ctl,melee,eff,maxHp,hp:maxHp,
      prof:0, // 主生得术式熟练度 %（100领悟领域，300领悟极之番）
      reverse:false, // 反转术式
      blackFlash:false, // 黑闪
      domainLearned:false, // 领域展开
      ultimateLearned:false, // 极之番（熟练度300%）
      statBoost:1.0, // 黑闪累计永久倍率
      stolen:[], // 死而替生夺取的术式名（兼容）
      stolenTechs:[], // 死而替生夺取的完整术式 {name,flag,domain,prof}，各自独立熟练度
      absorbed:[], // 咒灵操术/降灵术永久吸收的敌人快照（数值固定不成长）
      flashCount:0,battleCount:0,huntCount:0,killCount:0,
      eventsDone:[], // 已完成的剧情节点
      notes:[], // 后日谈用关键记录
      favors:{}, // Batch C2 好感度：{角色名:0-100}，见 favor.js
      allyBoost:[0,0,0,0,0.03,0.05,0.10][faceIdx] // 颜值带来的队友协同（游戏化补全）
    };
    P.levelIndex=Player.evalLevel(P);
    return P;
  },
  /** 综合等级索引 0~11：五维均衡加权——咒效(输出)24%、体质(生存)22%，咒力总量/咒力操控/体术各18%；
   *  每一项都计入评级（咒操/体术等差五六档会明显拉低评级），同时以「输出与生存的较短板+2档」温和封顶，避免严重偏科虚高。 */
  evalLevel(P){
    const cp=tierIndexOf(P.maxCp,CP_TIERS);
    const ctl=tierIndexOf(P.ctl,CTL_TIERS);
    const eff=tierIndexOf(P.eff[1],DMG_TIERS);
    const me=tierIndexOf(P.melee[1],DMG_TIERS);
    const hp=hpTierIndexOf(P.maxHp);
    const base=eff*0.24+hp*0.22+cp*0.18+ctl*0.18+me*0.18;
    const hard=Math.min(eff,hp)+2; // 输出/生存为硬短板，允许比其高2档
    return clamp(Math.min(Math.round(base),hard),0,11);
  },
  /** 修炼：type=cp/melee/hp/ctl/eff，返回描述文本 */
  train(P,type){
    const k=P.growthMult,li=P.levelIndex; // 固定增量：只看成长系数与当前等级，不随已有属性滚动
    let txt='';
    if(type==='cp'){
      const add=fixedGain('cp',li,k);
      P.maxCp+=add;P.cp=Math.min(P.maxCp,P.cp+add);txt=`咒力总量 +${add}（固定）（${P.maxCp-add} → ${P.maxCp}）`;
    }else if(type==='melee'){
      const hi=fixedGain('dmg',li,k),lo=Math.max(1,Math.round(hi*0.6));
      P.melee[0]+=lo;P.melee[1]+=hi;txt=`体术伤害区间提升（固定 +${lo}~${hi}）→ ${P.melee[0]}~${P.melee[1]}`;
    }else if(type==='hp'){
      const a=fixedGain('hp',li,k);
      P.maxHp+=a;P.hp=Math.min(P.maxHp,P.hp+a);txt=`最大生命 +${a}（固定）（${P.maxHp}）`;
    }else if(type==='ctl'){
      const a=fixedGain('ctl',li,k);
      P.ctl+=a;txt=`咒力操控（消耗减免）+${a}（固定）→ ${P.ctl}`;
    }else if(type==='eff'){
      const hi=fixedGain('dmg',li,k),lo=Math.max(1,Math.round(hi*0.6));
      P.eff[0]+=lo;P.eff[1]+=hi;
      Player.gainProf(P,8);
      txt=`咒力效率区间提升（固定 +${lo}~${hi}）→ ${P.eff[0]}~${P.eff[1]}；术式熟练度 +8%`;
    }
    const old=P.levelIndex;P.levelIndex=Player.evalLevel(P);
    if(P.levelIndex>old)txt+=`；综合评级提升至【${lvName(P.levelIndex)}】`;
    return txt;
  },
  gainProf(P,n){
    const bonus=(P.identity==='咒术师'?1.20:1);
    // 主术式：100%领悟领域、300%领悟极之番，熟练度可一直累积到300封顶
    if(P.prof<300){
      P.prof=clamp(P.prof+n*bonus,0,300);
      if(!P.domainLearned&&P.prof>=100){P.domainLearned=true;P.notes.push('术式熟练度达到100%，领悟【领域展开】');}
      if(!P.ultimateLearned&&P.prof>=300){P.ultimateLearned=true;P.notes.push('术式熟练度达到300%，领悟终极奥义【极之番】！');}
    }
    // 死而替生夺取的每个术式拥有独立熟练度，同步成长
    (P.stolenTechs||[]).forEach(t=>{t.prof=clamp((t.prof||0)+n*bonus,0,300);});
  },
  /**
   * 狩猎咒灵等级权重（严格规则）：
   * ① 最高只能与自己平级，绝不出比自己强的咒灵；可狩猎的最高级封顶「强特级(10)」，不存在超特级咒灵；
   * ② 平级目标固定占 50% 权重；
   * ③ 其余 50% 全部分配比自己低级的咒灵（每低一级权重递减），最低到不入流(-2)。
   * 四级(0)玩家：四级50% + 准四级(-1) + 不入流(-2)。
   */
  huntPool(P){
    const top=clamp(P.levelIndex,-2,10); // 平级目标，封顶强特级
    const lowRel=[20,12,8,5,3,2,2,2,2,2,2,2,2]; // 每低一级的相对权重
    const pool=[{tier:top,weight:50}];
    let k=0;
    for(let t=top-1;t>=-2;t--,k++)pool.push({tier:t,weight:lowRel[Math.min(k,lowRel.length-1)]});
    const lowSum=sum(pool.slice(1).map(p=>p.weight));
    pool.forEach((p,i)=>{if(i>0)p.weight=p.weight/lowSum*50;}); // 低级合计严格=50
    return pool;
  },
  /** 战后成长奖励（按敌方最高等级） */
  reward(P,enemyLi,victory=true){
    if(!victory)return '';
    const k=P.growthMult; // 战后同样给固定数值（按敌人等级查表×成长系数），不随玩家属性滚动
    const profGain=Math.max(1,6+enemyLi);
    const cpAdd=fixedGain('cp',enemyLi,k*0.6);
    const hpAdd=fixedGain('hp',enemyLi,k*0.6);
    const dHi=fixedGain('dmg',enemyLi,k*0.6),dLo=Math.max(1,Math.round(dHi*0.6));
    const ctlAdd=fixedGain('ctl',enemyLi,k*0.5);
    P.maxCp+=cpAdd;P.cp=P.maxCp;
    P.maxHp+=hpAdd;P.hp=P.maxHp;
    P.eff[0]+=dLo;P.eff[1]+=dHi;
    P.melee[0]+=Math.round(dLo*0.6);P.melee[1]+=Math.round(dHi*0.8);
    P.ctl+=ctlAdd;
    Player.gainProf(P,profGain);
    const old=P.levelIndex;P.levelIndex=Player.evalLevel(P);
    let t=`战胜奖励（固定）：咒力+${cpAdd}、生命+${hpAdd}、术式伤害+${dLo}~${dHi}、减免+${ctlAdd}、熟练度+${profGain}%`;
    if(P.levelIndex>old)t+=`；综合评级提升至【${lvName(P.levelIndex)}】`;
    return t;
  }
};

/* ============================ IV. Canvas 转盘组件 ============================ */
const WHEEL_COLORS=['#4c1d95','#1e3a8a','#155e75','#166534','#854d0e','#9f1239','#6d28d9','#1e40af','#0e7490','#3f6212','#b45309','#9d174d','#5b21b6','#334155','#7c2d12','#581c87'];
/** 转盘图例：色块+完整名称+权重%；hitIdx 为抽中项下标（高亮） */
function wheelLegendHtml(items,hitIdx=-1){
  const tw=items.reduce((a,b)=>a+(b.weight||0),0);
  const rows=items.map((it,i)=>{
    const txt=it.label||it.name||'';
    const w=it.weight&&tw>0?`<span class="lg-w">${Math.round(it.weight/tw*100)}%</span>`:'';
    return `<div class="lg-item${i===hitIdx?' hit':''}" title="${(techniqueDescription(it)||txt).replace(/"/g,'&quot;')}"><span class="lg-dot" style="background:${WHEEL_COLORS[i%WHEEL_COLORS.length]}"></span><span>${txt}</span>${w}</div>`;
  }).join('');
  return `<div class="legend-cap"><b>选项总览（共 ${items.length} 项）</b><span>${tw>0?'数字为权重占比':'等概率'}</span></div>${rows}`;
}
let SPIN_SPEED=(function(){try{return +localStorage.getItem('jjk_spin_speed')||2;}catch(e){return 2;}})();
class WheelView{
  /** boxEl: 容器（内含 <canvas>）；items:[{label,weight}] */
  constructor(canvas){
    this.cv=canvas;this.ctx=canvas.getContext('2d');this.items=[];this.rotation=0;this.spinning=false;
  }
  setItems(items){
    this.items=items;this.rotation=0;this.draw();
  }
  draw(){
    const ctx=this.ctx,W=this.cv.width,H=this.cv.height,cx=W/2,cy=H/2,R=W/2-6;
    const n=this.items.length,seg=360/n;
    ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(cx,cy);ctx.rotate(this.rotation*Math.PI/180);
    // 第一遍：先画完所有扇形底色，避免文字被相邻扇形填色覆盖
    for(let i=0;i<n;i++){
      const a0=(i*seg-90)*Math.PI/180,a1=((i+1)*seg-90)*Math.PI/180;
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,a0,a1);ctx.closePath();
      ctx.fillStyle=WHEEL_COLORS[i%WHEEL_COLORS.length];ctx.fill();
      ctx.strokeStyle='rgba(8,5,20,.9)';ctx.lineWidth=n>20?1:2;ctx.stroke();
    }
    // 第二遍：再统一绘制文字（中线角度与扇形一致，-90° 使 0 号扇形从正上方起）
    for(let i=0;i<n;i++){
      const mid=i*seg+seg/2-90;          // 扇形中线全局角度
      const flip=mid>90&&mid<270;        // 左半圆：文字翻转 180° 保持正立可读
      ctx.save();ctx.rotate(mid*Math.PI/180);if(flip)ctx.rotate(Math.PI);
      ctx.textAlign=flip?'left':'right';ctx.textBaseline='middle';
      const fs=n>24?11:n>14?13:n>8?15:18;
      ctx.font=`700 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.lineWidth=Math.max(2,fs/6);ctx.strokeStyle='rgba(8,4,20,.85)';
      let label=this.items[i].label||'';
      const maxLen=n>24?6:n>14?9:n>8?12:13;
      if([...label].length>maxLen)label=[...label].slice(0,maxLen).join('')+'…';
      const tx=flip?-(R-14):R-14;
      ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=4;
      ctx.strokeText(label,tx,0);
      ctx.fillStyle='#ffffff';ctx.fillText(label,tx,0);
      ctx.restore();
    }
    // 外圈
    ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.lineWidth=5;ctx.strokeStyle='#c9a6ff';ctx.stroke();
    ctx.restore();
  }
  /** 旋转抽取，cb(selectedItem,index) */
  spin(cb,selectedIndex){
    if(this.spinning)return;
    this.spinning=true;
    const sp=SPIN_SPEED,dur=4.6/sp; // 转速倍率：1×/2×/3×
    const idx=Number.isInteger(selectedIndex)&&selectedIndex>=0&&selectedIndex<this.items.length?selectedIndex:weightedIndex(this.items);
    const n=this.items.length,seg=360/n,targetCenter=idx*seg+seg/2;
    this.cv.style.transition='none';
    this.cv.style.transform=`rotate(${this.rotation%360}deg)`;
    void this.cv.offsetWidth;
    // 再转 6 圈，使目标扇形中心停在正上方指针处
    const finalRot=this.rotation+360*6+((360-targetCenter)-(this.rotation%360));
    const wheelTravel=finalRot-this.rotation;
    let settled=false,tickTimer=null;
    const finish=()=>{if(settled)return;settled=true;this.spinning=false;cancelAnimationFrame(tickTimer);SFX.spinEnd();cb&&(cb(this.items[idx],idx));};
    const onEnd=()=>{finish();this.cv.removeEventListener('transitionend',onEnd);};
    this.cv.addEventListener('transitionend',onEnd);
    this.cv.style.transition=`transform ${dur}s cubic-bezier(.12,.72,.08,1)`;
    this.cv.style.transform=`rotate(${finalRot}deg)`;
    this.rotation=finalRot;
    SFX.spinStart();
    // 指针滴答声：转6圈，每越过一个扇形一声，均摊到整段动画
    const started=performance.now(),startAngle=(finalRot-wheelTravel)%360;
    let lastSector=Math.floor(startAngle/seg),lastSound=started;
    const bez=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    const tickFrame=now=>{if(settled)return;const progress=Math.min(1,(now-started)/(dur*1000));let lo=0,hi=1;
      for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(bez(mid,.12,.08)<progress)lo=mid;else hi=mid;}
      const eased=bez((lo+hi)/2,.72,1),sector=Math.floor((startAngle+wheelTravel*eased)/seg);
      if(sector!==lastSector){if(now-lastSound>=65&&!document.hidden){SFX.tick();lastSound=now;}lastSector=sector;}
      if(progress<1)tickTimer=requestAnimationFrame(tickFrame);
    };tickTimer=requestAnimationFrame(tickFrame);
    // 兜底：动画事件异常时强制结算
    setTimeout(finish,dur*1000+600);
  }
}

/* ============================ V. 战斗引擎（ATB 轮轴回合制） ============================ */
/* 设计：引擎为纯逻辑，advance() 每次推进“一个动作”；UI 层按节奏调用并渲染事件。
 * 综合实力（等级 li）决定速度，ATB 条先满者行动 -> 即“综合实力越强行动越快”。 */
const TECH_MOVE={
 limitless:['苍·引力坍缩','赫·斥力爆散','茈·虚式轰击'],shadows:['玉犬撕咬','鵺雷击俯冲','满象重坠','脱兔群袭','大蛇绞噬'],
 cleave:['解·无形斩','捌·必中斩','开·火焰','灶·炎灾'],straw:['刍灵共鸣','簪·钉子贯魂'],ratio:['十划·7:3弱点必破'],
 cursedSpeech:['咒言·爆裂吧','咒言·停下','咒言·睡吧'],spiritControl:['驱使吸收咒灵群袭'],idleTrans:['无为转变·灵魂改写'],
 swap:['不义游戏·强制换位'],blood:['赤血·穿刺血弹','赤血·超新星','赤血·血刃斩'],crows:['黑鸟群·共享视野突袭'],
 projection:['投射咒法·24帧位移斩'],construct:['构筑术式·咒具具现'],puppet:['傀儡操术·人偶强袭'],
 moon:['淀月·毒触手侵蚀'],rot:['蚀烂腐术·腐血侵入'],miracle:['奇迹·伤害转化再生'],jacob:['雅各布天梯·圣光剥离'],
 amber:['幻兽琥珀·万雷齐落'],judge:['判决术式·定罪没收'],cannon:['咒力大炮·全力输出'],mass:['质量术式·重力坍缩'],
 arms:['鬼臂罗网·百手追袭'],tsukumo:['付丧操术·机械冲撞'],seance:['降灵术·亡灵强袭'],sky:['天空术式·空间扭曲'],
 grow:['生长术式·荆棘绞杀'],fire:['火灾操术·熔岩喷发'],gu:['蛊毒术式·毒侵'],copy:['复制术式·连携轰击'],
 negate:['万象拒绝·否定一切'],requiem:['黄金体验镇魂曲·行动归零'],kaioken:['界王拳·倍化猛攻'],
 ssj:['超级赛亚人·毁天灭地'],sage:['仙法·自然之力打击'],reviveWin:['死而替生·夺式一击']};
/** 每个术式对应的领域名（取自 WHEEL_TECHNIQUE.domain） */
const TECH_DOMAIN={};WHEEL_TECHNIQUE.forEach(t=>TECH_DOMAIN[t.flag]=t.domain);

class BattleEngine{
  /** cfg:{title, player(P), enemies:[{name,li,type}], allies:[{name,li,type}]} */
  constructor(cfg){
    this.cfg=cfg;this.ended=false;this.result=null;this.events=[];this.lastActor=null;this.awaitingPlayer=false;
    this.actionsTotal=0;this.units=[];this.killedPool=[];this._downNotified=false; // killedPool: 本场被击败敌人的面板快照（供咒灵操术/降灵召唤）
    this.player=this.makePlayerUnit(cfg.player);
    this.units.push(this.player);
    cfg.allies.forEach(a=>this.units.push(this.makeNpcUnit(a.name,a.li,a.type,'ally')));
    cfg.enemies.forEach(e=>this.units.push(this.makeNpcUnit(e.name,e.li,e.type||'咒灵','enemy',e.wild)));
    this.villain=!!cfg.villain;
    // 反派路线：作为敌方登场的五条悟，血量为正常的5倍（人类最强，是反派必须跨越的高墙）
    if(this.villain)this.units.filter(u=>u.side==='enemy'&&u.name==='五条悟').forEach(u=>{u.maxHp=Math.round(u.maxHp*5);u.hp=u.maxHp;});
    // 开局 5% 领悟反转术式
    if(!cfg.practiceSkills&&!cfg.player.reverse&&Math.random()<0.05){
      cfg.player.reverse=true;this.player.reverse=true;
      this.events.push({type:'learn',text:'✦ 生死之间灵光乍现——你领悟了被动技能【反转术式】！'});
      cfg.player.notes.push('在战斗中领悟了【反转术式】');
    }
    // 开局 5% 领悟黑闪（另：京都篇战胜东堂葵可100%学会）
    if(!cfg.practiceSkills&&!cfg.player.blackFlash&&Math.random()<0.05){
      cfg.player.blackFlash=true;this.player.blackFlash=true;
      this.events.push({type:'learn',text:'✦ 拳与咒力在刹那同频——你在激战中触到了【黑闪】的门径！'});
      cfg.player.notes.push('在战斗中领悟了【黑闪】');
    }
    // 界王拳：开战全属性+50%
    if(this.player.hasFlag('kaioken')){
      this.player.maxHp=Math.round(this.player.maxHp*1.5);this.player.hp=this.player.maxHp;
      this.player.melee=this.player.melee.map(v=>Math.round(v*1.5));this.player.eff=this.player.eff.map(v=>Math.round(v*1.5));
      this.events.push({type:'info',text:'【界王拳】发动！本场全属性提升50%，但每次行动后损失10%生命。'});
    }
    if(this.player.hasFlag('ssj'))this.events.push({type:'info',text:'【超级赛亚人变身】！前5次攻击伤害×51，之后恢复常态。'});
    // 进战召唤：黑鸟3乌鸦 / 傀儡1傀儡 / 十影宿傩召唤魔虚罗
    this.units.filter(u=>u.alive).forEach(u=>{
      if(u.hasFlag('crows')){for(let i=0;i<3;i++)this.addSummon(u,'乌鸦式神',0.30,'式神');}
      if(u.hasFlag('puppet'))this.addSummon(u,'傀儡',0.70,'傀儡');
      if(u.skills&&u.skills.summonMakora)this.addSummon(u,'魔虚罗·式神',1.0,'式神',{specName:'魔虚罗',specLi:10});
    });
  }
  hasFlag(u,f){return !!u&&(u.flag===f||(u.flags&&u.flags.includes(f)));}
  makePlayerUnit(P){
    const flags=P.technique.flags?P.technique.flags.slice():[];
    if(P.technique.flag)flags.unshift(P.technique.flag);
    // 死而替生夺取的术式：其 flag 一并并入，使多个术式效果在战斗中同时生效
    (P.stolenTechs||[]).forEach(t=>{if(t.flag)flags.push(t.flag);(t.flags||[]).forEach(f=>flags.push(f));});
    let pSpeed=6+P.levelIndex*1.7+randF(0,1);if(flags.includes('tsukumo'))pSpeed*=1.20;
    return this.decorate({
      name:'你',isPlayer:true,side:'ally',li:P.levelIndex,
      maxHp:P.maxHp,hp:P.maxHp,maxCp:P.maxCp,cp:P.maxCp,
      melee:P.melee.slice(),eff:P.eff.slice(),ctl:P.ctl,
      atb:randF(0,6),speed:pSpeed,
      reverse:!!P.reverse,canDomain:!!P.domainLearned,domainUsed:0,domainCd:0,
      canUlt:!!P.ultimateLearned,ultUsed:false,
      flag:P.technique.flag,flags:[...new Set(flags)],techName:P.technique.name,domainName:P.technique.domain||'领域',
      alive:true});
  }
  /** 具名角色优先使用精确五维面板（NPC_CHARS）；否则按 li 推导（泛用/野生咒灵） */
  makeNpcUnit(name,li,type,side,wild){
    li=clamp(li,-2,11);
    const spec=getCharSpec(name,li);
    let maxHp,maxCp,melee,eff,ctl,flag=null,flags=[],opt={},hpIdx;
    if(spec){
      const[cp,me,hp,ct,ef,fl,o]=spec;opt=o||{};
      maxCp=tierMidCp(cp);melee=tierMidDmg(me);eff=tierMidDmg(ef);ctl=tierMidCtl(ct);
      maxHp=charHp(hp);hpIdx=hp;flag=fl;if(o.flags)flags=o.flags.slice();
      if(fl)flags.unshift(fl);flags=[...new Set(flags)];
    }else{
      const cpR=tierCp(li),dmgR=tierDmg(li),ctlR=tierCtl(li);
      let hpR=npcHpRange(li);
      if(wild)hpR=li<0?npcHpRange(li):HP_TIERS[clamp(li,0,HP_TIERS.length-1)][1];
      const vary=v=>Math.round(v*randF(0.85,1.15));
      const hpK=wild?0.60:1,dmgK=wild?0.80:1,sc=(v,k)=>Math.max(1,Math.round(v*k));
      maxHp=sc(rand(hpR[0],hpR[1]),hpK);maxCp=Math.max(1,rand(cpR[0],cpR[1]));
      melee=[Math.max(0,sc(vary(dmgR[0]),dmgK)),Math.max(1,sc(vary(dmgR[1]),dmgK))];
      eff=[Math.max(0,sc(vary(dmgR[0]),dmgK)),Math.max(1,sc(vary(dmgR[1]),dmgK))];
      ctl=Math.max(0,rand(ctlR[0],ctlR[1]));
      opt.rev=li>=8?1:0;opt.dom=side==='enemy'?li>=7:li>=11;opt.bf=0;
    }
    // 付丧操术：速度+20%
    let speed=6+li*1.7+randF(0,1.5);if(flags.includes('tsukumo'))speed*=1.20;
    // 仅五条悟、十影宿傩、羂索、九十九由基掌握极之番
    const canUlt=['五条悟','十影宿傩','羂索','九十九由基'].includes(name);
    const u=this.decorate({
      name,li,type:type||'咒灵',side,isPlayer:false,wild:!!wild,
      maxHp,hp:maxHp,maxCp,cp:maxCp,melee,eff,ctl,
      atb:randF(0,8),speed,
      reverse:!!opt.rev,
      bf:opt.bf||0, // 是否掌握黑闪（NPC_CHARS 中 bf:1 者战斗中10%触发）
      canDomain:!!opt.dom,domainUsed:0,domainCd:0,flag,flags,techName:flag?this.techLabel(flag):'咒力',
      domainName:({'漏壶':'盖棺铁围山','花御':'朵颐光海','陀艮':'荡蕴平线','日车宽见':'诛伏赐死'})[name]||(flag?(TECH_DOMAIN[flag]||'领域'):'领域'),
      canUlt,ultUsed:false,
      skills:{sixEyes:opt.sixEyes||0,charge:opt.charge||0,adapt:opt.adapt||0,regen:opt.regen||0,summonMakora:opt.summonMakora||0,
              chargeSlash:opt.chargeSlash||null,spaceSlash:opt.spaceSlash||null},
      alive:true});
    return u;
  }
  techLabel(flag){const t=WHEEL_TECHNIQUE.find(x=>x.flag===flag);return t?t.name:'咒力';}
  decorate(u){
    u.buff={defend:false,vuln:0,stun:0,seal:0,ssj:5,actCount:0,miracle:0,saved:false,
            charge:false,poison:0,gu:0,adaptM:0,adaptT:0,jacobVuln:0,reviveBoost:false};
    u.flags=u.flags||[];u.skills=u.skills||{};
    u.hasFlag=function(f){return u.flag===f||(u.flags&&u.flags.includes(f));};
    return u;
  }
  alive(side){return this.units.filter(u=>u.alive&&(side?u.side===side:true));}
  /** 召唤单位：继承召唤者总属性的 ratio；tag=式神/傀儡 */
  addSummon(owner,name,ratio,tag,override){
    if(this.alive().length>=14)return null; // 全场单位上限，防止召唤膨胀
    const sc=v=>Math.max(1,Math.round(v*ratio));
    let melee,eff,maxHp,maxCp,ctl,li;
    if(override&&override.specName){ // 以指定具名角色面板召唤（十影宿傩召唤魔虚罗）
      const base=this.makeNpcUnit(override.specName,override.specLi,'式神',owner.side);
      melee=base.melee;eff=base.eff;maxHp=base.maxHp;maxCp=base.maxCp;ctl=base.ctl;li=base.li;
    }else{
      melee=owner.melee.map(sc);eff=owner.eff.map(sc);maxHp=sc(owner.maxHp);maxCp=sc(owner.maxCp);ctl=sc(owner.ctl);li=owner.li;
    }
    const u=this.decorate({name,isPlayer:false,side:owner.side,li,summonTag:tag,ownerName:owner.name,
      maxHp,hp:maxHp,maxCp,cp:maxCp,melee,eff,ctl,atb:clamp(owner.atb+randF(0,10),0,99),
      speed:owner.speed*randF(0.95,1.05),reverse:false,canDomain:false,domainUsed:0,
      flag:null,flags:[],techName:tag,domainName:'',alive:true});
    this.units.push(u);return u;
  }
  /** 十种影法术式神比例表 */
  shadowSummon(owner,ev){
    const table=[['玉犬式神',.05],['脱兔式神',.03],['蟾蜍式神',.07],['大蛇式神',.15],['圆鹿式神',.20],['贯牛式神',.30],['鵺式神',.25],['满象式神',.35],['虎杖式神',.40]];
    const mine=this.alive(owner.side).filter(u=>u.summonTag==='式神'&&u.ownerName===owner.name&&u.fused!==true&&u.shadow===true);
    // 嵌合兽融合：已有≥2个十种影式神在场时，融合为嵌合兽
    if(mine.length>=2){
      const sumHp=mine.reduce((a,b)=>a+b.maxHp,0),sumCp=mine.reduce((a,b)=>a+b.maxCp,0);
      const mM=[Math.round(sum(mine.map(u=>u.melee[0]))),Math.round(sum(mine.map(u=>u.melee[1])))];
      const eE=[Math.round(sum(mine.map(u=>u.eff[0]))),Math.round(sum(mine.map(u=>u.eff[1])))];
      mine.forEach(u=>{u.alive=false;});
      const f=this.decorate({name:'嵌合兽·式神',isPlayer:false,side:owner.side,li:owner.li,summonTag:'式神',ownerName:owner.name,fused:true,shadow:true,
        maxHp:sumHp,hp:sumHp,maxCp:sumCp,cp:sumCp,melee:mM,eff:eE,ctl:0,atb:owner.atb,speed:owner.speed,
        reverse:false,canDomain:false,domainUsed:0,flag:null,flags:[],techName:'嵌合兽',domainName:'',alive:true});
      this.units.push(f);
      ev.push({type:'skill',text:`${owner.name} 的多个式神融合为【嵌合兽】，强度叠加！`});return;
    }
    const[n,r]=table[rand(0,table.length-1)];
    const u=this.addSummon(owner,n,r,'式神');if(u){u.shadow=true;ev.push({type:'skill',text:`${owner.name} 召唤了【${n}】（继承${Math.round(r*100)}%总属性）。`});}
  }
  previewOrder(count=8,firstUnit=null){
    const seq=[];
    if(firstUnit&&firstUnit.alive)seq.push(firstUnit);
    const sim=this.alive().map(u=>({u,atb:u.atb}));
    if(!sim.length)return seq;
    for(let k=seq.length;k<count;k++){
      let chosen=null,guard=0;
      while(!chosen&&guard++<600){
        const pend=sim.filter(s=>s.atb<100).sort((a,b)=>b.atb-a.atb)[0];
        if(!pend){sim.forEach(s=>s.atb=Math.max(0,s.atb-100));continue;}
        const maxSpeed=Math.max(...sim.map(s=>s.u.speed));
        const step=(100-pend.atb)/maxSpeed+1e-4;
        sim.forEach(s=>s.atb+=s.u.speed*step);
        const ready=sim.filter(s=>s.atb>=100).sort((a,b)=>b.atb-a.atb);
        if(ready.length){chosen=ready[0];chosen.atb-=100;}
      }
      if(chosen)seq.push(chosen.u);else break;
    }
    return seq;
  }
  advance(){
    const ev=this.events;this.events=[];
    if(this.ended)return {events:ev,ended:true,result:this.result,needInput:false};
    if(this.actionsTotal>=300)return this.forceSettle(ev); // 硬上限：鏖战300行动仍未分胜负则强制裁决，保证绝不卡死
    const alive=this.alive();
    let actor=null,guard=0;
    while(!actor&&guard++<50){
      let top=alive.filter(u=>u.alive&&u.atb<100).sort((a,b)=>b.atb-a.atb)[0];
      if(!top){alive.forEach(u=>u.atb-=100);top=alive.filter(u=>u.alive&&u.atb<100).sort((a,b)=>b.atb-a.atb)[0];
        if(!top){alive.forEach(u=>u.atb=randF(0,6));top=alive.find(u=>u.alive);}}
      if(!top)break;
      const maxSpeed=Math.max(...alive.filter(u=>u.alive).map(u=>u.speed));
      const step=(100-top.atb)/maxSpeed+0.0001;
      alive.forEach(u=>{if(u.alive)u.atb+=u.speed*step;});
      const ready=alive.filter(u=>u.alive&&u.atb>=100).sort((a,b)=>b.atb-a.atb);
      if(ready.length)actor=ready[0];
    }
    if(!actor)return this.pack([{type:'info',text:'战局陷入凝滞。'}]);
    actor.atb-=100;this.lastActor=actor;
    if(window.BattleTraits?.beforeTurn(this,actor,ev))return this.pack(ev);
    if(actor.buff.stun>0){actor.buff.stun--;ev.push({type:'info',text:`${actor.name} 被压制，无法行动。`});this.afterAction(actor,ev);return this.pack(ev);}
    // —— 回合开始钩子 ——
    this.onTurnStart(actor,ev);
    if(this.ended)return this.pack(ev);
    if(!actor.alive){this.checkEnd(ev);return this.pack(ev);} // 回合开始DOT/反噬已将其击倒，不再行动
    actor.buff.defend=false;this.actionsTotal++;actor.buff.actCount++;
    if(actor.buff.jacobVuln>0)actor.buff.jacobVuln--; // 雅各布天梯·易伤：按受影响方行动次数衰减
    if(actor.isPlayer){this.awaitingPlayer=true;return {events:ev,ended:false,needInput:true};}
    this.npcAct(actor,ev);
    this.afterAction(actor,ev);
    return this.pack(ev);
  }
  /** 回合开始：DOT结算 / 反转 / 无下限耗蓝 / 再生回血 / 行动召唤 */
  onTurnStart(actor,ev){
    // 1. 毒素 / 蛊毒结算（每层扣当前血量上限的比例）
    if(actor.buff.poison>0){const d=Math.round(actor.maxHp*0.05*actor.buff.poison);this.loseHp(actor,d,ev,'淀月毒素');}
    if(actor.buff.gu>0){const d=Math.round(actor.maxHp*0.10*actor.buff.gu);this.loseHp(actor,d,ev,'蛊毒');}
    if(!actor.alive)return;
    // 2. 反转术式
    if(actor.reverse&&actor.hp<actor.maxHp&&actor.cp>=actor.maxCp*0.05){
      const hf=this.actionsTotal>120?0.25:1; // 力竭阶段回复衰减，保证僵持必分胜负
      const cost=(actor.skills&&actor.skills.sixEyes)?0:Math.round(actor.maxCp*0.05),heal=Math.round(actor.maxHp*0.20*hf);
      actor.cp-=cost;actor.hp=Math.min(actor.maxHp,actor.hp+heal);
      ev.push({type:'heal',from:actor.name,text:`${actor.name} 运转【反转术式】，耗5%咒力恢复${Math.round(20*hf)}%生命（+${heal}）。`,heal});
    }
    // 3. 超高速再生（魔虚罗：每回合回90%）
    if(actor.skills.regen){const rf=this.actionsTotal>120?0.25:1;const h=Math.round(actor.maxHp*actor.skills.regen*rf);actor.hp=Math.min(actor.maxHp,actor.hp+h);ev.push({type:'heal',text:`${actor.name}【超高速再生】，恢复${Math.round(actor.skills.regen*rf*100)}%生命（+${h}）。`,heal:h});}
    // 4. 无下限：每次行动咒力消耗+1000（被咒力操控减免抵消；六眼为0）
    if(this.hasFlag(actor,'limitless')&&!actor.skills.sixEyes){
      const cost=Math.max(0,1000-actor.ctl);
      if(actor.cp>=cost){actor.cp-=cost;if(cost>0&&actor.isPlayer)ev.push({type:'info',text:`维持【无下限·无穷】，本回合消耗咒力 ${cost}（已被操控减免）。`});}
    }
    // 5. 回合回血类
    if(this.hasFlag(actor,'idleTrans')){const h=Math.round(actor.maxHp*.10);actor.hp=Math.min(actor.maxHp,actor.hp+h);if(actor.isPlayer)ev.push({type:'heal',text:`【无为转变】改写灵魂，恢复10%生命（+${h}）。`,heal:h});}
    if(this.hasFlag(actor,'grow')){const h=Math.round(actor.maxHp*.10),c=Math.round(actor.maxCp*.10);actor.hp=Math.min(actor.maxHp,actor.hp+h);actor.cp=Math.min(actor.maxCp,actor.cp+c);if(actor.isPlayer)ev.push({type:'heal',text:`【生长术式】恢复10%生命与咒力。`,heal:h});}
    if(this.hasFlag(actor,'sage')){const h=Math.round(actor.maxHp*.30);actor.hp=Math.min(actor.maxHp,actor.hp+h);if(actor.isPlayer)ev.push({type:'heal',text:`【仙人模式】恢复30%生命（+${h}）。`,heal:h});}
    // 6. 行动时召唤
    if(!window.PlayerStyles?.manualSummons(this,actor)){
      if(this.hasFlag(actor,'shadows'))this.shadowSummon(actor,ev);
      if(this.hasFlag(actor,'spiritControl')){for(let i=0;i<3;i++)this.summonFromKilled(actor,ev,'咒灵式神');}
      if(this.hasFlag(actor,'seance'))this.summonFromKilled(actor,ev,'亡灵式神');
      if(this.hasFlag(actor,'puppet')){const n=this.alive(actor.side).filter(u=>u.summonTag==='傀儡'&&u.ownerName===actor.name).length;if(n<3)this.addSummon(actor,'傀儡',.70,'傀儡');}
    }
    // 领域熔断恢复：轮到自身行动时，有反转术式者冷却-1（用完间隔自身一次行动即可再开）
    if((actor.domainCd||0)>0&&actor.domainCd<9000)actor.domainCd=Math.max(0,actor.domainCd-1);
  }
  summonFromKilled(owner,ev,prefix){
    const perm=(owner.isPlayer&&this.cfg.player.absorbed)?this.cfg.player.absorbed:[];
    const pool=perm.concat(this.killedPool);
    if(!pool.length)return;
    const dead=pool[rand(0,pool.length-1)];
    const u=this.addSummon(owner,prefix+'·'+dead.name,1.0,'式神');
    if(u){u.melee=dead.melee.slice();u.eff=dead.eff.slice();u.maxCp=dead.maxCp;u.cp=dead.maxCp;u.maxHp=dead.maxHp;u.hp=dead.maxHp;u.li=dead.li;
      ev.push({type:'skill',text:`${owner.name} 召唤曾击败的【${dead.name}】作为临时式神。`});}
  }
  loseHp(u,d,ev,label){
    if(!u.alive||d<=0)return;
    u.hp-=d;ev.push({type:'hit',text:`${u.name} 因【${label}】受到 ${d} 点持续伤害。`,dmg:d});
    if(u.hp<=0){
      if(u.isPlayer)this.guardPlayerDeath(ev);
      if(u.alive===false||u.hp<=0)this.kill(u,ev);
    }
  }
  pack(ev){this.checkEnd(ev);return {events:ev,ended:this.ended,result:this.result,needInput:false};}
  afterAction(actor,ev){
    // 力竭收敛：行动超过120次后（如双方互相免疫/打不动），全体每回合受最大生命4%的力竭伤害，保证战斗必然分出胜负
    if(this.actionsTotal>120){
      const over=this.actionsTotal-120;
      const pct=Math.min(0.60,0.04+Math.floor(over/6)*0.05); // 递增侵蚀：4%起每6行动+5%，封顶60%（必压过再生/反转）
      this.alive().forEach(u=>{if(!u.alive)return;const d=Math.max(1,Math.round(u.maxHp*pct));u.hp-=d;
        if(u.isPlayer)ev.push({type:'hit',text:`战局拖入力竭（侵蚀${Math.round(pct*100)}%），你受到 ${d} 点侵蚀伤害。`,dmg:d});
        if(u.hp<=0){if(u.isPlayer)this.guardPlayerDeath(ev);if(u.hp<=0)this.kill(u,ev);}});
    }
    // 界王拳反噬：每次行动-10%血
    if(this.hasFlag(actor,'kaioken')){const d=Math.round(actor.maxHp*.10);actor.hp-=d;ev.push({type:'hit',text:`【界王拳】反噬，生命 -${d}。`,dmg:d});}
    // 投射咒法：行动后下一次行动值拉条80%
    if(this.hasFlag(actor,'projection')){actor.atb=Math.min(99,actor.atb+80);ev.push({type:'skill',text:`【投射咒法】24帧加速，下次行动值拉条80%。`});}
    if(actor.isPlayer&&actor.hp<=0)this.guardPlayerDeath(ev);
    this.checkEnd(ev);
  }
  playerAct(action,targetIdx){
    const ev=[];const p=this.player;this.awaitingPlayer=false;
    const target=()=>{let t=this.units[targetIdx];if(!t||!t.alive||t.side!=='enemy')t=this.pickEnemyTarget();return t;};
    if(action==='defend'){
      p.buff.defend=true;p.cp=Math.min(p.maxCp,p.cp+Math.round(p.maxCp*0.08));
      ev.push({type:'info',text:'你架式防御，本回合受伤减半，并恢复8%咒力。'});
    }else if(action==='domain'){
      const domOk=this.castDomain(p,ev);
      if(!domOk){ // 领域熔断中 / 咒力不足：不消耗本次行动，继续等待玩家重新选择指令
        this.awaitingPlayer=true;
        return {events:ev,ended:false,result:null,needInput:true,retryInput:true};
      }
    }
    else if(action==='ult'){
      const ultOk=this.castUltimate(p,ev);
      if(!ultOk){ // 不满足极之番条件：不耗回合，重新等待指令
        this.awaitingPlayer=true;
        return {events:ev,ended:false,result:null,needInput:true,retryInput:true};
      }
    }
    else if(action==='melee'){this.performStrike(p,target(),'melee',ev);}
    else if(action==='tech'){
      const cost=this.techCost(p);
      if(p.cp<cost){ev.push({type:'info',text:'咒力不足，无法释放术式，只能近身肉搏！'});this.performStrike(p,target(),'melee',ev);}
      else{p.cp-=cost;this.performStrike(p,target(),'tech',ev);}
    }
    this.afterAction(p,ev);
    return {events:ev,ended:this.ended,result:this.result,needInput:false};
  }
  techCost(u){
    if(u.skills&&u.skills.sixEyes)return 0; // 六眼：咒力消耗为0
    return Math.max(1,Math.round(u.eff[1]*0.08)-u.ctl);
  }
  /** 统一出手（玩家/NPC 共用），kind=melee|tech */
  performStrike(att,target,kind,ev){
    if(!target||!target.alive)return;
    // —— 原即死类术式（tech）：Batch B 机制化改造 ——
    if(kind==='tech'){
      // 雅各布天梯：受肉体 80% 概率剥离秒杀（未触发转为常规打击）；对非受肉体改为 70% 最大生命真伤 + 2 回合易伤
      if(this.hasFlag(att,'jacob')){
        const vessel=target.type==='受肉体'||target.name.includes('受肉');
        if(vessel&&Math.random()<MECHANIC_TUNING.jacob.executeP){ev.push({type:'domain',text:`【雅各布天梯】圣光剥离受肉灵魂，${target.name} 被瞬间抹除！`});this.kill(target,ev,att);this.afterStrike(ev);return;}
        if(vessel)ev.push({type:'info',text:`【雅各布天梯】圣光未能彻底剥离 ${target.name} 的受肉灵魂，转为常规打击。`});
        if(!vessel){
          ev.push({type:'domain',text:`【雅各布天梯】圣光降临，灼烧 ${target.name}（最大生命 ${Math.round(MECHANIC_TUNING.jacob.trueDmg*100)}% 真实伤害），并附加 ${MECHANIC_TUNING.jacob.vulnTurns} 回合易伤！`});
          this.dealDamage(att,target,Math.round(target.maxHp*MECHANIC_TUNING.jacob.trueDmg),1,'tech',ev,'雅各布天梯·圣光',false,true,true);
          if(target.alive)target.buff.jacobVuln=Math.max(target.buff.jacobVuln||0,MECHANIC_TUNING.jacob.vulnTurns); // 易伤自下一击起生效
          if(att.isPlayer&&att.hp<=0)this.guardPlayerDeath(ev);
          this.afterStrike(ev);return;
        }
      }
      // 判决术式：式神秒杀保留；对非式神改为 60% 最大生命真伤
      if(this.hasFlag(att,'judge')&&(target.type==='式神'||target.summonTag==='式神'||target.name.includes('式神'))){ev.push({type:'domain',text:`【判决术式】定罪完成，式神 ${target.name} 被处刑抹除！`});this.kill(target,ev,att);this.afterStrike(ev);return;}
      if(this.hasFlag(att,'judge')){
        ev.push({type:'domain',text:`【判决术式】开庭宣判，${target.name} 被判「有罪」，承受最大生命 ${Math.round(MECHANIC_TUNING.judge.trueDmg*100)}% 的真实伤害！`});
        this.dealDamage(att,target,Math.round(target.maxHp*MECHANIC_TUNING.judge.trueDmg),1,'tech',ev,'判决术式·有罪宣判',false,true,true);
        if(att.isPlayer&&att.hp<=0)this.guardPlayerDeath(ev);
        this.afterStrike(ev);return;
      }
      // 万象拒绝：对咒力上限更低者改为 50% 最大生命真伤 + 自身咒力消耗翻倍（不再秒杀）
      if(this.hasFlag(att,'negate')&&target.maxCp<att.maxCp){
        const extra=this.techCost(att);att.cp=Math.max(0,att.cp-extra);
        ev.push({type:'domain',text:`【万象拒绝】${att.name} 否定了 ${target.name} 的存在形式，造成最大生命 ${Math.round(MECHANIC_TUNING.negate.trueDmg*100)}% 的真实伤害（咒力消耗翻倍，额外 -${extra}）！`});
        this.dealDamage(att,target,Math.round(target.maxHp*MECHANIC_TUNING.negate.trueDmg),1,'tech',ev,'万象拒绝',false,true,true);
        if(att.isPlayer&&att.hp<=0)this.guardPlayerDeath(ev);
        this.afterStrike(ev);return;
      }
      // 咒言：控制目标下回合无法行动，消耗随对方实力提高
      if(this.hasFlag(att,'cursedSpeech')){const cost=(att.skills&&att.skills.sixEyes)?0:Math.round(att.maxCp*0.05+target.maxCp*0.02);if(att.cp>=cost){att.cp-=cost;target.buff.stun=Math.max(target.buff.stun,1);ev.push({type:'skill',text:`【咒言】强制命令 ${target.name}，其下回合无法行动（耗咒力${cost}）。`});} }
    }
    // —— 基础伤害 ——
    let base,label,mult=1;
    if(kind==='melee'){base=rand(att.melee[0],att.melee[1]);label=`${att.name} 体术攻击`;}
    else{
      // 御厨子四式轮换：解120/捌130/开200/灶250
      if(this.hasFlag(att,'cleave')){const seq=[['解',1.2],['捌',1.3],['开',2.0],['灶',2.5]];const[nm,m]=seq[(att.buff.actCount-1+seq.length)%seq.length];base=Math.round(rand(att.eff[0],att.eff[1])*m);label=`${att.name}「${nm}」`;}
      else{base=Math.round(rand(att.eff[0],att.eff[1])*2.0);label=`${att.name}「${this.pickMove(att.flag)}」`;}
    }
    // 队友颜值协同（allyBoost）
    if(att.side==='ally'&&!att.isPlayer)mult*=(1+(this.cfg.player.allyBoost||0));
    // —— 增伤倍率 ——
    if(kind==='melee'){
      if(this.hasFlag(att,'ratio'))mult*=1.5;            // 十划 近战+50%
      // 质量术式近战×2 已于 Batch B 移除（机制化：星之怒改为全体真伤，见下方追加段）
    }
    if(kind==='tech'){
      if(this.hasFlag(att,'construct'))mult*=1.5;       // 构筑 效率+50%
      if(this.hasFlag(att,'cannon'))mult*=2.0;          // 咒力大炮 +100%
      if(this.hasFlag(att,'blood'))mult*=2.0;           // 赤血 效率+100%
      if(this.hasFlag(att,'projection'))mult*=0.3;      // 投射 咒术-70%
    }
    if(kind==='melee'&&this.hasFlag(att,'projection'))mult*=0.1; // 投射 近战-90%
    // 超级赛亚人 ×51（前5次攻击）
    if(this.hasFlag(att,'ssj')&&att.buff.ssj>0){mult*=51;att.buff.ssj--;if(att.buff.ssj===0)ev.push({type:'info',text:'超级赛亚人变身结束，恢复常态。'});}
    // 复制术式：每名存活非自身队友 +8%；死而替生夺式 +20%/个
    if(this.hasFlag(att,'copy'))mult*=(1+0.08*this.alive(att.side).filter(u=>u!==att&&!u.summonTag).length);
    if(att.isPlayer)mult*=(1+0.20*(this.cfg.player.stolen?.length||0));
    // —— 耗血类：赤血耗10%血；幻兽琥珀烧20%血转附加 ——
    let amberBonus=0;
    if(kind==='tech'&&this.hasFlag(att,'blood')){const c=Math.round(att.maxHp*.10);att.hp-=c;ev.push({type:'hit',text:`【赤血操术】以血为武，消耗自身10%生命（-${c}）。`,dmg:c});}
    if(this.hasFlag(att,'amber')){const c=Math.round(att.maxHp*.20);att.hp-=c;amberBonus=c;ev.push({type:'hit',text:`【幻兽琥珀】燃烧20%生命（-${c}）化作雷击附加。`,dmg:c});}
    // —— 黑闪 ——（玩家需学会；NPC 需 bf；十划咒法 +20% 与基础概率叠加）
    let flash=false;
    const flashBase=((att.isPlayer&&this.cfg.player.blackFlash)||att.bf)?0.10:0;
    const flashP=window.BattleResonance?window.BattleResonance.flashChance(this,att,kind):flashBase+(this.hasFlag(att,'ratio')?0.20:0);
    if(flashP>0&&Math.random()<flashP){mult*=10;flash=true;}
    const dmg=this.dealDamage(att,target,base,mult,kind,ev,label,flash,false);
    window.BattleResonance?.onContact(this,att,kind,dmg,flash,ev);
    // —— 附加伤害（命中后追加，不再触发叠层/即死递归）——
    if(target.alive&&dmg>0){
      const bonus=(kind==='melee'?this.meleeBonus(att):0)+(kind==='tech'?this.techBonus(att):0)+amberBonus;
      if(bonus>0)this.dealDamage(att,target,Math.round(bonus),1,kind,ev,att.techName+'·附加',false,true);
      // 质量术式·星之怒（Batch B 机制化）：tech 命中后质量暴走——全体敌人承受 45% 最大生命真伤，自身损失 50% 当前生命
      if(kind==='tech'&&this.hasFlag(att,'mass')){
        const foes=this.alive(att.side==='enemy'?'ally':'enemy');
        foes.forEach(f=>this.dealDamage(att,f,Math.round(f.maxHp*MECHANIC_TUNING.mass.trueDmg),1,'tech',ev,'质量术式·星之怒',false,true,true));
        const self=Math.max(1,Math.round(att.hp*MECHANIC_TUNING.mass.selfCost));att.hp-=self;
        ev.push({type:'hit',text:`【星之怒】质量暴走反噬，${att.name} 失去 ${self} 点生命（当前生命的 ${Math.round(MECHANIC_TUNING.mass.selfCost*100)}%）。`,dmg:self});
        if(att.hp<=0){if(att.isPlayer)this.guardPlayerDeath(ev);if(att.hp<=0)this.kill(att,ev);}
      }
    }
    // —— 命中后叠层 / 蚀烂降上限 ——
    if(target.alive&&dmg>0){
      if(this.hasFlag(att,'moon')){target.buff.poison++;ev.push({type:'skill',text:`${target.name} 中了【淀月】毒素（当前${target.buff.poison}层）。`});}
      if(this.hasFlag(att,'gu')){target.buff.gu++;ev.push({type:'skill',text:`${target.name} 中了【蛊毒】（当前${target.buff.gu}层）。`});}
      if(this.hasFlag(att,'rot')){target.maxHp=Math.max(1,target.maxHp-dmg);if(target.hp>target.maxHp)target.hp=target.maxHp;ev.push({type:'skill',text:`【蚀烂腐术】腐蚀肉体，${target.name} 血量上限被削减 ${dmg}。`});}
    }
    if(att.isPlayer&&att.hp<=0)this.guardPlayerDeath(ev);
    this.afterStrike(ev);
  }
  meleeBonus(att){ // 近战附加：刍灵eff50/无为eff100/鬼臂eff10/火灾eff80
    let b=0,e=rand(att.eff[0],att.eff[1]);
    if(this.hasFlag(att,'straw'))b+=e*.50;
    if(this.hasFlag(att,'idleTrans'))b+=e*1.0;
    if(this.hasFlag(att,'arms'))b+=e*.10;
    if(this.hasFlag(att,'fire'))b+=e*.80;
    return b;
  }
  techBonus(att){ // 咒术附加：无为=体术100
    if(this.hasFlag(att,'idleTrans'))return rand(att.melee[0],att.melee[1])*1.0;
    return 0;
  }
  afterStrike(ev){this.checkEnd(ev);}
  pickMove(flag){const arr=TECH_MOVE[flag];return arr?arr[rand(0,arr.length-1)]:'咒力打击';}
  castDomain(att,ev){
    if(!att.canDomain)return false;
    // 领域熔断：用过后进入冷却；有【反转术式】者间隔自身一次行动即可再开，无反转者整场仅一次
    if((att.domainCd||0)>0){
      if(att.isPlayer)ev.push({type:'info',text:att.reverse?'【正在修复领域熔断中】反转术式正在重铸领域——再间隔一次自身行动即可再次展开！':'【正在领域熔断中】本场领域已展开，正在冷却，暂无法再次展开。'});
      return false;
    }
    const cost=(att.skills&&att.skills.sixEyes)?0:Math.round(att.maxCp*0.30);
    if(att.cp<cost){if(att.isPlayer)ev.push({type:'info',text:'咒力不足以展开领域（需30%咒力上限）。'});return false;}
    att.cp-=cost;att.domainUsed=1;
    att.domainCd=att.reverse?2:9999; // 反转者：间隔自身一次行动（下一次自身行动仍熔断、再下一次恢复）；无反转整场锁定
    const avg=(att.eff[0]+att.eff[1])/2;
    const dmg=Math.round(avg*6+att.maxCp*0.06);
    const dName=att.domainName||'领域';
    if(att.side==='enemy'){
      ev.push({type:'domain',domainName:dName,actorName:att.name,side:att.side,isPlayer:att.isPlayer,text:`✦✦ ${att.name} 展开领域【${dName}】——必中必杀，无处可逃！ ✦✦`});
      this.alive('ally').forEach(a=>{a.buff.vuln=Math.max(a.buff.vuln,3);this.dealDamage(att,a,att.isPlayer?dmg:Math.round(avg*3.5),1,'domain',ev,`${dName}·必中`,false,true);});
    }else{
      ev.push({type:'domain',domainName:dName,actorName:att.name,side:att.side,isPlayer:att.isPlayer,text:`✦✦ ${att.name} 展开领域【${dName}】——必中必杀，敌方全体笼罩！ ✦✦`});
      this.alive('enemy').forEach(e=>{e.buff.vuln=Math.max(e.buff.vuln,3);this.dealDamage(att,e,att.isPlayer?dmg:Math.round(avg*5),1,'domain',ev,`${dName}·必中`,false,true);});
    }
    this.checkEnd(ev);
    return true;
  }
  /** 极之番（生得术式终极奥义，熟练度300%领悟）：耗50%咒力上限，对敌全体造成效率500%伤害，释放后回满自身血；一场一次 */
  castUltimate(att,ev){
    if(!att.canUlt||att.ultUsed)return false;
    const cost=Math.round(att.maxCp*0.50);
    if(att.cp<cost){if(att.isPlayer)ev.push({type:'info',text:'咒力不足以释放极之番（需50%咒力上限）。'});return false;}
    att.cp-=cost;att.ultUsed=true;
    const avg=(att.eff[0]+att.eff[1])/2,dmg=Math.round(avg*5);
    const tName=att.techName||att.name;
    ev.push({type:'ultcut',actorName:att.isPlayer?'你':att.name,text:`极之番 · ${tName}`});
    const foes=att.side==='enemy'?this.alive('ally'):this.alive('enemy');
    foes.forEach(t=>this.dealDamage(att,t,dmg,1,'tech',ev,`极之番·${tName}`,false,false));
    const heal=Math.round(att.maxHp-att.hp);att.hp=att.maxHp;
    if(heal>0)ev.push({type:'heal',from:att.name,text:`${att.isPlayer?'你':att.name} 释放极之番后生命全部恢复（+${heal}）。`,heal});
    this.checkEnd(ev);
    return true;
  }
  dealDamage(att,tar,base,mult,kind,ev,label,flash,ignoreImmune,pierceCap){
    if(!tar.alive)return 0;
    let dmg=base*mult*randF(0.9,1.1);
    dmg*=(1+0.10*Math.floor(this.actionsTotal/15)); // 战意升温
    if(att.buff&&att.buff.reviveBoost)dmg*=(1+MECHANIC_TUNING.reviveWin.dmgBoost); // 死而替生：复活后本场伤害+30%
    if(tar.buff.vuln>0)dmg*=1.30;
    if(tar.buff.jacobVuln>0)dmg*=(1+MECHANIC_TUNING.jacob.vulnBonus); // 雅各布天梯·易伤（受伤+25%）
    if(att.buff&&att.buff.seal>0)dmg*=0.8;
    if(tar.buff.defend&&!att.toolPierceGuard)dmg*=0.5;
    if(kind==='domain'&&this.hasFlag(att,'requiem'))dmg*=MECHANIC_TUNING.requiem.domainBoost; // 镇魂曲：自身领域伤害×1.5
    // —— 术式免疫 / 闪避（领域与空间斩无视；Batch B：镇魂曲改为减伤、不义游戏改为概率闪避）——
    if(!ignoreImmune&&kind!=='domain'){
      if(this.hasFlag(tar,'limitless')&&!att.toolNullify){ev.push({type:'skill',text:`${tar.name} 的【无下限·无穷】将 ${label} 完全化解（免疫非领域攻击）。`});return 0;}
      if(this.hasFlag(tar,'requiem')){dmg*=(1-MECHANIC_TUNING.requiem.reduce);ev.push({type:'skill',text:`${tar.name} 的【黄金体验镇魂曲】将 ${label} 的伤害压制 ${Math.round(MECHANIC_TUNING.requiem.reduce*100)}%。`});}
      if(this.hasFlag(tar,'swap')){
        const dodgeP=clamp((tar.ctl-att.ctl)/(tar.ctl+att.ctl+10),MECHANIC_TUNING.swap.min,MECHANIC_TUNING.swap.max);
        if(Math.random()<dodgeP){ev.push({type:'skill',text:`${tar.name}【不义游戏】交换位置，闪避了 ${label}！（闪避率 ${Math.round(dodgeP*100)}%）`});return 0;}
      }
      if(this.hasFlag(tar,'sky')&&kind==='melee'&&!att.toolNullify){ev.push({type:'skill',text:`${tar.name}【天空术式】扭曲空间，${label}（近战）伤害为0。`});return 0;}
    }
    // —— 魔虚罗·适应：每次承受某类攻击，该类后续-20%（可叠加）——
    if(tar.skills&&tar.skills.adapt&&!ignoreImmune){
      if(kind==='melee'){dmg*=Math.max(0,1-0.20*tar.buff.adaptM);tar.buff.adaptM++;}
      if(kind==='tech'){dmg*=Math.max(0,1-0.20*tar.buff.adaptT);tar.buff.adaptT++;}
    }
    // —— 单发伤害软上限（按目标最大生命比例，防高数值互秒）——
    // 普攻/术式 ≤40%，领域 ≤60%，黑闪 ≤75%；附加真伤同样受限。
    // 低数值战斗不受影响（伤害远低于上限），高数值对抗从「互秒」变「分胜负」。
    // Batch B：pierceCap=true 的机制化真伤（万象拒绝/雅各布天梯/判决术式/星之怒）穿透此上限。
    if(tar.maxHp>0&&!pierceCap){
      const capRatio=kind==='domain'?0.60:(flash?0.75:0.40);
      const cap=Math.max(1,Math.round(tar.maxHp*capRatio));
      if(dmg>cap)dmg=cap;
    }
    dmg=Math.max(1,Math.round(dmg));
    if(flash){
      if(att.isPlayer){
        this.cfg.player.flashCount=(this.cfg.player.flashCount||0)+1;
        const cur=this.cfg.player.statBoost||1;
        if(cur<1.5&&!window.BattleResonance){
          /* 黑闪复利封顶 +50%：按「实际倍率」增幅，避免无上限指数膨胀 */
          const nxt=Math.min(1.5,cur*1.10),r=nxt/cur;
          this.cfg.player.statBoost=+nxt.toFixed(4);
          const P=this.cfg.player;
          P.maxHp=Math.round(P.maxHp*r);P.maxCp=Math.round(P.maxCp*r);P.ctl=Math.round((P.ctl||0)*r);
          P.melee=P.melee.map(v=>Math.round(v*r));P.eff=P.eff.map(v=>Math.round(v*r));
          att.maxHp=Math.round(att.maxHp*r);att.maxCp=Math.round(att.maxCp*r);att.ctl=Math.round((att.ctl||0)*r);
          att.melee=att.melee.map(v=>Math.round(v*r));att.eff=att.eff.map(v=>Math.round(v*r));
        }
      }
      ev.push({type:'flash',actorName:att.name,isPlayer:!!att.isPlayer,text:`★ 黑 闪 ★ 空间被一击扭曲！本次伤害×10${window.BattleResonance?'，进入黑闪心流':att.isPlayer?((this.cfg.player.statBoost||1)>=1.5?'，黑闪积累已达上限（+50%）':'，且你全属性永久+10%（上限+50%）'):''}！`});
    }
    tar.hp-=dmg;
    ev.push({type:flash?'flash':'hit',from:att.name,to:tar.name,text:`${label} → 命中 ${tar.name}，造成 ${dmg} 点伤害。`,dmg,attackKind:kind,fromIndex:this.units.indexOf(att),toIndex:this.units.indexOf(tar)});
    if(flash)window.BattleResonance?.onFlash(this,att,ev);
    // 奇迹：死亡时耗30%咒力复活并回满
    if(tar.hp<=0&&tar.isPlayer&&this.hasFlag(tar,'miracle')){
      const need=Math.round(tar.maxCp*.30);
      if(tar.cp>=need){tar.cp-=need;tar.hp=tar.maxHp;tar.buff.miracle=(tar.buff.miracle||0)+1;ev.push({type:'heal',text:`【奇迹】消耗30%咒力（-${need}），伤害转化再生，恢复100%生命！`,heal:tar.maxHp});return dmg;}
      ev.push({type:'info',text:`【奇迹】咒力不足以驱动再生（需${need}）……`});
    }
    if(tar.hp<=0&&tar.isPlayer)this.guardPlayerDeath(ev); // 死而替生/奇迹等：致死瞬间先尝试守护，避免被直接 kill
    if(tar.hp<=0)this.kill(tar,ev,att);
    return dmg;
  }
  kill(u,ev,killer){
    if(!u.alive)return;u.hp=0;u.alive=false;
    ev.push({type:'die',name:u.name,text:`${u.side==='enemy'?'◆':'◇'} ${u.name} 被击溃。`});
    const snap={name:u.name,maxHp:u.maxHp,maxCp:u.maxCp,melee:u.melee.slice(),eff:u.eff.slice(),li:u.li};
    // 本场池（供 NPC 羂索等召唤）
    if(u.side==='enemy'&&!u.summonTag&&this.killedPool.length<12)this.killedPool.push(snap);
    // 玩家持有咒灵操术/降灵术时，永久吸收（数值固定、按名去重、上限24）
    const P=this.cfg.player;
    if(u.side==='enemy'&&!u.summonTag&&killer&&killer.side==='ally'&&P&&
       (P.technique.flag==='spiritControl'||P.technique.flag==='seance')){
      if(!P.absorbed.some(x=>x.name===snap.name)&&P.absorbed.length<24){P.absorbed.push(snap);
        if(P.technique.flag==='spiritControl')ev.push({type:'skill',text:`【咒灵操术】吸收了被击溃的【${snap.name}】（数值固定，日后可召唤为式神）。`});}
    }
  }
  pickEnemyTarget(){
    // 傀儡嘲讽：对方傀儡在场时优先攻击傀儡
    const pups=this.alive('enemy').filter(u=>u.summonTag==='傀儡');
    const es=this.alive('enemy');if(!es.length)return null;
    if(pups.length&&Math.random()<0.8)return pups[rand(0,pups.length-1)];
    return es.sort((a,b)=>a.hp-b.hp)[0];
  }
  pickAllyTarget(){
    const pups=this.alive('ally').filter(u=>u.summonTag==='傀儡');
    const mates=this.alive('ally').filter(u=>!u.isPlayer);const p=this.player;
    if(pups.length&&Math.random()<0.8)return pups[rand(0,pups.length-1)]; // 傀儡优先吸引火力
    if(!mates.length)return p.alive?p:null;
    const guards=mates.filter(m=>m.li>=(this._actorLi??0)&&!m.summonTag);
    if(p.alive){
      if(guards.length){if(Math.random()<0.9)return guards[rand(0,guards.length-1)];
        const o=mates.filter(m=>!guards.includes(m));if(o.length)return o[rand(0,o.length-1)];
        return Math.random()<0.5?p:guards[rand(0,guards.length-1)];}
      if(Math.random()<0.55)return p;return mates[rand(0,mates.length-1)];
    }
    return mates[rand(0,mates.length-1)];
  }
  /* ---------- NPC AI ---------- */
  npcAct(u,ev){
    this._actorLi=u.li;
    // 特殊蓄力技：五条悟虚式茈 / 宿傩空间斩
    if(this.npcChargeSkill(u,ev))return;
    // 极之番：残血（<40%）且蓝够半管时，一场一次的终极爆发
    if(u.canUlt&&!u.ultUsed&&u.hp<u.maxHp*0.40&&u.cp>=u.maxCp*0.5){if(this.castUltimate(u,ev))return;}
    if(u.canDomain&&(u.domainCd||0)<=0){
      let want=false;
      if(u.side==='enemy'){
        const ac=u.buff.actCount||0;
        // 敌方领域欲望：第二次自身行动起即积极展开（不再要求残血才开），血线越低越坚决，行动越多次越必开
        if(ac>=1){const drive=u.hp<u.maxHp*0.5?0.95:(ac>=3?0.9:0.6);want=Math.random()<drive;}
      }else want=(u.buff.actCount>=2);
      if(want){this.castDomain(u,ev);return;}
    }
    // 专属技能（五条悟苍赫 / 宿傩解捌开灶 / 九十九星之怒）
    if(this.npcSignatureSkill(u,ev))return;
    const target=u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget();
    if(!target){ev.push({type:'info',text:`${u.name} 失去目标。`});return;}
    const cost=this.techCost(u);
    const allyMult=u.side==='ally'?(1+(this.cfg.player.allyBoost||0)):1;
    if(u.cp>=cost&&Math.random()<0.72){u.cp-=cost;this._allyMult=allyMult;this.performStrike(u,target,'tech',ev);this._allyMult=1;}
    else{this._allyMult=allyMult;this.performStrike(u,target,'melee',ev);this._allyMult=1;}
  }
  /** NPC 专属技能（金色大字）：五条悟苍/赫；宿傩解/捌/开/灶；九十九由基星之怒/质量弹。返回 true=本回合用了专属技 */
  npcSignatureSkill(u,ev){
    const isSukuna=u.name.includes('宿傩'),isGojo=u.name==='五条悟',isTsukumo=u.name==='九十九由基';
    if(!isSukuna&&!isGojo&&!isTsukumo)return false;
    const avg=(u.eff[0]+u.eff[1])/2;
    const foes=u.side==='enemy'?this.alive('ally'):this.alive('enemy');
    if(!foes.length)return false;
    const singleT=u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget();
    const hit=(scope,mult,label,fixed)=>{
      ev.push({type:'skillcut',actorName:u.name,text:label});
      const list=scope==='all'?foes:[singleT];
      list.forEach(t=>{if(t&&t.alive)this.dealDamage(u,t,fixed!=null?fixed:Math.round(avg*mult),1,'tech',ev,label,false,false);});
      this.afterStrike(ev);
    };
    // 九十九由基·星之怒：耗99%「当前血量」，给予敌方全体固定1000000毁灭伤害（血线充足且多敌时低概率）
    if(isTsukumo&&u.hp>u.maxHp*0.3&&foes.length>=2&&Math.random()<0.15){
      const cost=Math.round(u.hp*0.99);u.hp-=cost;
      ev.push({type:'hit',text:`九十九由基 燃烧99%生命（-${cost}）凝聚【星之怒】。`,dmg:cost});
      hit('all',0,'九十九由基·星之怒',1000000);return true;
    }
    if(Math.random()<0.38){
      if(isGojo){const r=Math.random();
        if(r<0.5)hit('all',1.5,'五条悟·苍（引力·全体）');else hit('one',2.0,'五条悟·赫（斥力·单体）');return true;}
      if(isSukuna){const r=Math.random();
        if(r<0.28)hit('all',1.2,'宿傩·解（无形斩·全体）');
        else if(r<0.56)hit('one',1.2,'宿傩·捌（必中斩·单体）');
        else if(r<0.80)hit('all',2.0,'宿傩·开（火焰·全体）');
        else hit('one',2.5,'宿傩·灶（炽焰·单体）');return true;}
      if(isTsukumo){hit('one',2.2,'九十九由基·质量弹');return true;}
    }
    return false;
  }
  /** 蓄力特殊技，返回 true 表示本回合用于蓄力/释放 */
  npcChargeSkill(u,ev){
    // 五条悟·虚式茈：蓄力一回合，下回合造成效率300%伤害
    if(u.skills.charge){
      if(u.buff.charge){
        u.buff.charge=false;const t=u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget();
        if(t){ev.push({type:'skillcut',actorName:u.name,text:'五条悟 · 虚式「茈」'});const d=Math.round((u.eff[0]+u.eff[1])/2*u.skills.charge);this.dealDamage(u,t,d,1,'tech',ev,'五条悟·虚式「茈」',false,true);this.afterStrike(ev);return true;}
      }else if(u.hp<u.maxHp*0.8&&u.cp>=u.maxCp*0.1){u.buff.charge=true;ev.push({type:'info',text:`${u.name} 开始蓄力【虚式·茈】，下一击将造成恐怖伤害！`});return true;}
    }
    // 宿傩·空间斩（chargeSlash：蓄力一回合→固定真伤，无视术式豁免）
    if(u.skills.chargeSlash){
      if(u.buff.charge){u.buff.charge=false;const t=u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget();
        if(t){ev.push({type:'skillcut',actorName:u.name,text:u.name+' · 空间斩'});const d=u.skills.chargeSlash.dmg;this.dealDamage(u,t,d,1,'tech',ev,u.name+'·空间斩（无法豁免）',false,true);this.afterStrike(ev);return true;}}
      else if(u.hp<u.maxHp*0.7&&!u.domainUsed){u.buff.charge=true;ev.push({type:'info',text:`${u.name} 开始凝聚【空间斩】，下一回合将落下无法被术式豁免的一击！`});return true;}
    }
    // 十影宿傩·空间斩：第 after 次行动后发动固定真伤
    if(u.skills.spaceSlash&&u.buff.actCount===u.skills.spaceSlash.after){
      const t=u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget();
      if(t){ev.push({type:'skillcut',actorName:u.name,text:'十影宿傩 · 空间斩'});this.dealDamage(u,t,u.skills.spaceSlash.dmg,1,'tech',ev,'十影宿傩·空间斩（无法豁免）',false,true);this.afterStrike(ev);return true;}
    }
    return false;
  }
  guardPlayerDeath(ev){
    const p=this.player,P=this.cfg.player;
    if(p.hp>0||!p.alive)return;
    if(this.hasFlag(p,'reviveWin')&&!p.buff.saved){
      p.buff.saved=true;p.alive=true;
      p.hp=Math.round(p.maxHp*MECHANIC_TUNING.reviveWin.hpRatio);
      p.cp=Math.round(p.maxCp*MECHANIC_TUNING.reviveWin.cpRatio);
      p.buff.reviveBoost=true; // 本场战斗伤害+30%（dealDamage 统一结算）
      ev.push({type:'skillcut',actorName:'你',text:'死而替生 · 替死夺式'});
      if(!P.stolen)P.stolen=[];if(!P.stolenTechs)P.stolenTechs=[];
      // Batch B 机制化：不再自动获胜、不再击溃敌人；改为随机夺取一名存活敌人的生得术式（独立熟练度30%起）
      const foes=this.alive('enemy').filter(e=>e.flag);
      if(foes.length){
        const e=foes[rand(0,foes.length-1)];
        if(!P.stolenTechs.some(t=>t.flag===e.flag)){
          P.stolenTechs.push({name:e.techName,flag:e.flag,domain:e.domainName,
            flags:(e.flags||[]).filter(f=>f!==e.flag),prof:MECHANIC_TUNING.reviveWin.stealProf});
          if(!p.flags.includes(e.flag))p.flags.push(e.flag); // 当场立即生效
          P.notes.push(`死而替生，夺取了【${e.name}】的术式「${e.techName}」`);
          ev.push({type:'skill',text:`你夺取了【${e.name}】的生得术式「${e.techName}」（独立熟练度30%起）。`});
        }
        if(!P.stolen.includes(e.name))P.stolen.push(e.name);
      }
      ev.push({type:'skill',text:`【死而替生】你从死亡边缘归来（半血半咒力），本场战斗伤害+${Math.round(MECHANIC_TUNING.reviveWin.dmgBoost*100)}%！`});
    }
  }
  /** 鏖战硬上限裁决：按双方存活单位的「剩余血量占比之和」比较，高者胜；保证有限步内必分胜负、绝不平局卡死 */
  forceSettle(ev){
    const score=side=>this.alive(side).reduce((s,u)=>s+Math.max(0,u.hp)/u.maxHp,0);
    const a=score('ally'),e=score('enemy');
    const win=a>=e;
    ev.push({type:'info',text:`鏖战已久，双方皆至强弩之末——按残存战力最终裁决，${win?'我方险胜！':'敌方占优，我方惜败。'}`});
    this.alive(win?'enemy':'ally').forEach(u=>{if(u.isPlayer)return;this.kill(u,ev);});
    // 判负方若含玩家，也让其倒下（不触发死而替生，这是裁决而非被击杀）
    if(!win){const p=this.player;if(p.alive){p.alive=false;p.hp=0;}}
    this.ended=true;this.result=win?'win':'lose';
    ev.push({type:'info',text:win?'敌方全部被击溃，战斗胜利！':'你与队友全部倒下——本场战斗战败。'});
    return this.pack(ev);
  }
  /** 玩家主动撤退：本场按战败(flee)结算，交由剧情/狩猎规则安全收尾 */
  flee(){
    const ev=this.events;this.events=[];
    if(this.ended)return {events:ev,ended:true,result:this.result,needInput:false};
    this.ended=true;this.result='flee';
    ev.push({type:'info',text:'你果断脱离战场，本场战斗结束。'});
    return this.pack(ev);
  }
  checkEnd(ev){
    if(this.ended)return true;
    // 玩家倒下：先尝试死而替生；若仍倒下，只要还有存活队友，战斗继续（队友代战），不直接判败
    if(!this.player.alive)this.guardPlayerDeath(ev);
    if(this.alive('enemy').length===0){this.ended=true;this.result='win';ev.push({type:'info',text:'敌方全部被击溃，战斗胜利！'});return true;}
    if(this.alive('ally').length===0){this.ended=true;this.result='lose';ev.push({type:'info',text:'你与队友全部倒下——本场战斗战败。'});return true;}
    if(!this.player.alive&&!this._downNotified){this._downNotified=true;ev.push({type:'info',text:'你倒下了——队友仍在战斗，继续为你而战！'});}
    return false;
  }
}

/* ============================ VI. 剧情引擎：全部剧情节点（严格按设定录入） ============================ */
/* 等级索引：四级0 三级1 准二级2 二级3 准一级4 一级5 特别一级6 准特级7 弱特级8 标准特级9 强特级10 超特级11
 * stage: {enemies,allies,intro,lose: 'die'|'continue'|'next', winNote}
 *   die=战败即死亡结局；continue=战败不死继续剧情；next=战败进入下一组 stage */
/* ================== 具名角色精确五维面板（严格按设定录入） ==================
 * spec = [咒力总量cp, 体术me, 体质hp, 咒力操控ctl, 咒力效率eff, 生得术式flag, 选项opt]
 *   前五项为属性等级索引（0四级…11超特级，可负）；hp 项为 HP_TIERS 索引，或 {f:固定血量}
 *   opt: rev=会反转术式 bf=会黑闪 dom=已会领域；sixEyes六眼(耗蓝0) charge=虚式茈效率倍率
 *        adapt=适应 regen=每回合回血比 summonMakora=开局召唤魔虚罗
 *        spaceSlash={after:n,dmg:x}=第n次行动后固定真伤  chargeSlash={dmg}=蓄力一回合固定真伤
 *        flags=双术式
 * 匹配优先级：名字#场景等级 → 名字 → 按 li 推导（泛用咒灵） */
const NPC_CHARS={
 '五条悟#11':[11,11,12,11,11,'limitless',{rev:1,bf:1,dom:1,sixEyes:1,charge:5.0}],
 '1指受肉宿傩#7':[7,7,7,7,7,'cleave',{rev:1,bf:0,dom:1}],
 '2指宿傩#8':[8,8,8,8,8,'cleave',{rev:1,bf:0,dom:1}],
 '伏黑惠#3':[2,1,4,2,3,'shadows',{rev:0,bf:0,dom:0}],
 '伏黑惠#4':[4,3,5,3,4,'shadows',{rev:0,bf:0,dom:1}],
 '钉崎野蔷薇#3':[3,2,3,3,3,'straw',{rev:0,bf:0,dom:0}],
 '钉崎野蔷薇#4':[4,5,5,4,5,'straw',{rev:0,bf:1,dom:0}],
 '咒胎怠天#7':[6,6,7,5,7,'cleave',{rev:1,bf:0,dom:0}],
 '漏壶#10':[9,8,9,10,10,'fire',{rev:1,bf:0,dom:1}],
 '顺平（二级变化人·精英）#3':[2,2,2,2,2,'moon',{rev:0,bf:0,dom:0}],
 '真人#8':[9,4,9,7,6,'idleTrans',{rev:1,bf:0,dom:1}],
 '真人#9':[9,7,8,9,9,'idleTrans',{rev:1,bf:1,dom:1}],
 '七海建人#6':[5,6,6,4,5,'ratio',{rev:0,bf:1,dom:0}],
 '东堂葵#6':[6,6,7,9,7,'swap',{rev:0,bf:1,dom:0}],
 '东堂葵#7':[8,8,8,10,8,'swap',{rev:0,bf:1,dom:0}],
 '花御#9':[8,7,9,8,9,'gu',{rev:1,bf:0,dom:1}],
 '禅院真希#0':[0,4,6,0,0,null,{rev:0,bf:0,dom:0}],
 '真希#4':[4,4,5,4,4,null,{rev:0,bf:0,dom:0}],
 '虎杖悠仁#5':[8,5,10,4,5,'cleave',{rev:0,bf:1,dom:0}],
 '虎杖悠仁#6':[9,6,10,6,6,'cleave',{rev:0,bf:1,dom:0}],
 '虎杖悠仁#7':[9,8,8,6,6,'cleave',{rev:0,bf:1,dom:0}],
 '虎杖悠仁#8':[9,10,{f:200000},8,9,'cleave',{rev:0,bf:1,dom:0}],
 '虎杖悠仁#10':[11,10,{f:300000},10,10,'cleave',{rev:1,bf:1,dom:1,flags:['blood']}],
 '血涂#8':[8,5,7,4,6,'rot',{rev:0,bf:0,dom:0}],
 '坏相#8':[7,6,6,5,7,'rot',{rev:0,bf:0,dom:0}],
 '胀相#9':[9,7,9,8,7,'blood',{rev:1,bf:0,dom:0}],
 '羂索#10':[10,8,9,9,10,'spiritControl',{rev:1,bf:0,dom:1}],
 '蝗虫#8':[7,8,7,7,7,null,{rev:1,bf:0,dom:0}],
 '魔虚罗#10':[10,9,10,4,4,null,{rev:1,bf:0,dom:0,adapt:1,regen:0.9}],
 '15指宿傩#10':[10,10,10,10,10,'cleave',{rev:1,bf:0,dom:1}],
 '陀艮#8':[8,7,8,7,8,'cannon',{rev:1,bf:0,dom:1}],
 '禅院家主#6':[7,6,6,5,6,'projection',{rev:0,bf:0,dom:0}],
 '伏黑甚尔#8':[0,10,11,0,0,null,{rev:0,bf:0,dom:0}],
 '里梅#8':[8,6,6,8,8,'cannon',{rev:1,bf:0,dom:1}],
 '九十九由基#9':[9,5,9,10,10,'mass',{rev:1,bf:1,dom:1}],
 '多鲁布#7':[7,5,6,7,6,'arms',{rev:0,bf:0,dom:1}],
 '黑沐死#8':[8,6,8,7,7,null,{rev:1,bf:0,dom:1}],
 '乌璐亨子#8':[8,4,7,8,8,'sky',{rev:0,bf:0,dom:1}],
 '石流龙#9':[10,6,9,8,10,'cannon',{rev:0,bf:0,dom:1}],
 '乙骨忧太#10':[11,8,10,10,10,'copy',{rev:1,bf:1,dom:1}],
 '日车宽见#8':[7,4,6,8,8,'judge',{rev:1,bf:0,dom:1}],
 '鹿紫云一#9':[9,9,9,8,9,'amber',{rev:0,bf:0,dom:0}],
 '秤金次#8':[7,7,9,8,7,'cannon',{rev:1,bf:0,dom:1}],
 '禅院直哉#9':[9,8,9,7,8,'projection',{rev:1,bf:0,dom:1}],
 '禅院真希·天裕暴君#8':[0,10,11,0,0,null,{rev:0,bf:0,dom:0}],
 '加茂宪纪#5':[4,4,6,6,5,'blood',{rev:0,bf:0,dom:0}],
 '十影宿傩#11':[11,11,{f:1000000},11,11,'cleave',{rev:1,bf:1,dom:1,flags:['shadows'],summonMakora:1,spaceSlash:{after:5,dmg:500000}}],
 '一削·神武真身宿傩#10':[11,10,{f:500000},10,10,'cleave',{rev:1,bf:1,dom:1,chargeSlash:{dmg:300000}}],
 '二削·神武真身宿傩#10':[10,10,{f:400000},10,10,'cleave',{rev:1,bf:1,dom:1,chargeSlash:{dmg:200000}}],
 '三削·神武真身宿傩#10':[10,10,{f:300000},10,10,'cleave',{rev:1,bf:1,dom:1,chargeSlash:{dmg:100000}}],
 '四削·神武真身宿傩#9':[9,10,{f:200000},9,10,'cleave',{rev:1,bf:1,dom:1,chargeSlash:{dmg:80000}}],
 '五削·神武真身宿傩#9':[9,10,{f:100000},9,10,'cleave',{rev:1,bf:1,dom:1,chargeSlash:{dmg:50000}}]
};
function getCharSpec(name,li){return NPC_CHARS[name+'#'+li]||NPC_CHARS[name]||null;}
/** 按属性等级取该档稳定中值（NPC 精确面板用，不再随机±15%） */
function tierMidCp(i){i=clamp(i,-2,11);const r=tierCp(i);return Math.round((r[0]+r[1])/2);}
function tierMidDmg(i){i=clamp(i,-2,11);const r=tierDmg(i);return [Math.max(0,r[0]),Math.max(1,r[1])];}
function tierMidCtl(i){i=clamp(i,-2,11);const r=tierCtl(i);return Math.round((r[0]+r[1])/2);}
function charHp(specHp){if(specHp&&typeof specHp==='object'&&specHp.f)return specHp.f;const idx=clamp(specHp??1,0,HP_TIERS.length-1);return Math.round((HP_TIERS[idx][1][0]+HP_TIERS[idx][1][1])/2);}

const E=(name,li,type)=>({name,li,type:type||'咒灵'});
const STORY={
 3:{chapter:'宿傩受肉虎杖篇',title:'第3天 · 诅咒初现',
    intro:'你穿越后的第3天，异样的咒力气息在夜色中弥漫。一只咒灵拦住了去路——而更深处，寄宿于少年体内的古老诅咒，正在苏醒……',
    stages:[
      {enemies:[E('准二级咒灵',2)],allies:[],lose:'die'},
      {enemies:[E('1指受肉宿傩',7,'受肉体')],allies:[],lose:'next',
       intro:'击败咒灵的瞬间，两面宿傩的手指之力暴走——【1指受肉宿傩】出现在你面前！'},
      {enemies:[E('1指受肉宿傩',7,'受肉体')],allies:[E('五条悟',11,'咒术师'),E('伏黑惠',3,'咒术师')],lose:'continue',
       intro:'千钧一发——超特级咒术师【五条悟】登场，二级咒术师【伏黑惠】并肩而立，再度迎战！'}]},
 10:{chapter:'钉崎野蔷薇登场篇',title:'第10天 · 红发的咒术师',
    intro:'新都厅附近的咒灵事件现场，你与刚从乡下来到东京的红发少女相遇——钉崎野蔷薇加入了你的队伍。',
    stages:[{enemies:[E('二级咒灵',3)],allies:[E('钉崎野蔷薇',3,'咒术师')],lose:'die'}]},
 33:{chapter:'少年院篇',title:'第33天 · 少年院的咒胎',
    intro:'废弃少年院内，特级咒灵「咒胎怠天」盘踞。你与伏黑惠、钉崎野蔷薇一同踏入了这座牢笼……',
    stages:[
      {enemies:[E('咒胎怠天',7)],allies:[E('伏黑惠',3,'咒术师'),E('钉崎野蔷薇',3,'咒术师')],lose:'next'},
      {enemies:[E('咒胎怠天',7)],allies:[E('2指宿傩',8,'受肉体')],lose:'continue',
       intro:'形势急转直下，伏黑惠与钉崎野蔷薇暂时离场；【2指宿傩】现身接手战场！'}]},
 35:{chapter:'幼鱼与逆罚篇',title:'第35天 · 漏壶来袭',
    intro:'五条在移动途中遭到漏瑚袭击。林间公路上，战斗一触即发。',
    stages:[{enemies:[E('漏壶',10)],allies:[E('五条悟',11,'咒术师')],lose:'die'}]},
 47:{chapter:'幼鱼与逆罚篇',title:'第47天 · 顺平',
    intro:'被真人利用的少年吉野顺平，以改造人之姿挡在你面前。这是一场你不想打、却不得不打的战斗。',
    stages:[{enemies:[E('顺平（二级变化人·精英）',3,'变化人')],allies:[],lose:'die',
      winQuote:'谢谢你出现在我的生命里，谢谢你……'}]},
 48:{chapter:'幼鱼与逆罚篇',title:'第48天 · 真人',
    intro:'里樱高校，顺平事件之后，轻视生命的弱特级咒灵【真人】露出笑容。特别一级咒术师七海建人拎着缠满咒力的钝刀与你并肩。',
    stages:[{enemies:[E('真人',8)],allies:[E('七海建人',6,'咒术师')],lose:'die'}]},
 62:{chapter:'京都姐妹校交流会篇',title:'第62天 · 交流会前哨',
    intro:'京都姐妹校交流会期间，咒灵潜入会场。第一波敌人迎面而来。',
    stages:[{enemies:[E('准一级咒灵',4)],allies:[],lose:'die'}]},
 63:{chapter:'京都姐妹校交流会篇',title:'第63天 · 东堂葵',
    intro:'“我叫东堂葵，特别一级咒术师！来，让我看看你的实力！”京都校的猛将向你发起单挑。此战即使败北也不会死亡。',
    stages:[{enemies:[E('东堂葵',6,'咒术师')],allies:[],lose:'continue',noFlip:true,
      winSkill:'blackFlash',winSkillText:'东堂葵认可了你的拳头：“不错嘛！”——在激战中你触到了【黑闪】的门径。接触攻击有机会触发，控制力、连击与心流影响成功率；黑闪带来短暂输出强化和领域优势。'}]},
 68:{chapter:'京都姐妹校交流会篇',title:'第68天 · 花御来袭',
    intro:'交流会被突袭打断，标准特级咒灵【花御】降临森林。',
    stages:[
      {enemies:[E('花御',9)],allies:[E('伏黑惠',3,'咒术师'),E('禅院真希',0,'咒术师')],lose:'next',
       intro:'第一战：你与伏黑惠、四级咒术师禅院真希联手迎击花御。'},
      {enemies:[E('花御',9)],allies:[E('虎杖悠仁',6,'咒术师'),E('东堂葵',6,'咒术师')],lose:'next',
       intro:'第二战：虎杖悠仁与东堂葵接替上场，黑白两道闪光夹击花御！'},
      {enemies:[E('花御',9)],allies:[E('五条悟',11,'咒术师')],lose:'continue',
       intro:'最终战：五条悟亲自下场——在最强面前，花御已无胜算。'}]},
 78:{chapter:'八十八桥篇',title:'第78天 · 八十八桥',
    intro:'八十八桥下埋藏着咒物的气息。进入战场前，先抽取你将被分配到的战场。',
    wheel:{title:'战场转盘',items:[
      {label:'咒胎战场',battle:{enemies:[E('咒胎怠天',7)],allies:[E('伏黑惠',4,'咒术师')],lose:'die',
        intro:'咒胎战场：你与准一级咒术师伏黑惠一同面对咒胎怠天。'}},
      {label:'血涂与坏相战场',battle:{enemies:[E('血涂',8,'受肉体'),E('坏相',8,'受肉体')],allies:[E('虎杖悠仁',6,'咒术师'),E('钉崎野蔷薇',4,'咒术师')],lose:'die',
        intro:'血涂与坏相战场：九相图的兄弟二人拦路，特别一级的虎杖与准一级的钉崎与你并肩！'}}]}},
 88:{chapter:'涩谷事变',title:'第88天 · 最前线的抉择',
    intro:'10月31日，涩谷。结界内人间地狱。是否与五条悟一起前往最前线？',
    wheel:{title:'抉择转盘',items:[
      {label:'是（30%）',weight:30,battle:{enemies:[E('漏壶',10),E('花御',9),E('胀相',9,'受肉体'),E('羂索',10,'诅咒师')],allies:[E('五条悟',11,'咒术师')],lose:'die',
        intro:'你选择追随五条悟突入最前线——漏壶、花御、胀相、羂索四大强敌同时现身！'}},
      {label:'否（70%）',weight:70,skipText:'你被分配到后方战线，第88天的最前线激战与你擦肩而过（涩谷的天空传来震耳欲聋的轰鸣）。'}]}},
 90:{chapter:'涩谷事变',title:'第90天 · 涩谷八方战场',
    intro:'涩谷全面混战，你被随机分配到八处战场之一。转动转盘决定你的战场。',
    wheel:{title:'第90天战场转盘',items:[
      {label:'蝗虫战场',battle:{enemies:[E('蝗虫',8)],allies:[E('虎杖悠仁',6,'咒术师')],lose:'die',intro:'蝗虫战场：你与特别一级咒术师虎杖悠仁对战弱特级咒灵蝗虫。'}},
      {label:'真人战场',battle:{enemies:[E('真人',9)],allies:[E('虎杖悠仁',6,'咒术师'),E('东堂葵',6,'咒术师')],lose:'die',intro:'真人战场：你与虎杖、东堂联手对战标准特级的真人。'}},
      {label:'魔虚罗战场',battle:{enemies:[E('魔虚罗',10,'式神')],allies:[E('15指宿傩',10,'受肉体')],lose:'die',intro:'魔虚罗战场：强特级式神魔虚罗降临，与你并肩的是强特级受肉体【15指宿傩】。'}},
      {label:'陀艮战场',battle:{enemies:[E('陀艮',8)],allies:[E('伏黑惠',4,'咒术师'),E('七海建人',6,'咒术师'),E('禅院家主',6,'咒术师'),E('真希',4,'咒术师'),E('伏黑甚尔',8,'人类')],lose:'die',intro:'陀艮战场：伏黑惠、七海建人、禅院家主、真希与伏黑甚尔齐聚，围攻弱特级咒灵陀艮。'}},
      {label:'漏壶宿傩战场',battle:{enemies:[E('漏壶',10)],allies:[E('15指宿傩',10,'受肉体')],lose:'die',intro:'漏壶宿傩战场：15指宿傩与你一同迎战强特级咒灵漏壶。'}},
      {label:'羂索里梅战场',battle:{enemies:[E('羂索',10,'诅咒师'),E('里梅',8,'受肉体')],allies:[E('九十九由基',9,'咒术师')],lose:'continue',intro:'羂索里梅战场：标准特级咒术师九十九由基与你对战羂索与里梅，此战败北也不会死亡。'}},
      {label:'胀相虎杖战场',battle:{enemies:[E('胀相',9,'受肉体')],allies:[E('虎杖悠仁',6,'咒术师')],lose:'continue',intro:'胀相虎杖战场：兄弟相残之战，你协助虎杖对战标准特级受肉体胀相，败北不死。'}},
      {label:'伏黑父子对决战场',battle:{enemies:[E('伏黑甚尔',8,'人类')],allies:[E('伏黑惠',4,'咒术师')],lose:'continue',intro:'伏黑父子对决战场：你协助伏黑惠对战其生父——弱特级人类伏黑甚尔，败北不死。'}}]}},
 105:{chapter:'死灭回游',title:'第105天 · 死灭回游四战场',
    intro:'死灭回游的杀阵开启，泳者们在各地厮杀。转动转盘，决定你被投入哪处战场。',
    wheel:{title:'死灭回游战场转盘',items:[
      {label:'仙台战场',battle:{enemies:[E('多鲁布',7,'诅咒师'),E('黑沐死',8),E('乌璐亨子',8,'受肉体'),E('石流龙',9,'受肉体')],allies:[E('乙骨忧太',10,'咒术师')],lose:'die',intro:'仙台战场：四泳者围城！强特级咒术师乙骨忧太与你共战多鲁布、黑沐死、乌璐亨子、石流龙。'}},
      {label:'东京第一结界·剧场',battle:{enemies:[E('日车宽见',8,'咒灵')],allies:[E('虎杖悠仁',7,'咒术师')],lose:'continue',intro:'东京第一结界的剧场中：你与准特级咒术师虎杖悠仁对战弱特级的日车宽见，败北不会死亡。'}},
      {label:'东京第二结界·港口',battle:{enemies:[E('鹿紫云一',9,'受肉体')],allies:[E('秤金次',8,'咒术师')],lose:'die',intro:'东京第二结界的港口：弱特级咒术师秤金次与你对战标准特级受肉体鹿紫云一。'}},
      {label:'樱岛战场',battle:{enemies:[E('禅院直哉',9)],allies:[E('禅院真希·天裕暴君',8,'人类'),E('加茂宪纪',5,'咒术师')],lose:'die',intro:'樱岛战场：天与暴君之姿的禅院真希与一级咒术师加茂宪纪，同你对战标准特级咒灵禅院直哉。'}}]}},
 120:{chapter:'新宿决战',title:'第120天 · 新宿决战（六连战）',
    intro:'最终决战。两面宿傩以十影术式之姿君临新宿。这是人类与诅咒的最后战场——败而不馁，连战不息，直至最后一人。',
    final:true,
    stages:[
      {enemies:[E('十影宿傩',11,'受肉体')],allies:[E('五条悟',11,'咒术师')],lose:'next',intro:'【第一场】超特级的对决：五条悟 VS 十影宿傩，你与最强并肩！'},
      {enemies:[E('一削·神武真身宿傩',10,'受肉体')],allies:[E('鹿紫云一',9,'受肉体')],lose:'next',intro:'【第二场】宿傩被削去一臂。标准特级受肉体鹿紫云一抱定觉悟参战！'},
      {enemies:[E('二削·神武真身宿傩',10,'受肉体')],allies:[E('日车宽见',8,'咒术师'),E('虎杖悠仁',7,'咒术师')],lose:'next',intro:'【第三场】弱特级日车宽见与准特级虎杖悠仁接力上阵。'},
      {enemies:[E('三削·神武真身宿傩',10,'受肉体')],allies:[E('虎杖悠仁',8,'咒术师'),E('乙骨忧太',10,'咒术师')],lose:'next',intro:'【第四场】弱特级虎杖与强特级乙骨忧太联手强攻。'},
      {enemies:[E('四削·神武真身宿傩',9,'受肉体')],allies:[E('虎杖悠仁',8,'咒术师'),E('东堂葵',7,'咒术师')],lose:'next',intro:'【第五场】标准特级的宿傩再被削落，虎杖与准特级东堂的最佳组合登场。'},
      {enemies:[E('五削·神武真身宿傩',9,'受肉体')],allies:[E('虎杖悠仁',10,'咒术师')],lose:'die',intro:'【第六场·决战】强特级咒术师虎杖悠仁与你一同，向宿傩挥出最后一拳！此战若败，万劫不复。'}]}};
const EVENT_DAYS=Object.keys(STORY).map(Number).sort((a,b)=>a-b);
/** 主界面时代标签 */
function eraOfDay(d){
  if(d<=4)return'宿傩受肉虎杖时期';
  if(d<=24)return'钉崎野蔷薇登场篇';
  if(d<=33)return'少年院篇';
  if(d<=48)return'幼鱼与逆罚篇';
  if(d<=68)return'京都姐妹校交流会篇';
  if(d<=87)return'八十八桥篇';
  if(d<=90)return'涩谷事变';
  if(d<=99)return'涩谷事变·善后';
  if(d<=119)return'死灭回游时期';
  return'新宿决战';
}


const Game={player:null,day:70,render(){}},Campaign={state:null,fresh(){return {}},validate(x){return x}};
const Save={phase:'world',busy:false,failed:false,restoring:false,checkpoint(){return true}};
const BattleUI={run(cfg){return cfg}};
/* Transient battle rules. Nothing in this module is written into a save. */
(() => {
  const scenes=window.BattleScenes, proto=BattleEngine.prototype;
  const fields=e=>e.domainFields||[];
  const active=(e,u)=>fields(e).find(f=>f.owner===e.units.indexOf(u));
  const opposite=(e,f)=>fields(e).find(g=>g.side!==f.side);
  const cost=u=>u.skills?.sixEyes?0:Math.round(u.maxCp*.30);
  const upkeep=(u,f)=>u.skills?.sixEyes?0:Math.round(u.maxCp*.05*(f?.barrierCondition==='reinforce'?1.35:f?.barrierCondition==='compact'?1.65:1));
  const ready=(e,u)=>!!u?.alive&&!window.BattleTraits?.blocked(e,u,'domain')&&!e.ended&&u.canDomain&&!(u.domainCd>0)&&u.cp>=cost(u)&&!fields(e).some(f=>f.side===u.side);
  const snapshot=e=>fields(e).map(f=>({...f,advantage:window.BattleResonance?.advantage(e,f),momentum:window.BattleResonance?.momentum(e.units[f.owner])||0}));
  const emit=(e,ev,type,text,extra={})=>ev.push({type,text,domainSnapshot:snapshot(e),...extra});
  const mastery=u=>/五条悟|宿傩/.test(u.name)?260:/羂索/.test(u.name)?250:/真人/.test(u.name)?185:/漏[壶瑚]/.test(u.name)?180:/伏黑惠/.test(u.name)?110:160;
  const power=(e,u)=>Math.round((u.isPlayer?Math.max(100,Math.min(300,e.cfg.player.prof||100)):mastery(u))*.7+Math.min(120,Math.log2(1+Math.max(0,u.ctl))*7));
  const collapse=(e,f,ev,reason)=>{
    if(!fields(e).includes(f))return;
    e.domainFields=fields(e).filter(g=>g!==f);
    const owner=e.units[f.owner];if(owner)owner.domainCd=owner.reverse?2:9999;
    emit(e,ev,'domain_end',`【${f.name}】${reason}，领域崩解。`,{domainName:f.name,actorName:owner?.name,owner:f.owner,side:f.side,domainPhase:'collapse',reason,stabilityBefore:f.stability});
    if(owner)window.BattleResonance?.onCollapse(e,owner,ev,reason);
  };
  const begin=(e,u,ev)=>{
    const n=scenes.name(u.domainName),p=scenes.profileFor({name:n,actorName:u.name,isPlayer:u.isPlayer});
    u.cp-=cost(u);u.domainUsed=1;u.domainCd=9001;
    const f={owner:e.units.indexOf(u),actorName:u.name,side:u.side,name:n,key:p?.key||null,open:!!p?.open,incomplete:!!p?.incomplete,nonlethal:!!p?.nonlethal,remaining:3,stability:100,power:power(e,u),born:e.actionsTotal,fresh:true};
    f.traitName=(u.isPlayer||scenes.npcDomain(u.name)===n)&&window.BattleTraits?.rules[n]?n:null;
    (e.domainFields||=[]).push(f);
    emit(e,ev,'domain',`${u.name} 展开【${n}】！`,{domainName:n,actorName:u.name,owner:f.owner,side:u.side,isPlayer:!!u.isPlayer,domainPhase:'formation'});return f;
  };
  const clash=(e,ev)=>{
    if(fields(e).length<2)return;
    const [a,b]=fields(e),strength=f=>window.BattleResonance?.effective(e,f)||f.power,strong=strength(a)>=strength(b)?a:b,weak=strong===a?b:a;
    // An incomplete domain can contest a sure-hit, but cannot overpower a complete one.
    if(strength(strong)>=strength(weak)*1.5&&!strong.incomplete&&!weak.incomplete){
      emit(e,ev,'domain_clash',`领域对抗！【${strong.name}】的精炼度压过了【${weak.name}】。`,{domainPhase:'engage',outcome:'overpower',winner:strong.owner,loser:weak.owner});
      collapse(e,weak,ev,'在对抗中失守');
    }else emit(e,ev,'domain_clash','领域对抗僵持：双方必中抵消。攻击施术者，动摇对方领域！',{domainPhase:'engage',outcome:'contested'});
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
    const damage=Math.round(total*(opening?.4:.2)*(f.barrierCondition==='compact'?.85:1));
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
      const maintenance=upkeep(u,f);
      if(u.cp<maintenance){collapse(this,f,ev,'因咒力不足');return;}
      u.cp-=maintenance;
      const enemy=opposite(this,f);
      if(enemy){
        const pressure=window.BattleResonance?.pressure(this,f,enemy),external=pressure?.external??(f.open&&!enemy.open&&!enemy.incomplete?12:0);
        const erosion=pressure?.total??(8+Math.min(20,Math.max(0,(f.power/enemy.power-1)*30))+external);
        enemy.stability=Math.max(0,enemy.stability-erosion);
        enemy.shellStress=Math.min(100,(enemy.shellStress||0)+external);
        if(f.incomplete)f.stability=Math.max(0,f.stability-12);
        emit(this,ev,'domain_clash',`领域对攻：【${f.name}】削减对方 ${Math.round(erosion)} 稳定度${external>0?`（外侧侵蚀 ${Math.round(external)}）`:''}。${f.incomplete?'未完成结界额外损失12稳定度。':''}`,{domainPhase:'pressure',fromIndex:f.owner,toIndex:enemy.owner,stabilityLoss:erosion,externalPressure:external,upkeepPaid:maintenance,reason:external>0?'开放结界外侧侵蚀':'结界对抗',selfLoss:f.incomplete?12:0});
        if(enemy.stability<=0)collapse(this,enemy,ev,'结界在对攻中破裂');
        if(f.stability<=0)collapse(this,f,ev,'未完成结界无法继续维持');
      }
      if(!fields(this).includes(f))return;
      pulse(this,f,ev);
      if(!fields(this).includes(f))return;
      if(opposite(this,f))emit(this,ev,'domain_state',`【${f.name}】继续争夺空间；对攻期间持续支付咒力，不结算独占维持时限。`);
      else{f.remaining--;if(f.remaining<=0)collapse(this,f,ev,'维持时间结束');else emit(this,ev,'domain_state',`【${f.name}】剩余 ${f.remaining} 次自身行动。`);}
    }
  };
  const hit=proto.dealDamage;
  proto.dealDamage=function(u,t,...args){
    const hp=t.hp,ev=args[3],result=hit.call(this,u,t,...args),f=active(this,t);
    if(f&&t.hp<hp){const loss=(hp-t.hp)/Math.max(1,t.maxHp)*160*(f.barrierCondition==='reinforce'?1.35:1);f.stability=Math.max(0,f.stability-loss);
      if(f.stability<=0)collapse(this,f,ev,'因施术者受到重创');else emit(this,ev,'domain_state',`【${f.name}】稳定度 ${Math.ceil(f.stability)}%。`,{domainPhase:'damage',owner:f.owner,stabilityLoss:loss,reason:'施术者受击'});
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
    const rating=u=>window.BattleResonance?.effective(e,{owner:e.units.indexOf(u),power:power(e,u)})||power(e,u);
    const pa=Math.round(rating(a)),pb=Math.round(rating(b)),incomplete=scenes.profileFor({name:a.domainName,actorName:a.name,isPlayer:a.isPlayer})?.incomplete||scenes.profileFor({name:b.domainName,actorName:b.name,isPlayer:b.isPlayer})?.incomplete;
    const text=!incomplete&&pa>=pb*1.5?'预计我方压过对手':!incomplete&&pb>=pa*1.5?'预计对方压过我方':'预计进入僵持 · 必中抵消';
    return {a:pa,b:pb,text,cost:cost(a),cpAfter:Math.max(0,a.cp-cost(a)),upkeep:upkeep(a),incomplete:!!incomplete};
  };
  window.DomainCombat={fields,active,ready,cost,upkeep,power,snapshot,collapse,forecast};

})();
/* Single-slot cursed tools. Bonuses belong to a battle snapshot, never permanent stats. */
(() => {
 'use strict';
 const catalog=([
  {id:'practice',name:'制式咒刀',tag:'基础咒具',role:'稳定近战',index:0,wins:0,bonus:.10,desc:'注入咒力的制式刀具，作为这段旅程的第一件武器。',effect:'体术伤害 +10%。',source:'本作基础装备'},
  {id:'naginata',name:'薙刀',tag:'长柄咒具',role:'近战进阶',index:1,wins:2,bonus:.20,desc:'红色长柄、宽刃与白色系穗，参考真希使用的长柄咒具。',effect:'体术伤害 +20%。',source:'参考原作咒具造型'},
  {id:'cloud',name:'游云',tag:'特级咒具',role:'纯粹力量',index:2,wins:5,bonus:.35,desc:'以短链连接的三节棍。没有附加术式，以使用者的力量发挥威力。',effect:'体术伤害 +35%；不增加术式或领域伤害。',source:'原作咒具'},
  {id:'spear',name:'天逆鉾',tag:'特级咒具',role:'突破防护',index:3,wins:8,bonus:.10,desc:'具有强制解除术式性质的特殊短刃，适合应对术式防护。',effect:'体术伤害 +10%；近战可突破无下限与天空术式防护。仍受防御、闪避和适应影响，不解除领域。',source:'原作咒具 · 能力按本作规则改编'},
  {id:'soul',name:'释魂刀',tag:'特级咒具',role:'破防利刃',index:4,wins:12,bonus:.20,desc:'白色绒毛刀柄与宽阔刀身。原作中，发挥其力量需要感知灵魂。',effect:'体术伤害 +20%；熟练度达到 100% 时，近战无视「防御」的减伤。不能突破无下限或适应。',source:'原作咒具 · 以熟练度模拟领悟'}
].map(Object.freeze)); // 数组本身保持可扩展：Batch C4 原创咒具经 Equipment.register 追加，单项仍冻结
const find=id=>catalog.find(t=>t.id===id);
const Equipment={catalog,find,
 /** Batch C4：注册原创咒具（equipment-original.js）。id 冲突即拒绝，注册后参与解锁/渲染/装备全流程 */
 register(tool){
  if(!tool||typeof tool.id!=='string'||find(tool.id))throw Error('咒具注册失败：id 缺失或重复');
  for(const k of ['name','tag','role','desc','effect','source'])if(typeof tool[k]!=='string')throw Error('咒具注册失败：缺少字段 '+k);
  if(!Number.isInteger(tool.index)||!Number.isInteger(tool.wins)||!Number.isFinite(tool.bonus))throw Error('咒具注册失败：数值字段异常');
  const t=Object.freeze(tool);catalog.push(t);return t;
 },
  fresh:()=>({version:1,owned:['practice'],equipped:null}),
  validate(e){
   if(e===undefined)return;
   if(!e||e.version!==1||!Array.isArray(e.owned)||e.owned.length>catalog.length||!e.owned.includes('practice')||new Set(e.owned).size!==e.owned.length||e.owned.some(id=>!find(id))||(e.equipped!==null&&!e.owned.includes(e.equipped)))throw Error('咒具数据异常');
  },
  state(){const r=Campaign.state;if(!r)return null;return r.equipment||(r.equipment=this.fresh());},
  victories(){return (Game.player?.huntCount||0)+(Campaign.state?.missions||[]).filter(m=>m.result==='win').length;},
  sync(){
   if(!Game.player)return [];
   const e=this.state();if(!e)return [];
   const unlocked=catalog.filter(t=>t.wins<=this.victories()&&!e.owned.includes(t.id));
   for(const t of unlocked)e.owned.push(t.id);
   return unlocked;
  },
  owned(){return this.state()?.owned.slice()||[];},
  current(){return find(this.state()?.equipped)||null;},
  blocked(){return !Game.player||Save.phase!=='world'||Save.busy||Save.failed||Save.restoring;},
  equip(id){
   if(this.blocked())throw Error('请在每日行动结束后更换咒具。');
   const e=this.state();if(!e||(id!==null&&!e.owned.includes(id)))throw Error('尚未获得这件咒具。');
   if(e.equipped===id)return;
   const previous=e.equipped;e.equipped=id;
   if(!Save.checkpoint()){e.equipped=previous;throw Error('未能保存装备，请先导出存档或检查浏览器存储。');}
   Game.render();
  },
  combatDescription(unit){const t=find(unit?.equipmentId);return t?t.name+'：'+t.effect:'';},
  rewardHTML(before=[]){const items=catalog.filter(t=>this.owned().includes(t.id)&&!before.includes(t.id));return items.length?`<div class="equipment-reward"><span>咒具库 · 新增藏品</span>${items.map(t=>`<b>${t.name}</b>`).join('')}<small>返回日程后，在角色下方的咒具库装备。</small></div>`:'';}
 };
 const fresh=Campaign.fresh;Campaign.fresh=function(...a){return {...fresh.apply(this,a),equipment:Equipment.fresh()};};
 const validate=Campaign.validate;Campaign.validate=function(r,...a){const out=validate.call(this,r,...a);Equipment.validate(r.equipment);return out;};
 const render=Game.render;Game.render=function(...a){Equipment.sync();return render.apply(this,a);};
 const run=BattleUI.run;BattleUI.run=function(cfg){Equipment.sync();return run.call(this,{...cfg,equipment:Equipment.current()?.id||null});};
 const make=BattleEngine.prototype.makePlayerUnit;
 BattleEngine.prototype.makePlayerUnit=function(p){const u=make.call(this,p);u.equipmentId=find(this.cfg.equipment)?.id||null;u.equipmentMastered=p.prof>=100;return u;};
const damage=BattleEngine.prototype.dealDamage;
// Batch B 兼容：必须透传第 10 参 pierceCap，否则玩家的机制化真伤会被静默压回 40% 软上限
BattleEngine.prototype.dealDamage=function(att,tar,base,mult,kind,ev,label,flash,ignoreImmune,pierceCap){
 const tool=att.isPlayer&&kind==='melee'&&!window.BattleTraits?.toolSealed(this,att)?find(att.equipmentId):null;
 if(!tool)return damage.call(this,att,tar,base,mult,kind,ev,label,flash,ignoreImmune,pierceCap);
 const nullify=att.toolNullify,pierce=att.toolPierceGuard,start=ev.length;
 att.toolNullify=tool.id==='spear';att.toolPierceGuard=tool.id==='soul'&&att.equipmentMastered;
 try{
  const amount=damage.call(this,att,tar,base*(1+tool.bonus),mult,kind,ev,`${tool.name} · ${label}`,flash,ignoreImmune,pierceCap);
  for(const e of ev.slice(start))if(e.from===att.name&&e.dmg)e.equipment=tool.id;
  return amount;
 }finally{att.toolNullify=nullify;att.toolPierceGuard=pierce;}
};
 window.Equipment=Equipment;
})();

/* Batch C4 原创咒具：5 件原创设计（不与原作武器同名，仅气质致敬）。
   通过 Equipment.register 挂入既有装备系统（解锁/渲染/存档校验自动生效）；
   特殊效果统一在本文件的 dealDamage/kill 补丁中结算，不改动引擎。 */
(() => {
'use strict';
const E=window.Equipment;if(!E)return;
const usable=(eng,u)=>!!u&&!window.BattleTraits?.toolSealed(eng,u);

E.register({id:'scissors',name:'断罪之剪',art:'assets/ui/v2/tools/scissors.png',tag:'原创咒具',role:'收割利刃',index:5,wins:15,bonus:.15,
 desc:'黑铁打造的双刃大剪，咬合时发出类似法槌落下的闷响。据说锻匠执念于「剪断罪孽」。',
 effect:'体术伤害 +15%；对生命低于 30% 的敌人，近战伤害再 +25%。',source:'原创咒具'});
E.register({id:'godBell',name:'鸣神之铃',art:'assets/ui/v2/tools/godBell.png',tag:'原创咒具',role:'护命铃音',index:6,wins:18,bonus:.10,
 desc:'系在刀镡上的黄铜小铃，持有者濒死时会无风自鸣。铃声只有一次——听过的人都还活着。',
 effect:'体术伤害 +10%；每场战斗首次受到致命伤害时，保留 1 点生命（铃响即碎）。',source:'原创咒具'});
E.register({id:'demonScroll',name:'百鬼夜行图',art:'assets/ui/v2/tools/demonScroll.png',tag:'原创咒具',role:'群战号令',index:7,wins:22,bonus:.15,
 desc:'一幅会自己变换内容的卷轴，展开时隐约能听到百鬼的脚步声。持卷者即夜行之主。',
 effect:'体术伤害 +15%；我方队友与召唤物伤害 +20%。',source:'原创咒具'});
E.register({id:'paradoxRing',name:'逆理之戒',art:'assets/ui/v2/tools/paradoxRing.png',tag:'原创咒具',role:'术式增幅',index:8,wins:26,bonus:.05,
 desc:'戒面刻着一句自相矛盾的咒文，念出来会让咒力回路短暂「打结」——结解开的瞬间，输出反而更顺。',
 effect:'体术伤害 +5%；术式伤害 +15%。',source:'原创咒具'});
E.register({id:'sheath',name:'无铭之鞘',art:'assets/ui/v2/tools/sheath.png',tag:'原创咒具',role:'居合一闪',index:9,wins:30,bonus:.12,
 desc:'没有刀铭的白鞘古刀，刀身只在出鞘的第一瞬映出使用者的杀气。鞘比刀更有名。',
 effect:'体术伤害 +12%；每场战斗第一次近战攻击伤害 ×1.6。',source:'原创咒具'});

// —— 特殊效果结算 ——
const proto=BattleEngine.prototype;
const deal=proto.dealDamage;
proto.dealDamage=function(att,tar,base,mult,kind,ev,...rest){
 // 断罪之剪：对残血（<30% 最大生命）目标近战 +25%
 if(usable(this,att)&&att.isPlayer&&kind==='melee'&&att.equipmentId==='scissors'&&tar.hp>0&&tar.hp<tar.maxHp*0.30){
  mult*=1.25;if(ev)ev.push({type:'skill',text:'【断罪之剪】剪刃咬合——收割残血目标，伤害 +25%。'});
 }
 // 百鬼夜行图：我方队友/召唤物伤害 +20%（玩家持卷才生效）
 if(att.side==='ally'&&!att.isPlayer&&this.player?.equipmentId==='demonScroll'&&usable(this,this.player))mult*=1.20;
 // 逆理之戒：术式伤害 +15%
 if(usable(this,att)&&att.isPlayer&&kind==='tech'&&att.equipmentId==='paradoxRing')base*=1.15;
 // 无铭之鞘：每场第一次近战 ×1.6
 if(usable(this,att)&&att.isPlayer&&kind==='melee'&&att.equipmentId==='sheath'&&!att.buff.sheathUsed){
  att.buff.sheathUsed=true;mult*=1.6;if(ev)ev.push({type:'skill',text:'【无铭之鞘】居合一闪——出鞘第一击，伤害 ×1.6！'});
 }
 return deal.call(this,att,tar,base,mult,kind,ev,...rest);
};
// 鸣神之铃：首次致命伤害保留 1 点生命（铃响即碎，每场一次）
const kill=proto.kill;
proto.kill=function(u,ev,...rest){
  if(usable(this,u)&&u.isPlayer&&u.equipmentId==='godBell'&&!u.buff.bellUsed){
  u.buff.bellUsed=true;u.alive=true;u.hp=1;
  if(ev)ev.push({type:'skill',text:'【鸣神之铃】铃声炸响又戛然而止——你从致命一击中撑住了最后 1 点生命！'});
  return;
 }
 return kill.call(this,u,ev,...rest);
};
})();

/* Battle-only traits. Canon motifs are adapted to turns; no persistent player mutation. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype,dc=()=>window.DomainCombat;
 const rules={
  '无量空处':{tag:'信息过载',text:'不直接造成领域伤害；每个敌人首次行动被压制，之后输出降低20%。',counter:'展开领域抵消控制，或由同伴击破施术者。'},
  '伏魔御厨子':{tag:'连续斩击 · 开放',text:'每次必中分成三段斩击；对攻时从外侧额外削减封闭结界12稳定度。',counter:'攻击宿傩削弱稳定度；防御可稳固自己的领域。'},
  '嵌合暗翳庭':{tag:'影之增幅 · 未完成',text:'没有必中；自身术式伤害+20%，自己的式神伤害+30%。可牵制对方必中，但对攻额外损失12稳定度。',counter:'优先击破伏黑或其式神；增幅在对攻期间仍生效。'},
  '盖棺铁围山':{tag:'熔岩 · 灼热',text:'必中伤害降低为原基础的70%；敌人每次行动前受到灼热伤害。',counter:'展开领域暂停灼热与必中；防御可减轻伤害。'},
  '自闭圆顿裹':{tag:'灵魂触及',text:'必中伤害降低为原基础的75%；敌方输出降低20%。',counter:'领域对攻暂停灵魂压制；打破领域即可解除。'},
  '荡蕴平线':{tag:'死累累涌军',text:'65%基础必中扫击全体，再对标记目标追加70%基础伤害。目标倒下后重新标记。',counter:'标记目标防御，其余同伴集中攻击陀艮。'},
  '诛伏赐死':{tag:'简化判决 · 没收',text:'无直接伤害。优先没收咒具效果；没有咒具者无法主动使用术式、极之番或领域，生得术式被封。',counter:'在判决成立前展开领域；判决后用体术击破日车。装备不会从存档丢失。'},
  '坐杀博徒':{tag:'抽奖 · 咒力奖金',text:'无直接伤害；展开及维持时抽奖，35%中奖，第三次保底。中奖后收起领域，随后3次行动回满咒力并恢复25%生命。',counter:'在中奖前击破秤；奖金不是无敌，爆发仍可将其击倒。概率与时长为本作改编。'},
  '胎藏遍野':{tag:'重力压制',text:'基础必中；敌方每次行动后行动值回退20。',counter:'对攻抵消压制；集中火力击破施术者。'},
  '真赝相爱':{tag:'刀阵 · 交替连携',text:'基础必中；领域内术式命中后，下一次体术伤害+35%。',counter:'注意施术者的连携状态；刀阵强化在对攻中保留。'},
  '时胞月宫殿':{tag:'帧规则',text:'基础必中降低为70%；敌方使用攻击指令后承受帧规则反噬，防御不触发。',counter:'选择防御等待窗口，或展开领域抵消帧规则。'},
  '朵颐光海':{tag:'花海牵制 · 游戏扩展',text:'必中降为60%；敌人行动前流失5%最大咒力。完整规则未在动画展示，这里是主题玩法。',counter:'展开领域暂停咒力流失，或集中攻击花御。'}
 };
 const fallback={tag:'基础领域',text:'维持期间结算基础必中伤害；对攻时必中抵消。',counter:'攻击施术者削弱稳定度，或展开自己的领域。'};
 const info=name=>rules[window.BattleScenes.name(name)]||fallback;
 const fs=e=>dc().fields(e),solo=(e,f)=>!fs(e).some(g=>g.side!==f.side);
 const hostiles=(e,u)=>fs(e).filter(f=>f.side!==u.side&&solo(e,f));
 const fieldType=(e,f)=>f.traitName||'';
 const court=(e,u)=>hostiles(e,u).some(f=>fieldType(e,f)==='诛伏赐死');
 const sealed=(e,u)=>court(e,u)&&!u.equipmentId;
 const toolSealed=(e,u)=>!!u.equipmentId&&court(e,u);
 const blocked=(e,u,action)=>window.BattleResonance?.blocked(e,u,action)||(sealed(e,u)&&['tech','ult','domain'].includes(action)?'判决没收：术式暂时封锁，使用体术或防御。':'');
 const effects=u=>u.traitEffects||(u.traitEffects={});
 const mark=(u,key,source,turns=2)=>{effects(u)[key]={source,left:turns};};
 const say=(ev,text)=>ev.push({type:'skill',text});
 const heal=(u,amount,ev,label)=>{const actual=Math.min(u.maxHp-u.hp,Math.round(amount));u.hp+=actual;if(actual>0)ev.push({type:'heal',from:u.name,heal:actual,text:`${u.name}【${label}】恢复 ${actual} 生命。`});};
 function domainPulse(e,f,ev,opening){
  const name=fieldType(e,f),u=e.units[f.owner];if(!u?.alive)return true;
  const targets=e.alive(u.side==='ally'?'enemy':'ally');
  if(name==='坐杀博徒'){
   f.draws=(f.draws||0)+1;
   if(Math.random()<.35||f.draws>=3){u.traitJackpot=3;u.cp=u.maxCp;say(ev,`${u.name}【坐杀博徒】大奖！获得3次行动的咒力与生命补给。`);dc().collapse(e,f,ev,'抽中大奖，转入奖金时间');}
   else say(ev,`【坐杀博徒】第${f.draws}次抽奖未中；第三次保底。`);
   return true;
  }
  if(name==='嵌合暗翳庭'){say(ev,'【嵌合暗翳庭】影与式神增幅生效；不完整领域没有必中。');return true;}
  if(!solo(e,f))return true;
  if(name==='无量空处'||name==='诛伏赐死'){say(ev,`【${name}】${info(name).tag}生效，不结算直接伤害。`);return true;}
  const avg=(u.eff[0]+u.eff[1])/2,total=u.isPlayer?avg*6+u.maxCp*.06:avg*(u.side==='enemy'?3.5:5),base=total*(opening?.4:.2)*(f.barrierCondition==='compact'?.85:1);
  const hit=(t,n,label)=>{if(t?.alive&&!e.ended&&fs(e).includes(f))e.dealDamage(u,t,Math.round(n),1,'domain',ev,label,false,true);};
  if(name==='荡蕴平线'){
   if(!e.units[f.focus]?.alive)f.focus=e.units.indexOf(targets.slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]);
   targets.forEach(t=>hit(t,base*.65,'死累累涌军·扫击'));hit(e.units[f.focus],base*.7,'死累累涌军·集中围攻');
  }else if(name==='伏魔御厨子'){
   for(let i=0;i<3;i++)for(const t of targets)hit(t,base/3,`伏魔御厨子·连续斩击 ${i+1}/3`);
  }else{
   const scale=name==='盖棺铁围山'||name==='时胞月宫殿'?.7:name==='自闭圆顿裹'?.75:name==='朵颐光海'?.6:1;
   targets.forEach(t=>hit(t,base*scale,`${f.name}·必中`));
  }
  e.checkEnd(ev);return true;
 }
 function beforeTurn(e,u,ev){
  if(u.traitJackpot>0){u.cp=u.maxCp;heal(u,u.maxHp*.25,ev,'咒力奖金');u.traitJackpot--;say(ev,`${u.name} 的奖金补给剩余 ${u.traitJackpot} 次行动。`);}
  for(const f of [...hostiles(e,u)]){
   const name=fieldType(e,f),owner=e.units[f.owner];
   if(name==='盖棺铁围山'){
    e.dealDamage(owner,u,Math.min(u.maxHp*.03,(owner.eff[0]+owner.eff[1])*.3),1,'domain',ev,'熔岩环境·灼热',false,true);e.checkEnd(ev);
    if(!u.alive||e.ended)return true;
   }
   if(name==='朵颐光海'){const loss=Math.min(u.cp,Math.round(u.maxCp*.05));u.cp-=loss;say(ev,`【花海牵制】${u.name} 流失 ${loss} 咒力。`);}
   if(name==='无量空处'){
    f.overloaded||=[];const id=e.units.indexOf(u);
    if(!f.overloaded.includes(id)){f.overloaded.push(id);u.intent=null;u.buff.defend=false;e.actionsTotal++;u.buff.actCount++;say(ev,`${u.name} 陷入【信息过载】，本次无法行动；同一领域只触发一次。`);e.afterAction(u,ev);return true;}
   }
  }
  return false;
 }
 const techniqueNotes={
  ratio:'命中留下弱点：下一次受到的体术/术式伤害+25%，2次自身行动内有效。',
  straw:'命中留下共鸣钉；再次用术式命中同一目标触发共鸣，目标行动值后退25。防御可清除钉。',
  projection:'术式命中定帧，目标跳过1次行动；同一目标需再经过2次行动才能再次定帧。',
  swap:'术式命中后交换扰乱，使目标下一次体术/术式伤害降低25%，2次自身行动内有效。',
  idleTrans:'术式命中造成灵魂扰动，目标输出降低20%，持续2次自身行动；防御可清除。',
  grow:'术式命中吸取目标最多10%最大咒力，恢复给自己。',
  cursedSpeech:'支付额外咒力可压制目标1次行动。',shadows:'自身行动时召唤/融合式神；暗翳庭内式神输出提升。',
  spiritControl:'使用战斗中击败或已吸收的敌人召唤式神。',puppet:'自动补充傀儡，傀儡优先承担敌人攻击。',
  seance:'从击败过的角色中召唤亡灵式神。',moon:'命中叠加淀月毒素，每层在行动前造成5%最大生命伤害。',
  gu:'命中叠加蛊毒，每层在行动前造成10%最大生命伤害。',rot:'命中可腐蚀目标本场生命上限。',
  limitless:'无下限可阻挡普通攻击；领域必中与天逆鉾近战能够突破。'
 };
 function description(e,u){return Object.entries(techniqueNotes).filter(([flag])=>e.hasFlag(u,flag)).map(([,s])=>s).join(' ');}
 const hasFlag=proto.hasFlag;proto.hasFlag=function(u,f){return !!u&&!sealed(this,u)&&hasFlag.call(this,u,f);};
 const strike=proto.performStrike;
 proto.performStrike=function(u,t,kind,ev){
  if(!t?.alive)return;
  const wasNailed=effects(t).nail?.source===this.units.indexOf(u),start=ev.length;
  const result=strike.call(this,u,t,kind,ev);
  const landed=ev.slice(start).some(x=>x.from===u.name&&x.to===t.name&&x.dmg>0);
  if(landed&&t.alive){
   const source=this.units.indexOf(u);
   if(this.hasFlag(u,'ratio')){mark(t,'weak',source);say(ev,`${t.name} 被标出【十划弱点】，下一击可利用。`);}
   if(this.hasFlag(u,'straw')){if(kind==='tech'&&wasNailed){delete effects(t).nail;t.atb=Math.max(0,t.atb-25);say(ev,`【共鸣】引爆钉印，${t.name} 行动值 -25。`);}else{mark(t,'nail',source);say(ev,`${t.name} 留下【共鸣钉】，可用术式引爆。`);}}
   if(kind==='tech'&&this.hasFlag(u,'projection')&&(t.traitClock||0)>=(t.traitFrameUntil||0)){t.buff.stun=Math.max(t.buff.stun,1);t.traitFrameUntil=(t.traitClock||0)+3;say(ev,`【定帧】${t.name} 下一次行动被冻结。`);}
   if(kind==='tech'&&this.hasFlag(u,'swap')){mark(t,'disrupt',source);say(ev,`【不义游戏】交换扰乱，${t.name} 下一次攻击威力降低。`);}
   if(kind==='tech'&&this.hasFlag(u,'idleTrans')){mark(t,'soul',source);say(ev,`${t.name} 受到【灵魂扰动】，防御可解除。`);}
   if(kind==='tech'&&this.hasFlag(u,'grow')){const n=Math.min(t.cp,Math.round(t.maxCp*.1));t.cp-=n;u.cp=Math.min(u.maxCp,u.cp+n);say(ev,`【生长术式】吸取 ${t.name} 的 ${n} 咒力。`);}
  }
  return result;
 };
 const hit=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  let factor=1;const direct=kind==='tech'||kind==='melee',mine=dc().active(this,u),debuff=effects(u),weak=effects(t).weak;
  if(direct){
   if(debuff.soul)factor*=.8;
   if(debuff.disrupt)factor*=.75;
   if(weak)factor*=1.25;
   for(const f of hostiles(this,u))if(['无量空处','自闭圆顿裹'].includes(fieldType(this,f)))factor*=.8;
   const shadow=fs(this).find(f=>fieldType(this,f)==='嵌合暗翳庭'&&f.side===u.side&&(f.owner===this.units.indexOf(u)||u.ownerName===f.actorName));
   if(shadow){if(u.summonTag)factor*=1.3;else if(kind==='tech')factor*=1.2;}
   if(mine?.traitName==='真赝相爱'&&mine.combo&&kind==='melee')factor*=1.35;
  }
  const result=hit.call(this,u,t,base*factor,mult,kind,ev,...rest);
  if(direct&&result>0){
   if(weak){delete effects(t).weak;say(ev,'弱点被利用，伤害提升25%。');}
   if(debuff.disrupt)delete debuff.disrupt;
   if(mine?.traitName==='真赝相爱'){mine.combo=kind==='tech';}
  }
  return result;
 };
 const player=proto.playerAct;
 proto.playerAct=function(action,...a){
  const reason=blocked(this,this.player,action);
  if(reason){this.awaitingPlayer=true;return {events:[{type:'info',text:reason}],ended:false,needInput:true,retryInput:true};}
  let fortify=null;
  if(action==='defend'&&this.awaitingPlayer){
   const state=effects(this.player);delete state.nail;delete state.soul;
   const f=dc().active(this,this.player);if(f){const before=f.stability;f.stability=Math.min(100,f.stability+15);fortify={type:'domain_state',domainPhase:'fortify',owner:f.owner,stabilityGain:f.stability-before,reason:'防御稳固',text:`【${f.name}】防御稳固 +${Math.round(f.stability-before)} 稳定度；恢复8%咒力，仍需支付领域维持。`,domainSnapshot:dc().snapshot(this)};}
  }
  this.player.traitAction=action;const result=player.call(this,action,...a);if(fortify)result.events.unshift(fortify);return result;
 };
 const npc=proto.npcAct;
 proto.npcAct=function(u,ev){
  u.traitAction='attack';
  if(sealed(this,u)){u.intent=null;say(ev,`${u.name} 术式被没收，改用体术。`);const t=u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget();return this.performStrike(u,t,'melee',ev);}
  return npc.call(this,u,ev);
 };
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){
  if(this.pendingDomain?.owner===this.units.indexOf(u))return after.call(this,u,ev);
  for(const f of [...hostiles(this,u)]){
   if(f.traitName==='胎藏遍野')u.atb=Math.max(0,u.atb-20);
   if(f.traitName==='时胞月宫殿'&&['melee','tech','ult','attack'].includes(u.traitAction)){
    const caster=this.units[f.owner];this.dealDamage(caster,u,Math.min(u.maxHp*.03,(caster.eff[0]+caster.eff[1])*.3),1,'domain',ev,'违反帧规则',false,true);
   }
  }
  u.traitAction=null;u.traitClock=(u.traitClock||0)+1;
  for(const [key,s] of Object.entries(effects(u)))if(--s.left<=0)delete effects(u)[key];
  return after.call(this,u,ev);
 };
 const labels={weak:'弱点 +25%',nail:'共鸣钉 · 防御清除',soul:'灵魂扰动 -20% · 防御清除',disrupt:'交换扰乱 · 下次攻击 -25%'};
 function status(e,u){
  const list=Object.entries(u.traitEffects||{}).map(([key,s])=>`${labels[key]} · ${s.left}行动`);
  for(const f of hostiles(e,u)){
   if(f.traitName==='诛伏赐死')list.push(u.equipmentId?'咒具效果被没收':'术式被没收');
   if(f.traitName==='无量空处')list.push(f.overloaded?.includes(e.units.indexOf(u))?'信息压制 · 输出 -20%':'信息过载 · 首次行动受控');
   if(f.traitName==='自闭圆顿裹')list.push('灵魂触及 · 输出 -20%');
   if(f.traitName==='荡蕴平线'&&f.focus===e.units.indexOf(u))list.push('涌军集中目标');
  }
  if(u.buff.stun>0)list.push('受控 · 跳过 '+u.buff.stun+' 行动');
  if(u.traitJackpot>0)list.push('奖金补给 · '+u.traitJackpot+' 行动');
  if(dc().active(e,u)?.combo)list.push('刀阵连携 · 下次体术 +35%');
  list.push(...(window.BattleResonance?.status(e,u)||[]));return list;
 }
 window.BattleTraits={rules,info,description,techniqueNotes,domainPulse,beforeTurn,blocked,toolSealed,status,solo};
})();

/* Battle-only black flash, barrier conditions and burnout. Never serialized into a save. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype,dc=()=>window.DomainCombat;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const clock=u=>u.resonanceClock||0;
 const zoneLeft=u=>Math.max(0,(u.flashZone?.until||0)-clock(u));
 const burnoutLeft=u=>Math.max(0,(u.techBurnoutUntil||0)-clock(u));
 const contact=(e,u,kind)=>kind==='melee'||kind==='tech'&&['ratio','mass','idleTrans'].some(f=>e.hasFlag(u,f));
 const momentum=u=>u.domainMomentum?.until>clock(u)?u.domainMomentum.bonus:0;
 const flashChance=(e,u,kind)=>{
  if(!contact(e,u,kind)||u.summonTag)return 0;
  const learned=u.isPlayer?e.cfg.player.blackFlash:!!u.bf,ratio=e.hasFlag(u,'ratio');
  if(!learned&&!ratio)return 0;
  const control=clamp(u.ctl/(u.ctl+4500),0,1),strain=u.cp<Math.round(u.maxCp*.12)? .65:1;
  const disrupted=u.buff.stun>0||u.traitEffects?.soul||u.traitEffects?.disrupt;
  return clamp(((learned?.055:0)+(ratio?.10:0)+control*.03+Math.min(3,u.contactRhythm||0)*.015+(zoneLeft(u)>0?.12:0)+(u.focusUntil>clock(u)?.025:0))*strain*(disrupted?.65:1),0,.45);
 };
 const blocked=(e,u,action)=>burnoutLeft(u)>0&&['tech','ult','domain'].includes(action)?`术式熔断 · 还需 ${burnoutLeft(u)} 次自身行动，用体术或防御等待恢复。`:'';
 const emit=(e,ev,type,text,extra={})=>ev.push({type,text,domainSnapshot:dc().snapshot(e),...extra});
 function surge(e,u,ev,bonus,turns,label){
  const prior=momentum(u);u.domainMomentum={bonus:Math.max(prior,bonus),until:Math.max(u.domainMomentum?.until||0,clock(u)+turns+1)};
  if(dc().active(e,u))emit(e,ev,'domain_state',`${u.name}【${label}】获得短暂领域优势 +${Math.round(momentum(u)*100)}%。`,{domainPhase:'momentum',owner:e.units.indexOf(u),momentum:momentum(u)});
 }
 function onFlash(e,u,ev){
  const chained=zoneLeft(u)>0;
  u.flashZone={until:clock(u)+4,chain:chained?(u.flashZone.chain||1)+1:1};
  surge(e,u,ev,.10,2,'黑闪心流');
  emit(e,ev,'skill',`${u.name}${chained?' · 连续黑闪 '+u.flashZone.chain:' · 黑闪心流'}！随后3次自身行动输出 +12%，接触攻击更容易再次黑闪；领域优势 +10%持续2次行动。`,{resonancePhase:'zone',owner:e.units.indexOf(u),zoneActions:3,chain:u.flashZone.chain});
 }
 function onContact(e,u,kind,damage,flash,ev){
  if(u.summonTag)return;
  if(!contact(e,u,kind)||!(damage>0)){u.contactRhythm=0;u.contactCombo=0;return;}
  u.contactRhythm=Math.min(3,(u.contactRhythm||0)+1);
  u.contactCombo=(u.contactCombo||0)+1;
  if(!flash&&u.contactCombo%3===0&&dc().active(e,u))surge(e,u,ev,.06,1,'连续压制');
 }
 const effective=(e,f)=>{
  const u=e.units[f.owner];return f.power*(1+momentum(u))*(f.barrierCondition==='compact'?1.12:1);
 };
 const advantage=(e,f)=>effective(e,f)*(.35+.65*clamp(f.stability,0,100)/100);
 const conditionLabel=f=>f.barrierCondition==='reinforce'?'外壳加固':f.barrierCondition==='compact'?'压缩结界':f.open?'开放结界':f.incomplete?'未完成结界':'常规结界';
 function pressure(e,from,to){
  const inner=8+Math.min(20,Math.max(0,(effective(e,from)/Math.max(1,effective(e,to))-1)*30));
  const outer=from.open&&!to.open&&!to.incomplete?12:0;
  const outsideFactor=to.barrierCondition==='reinforce'?.45:to.barrierCondition==='compact'?.65:1;
  const insideFactor=to.barrierCondition==='reinforce'?1.15:1;
  return {inner:inner*insideFactor,external:outer*outsideFactor,total:inner*insideFactor+outer*outsideFactor};
 }
 const conditionCost=u=>Math.round(u.maxCp*.04);
 function canCondition(e,u,kind){
  const f=dc().active(e,u),other=f&&dc().fields(e).find(x=>x.side!==f.side);
  const mastery=u.isPlayer?e.cfg.player.prof||0:/五条悟|宿傩|羂索/.test(u.name)?260:160;
  return !!f&&!!other&&!f.open&&!f.incomplete&&!f.barrierCondition&&u.alive&&!burnoutLeft(u)&&mastery>=160&&u.cp>=conditionCost(u)&&(kind!=='reinforce'||other.open);
 }
 function adjust(e,u,kind,ev){
  if(!['reinforce','compact'].includes(kind)||!canCondition(e,u,kind))return false;
  const f=dc().active(e,u),paid=conditionCost(u);u.cp-=paid;f.barrierCondition=kind;
  emit(e,ev,'domain_state',`【${f.name}】${conditionLabel(f)}，支付 ${paid} CP。${kind==='reinforce'?'外侧侵蚀降55%，内部对攻压力增加15%，施术者受击时稳定度损失增加35%；维持消耗增加35%。':'精炼输出增加12%，外侧侵蚀降35%，必中输出降15%；维持消耗增加65%。'}`,{domainPhase:'condition',owner:f.owner,condition:kind,cpPaid:paid});return true;
 }
 function onCollapse(e,u,ev,reason){
  if(e.ended||!u.alive)return;
  const actions=u.reverse?2:3,ownAction=e.lastActor===u||u.resonanceTick;
  u.techBurnoutUntil=clock(u)+actions+(ownAction?1:0);u.domainCd=actions;
  emit(e,ev,'skill',`${u.name} 进入术式熔断，随后 ${actions} 次自身行动只能使用体术与防御${u.reverse?'；反转术式缩短了恢复时间':''}。`,{resonancePhase:'burnout',owner:e.units.indexOf(u),burnoutActions:actions,reason});
 }
 const hasFlag=proto.hasFlag;
 proto.hasFlag=function(u,flag){if(u&&burnoutLeft(u)>0&&(u.flag===flag||u.flags?.includes(flag)))return false;return hasFlag.call(this,u,flag);};
 const hit=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){return hit.call(this,u,t,base*(zoneLeft(u)>0&&['melee','tech'].includes(kind)?1.12:1),mult,kind,ev,...rest);};
 const npc=proto.npcAct;
 proto.npcAct=function(u,ev){
  if(burnoutLeft(u)>0){u.intent=null;u.traitAction='melee';return this.performStrike(u,u.side==='enemy'?this.pickAllyTarget():this.pickEnemyTarget(),'melee',ev);}
  const f=dc().active(this,u);
  if(f&&(f.shellStress||0)>=8&&canCondition(this,u,'reinforce')){u.intent=null;u.traitAction='barrier';return adjust(this,u,'reinforce',ev);}
  return npc.call(this,u,ev);
 };
 const player=proto.playerAct;
 proto.playerAct=function(action,...args){
  if(action.startsWith('barrier_')){
   const ev=[];
   if(!this.awaitingPlayer||this.ended||this.pendingDomain)return {events:ev,ended:this.ended,needInput:this.awaitingPlayer,retryInput:true};
   if(!adjust(this,this.player,action.slice(8),ev)){ev.push({type:'info',text:'当前不能调整结界：需要熟练度160%、领域僵持、完整封闭领域、足够咒力，且每次展开只能调整一次。'});return {events:ev,ended:false,needInput:true,retryInput:true};}
   this.awaitingPlayer=false;this.player.traitAction='barrier';this.afterAction(this.player,ev);return this.pack(ev);
  }
  if(action==='defend'&&this.awaitingPlayer){this.player.focusUntil=clock(this.player)+2;this.player.contactRhythm=0;this.player.contactCombo=0;}
  return player.call(this,action,...args);
 };
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){
  if(this.pendingDomain?.owner===this.units.indexOf(u))return after.call(this,u,ev);
  const wasZone=zoneLeft(u)>0,wasBurnout=burnoutLeft(u)>0;
  u.resonanceTick=true;try{after.call(this,u,ev);}finally{u.resonanceTick=false;}
  u.resonanceClock=clock(u)+1;
  if(wasZone&&!zoneLeft(u)){u.flashZone=null;emit(this,ev,'skill',`${u.name} 的黑闪心流结束。`,{resonancePhase:'zone_end',owner:this.units.indexOf(u)});}
  if(wasBurnout&&!burnoutLeft(u)){u.techBurnoutUntil=0;u.domainCd=0;emit(this,ev,'skill',`${u.name} 的术式恢复，可以再次使用术式与领域。`,{resonancePhase:'recovery',owner:this.units.indexOf(u)});}
  else if(burnoutLeft(u)>0)u.domainCd=burnoutLeft(u);
  if(momentum(u)===0&&u.domainMomentum){u.domainMomentum=null;if(dc().active(this,u))emit(this,ev,'domain_state',`${u.name} 的短暂领域优势消退。`,{domainPhase:'momentum_end',owner:this.units.indexOf(u)});}
 };
 function status(e,u){const list=[];if(zoneLeft(u))list.push(`黑闪心流 · ${Math.min(3,zoneLeft(u))} 行动`);if(burnoutLeft(u))list.push(`术式熔断 · ${burnoutLeft(u)} 行动`);return list;}
 function fieldText(e,f,contested){
  const u=e.units[f.owner],boost=f.momentum??momentum(u);return `${conditionLabel(f)} · ${contested?'对攻持续至结界破裂 / 咒力耗尽':`剩余 ${f.remaining} 行动`}${boost?` · 优势 +${Math.round(boost*100)}%`:''}${f.shellStress>0?` · 外壳侵蚀 ${Math.round(f.shellStress)}`:''}`;
 }
 function buttons(e,u,can){
  const f=dc().active(e,u);if(!f||!dc().fields(e).some(x=>x.side!==f.side)||f.open||f.incomplete||f.barrierCondition)return '';
  return `<div class="barrier-options" role="group" aria-label="结界条件调整"><span>结界条件 · 消耗一次行动与 ${conditionCost(u)} CP</span><button type="button" data-barrier="reinforce" ${can&&canCondition(e,u,'reinforce')?'':'disabled'}>外壳加固<small>抵御外侧侵蚀 · 内部更脆弱</small></button><button type="button" data-barrier="compact" ${can&&canCondition(e,u,'compact')?'':'disabled'}>压缩结界<small>精炼增强 · 更耗咒力</small></button></div>`;
 }
 window.BattleResonance={flashChance,onFlash,onContact,zoneLeft,burnoutLeft,blocked,effective,advantage,pressure,conditionCost,canCondition,adjust,onCollapse,momentum,status,fieldText,buttons,conditionLabel};
})();

/* Player decisions use the real engine. All style resources belong to this battle only. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype, rawFlag=(u,f)=>u.flag===f||u.flags?.includes(f);
 const families=['shadows','puppet','crows','spiritControl','seance'];
 const family=u=>families.find(f=>rawFlag(u,f))||'';
 const manualSummons=(e,u)=>!!u.isPlayer&&!!family(u);
 const cost=(u,p)=>Math.max(1,Math.round(u.maxCp*p));
 const state=u=>u.playerStyle||(u.playerStyle={pressure:0,burst:0,deployed:0,orders:0,intercepts:0,damage:0});
 const owned=(e,u=e.player)=>e.alive(u.side).filter(s=>s.summonTag&&s.ownerIndex===e.units.indexOf(u));
 const shadowSpecs=[
  {key:'dog',name:'玉犬式神',label:'玉犬',ratio:.24,prof:0,note:'近身追击 · 稳定输出'},
  {key:'rabbit',name:'脱兔式神',label:'脱兔',ratio:.14,prof:0,note:'更快行动 · 适合护卫',speed:1.35},
  {key:'nue',name:'鵺式神',label:'鵺',ratio:.30,prof:40,note:'空中协攻 · 速度较快',speed:1.15},
  {key:'ox',name:'贯牛式神',label:'贯牛',ratio:.34,prof:100,note:'蓄势冲撞 · 更高单次输出',speed:.85}
 ];
 const limit=u=>family(u)==='crows'?3:2;
 const summon=proto.addSummon;
 proto.addSummon=function(owner,...args){const u=summon.call(this,owner,...args);if(u)u.ownerIndex=this.units.indexOf(owner);return u;};
 function specs(e,u){
  switch(family(u)){
   case 'shadows':return shadowSpecs;
   case 'puppet':return [{key:'puppet',name:'傀儡',label:'傀儡',ratio:.70,prof:0,note:'实体机械 · 协攻与护卫'}];
   case 'crows':return [{key:'crow',name:'乌鸦式神',label:'乌鸦',ratio:.30,prof:0,note:'飞行式神 · 最多三只'}];
   default:return [...(e.cfg.player.absorbed||[]),...e.killedPool].filter((s,i,a)=>a.findIndex(x=>x.name===s.name)===i).map((s,i)=>({key:'recall-'+i,name:(family(u)==='seance'?'亡灵式神·':'咒灵式神·')+s.name,label:s.name,spec:s,ratio:1,prof:0,note:'已收录单位 · 原面板召回'}));
  }
 }
 function commands(e){
  const u=e.player,s=state(u),mine=owned(e),block=window.BattleTraits?.blocked(e,u,'tech')||'',rows=[];
  const row=(id,label,cp,note,reason='')=>rows.push({id,label,cost:cp,note,reason:reason||(u.cp<cp?'咒力不足':'')});
  row('style_burst','破势一击',cost(u,.04),'消耗3格势能 · 体术×1.65，命中额外削减领域稳定度10',s.pressure<3?'势能 '+s.pressure+'/3':'');
  if(!family(u))return rows;
  const max=limit(u),deployCost=cost(u,.08);
  for(const spec of specs(e,u))row('style_deploy:'+spec.key,'显现 · '+spec.label,deployCost,spec.note,block||(mine.length>=max?'在场上限 '+max:((e.cfg.player.prof||0)<spec.prof?'熟练度需 '+spec.prof+'%':e.alive().length>=14?'战场已满':'')));
  if(!specs(e,u).length)row('style_deploy:none','召回已收录单位',deployCost,'击败敌人后可收录；不凭空生成咒灵','尚未收录单位');
  row('style_coordinate','协攻指令',cost(u,.06),'锁定当前目标 · 召唤物行动值+40，下次攻击×1.30',block||(!mine.length?'先显现召唤物':''));
  row('style_protect','护卫指令',cost(u,.04),'最健康的召唤物分担下一次直接攻击35% · 不影响领域必中',block||(!mine.length?'先显现召唤物':''));
  if(family(u)==='shadows')row('style_fuse','融合 · 嵌合兽',cost(u,.10),'两只式神融合 · 累加现有生命与面板，不回复已损失生命',block||(mine.filter(x=>x.shadow&&!x.fused).length<2?'需两只未融合式神':''));
  return rows;
 }
 function event(e,ev,phase,text,extra={}){ev.push({type:'style',stylePhase:phase,from:e.player.name,fromIndex:e.units.indexOf(e.player),text,...extra});}
 const act=proto.playerAct;
 proto.playerAct=function(action,targetIndex){
  if(!action.startsWith('style_')){
   const packet=act.call(this,action,targetIndex);
   if(!packet.retryInput&&action==='tech')state(this.player).pressure=Math.max(0,state(this.player).pressure-1);
   return packet;
  }
  const ev=[],u=this.player,command=commands(this).find(c=>c.id===action);
  const retry=reason=>({events:[{type:'info',text:reason}],ended:this.ended,result:this.result,needInput:this.awaitingPlayer,retryInput:true});
  if(!this.awaitingPlayer||this.ended||this.pendingDomain||!u.alive)return retry('等待你的行动。');
  if(!command||command.reason)return retry(command?.reason||'此指令不属于当前人物。');
  const target=this.units[targetIndex]?.alive&&this.units[targetIndex].side!==u.side?this.units[targetIndex]:this.pickEnemyTarget();
  if(!target)return retry('没有可攻击的目标。');
  const mine=owned(this),st=state(u);u.cp-=command.cost;this.awaitingPlayer=false;
  if(action==='style_burst'){
   st.pressure=0;st.burst++;u.styleStrike='burst';u.traitAction='melee';
   event(this,ev,'burst','势能满格 · 破势一击！');
   try{this.performStrike(u,target,'melee',ev);}finally{u.styleStrike='';}
  }else if(action.startsWith('style_deploy:')){
   const spec=specs(this,u).find(x=>action==='style_deploy:'+x.key);
   const spawned=this.addSummon(u,spec.name,spec.ratio,family(u)==='puppet'?'傀儡':'式神');
   if(!spawned){u.cp+=command.cost;this.awaitingPlayer=true;return retry('当前无法显现。');}
   spawned.shadow=family(u)==='shadows';spawned.styleSpawn=true;spawned.speed=u.speed*(spec.speed||1);spawned.atb=55;
   if(spec.spec){for(const k of ['maxHp','maxCp','ctl','li'])spawned[k]=spec.spec[k]??spawned[k];spawned.hp=spawned.maxHp;spawned.cp=spawned.maxCp;spawned.melee=spec.spec.melee.slice();spawned.eff=spec.spec.eff.slice();}
   st.deployed++;event(this,ev,'deploy','显现 · '+spec.label+'！',{spawnIndex:this.units.indexOf(spawned),summonFamily:family(u)});u.traitAction='tech';
  }else if(action==='style_coordinate'){
   for(const summon of mine){summon.summonOrder={targetIndex:this.units.indexOf(target),boost:1.30};summon.atb=Math.min(99,summon.atb+40);}
   st.orders++;event(this,ev,'coordinate','协攻 · '+mine.map(s=>s.name).join('、')+' → '+target.name,{toIndex:this.units.indexOf(target),ordered:mine.map(s=>this.units.indexOf(s))});u.traitAction='tech';
  }else if(action==='style_protect'){
   const guard=mine.slice().sort((a,b)=>b.hp-a.hp)[0];u.summonGuard={index:this.units.indexOf(guard),until:(u.resonanceClock||0)+2};guard.buff.defend=true;
   event(this,ev,'protect',guard.name+' · 护卫就绪，分担你的下一次直接攻击。',{guardIndex:this.units.indexOf(guard)});u.traitAction='defend';
  }else if(action==='style_fuse'){
   const source=mine.filter(x=>x.shadow&&!x.fused).slice(0,2),departed=source.map(s=>this.units.indexOf(s));
   const f=this.decorate({name:'嵌合兽·式神',side:u.side,isPlayer:false,li:u.li,summonTag:'式神',ownerName:u.name,ownerIndex:this.units.indexOf(u),fused:true,shadow:true,
    maxHp:source.reduce((n,s)=>n+s.maxHp,0),hp:source.reduce((n,s)=>n+s.hp,0),maxCp:source.reduce((n,s)=>n+s.maxCp,0),cp:source.reduce((n,s)=>n+s.cp,0),
    melee:[0,1].map(i=>source.reduce((n,s)=>n+s.melee[i],0)),eff:[0,1].map(i=>source.reduce((n,s)=>n+s.eff[i],0)),ctl:source.reduce((n,s)=>n+s.ctl,0),
    atb:Math.min(90,Math.max(...source.map(s=>s.atb))),speed:u.speed,styleSpawn:true,alive:true,flag:null,flags:[],canDomain:false,reverse:false,domainUsed:0,techName:'嵌合兽',domainName:''});
   source.forEach(s=>{s.hp=0;s.alive=false;s.summonOrder=null;});this.units.push(f);st.deployed++;
   event(this,ev,'fuse','融合 · 嵌合兽！保留现有生命，承接两只式神的力量。',{spawnIndex:this.units.indexOf(f),departed,summonFamily:'shadows'});u.traitAction='tech';
  }
  this.afterAction(u,ev);return this.pack(ev);
 };
 const strike=proto.performStrike;
 proto.performStrike=function(u,t,kind,ev){
  const start=ev.length,move=u.styleStrike,order=u.summonOrder;
  if(order&&kind==='melee')u.styleDamageBoost=order.boost;
  try{strike.call(this,u,t,kind,ev);}finally{u.styleDamageBoost=0;}
  const hits=ev.slice(start).filter(x=>x.dmg>0&&x.fromIndex===this.units.indexOf(u)&&x.toIndex===this.units.indexOf(t)&&x.attackKind===kind);
  if(u.isPlayer&&kind==='melee'){
   const s=state(u);if(hits.length){s.damage+=hits.reduce((n,x)=>n+x.dmg,0);if(move!=='burst')s.pressure=Math.min(3,s.pressure+1);}
   for(const hit of hits)if(move==='burst')hit.styleMove='burst';
   if(move==='burst'&&hits.length){const dc=window.DomainCombat,field=dc?.active(this,t);if(field){field.stability=Math.max(0,field.stability-10);if(field.stability<=0)dc.collapse(this,field,ev,'破势一击击破结界');else ev.push({type:'domain_state',domainSnapshot:dc.snapshot(this),text:'破势一击 · 对方领域稳定度额外 -10。'});}}
  }
  if(order&&hits.length)for(const hit of hits){hit.styleMove='coordinate';hit.text='协攻 · '+hit.text;}
 };
 const damage=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  if(u.styleStrike==='burst'&&kind==='melee')base*=1.65;
  if(u.styleDamageBoost&&kind==='melee')base*=u.styleDamageBoost;
  const guard=t?.isPlayer&&t.summonGuard,protector=guard&&this.units[guard.index];
  if(guard&&guard.until>(t.resonanceClock||0)&&protector?.alive&&protector.hp>0&&u.side!==t.side&&['melee','tech'].includes(kind)&&base>0&&!this.guardRedirect){
   const share=window.PlayerStyles.guardShare?.(this)||.35;
   t.summonGuard=null;state(t).intercepts++;this.guardRedirect=true;
   try{
    ev.push({type:'style',stylePhase:'intercept',from:t.name,fromIndex:this.units.indexOf(t),guardIndex:guard.index,text:protector.name+' 分担来袭的'+Math.round(share*100)+'%攻击。'});
    const begin=ev.length;damage.call(this,u,protector,base*share,mult,kind,ev,...rest);
    for(const hit of ev.slice(begin))if(hit.dmg&&hit.toIndex===guard.index)hit.attackKind='intercept';
    return damage.call(this,u,t,base*(1-share),mult,kind,ev,...rest);
   }finally{this.guardRedirect=false;}
  }
  return damage.call(this,u,t,base,mult,kind,ev,...rest);
 };
 const npc=proto.npcAct;
 function intent(e,u){
  if(window.Tactics&&e.cfg.v3){const p=window.Tactics.plan(e,u),target=window.Tactics.target(e,u,p.target);return {label:p.label,target:target?.name||'我方',targetIndex:e.units.indexOf(target),danger:!!p.danger,scope:p.scope};}
  if(!e.cfg.stylePractice)return {label:'准备行动',target:'—',danger:false};
  if(!u.practiceIntent){const t=e.player.alive?e.player:e.alive('ally')[0],tech=u.cp>=e.techCost(u)&&(u.buff.actCount||0)%3===2;u.practiceIntent={kind:tech?'tech':'melee',label:tech?u.techName:'体术攻击',target:t?.name||'我方',targetIndex:e.units.indexOf(t),danger:tech};}
  return u.practiceIntent;
 }
 proto.npcAct=function(u,ev){
  if(this.cfg.stylePractice&&u.side==='enemy'&&!u.summonTag&&!window.BattleResonance?.burnoutLeft(u)){
   const plan=intent(this,u),t=this.units[plan.targetIndex]?.alive?this.units[plan.targetIndex]:this.pickAllyTarget();u.practiceIntent=null;
   if(t){let kind=plan.kind;if(kind==='tech'){const paid=this.techCost(u);if(u.cp>=paid)u.cp-=paid;else kind='melee';}this.performStrike(u,t,kind,ev);}return;
  }
  if(!u.summonOrder){
   const owner=this.units[u.ownerIndex];
   if(u.summonTag&&owner?.isPlayer&&manualSummons(this,owner)){const target=u.side==='ally'?this.pickEnemyTarget():this.pickAllyTarget();if(target)this.performStrike(u,target,'melee',ev);return;}
   return npc.call(this,u,ev);
  }
  const order=u.summonOrder,t=this.units[order.targetIndex];
  const target=t?.alive&&t.side!==u.side?t:u.side==='ally'?this.pickEnemyTarget():this.pickAllyTarget();
  if(target)this.performStrike(u,target,'melee',ev);u.summonOrder=null;
 };
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){after.call(this,u,ev);if(u.summonTag)u.summonOrder=null;if(u.summonGuard?.until<=(u.resonanceClock||0))u.summonGuard=null;};
 const status=window.BattleTraits.status;
 window.BattleTraits.status=function(e,u){const notes=status(e,u);if(u.isPlayer){if(state(u).pressure)notes.push('势能 '+state(u).pressure+'/3');if(u.summonGuard)notes.push('召唤护卫');}if(u.summonOrder)notes.push('协攻待命');return notes;};
 window.PlayerStyles={manualSummons,family,owned,commands,state,limit,intent};
})();

/* Optional, versioned equipment lessons. Old saves begin with no certified moves. */
(() => {
 'use strict';
 const E=window.Equipment, families={practice:'blade',naginata:'pole',cloud:'chain',spear:'blade',soul:'blade'};
 const moves={blade:{label:'错步连斩',note:'消耗2格刃势 · 两次体术各×0.80，保留咒具特性'},pole:{label:'穿突压制',note:'消耗2格刃势 · 体术×1.50；目标下次行动的首次直接攻击降低20%'},chain:{label:'回旋收势',note:'消耗2格刃势 · 体术×1.50；收势进入防御，不恢复咒力'}};
 const lesson=(id,e=E.state())=>e?.training?.lessons?.[id]||{stage:0,focus:null,day:0};
 const certified=(id,e=E.state())=>lesson(id,e).stage===3;
 function validate(e,day=120){
  if(e?.training===undefined)return;
  const t=e.training;
  if(!t||t.version!==1||!t.lessons||typeof t.lessons!=='object'||Array.isArray(t.lessons)||Object.keys(t.lessons).length>5)throw Error('咒具课题数据异常');
  for(const [id,l] of Object.entries(t.lessons)){
   if(!families[id]||!e.owned.includes(id)||!l||!Number.isInteger(l.stage)||l.stage<1||l.stage>3||!Number.isInteger(l.day)||l.day<0||l.day>day||l.day>120||(l.stage===1?l.focus!==null:!['edge','flow'].includes(l.focus)))throw Error('咒具课题进度异常');
  }
 }
 function eligible(e=E.state()){
  if(!e)return null;
  const ids=[e.equipped,...e.owned].filter((id,i,a)=>families[id]&&a.indexOf(id)===i);
  return ids.find(id=>!certified(id,e))||null;
 }
 function event(id=eligible()){
  if(!id)return null;
  const tool=E.find(id),l=lesson(id),move=moves[families[id]],prefix='咒具课题 · '+tool.name;
  const change=(label,focus,desc,stat)=>({label,desc,stat,toolLesson:{id,stage:l.stage,focus}});
  const delay={label:'留待下次，稳定修炼',stat:'ctl'};
  const scenes=[
   '从自己的咒具收藏中取出这件武器，检查握柄、重心和残留的咒力。先建立正确的握持，再追求威力。',
   '将同一套动作重复到稳定。可以专注步伐与刃口，也可以练习咒力沿武器流动；两种训练都会进入最后的动作演练。',
   '从起手、命中到回收，完成一套不失去重心的动作。通过这次演练后，只有携带这件咒具时才能使用它的专属持械指令。'
  ];
  const choices=l.stage===0?[change('取出并装备咒具',null,'建立持械训练档案，装备此咒具；替换当前主武器。'),delay]:l.stage===1?[change('步伐与刃口训练','edge','进行一次体术修炼；进入动作演练。','melee'),change('咒力贯通训练','flow','进行一次咒力操控修炼；进入动作演练。','ctl')]:[change('完成 '+move.label+' 演练',l.focus,'永久解锁本件咒具的「'+move.label+'」；不叠加永久伤害。'),delay];
  return {label:prefix+' · '+['取用登记','适应训练','动作演练'][l.stage],scene:scenes[l.stage],image:'assets/events/b-v1/tool-training.png',choices};
 }
 function apply(c,day){
  if(!c?.toolLesson)return '';
  const {id,stage,focus}=c.toolLesson,e=E.state(),l=lesson(id,e);
  if(!families[id]||!e?.owned.includes(id)||l.stage!==stage||stage>=3||!Number.isInteger(day)||day<=l.day||day>120||(stage===0?focus!==null:!['edge','flow'].includes(focus)))throw Error('此课题已完成或不属于当前收藏。');
  e.training ||= {version:1,lessons:{}};
  e.training.lessons[id]={stage:stage+1,focus,day};
  if(stage===0)e.equipped=id;
  return stage===2?'动作解锁 · '+E.find(id).name+' / '+moves[families[id]].label:'咒具课题推进 · '+(stage+1)+'/3';
 }
 const old=E.validate;E.validate=function(e){old.call(this,e);validate(e);};
 const check=Campaign.validate;Campaign.validate=function(r,day,...rest){const out=check.call(this,r,day,...rest);validate(r.equipment,Number.isInteger(day)?day:120);return out;};
 const run=BattleUI.run;BattleUI.run=function(cfg){const training=E.state()?.training;return run.call(this,{...cfg,weaponTraining:training?JSON.parse(JSON.stringify(training)):null});};
 window.CursedToolTraining={families,moves,lesson,certified,eligible,event,apply,validate};
})();

/* Battle-only weapon stance and ranged concentration. All hits use existing defenses. */
(() => {
 'use strict';
 const proto=BattleEngine.prototype,PS=window.PlayerStyles,T=window.CursedToolTraining;
 const ranged=new Set(['limitless','cleave','straw','blood','construct','moon','rot','amber','cannon','fire','gu']);
 const state=u=>u.arsenal||(u.arsenal={edge:0,focus:0,weaponUses:0,charges:0,releases:0,interruptions:0});
 const family=u=>T.families[u.equipmentId]||'';
 const isRanged=u=>ranged.has(u.flag);
 const cost=(u,n)=>Math.max(1,Math.round(u.maxCp*n));
 const trained=(e,u)=>T.certified(u.equipmentId,{training:e.cfg.weaponTraining});
 const priorCommands=PS.commands;
 PS.commands=function(e){
  const rows=priorCommands(e),u=e.player,s=state(u),f=family(u),blocked=window.BattleTraits.blocked(e,u,'tech');
  const row=(id,label,cp,note,reason='')=>rows.push({id,label,cost:cp,note,reason:reason||(u.cp<cp?'咒力不足':'')});
  if(f){const m=T.moves[f];row('arsenal_weapon',m.label,cost(u,.04),m.note,window.BattleTraits.toolSealed(e,u)?'咒具被封锁':!trained(e,u)?'完成这件咒具的三步课题':s.edge<2?'刃势 '+s.edge+'/2':'');}
  if(isRanged(u)){
   row('arsenal_charge','集中蓄力',cost(u,.02),'消耗一次行动与2%咒力 · 最多2层；单次直接伤害达到12%最大生命损失1层，防御可稳住',blocked||(s.focus>=2?'已达2层':''));
   row('arsenal_release','集中施术',e.techCost(u)+cost(u,.03*s.focus),'释放当前术式 · 1层×2，2层×3；额外每层3%咒力，仍受原有防护与单击上限',blocked||(!s.focus?'先集中蓄力':''));
  }
  return rows;
 };
 function style(e,ev,phase,text){ev.push({type:'style',stylePhase:phase,from:e.player.name,fromIndex:e.units.indexOf(e.player),text});}
 const act=proto.playerAct;
 proto.playerAct=function(action,targetIndex){
  if(!action.startsWith('arsenal_')){
   const packet=act.call(this,action,targetIndex);
   if(!packet.retryInput&&['melee','tech','domain','ult','style_burst'].includes(action))state(this.player).focus=0;
   return packet;
  }
  const u=this.player,s=state(u),command=PS.commands(this).find(c=>c.id===action),ev=[];
  const retry=reason=>({events:[{type:'info',text:reason}],ended:this.ended,result:this.result,needInput:this.awaitingPlayer,retryInput:true});
  if(!this.awaitingPlayer||this.ended||this.pendingDomain||!u.alive)return retry('等待你的行动。');
  if(!command||command.reason)return retry(command?.reason||'此指令不属于当前人物。');
  const target=this.units[targetIndex]?.alive&&this.units[targetIndex].side!==u.side?this.units[targetIndex]:this.pickEnemyTarget();
  if(!target)return retry('没有可攻击的目标。');
  this.awaitingPlayer=false;u.cp-=command.cost;
  if(action==='arsenal_charge'){
   s.focus++;s.charges++;u.traitAction='tech';style(this,ev,'charge','咒力集中 · '+s.focus+'/2');
  }else{
   const start=ev.length,weapon=action==='arsenal_weapon',f=family(u),level=s.focus;
   u.arsenalMove=weapon?f:'charged';u.arsenalPower=weapon?(f==='blade'?.8:1.5):1+level;u.traitAction=weapon?'melee':'tech';
   if(weapon){s.edge=0;s.focus=0;s.weaponUses++;style(this,ev,'weapon-ready',T.moves[f].label+'！');}
   else{s.focus=0;s.releases++;style(this,ev,'release','集中施术 · '+u.techName+' / '+level+'层');}
   try{
    this.performStrike(u,target,weapon?'melee':'tech',ev);
    if(weapon&&f==='blade'&&target.alive&&u.alive)this.performStrike(u,target,'melee',ev);
   }finally{u.arsenalMove='';u.arsenalPower=0;}
   const hits=ev.slice(start).filter(x=>x.dmg>0&&x.fromIndex===this.units.indexOf(u)&&x.attackKind===(weapon?'melee':'tech'));
   hits.forEach((hit,i)=>{hit.styleMove=weapon?'weapon-'+f:'charged';hit.chargeLevel=weapon?0:level;hit.comboIndex=i;hit.text=(weapon?T.moves[f].label:'集中施术')+' · '+hit.text;});
   if(weapon&&hits.length&&f==='pole')target.weaponSuppressed=true;
   if(weapon&&f==='chain')u.buff.defend=true;
  }
  this.afterAction(u,ev);return this.pack(ev);
 };
 const strike=proto.performStrike;
 proto.performStrike=function(u,t,kind,ev){
  const start=ev.length;strike.call(this,u,t,kind,ev);
  if(u.isPlayer&&family(u)&&!window.BattleTraits.toolSealed(this,u)&&kind==='melee'&&!u.arsenalMove&&ev.slice(start).some(x=>x.dmg>0&&x.attackKind==='melee'&&x.fromIndex===this.units.indexOf(u)))state(u).edge=Math.min(2,state(u).edge+1);
 };
 const damage=proto.dealDamage;
 proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  if(u.arsenalPower&&['melee','tech'].includes(kind))base*=u.arsenalPower;
  if(u.weaponSuppressed&&u.side!==t.side&&['melee','tech'].includes(kind)&&base>0){base*=.8;u.weaponSuppressed=false;}
  const start=ev.length,result=damage.call(this,u,t,base,mult,kind,ev,...rest);
  if(t.isPlayer&&!t.buff.defend&&state(t).focus&&u.side!==t.side&&['melee','tech'].includes(kind)&&ev.slice(start).some(x=>x.dmg>=t.maxHp*.12&&x.toIndex===this.units.indexOf(t)&&x.attackKind===kind)){
   const s=state(t);s.focus--;s.interruptions++;ev.push({type:'info',text:'蓄力被命中打断 · 剩余 '+s.focus+' 层。'});
  }
  return result;
 };
 const turn=proto.onTurnStart;
 proto.onTurnStart=function(u,ev){turn.call(this,u,ev);if(u.isPlayer&&state(u).focus&&window.BattleTraits.blocked(this,u,'tech')){state(u).focus=0;ev.push({type:'info',text:'术式无法维持，蓄力解除。'});}};
 const after=proto.afterAction;
 proto.afterAction=function(u,ev){after.call(this,u,ev);u.weaponSuppressed=false;};
 const notes=window.BattleTraits.status;
 window.BattleTraits.status=function(e,u){const rows=notes(e,u);if(u.isPlayer){const s=state(u);if(family(u))rows.push('刃势 '+s.edge+'/2');if(s.focus)rows.push('蓄力 '+s.focus+'/2');}if(u.weaponSuppressed)rows.push('下次直接攻击 -20%');return rows;};
 function summary(e){const u=e.player,s=state(u),f=family(u);return (f?'刃势 '+s.edge+'/2 · '+(trained(e,u)?T.moves[f].label:'咒具课题未完成'):'')+(isRanged(u)?(f?' / ':'')+'蓄力 '+s.focus+'/2':'');}
 window.PlayerArsenal={state,family,isRanged,trained,summary};
})();

/* All 36 draw identities; mechanics below are game adaptations, not canon claims. */
(() => {
 'use strict';
 const groups={
  contact:{name:'弱点与连击',lesson:'在命中、标记与下一次出手之间找到衔接；练习连击，或把机会留给持械重击。'},
  control:{name:'控制与节奏',lesson:'复盘控制成功后的窗口。选择节省控制消耗，或抓住对手受扰时的进攻机会。'},
  toxin:{name:'毒蚀与消耗',lesson:'观察侵蚀积累的过程。选择消耗已有积累进行爆发，或利用侵蚀掩护恢复。'},
  sacrifice:{name:'生命与爆发',lesson:'记录每次出手的生命代价。选择命中后缓慢回补，或承担更高风险换取低血量爆发。'},
  cast:{name:'施术与爆发',lesson:'调整连续施术和集中输出的节奏。选择资源循环，或用蓄力命中干扰结界。'},
  guard:{name:'防护与反制',lesson:'防护并不等于拥有原作人物的全部配置。选择守势施术，或承受攻击后反攻。'},
  recovery:{name:'恢复与续航',lesson:'把恢复转化为出手机会，或将防御留给资源回补；恢复满额时不会凭空产生收益。'},
  conditional:{name:'条件克制',lesson:'识别术式的有效对象。选择抓住克制优势，或练习面对非优势目标时的资源管理。'},
  hybrid:{name:'近战与施术交替',lesson:'用体术与施术交替推进压制。选择交替衔接，或用持续接触攻击积累节奏。'},
  acquire:{name:'能力与配合',lesson:'研究获得的能力与自身出手节奏。选择有限借用与交替衔接，或稳住资源。'},
  summon:{name:'召唤与调度',lesson:'复盘实体单位的出手、牵制和护卫，让你自己的行动与它们形成配合。'},
  burst:{name:'速度与限时爆发',lesson:'计算有限爆发窗口内的行动顺序。选择连续命中节奏，或推进自己的下次出手。'}
 };
 const rows=[
  ['limitless','guard','无穷阻挡普通攻击，按操控支付维持；玩家没有自动获得六眼。','维持与反攻','守势施术','空间扭曲／防护波纹'],
  ['shadows','summon','玩家主动显现、协攻、护卫和融合；NPC保留自动召唤。','追击调度','护卫接力','玉犬／鵺／脱兔／贯牛实体动作'],
  ['cleave','cast','御厨子四式按行动计数轮换，领域保留连续斩击与开放结界特性。','连式回路','聚能破界','斩线／火焰；招式预告'],
  ['straw','contact','命中留钉，术式再次命中触发共鸣；近战有附伤。','标记追打','交替衔接','钉印／共鸣脉冲'],
  ['ratio','contact','体术增伤、弱点标记及接触黑闪节奏。','标记追打','接触节奏','弱点刻线／持械命中'],
  ['cursedSpeech','control','支付随目标实力增加的额外咒力，压制目标一次行动。','控后追打','命令回路','文字震波／控制提示'],
  ['spiritControl','summon','收录击败目标的固定面板，玩家主动召回并指挥。','收集与协攻','护卫接力','已收录实体图集；缺口需另补'],
  ['idleTrans','hybrid','近战与术式互有附伤，恢复生命；术式命中附灵魂扰动。','交替衔接','接触节奏','灵魂波纹／变形命中'],
  ['swap','control','按操控差概率闪避；术式命中扰乱目标下次攻击，不是永久闪避。','控后追打','命令回路','换位闪迹／扰乱标记'],
  ['blood','sacrifice','术式输出强化并消耗生命，需管理生命与咒力。','血偿回补','险势爆发','血线／穿血轨迹'],
  ['crows','summon','入场三只实体乌鸦，可使用协攻与护卫。','鸟群追击','鸟群护卫','乌鸦飞行／鸟击'],
  ['projection','control','低单击输出、高行动频率；术式定帧有目标冷却。','控后追打','命令回路','定帧残影／帧格'],
  ['construct','cast','原有施术增幅；造物专精可选择刃阵或护甲，均消耗玩家行动。','造物适配','连式回路','复用聚能；独立造物图待制作'],
  ['puppet','summon','实体傀儡、主动补充、护卫与炮击指令。','炮击回路','护卫接力','机械攻击／炮击'],
  ['moon','toxin','实际命中叠毒，毒在目标行动前结算。','侵蚀引爆','毒蚀掩护','毒雾／层数提示'],
  ['rot','toxin','命中腐蚀本场生命上限，不写回敌人永久面板。','侵蚀引爆','毒蚀掩护','腐蚀斑纹／上限缩减'],
  ['miracle','recovery','致命直接伤害时检查咒力，满足代价才能恢复；并非无条件不死。','复原追击','续航储备','复原光／资源消耗'],
  ['jacob','conditional','受肉对象概率剥离；其他对象为真实伤害与易伤，属于游戏改编。','识别追击','应变施术','圣光柱／易伤标记'],
  ['amber','sacrifice','燃烧生命追加输出，爆发需承担自损。','血偿回补','险势爆发','雷击／燃命光'],
  ['judge','conditional','式神处刑、其他对象真实伤害；领域为简化没收规则。','识别追击','应变施术','判决／没收提示'],
  ['cannon','cast','术式输出强化，支持集中蓄力与重击打断。','连式回路','聚能破界','聚能炮／命中爆光'],
  ['mass','sacrifice','术式命中后全体追加真实伤害并损失自身当前生命；不再自动同归于尽。','血偿回补','险势爆发','重力冲击／地面震波'],
  ['arms','contact','近战附加术式效率伤害。','交替衔接','接触节奏','多臂追打；专属动作待补'],
  ['tsukumo','burst','速度增加，角色还是随机玩家。','接触节奏','抢势出手','行动残影／速度提示'],
  ['seance','summon','以已击败目标面板召回亡灵单位，主动选择与指挥。','收集与追击','亡灵护卫','召回实体；缺口需另补'],
  ['sky','guard','阻挡近战，不能因此阻挡全部施术与领域。','守势施术','防护反攻','空间折射／近战偏折'],
  ['grow','recovery','自身行动恢复生命与咒力，术式命中吸取咒力。','复原追击','续航储备','生长光／吸取流线'],
  ['fire','cast','近战有火焰附伤，可投资近战或集中施术。','交替衔接','聚能破界','火焰挥击／爆燃'],
  ['gu','toxin','命中叠蛊毒，目标行动前结算。','侵蚀引爆','毒蚀掩护','蛊毒符纹／层数提示'],
  ['copy','acquire','保留队友协同增伤；借式专精可选择在场同伴的一种受支持能力，用于下一次施术。','借式研习','交替衔接','复用被借能力命中特效；借式提示'],
  ['negate','conditional','对咒力上限较低目标真实伤害并追加消耗，不是无条件秒杀。','识别追击','应变施术','否定波／条件提示'],
  ['requiem','guard','非领域减伤和领域增幅，不是全部伤害无效。','守势施术','防护反攻','归零波纹／减伤提示'],
  ['kaioken','sacrifice','临时强化并在自身行动后损失生命。','血偿回补','险势爆发','爆气／反噬提示'],
  ['ssj','burst','前五次攻击有变身强化，结束恢复常态；保留扩展术式。','接触节奏','抢势出手','变身光焰；独立造型待补'],
  ['sage','recovery','自身行动恢复生命，属于保留的扩展术式。','复原追击','续航储备','恢复光／状态提示'],
  ['reviveWin','acquire','首次倒下恢复部分生命咒力并夺取能力，战斗继续；不再倒下即胜。','应变施术','接触节奏','替死演出／夺式提示']
 ];
 const catalog=Object.fromEntries(rows.map(([flag,group,current,a,b,art])=>[flag,{flag,group,current,routes:[a,b],art}]));
 const talent=(id,name,tags,note)=>({id,name,family:'technique',tags,note});
 const talents=[
  talent('weakFollow','标记追打',['contact'],'命中带弱点或自己共鸣钉的目标后，自身行动值+12；每次自身行动最多一次。'),
  talent('cadence','接触节奏',['contact','hybrid','burst','acquire'],'实际近身命中累计三次，恢复3%最大咒力；同一次行动的多段命中只计一次。'),
  talent('controlFollow','控后追打',['control'],'命中受眩晕、交换扰乱或定帧冷却影响的目标，行动值后退12；每次自身行动一次。'),
  talent('controlFlow','命令回路',['control'],'术式实际命中并成功留下控制或扰乱后，返还基础术式消耗25%；不返还额外控制代价，每次自身行动一次。'),
  talent('toxicBurst','侵蚀引爆',['toxin'],'术式命中已有毒素、蛊毒或本场腐蚀的目标，伤害+25%；命中消耗一层蛊毒或毒素，腐蚀不回退。每次自身行动一次。'),
  talent('toxicCover','毒蚀掩护',['toxin'],'防御时若目标已有毒蚀，恢复3%最大生命并令其行动值后退10；占用本次行动。'),
  talent('bloodRecovery','血偿回补',['sacrifice'],'术式实际命中后，存活的你恢复4%最大生命；不抵消原有自损，不复活，每次自身行动一次。'),
  talent('bloodEdge','险势爆发',['sacrifice'],'生命不高于50%时直接输出+20%，承受直接伤害也+10%；不强化领域必中。'),
  talent('castChain','连式回路',['cast'],'两次自身行动内连续术式命中，第二次返还基础消耗25%；一次行动只计一次，改用体术或防御中断衔接。'),
  talent('castBreak','聚能破界',['cast'],'集中施术实际命中领域施术者，额外削减6稳定度；每次自身行动一次，不赠送蓄力能力。'),
  talent('guardCast','守势施术',['guard'],'防御准备下一次术式实际命中，使自己行动值+12；占用行动，不因免疫攻击白赚反击。'),
  talent('guardRiposte','防护反攻',['guard'],'防御期间承受实际直接伤害后，下一次术式命中伤害+20%；只触发一次，领域伤害不准备反攻。'),
  talent('healFollow','复原追击',['recovery'],'自身行动开始时实际恢复了生命，准备下一次直接命中推进自己行动值12；满血不触发。'),
  talent('healReserve','续航储备',['recovery'],'防御额外恢复3%最大咒力；不免费复活，不改变原有恢复代价。'),
  talent('typeFollow','识别追击',['conditional'],'雅各布对受肉目标、判决对式神、拒绝对低咒力上限目标，实际命中后自身行动值+12；每次自身行动一次。'),
  talent('adaptCast','应变施术',['conditional','acquire'],'术式实际命中返还基础消耗15%；不返还判决、剥离或拒绝的额外代价，每次自身行动一次。'),
  talent('alternation','交替衔接',['contact','hybrid','cast','acquire'],'体术和术式交替实际命中，后一次伤害+12%；一次行动只记录一种，不强化领域或追加伤害。'),
  talent('tempo','抢势出手',['burst'],'直接攻击实际命中推进自己行动值12；每次自身行动一次，不凭空增加额外攻击。'),
  {id:'constructKit',name:'造物适配',family:'technique',flags:['construct'],note:'解锁刃阵／护甲二选一造物指令，各花一次行动与6%咒力；刃阵强化两次近战，护甲减轻两次直接受击，不能叠加。'},
  {id:'copyStudy',name:'借式研习',family:'technique',flags:['copy'],note:'消耗一次行动和6%咒力，选择在场同伴的受支持能力，下一次施术临时借用；不保存为永久术式，不复制领域或被动无敌。'}
 ];
 const entry=p=>catalog[p?.technique?.flag||p?.flag];
 const compatible=(t,p)=>!!entry(p)&&(t.flags?t.flags.includes(p.technique?.flag||p.flag):t.tags?.includes(entry(p).group));
 const current=p=>entry(p)?.current||'';
 const lesson=p=>groups[entry(p)?.group]?.lesson||'';
 const raw=techniqueDescription;techniqueDescription=function(t){return catalog[t?.flag]?catalog[t.flag].current+(t.domain?' 当前游戏领域：'+t.domain+'。':''):raw(t);};
 window.TechniqueBuilds={catalog,groups,talents,entry,compatible,current,lesson};
})();

/* Optional run progression; no named character replaces the randomized player. */
(() => {
 'use strict';
 const talents=[
  {id:'pursuit',name:'召唤追击',family:'summon',note:'自己的召唤物实际命中留下追击窗口；你的下一次直接命中使目标行动值后退18。窗口保留至两次自身行动。'},
  {id:'shelter',name:'护卫接力',family:'summon',note:'护卫指令分担比例由35%提高到50%；仍只分担一次直接攻击，不能挡领域必中。'},
  {id:'relay',name:'影之调度',family:'shadows',note:'协攻推进自己的式神行动值60，而非40；每只式神仍需等到自己的行动。'},
  {id:'battery',name:'炮击回路',family:'puppet',note:'傀儡默认使用耗咒力炮击。实际炮击命中补回你2%咒力，每次自身行动之间最多4%。'},
  {id:'counter',name:'守势反击',family:'any',note:'防御期间承受实际直接伤害后，下一次体术命中推进自己行动值20；只能触发一次。'},
  {id:'flow',name:'收束回路',family:'any',note:'防御准备下一次施术：实际术式命中返还该次基础术式消耗的25%（向上取整），只返还一次。'},
  {id:'blade',name:'持械压制',family:'any',note:'装备咒具时，专属持械招式第一次实际命中令目标行动值后退15；仍需完成咒具课题。'},
  {id:'focus',name:'聚能压制',family:'ranged',note:'集中施术第一次实际命中令目标行动值后退20；不会凭空获得蓄力或黑闪。'}
 ].concat(window.TechniqueBuilds?.talents||[]);
 const vows={none:{name:'不立束缚',note:'保持正常消耗与防护。'},rush:{name:'舍守求攻',note:'你的直接攻击伤害+15%，承受的直接攻击伤害也+15%；不影响领域必中。'},reserve:{name:'节律回补',note:'你的基础术式消耗+20%；防御额外恢复4%最大咒力。'}};
 const domains={balanced:{name:'均衡',note:'保留当前领域规则。'},anchor:{name:'稳守结界',note:'自身领域维持时，承受直接攻击-15%，自身直接输出-10%。'},pressure:{name:'加压对攻',note:'维持时额外消耗2%最大咒力；每次自身行动对攻额外削减对方4稳定度。'},escort:{name:'协同争夺',note:'维持时额外消耗2%最大咒力；自己的召唤物实际命中对方施术者削减3稳定度，每次自身行动之间最多6。'}};
 const fresh=()=>({version:1,stage:0,lastDay:0,retrains:2,unlocked:[],equipped:[],vow:'none',domain:'balanced'});
 const state=()=>Campaign.state?.build||fresh();
 const family=p=>window.PlayerStyles.family({flag:p?.technique?.flag,flags:p?.technique?.flags||[]});
 const compatible=(t,p)=>!!t&&(t.family==='any'||t.family==='technique'&&window.TechniqueBuilds.compatible(t,p)||t.family==='summon'&&!!family(p)||t.family===family(p)||t.family==='ranged'&&window.PlayerArsenal.isRanged({flag:p?.technique?.flag}));
 function validate(b,day=120,p=null){
  if(b===undefined)return;
  if(b.rewardDays!==undefined&&(!Array.isArray(b.rewardDays)||b.rewardDays.length>120||new Set(b.rewardDays).size!==b.rewardDays.length||b.rewardDays.some(d=>!Number.isInteger(d)||d<1||d>day)))throw Error('战后构筑领取记录异常');
  if(!b||b.version!==1||!Number.isInteger(b.stage)||b.stage<0||b.stage>120||!Number.isInteger(b.lastDay)||b.lastDay<0||b.lastDay>day||b.stage>b.lastDay||!Number.isInteger(b.retrains)||b.retrains<0||b.retrains>8||!Array.isArray(b.unlocked)||b.unlocked.length>talents.length||new Set(b.unlocked).size!==b.unlocked.length||b.unlocked.some(id=>!talents.some(t=>t.id===id))||!Array.isArray(b.equipped)||b.equipped.length>2||new Set(b.equipped).size!==b.equipped.length||b.equipped.some(id=>!b.unlocked.includes(id)||p&&!compatible(talents.find(t=>t.id===id),p))||!Object.hasOwn(vows,b.vow)||!Object.hasOwn(domains,b.domain)||(b.stage<3&&(b.vow!=='none'||b.domain!=='balanced'))||(p&&b.domain==='escort'&&!family(p)))throw Error('构筑数据或专精条件异常');
 }
 const copy=b=>JSON.parse(JSON.stringify(b));
 const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
 function offers(b=state(),p=Game.player,day=Game.day+1){
  if(b.stage===2)return Object.entries(domains).filter(([id])=>id!=='balanced'&&(id!=='escort'||family(p))).map(([id,d])=>({label:d.name,desc:d.note,buildLesson:{stage:b.stage,kind:'domain',id}})).concat([{label:'保持均衡，增加一次重训',desc:'不改变领域规则，重训次数+1。',buildLesson:{stage:b.stage,kind:'domain',id:'balanced'}}]).slice(0,3);
  const pool=talents.filter(t=>compatible(t,p)&&!b.unlocked.includes(t.id));
  const relevant=pool.filter(t=>!['any'].includes(t.family)),general=pool.filter(t=>t.family==='any');
  const rotate=a=>a.length?a.slice(hash(`${Campaign.state?.eventSeed||0}:${day}:${b.stage}`)%a.length).concat(a.slice(0,hash(`${Campaign.state?.eventSeed||0}:${day}:${b.stage}`)%a.length)):[];
  const ordered=[...rotate(relevant).slice(0,1),...rotate(general).slice(0,1),...rotate(relevant).slice(1),...rotate(general).slice(1)];
  const choices=ordered.slice(0,b.retrains===0?2:3).map(t=>({label:'掌握 · '+t.name,desc:t.note+' 未满两槽时自动装备；槽满后进入已掌握列表。',buildLesson:{stage:b.stage,kind:'talent',id:t.id}}));
  if(choices.length<3)choices.push({label:'复盘与重训',desc:'完成一次咒力操控修炼，重训次数+1，最多8次。',stat:'ctl',buildLesson:{stage:b.stage,kind:'retrain',id:'retrain'}});
  for(const [stat,label] of [['melee','稳固体术节奏'],['eff','稳固术式输出']])if(choices.length<3)choices.push({label,desc:'进行一次基础修炼，保留现有专精搭配。',stat,buildLesson:{stage:b.stage,kind:'train',id:stat}});
  return choices;
 }
 function event(){const b=state(),p=Game.player;return {label:p.technique.name+' · '+(b.stage<3?['找到出手节奏','补足另一种应对','确定领域与束缚方向'][b.stage]:'构筑进修'),scene:(window.TechniqueBuilds?.lesson(p)||'围绕你自己的术式复盘实战。')+' 选择改变配合，不替换你的随机人物。'+(b.stage===2?'此课只确定领域方向；仍需按原规则领悟领域后才能展开。':''),image:'assets/events/b-v1/tool-training.png',choices:offers()};}
 function apply(c,day){
  const b=state(),x=c?.buildLesson;
  if(!x||day!==Game.day||day<=b.lastDay||day>120||x.stage!==b.stage||!offers(b,Game.player,day).some(o=>o.buildLesson.kind===x.kind&&o.buildLesson.id===x.id))throw Error('此课题已经结算或不适合当前人物。');
  const next=copy(b);
  if(x.kind==='talent'){next.unlocked.push(x.id);if(next.equipped.length<2)next.equipped.push(x.id);}
  else if(x.kind==='domain')next.domain=x.id;
  if(x.kind==='retrain'||x.kind==='domain'&&x.id==='balanced')next.retrains=Math.min(8,next.retrains+1);
  next.stage++;next.lastDay=day;validate(next,day,Game.player);Campaign.state.build=next;
  return x.kind==='talent'?'专精掌握 · '+talents.find(t=>t.id===x.id).name:x.kind==='domain'?'领域方向 · '+domains[x.id].name:x.kind==='retrain'?'重训机会 +1':'保留构筑，完成基础修炼。';
 }
 function equip(ids,vow,domain){
  if(window.Equipment.blocked())throw Error('请在每日行动结束后调整构筑。');
  const old=Campaign.state.build,next=copy(state());next.equipped=ids.slice();next.vow=vow;next.domain=domain;validate(next,Game.day,Game.player);
  const changed=JSON.stringify([...next.equipped].sort())!==JSON.stringify([...state().equipped].sort())||vow!==state().vow||domain!==state().domain;
  if(!changed)return;
  if(next.retrains<=0)throw Error('重训次数不足；安排构筑课题可补充。');next.retrains--;
  Campaign.state.build=next;if(!Save.checkpoint()){if(old===undefined)delete Campaign.state.build;else Campaign.state.build=old;throw Error('保存失败，构筑未改变。');}Game.render();
 }
 function rewardOffers(day=Game.day,p=Game.player){return offers({...state(),stage:state().stage+120},p,day);}
 function claimReward(choice,day=Game.day){
  const b=state(),x=choice?.buildLesson;
  if(day!==Game.day||!Number.isInteger(day)||day<1||day>120||(b.rewardDays||[]).includes(day)||!x||!rewardOffers(day).some(c=>c.buildLesson.kind===x.kind&&c.buildLesson.id===x.id))throw Error('本日战后奖励已领取或选项不适用。');
  const next=copy(b);next.rewardDays=[...(b.rewardDays||[]),day];
  if(x.kind==='talent'){next.unlocked.push(x.id);if(next.equipped.length<2)next.equipped.push(x.id);}
  else if(x.kind==='retrain')next.retrains=Math.min(8,next.retrains+1);
  validate(next,day,Game.player);Campaign.state.build=next;
  return x.kind==='talent'?'战后掌握 · '+talents.find(t=>t.id===x.id).name:x.kind==='retrain'?'战后复盘 · 重训机会 +1':'战后基础训练';
 }
 const presets={
  hunter:{name:'十影 · 追击调度',flag:'shadows',ids:['pursuit','relay'],vow:'rush',domain:'escort'},
  keeper:{name:'十影 · 护卫反击',flag:'shadows',ids:['shelter','counter'],vow:'none',domain:'anchor'},
  artillery:{name:'傀儡 · 炮击连携',flag:'puppet',ids:['battery','pursuit'],vow:'reserve',domain:'escort'},
  fortress:{name:'傀儡 · 护卫反击',flag:'puppet',ids:['shelter','counter'],vow:'none',domain:'anchor'},
  counter:{name:'通用 · 守势施术',ids:['counter','flow'],vow:'reserve',domain:'anchor'},
  ratio:{name:'十划 · 弱点连击',flag:'ratio',ids:['weakFollow','cadence'],vow:'none',domain:'balanced'},
  resonance:{name:'刍灵 · 共鸣衔接',flag:'straw',ids:['weakFollow','alternation'],vow:'none',domain:'pressure'},
  control:{name:'咒言 · 控后追打',flag:'cursedSpeech',ids:['controlFollow','controlFlow'],vow:'reserve',domain:'balanced'},
  toxin:{name:'淀月 · 毒蚀攻守',flag:'moon',ids:['toxicBurst','toxicCover'],vow:'none',domain:'anchor'},
  blood:{name:'赤血 · 血偿爆发',flag:'blood',ids:['bloodRecovery','bloodEdge'],vow:'none',domain:'balanced'},
  cannon:{name:'大炮 · 聚能破界',flag:'cannon',ids:['castChain','castBreak'],vow:'reserve',domain:'pressure'},
  barrier:{name:'无下限 · 守势反攻',flag:'limitless',ids:['guardCast','guardRiposte'],vow:'none',domain:'anchor'},
  renewal:{name:'生长 · 复原追击',flag:'grow',ids:['healFollow','healReserve'],vow:'none',domain:'anchor'},
  judge:{name:'判决 · 识别应变',flag:'judge',ids:['typeFollow','adaptCast'],vow:'none',domain:'balanced'},
  hybrid:{name:'无为 · 交替衔接',flag:'idleTrans',ids:['alternation','cadence'],vow:'none',domain:'balanced'},
  construction:{name:'构筑 · 造物适配',flag:'construct',ids:['constructKit','castChain'],vow:'reserve',domain:'balanced'},
  copy:{name:'复制 · 借式研习',flag:'copy',ids:['copyStudy','alternation'],vow:'none',domain:'balanced'},
  speed:{name:'付丧 · 抢势节奏',flag:'tsukumo',ids:['tempo','cadence'],vow:'none',domain:'balanced'}
 };
 function sample(id,p){const s=presets[id];if(!s||s.flag&&s.flag!==p.technique.flag)return fresh();return {...fresh(),stage:3,lastDay:3,unlocked:s.ids.slice(),equipped:s.ids.slice(),vow:s.vow,domain:s.domain};}
 function summary(b){return (b.equipped.map(id=>talents.find(t=>t.id===id)?.name).join(' ＋ ')||'尚未装备专精')+' / '+vows[b.vow].name+' / '+domains[b.domain].name;}
 const oldFresh=Campaign.fresh;Campaign.fresh=function(...a){return {...oldFresh.apply(this,a),build:fresh()};};
 const oldCheck=Campaign.validate;Campaign.validate=function(r,day,...a){const result=oldCheck.call(this,r,day,...a);validate(r.build,Number.isInteger(day)?day:120);return result;};
 if(Save.validate){const check=Save.validate;Save.validate=function(s){const r=check.call(this,s);if(s.phase!=='create')validate(s.run?.build,s.day,s.player);return r;};}
 const run=BattleUI.run;BattleUI.run=function(cfg){return run.call(this,{...cfg,playerBuild:copy(state())});};
 window.PlayerBuild={talents,vows,domains,fresh,state,family,compatible,validate,offers,event,apply,equip,rewardOffers,claimReward,presets,sample,summary};
})();

/* Real engine hooks. Build state is copied into a battle, resources never persist. */
(() => {
 'use strict';
 const B=window.PlayerBuild,PS=window.PlayerStyles,DC=window.DomainCombat,proto=BattleEngine.prototype;
 const config=e=>e.cfg.playerBuild||B.fresh();
 const has=(e,id)=>config(e).equipped.includes(id);
 const clock=e=>e.player.resonanceClock||0;
 const state=e=>e.buildBattle||(e.buildBattle={riposte:false,flow:false,returned:0,erosion:0,followups:0,counters:0,returnedTotal:0});
 const mine=(e,u)=>!!u.summonTag&&u.ownerIndex===e.units.indexOf(e.player)&&u.side===e.player.side;
 const say=(ev,text)=>ev.push({type:'skill',text});
 const role=u=>/脱兔/.test(u.name)?'rabbit':/鵺/.test(u.name)?'nue':/贯牛/.test(u.name)?'ox':/玉犬/.test(u.name)?'dog':/傀儡/.test(u.name)?'puppet':'';
 PS.guardShare=(e)=>has(e,'shelter')?.50:.35;
 const commands=PS.commands;PS.commands=function(e){
  const rows=commands(e),f=PS.family(e.player),blocked=window.BattleTraits.blocked(e,e.player,'tech');
  for(const r of rows){
   const summonNotes={'style_deploy:dog':'近身追击 · 实际命中可以衔接玩家追击专精','style_deploy:rabbit':'掩护牵制 · 每次自身行动耗自身5%咒力，目标行动值-10，不造成伤害','style_deploy:nue':'空中电击 · 自身5%咒力，真实术式攻击；咒力不足改为近身攻击','style_deploy:ox':'先用一次自身行动蓄势，再以×1.80基础体术冲撞'};
   if(summonNotes[r.id])r.note=summonNotes[r.id];
   if(r.id==='style_protect'&&has(e,'shelter'))r.note=r.note.replace('35%','50%');
   if(r.id==='style_coordinate'){r.note=f==='shadows'?'锁定目标 · 式神行动值+'+(has(e,'relay')?60:40)+'；玉犬追击、脱兔牵制、鵺电击、贯牛蓄势，攻击仍由式神自身回合结算。':r.note;}
  }
  if(f==='puppet'){
   const cp=Math.max(1,Math.round(e.player.maxCp*.06));rows.push({id:'build_barrage',label:'炮击指令',cost:cp,note:'消耗一次玩家行动；傀儡行动值+25，下次自身行动耗自身5%咒力进行炮击。',reason:blocked||(!PS.owned(e).length?'先显现傀儡':e.player.cp<cp?'咒力不足':'')});
  }
  return rows;
 };
 const act=proto.playerAct;proto.playerAct=function(action,targetIndex){
  this.player.buildArsenalProc=false;
  if(action==='build_barrage'){
   const row=PS.commands(this).find(r=>r.id===action),ev=[],u=this.player;
   if(!this.awaitingPlayer||this.pendingDomain||this.ended||!u.alive||!row||row.reason)return {events:[{type:'info',text:row?.reason||'等待你的行动。'}],retryInput:true,ended:this.ended,needInput:this.awaitingPlayer};
   const t=this.units[targetIndex]?.alive&&this.units[targetIndex].side!==u.side?this.units[targetIndex]:this.pickEnemyTarget();if(!t)return {events:[],retryInput:true,needInput:true};
   this.awaitingPlayer=false;u.cp-=row.cost;u.traitAction='tech';PS.state(u).orders++;
   const sums=PS.owned(this);for(const s of sums){s.summonOrder={targetIndex:this.units.indexOf(t),boost:1.15,ability:'cannon'};s.atb=Math.min(99,s.atb+25);}
   ev.push({type:'style',stylePhase:'coordinate',from:u.name,fromIndex:0,toIndex:this.units.indexOf(t),ordered:sums.map(s=>this.units.indexOf(s)),text:'炮击待命 · '+sums.map(s=>s.name).join('、')});this.afterAction(u,ev);return this.pack(ev);
  }
  const packet=act.call(this,action,targetIndex);
  if(!packet.retryInput&&action==='defend'){
   if(has(this,'flow'))state(this).flow=true;
   if(config(this).vow==='reserve'){const n=Math.min(this.player.maxCp-this.player.cp,Math.round(this.player.maxCp*.04));this.player.cp+=n;say(packet.events,'节律回补 · 额外恢复 '+n+' 咒力。');}
  }
  if(!packet.retryInput&&action==='style_coordinate'&&has(this,'relay'))for(const s of PS.owned(this))if(s.summonOrder)s.atb=Math.min(99,s.atb+20);
  return packet;
 };
 const techCost=proto.techCost;proto.techCost=function(u){const n=techCost.call(this,u);return u.isPlayer&&config(this).vow==='reserve'?Math.ceil(n*1.2):n;};
 const damage=proto.dealDamage;proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  const direct=['melee','tech'].includes(kind),c=config(this),s=state(this),first=u.buildStrikeUsed!==true;
  if(direct){
   if(u.isPlayer&&c.vow==='rush')base*=1.15;if(t.isPlayer&&c.vow==='rush')base*=1.15;
   if(c.domain==='anchor'&&DC.active(this,this.player)){if(t.isPlayer)base*=.85;if(u.isPlayer)base*=.9;}
   if(u.buildPower)base*=u.buildPower;
  }
  const result=damage.call(this,u,t,base,mult,kind,ev,...rest);
  if(result>0&&direct){
   if(t.isPlayer&&t.buff.defend&&u.side!==t.side&&has(this,'counter'))s.riposte=true;
   if(mine(this,u)&&has(this,'pursuit')){t.buildOpening={owner:0,until:clock(this)+2};say(ev,u.name+' 创造了追击窗口 · 你的下一次命中可牵制 '+t.name+'。');}
   if(u.isPlayer&&t.buildOpening?.until>clock(this)&&has(this,'pursuit')){delete t.buildOpening;s.followups++;t.atb=Math.max(0,t.atb-18);say(ev,'召唤追击 · '+t.name+' 行动值 -18。');}
   if(u.isPlayer&&kind==='melee'&&s.riposte&&has(this,'counter')){s.riposte=false;s.counters++;u.atb=Math.min(99,u.atb+20);say(ev,'守势反击 · 你的行动值 +20。');}
   if(u.isPlayer&&kind==='tech'&&s.flow&&has(this,'flow')){s.flow=false;const n=Math.min(u.maxCp-u.cp,Math.ceil(this.techCost(u)*.25));u.cp+=n;say(ev,'收束回路 · 命中后返还 '+n+' 咒力。');}
   if(u.isPlayer&&first&&!u.buildArsenalProc&&u.arsenalMove&&has(this,u.arsenalMove==='charged'?'focus':'blade')){u.buildArsenalProc=true;const n=u.arsenalMove==='charged'?20:15;t.atb=Math.max(0,t.atb-n);say(ev,'构筑压制 · '+t.name+' 行动值 -'+n+'。');}
   if(mine(this,u)&&u.buildAbility==='cannon'&&has(this,'battery')){const n=Math.min(this.player.maxCp-this.player.cp,Math.max(0,Math.round(this.player.maxCp*.04)-s.returned),Math.round(this.player.maxCp*.02));this.player.cp+=n;s.returned+=n;s.returnedTotal+=n;if(n)say(ev,'炮击回路 · 你的咒力 +'+n+'。');}
   if(mine(this,u)&&c.domain==='escort'&&DC.active(this,this.player)&&s.erosion<6){const f=DC.active(this,t);if(f&&f.side!==u.side){const n=Math.min(3,6-s.erosion);s.erosion+=n;f.stability=Math.max(0,f.stability-n);if(f.stability<=0)DC.collapse(this,f,ev,'召唤物协同击破');else ev.push({type:'domain_state',domainSnapshot:DC.snapshot(this),text:'协同争夺 · 对方领域稳定度 -'+n+'。'});}}
   u.buildStrikeUsed=true;
  }
  return result;
 };
 const strike=proto.performStrike;proto.performStrike=function(u,t,kind,ev){u.buildStrikeUsed=false;const start=ev.length;strike.call(this,u,t,kind,ev);for(const h of ev.slice(start))if(h.dmg>0&&h.fromIndex===this.units.indexOf(u)&&u.buildAbility)h.summonAbility=u.buildAbility;};
 const npc=proto.npcAct;proto.npcAct=function(u,ev){
  if(!mine(this,u)||!['shadows','puppet'].includes(PS.family(this.player)))return npc.call(this,u,ev);
  if(window.BattleTraits.blocked(this,this.player,'tech')){say(ev,'术式封锁 · '+u.name+' 本次无法执行术式指令。');return;}
  const r=role(u),order=u.summonOrder,chosen=this.units[order?.targetIndex],t=chosen?.alive&&chosen.side!==u.side?chosen:this.pickEnemyTarget();if(!t)return;
  const cp=Math.max(1,Math.round(u.maxCp*.05));
  if(r==='rabbit'){
   if(u.cp>=cp){u.cp-=cp;t.atb=Math.max(0,t.atb-10);ev.push({type:'style',stylePhase:'coordinate',from:u.name,fromIndex:this.units.indexOf(u),toIndex:this.units.indexOf(t),ordered:[this.units.indexOf(u)],text:'脱兔掩护 · '+t.name+' 行动值 -10，不造成伤害。'});}else say(ev,'脱兔咒力不足，维持掩护位置。');return;
  }
  if(r==='ox'&&!u.buildOxReady){u.buildOxReady=true;ev.push({type:'style',stylePhase:'charge',from:u.name,fromIndex:this.units.indexOf(u),text:'贯牛蓄势 · 下一次自身行动冲撞。'});return;}
  const cannon=r==='puppet'&&(order?.ability==='cannon'||has(this,'battery')),special=r==='nue'||cannon,kind=special&&u.cp>=cp?'tech':'melee';
  if(kind==='tech')u.cp-=cp;
  u.buildAbility=kind==='tech'?(r==='nue'?'electric':'cannon'):r==='ox'?'charge':'';u.buildPower=(kind==='tech'?(order?.boost||1):1)*(r==='ox'?1.8:1);
  try{this.performStrike(u,t,kind,ev);}finally{u.buildAbility='';u.buildPower=0;if(r==='ox')u.buildOxReady=false;}
 };
 const after=proto.afterAction;proto.afterAction=function(u,ev){
  if(this.pendingDomain?.owner===this.units.indexOf(u))return after.call(this,u,ev);
  const c=config(this),f=u.isPlayer&&DC.active(this,u),opening=!!f?.fresh;
  if(f&&!f.fresh&&['pressure','escort'].includes(c.domain)){
   const n=Math.max(1,Math.round(u.maxCp*.02));if(u.cp<n)DC.collapse(this,f,ev,'构筑方向所需咒力不足');else{u.cp-=n;say(ev,'领域构筑维持 · 额外消耗 '+n+' 咒力。');}
  }
  after.call(this,u,ev);
  if(u.isPlayer){
   state(this).returned=0;state(this).erosion=0;
   for(const t of this.units)if(t.buildOpening?.until<=clock(this))delete t.buildOpening;
   const own=DC.active(this,u),enemy=own&&DC.fields(this).find(g=>g.side!==u.side);
   if(!opening&&!this.ended&&own&&enemy&&c.domain==='pressure'){enemy.stability=Math.max(0,enemy.stability-4);if(enemy.stability<=0)DC.collapse(this,enemy,ev,'加压对攻击破');else ev.push({type:'domain_state',domainSnapshot:DC.snapshot(this),text:'加压对攻 · 对方领域稳定度 -4。'});}
  }
 };
 const notes=window.BattleTraits.status;window.BattleTraits.status=function(e,u){const rows=notes(e,u);if(u.isPlayer){if(state(e).riposte)rows.push('反击就绪');if(state(e).flow)rows.push('回路收束');}if(u.buildOpening?.until>clock(e))rows.push('玩家追击窗口');if(mine(e,u)){rows.push(({dog:'近身追击',rabbit:'掩护牵制',nue:'空中电击',ox:'蓄势冲撞',puppet:has(e,'battery')?'炮击回路':'近战 / 炮击待命'})[role(u)]||'融合输出');}return rows;};
 window.PlayerBuildCombat={has,config,state,role,mine};
})();

/* Technique-specific loadouts. Effects require real hits and never edit permanent panels. */
(() => {
 'use strict';
 const B=window.PlayerBuild,BC=window.PlayerBuildCombat,PS=window.PlayerStyles,DC=window.DomainCombat,proto=BattleEngine.prototype;
 const state=e=>e.techniqueBuildState||(e.techniqueBuildState={procs:{},hits:0,lastKind:'',chainUntil:-1,guardCast:false,riposte:false,healReady:false,construct:null,borrow:null,triggers:0});
 const stamp=e=>e.player.resonanceClock||0;
 const has=(e,id)=>BC.has(e,id)&&B.compatible(B.talents.find(t=>t.id===id),e.cfg.player);
 const ready=(e,id)=>state(e).procs[id]!==stamp(e);
 const spend=(e,id)=>{state(e).procs[id]=stamp(e);state(e).triggers++;};
 const say=(ev,text)=>ev.push({type:'skill',text});
 const advance=(u,n)=>{u.atb=Math.min(99,u.atb+n);};
 const refund=(e,ev,ratio,label)=>{const u=e.player,n=Math.min(u.maxCp-u.cp,Math.ceil(e.techCost(u)*ratio));u.cp+=n;if(n)say(ev,label+' · 咒力 +'+n+'。');};
 const heal=(u,ev,ratio,label)=>{if(!u.alive||u.hp<=0)return;const n=Math.min(u.maxHp-u.hp,Math.round(u.maxHp*ratio));if(n>0){u.hp+=n;ev.push({type:'heal',from:u.name,fromIndex:0,heal:n,text:label+' · 生命 +'+n+'。'});}};
 const originalHP=(e,u)=>{e.buildOriginalHP||=new WeakMap();if(!e.buildOriginalHP.has(u))e.buildOriginalHP.set(u,u.maxHp);return e.buildOriginalHP.get(u);};
 const toxic=(e,u)=>u.buff.poison>0||u.buff.gu>0||u.maxHp<originalHP(e,u);
 const controlled=u=>u.buff.stun>0||!!u.traitEffects?.disrupt||(u.traitFrameUntil||0)>(u.traitClock||0);
 const matchup=(e,t)=>e.player.flag==='jacob'?(t.type==='受肉体'||/受肉/.test(t.name)):e.player.flag==='judge'?(t.type==='式神'||t.summonTag==='式神'||/式神/.test(t.name)):e.player.flag==='negate'&&t.maxCp<e.player.maxCp;
 const borrowable=new Set(['ratio','straw','fire','moon','gu','swap']);
 const reason=e=>window.BattleTraits.blocked(e,e.player,'tech');
 const commands=PS.commands;PS.commands=function(e){
  const rows=commands(e),u=e.player,cp=Math.max(1,Math.round(u.maxCp*.06)),block=reason(e)|| (u.cp<cp?'咒力不足':'');
  const row=(id,label,note,extra='')=>rows.push({id,label,cost:cp,note,reason:block||extra});
  if(has(e,'constructKit')){
   row('techbuild_blades','造物 · 刃阵','一次行动与6%咒力；接下来两次近战实际命中+20%，替换现有造物。');
   row('techbuild_armor','造物 · 护甲','一次行动与6%咒力；接下来两次直接受击减伤20%，不挡领域必中，替换现有造物。');
  }
  if(has(e,'copyStudy')){
   const allies=e.units.map((u,i)=>({u,i})).filter(({u})=>u.alive&&u.side===e.player.side&&!u.isPlayer&&!u.summonTag&&borrowable.has(u.flag));
   for(const {u:ally,i} of allies)row('techbuild_borrow:'+i,'借式 · '+ally.techName,'一次行动与6%咒力；下次施术借用 '+ally.name+' 的 '+ally.techName+'，随后归还。');
   if(!allies.length)row('techbuild_borrow:none','借式 · 等待同伴','支持十划、刍灵、火灾、淀月、蛊毒、不义游戏；其余能力仍待适配。','暂无可借用同伴');
  }
  return rows;
 };
 const act=proto.playerAct;proto.playerAct=function(action,targetIndex){
  if(action.startsWith('techbuild_')){
   const row=PS.commands(this).find(x=>x.id===action),u=this.player,ev=[],s=state(this);
   const retry=text=>({events:[{type:'info',text}],retryInput:true,needInput:this.awaitingPlayer,ended:this.ended});
   if(!this.awaitingPlayer||this.ended||this.pendingDomain||!u.alive)return retry('等待你的行动。');
   if(!row||row.reason)return retry(row?.reason||'当前人物尚未掌握这一专精。');
   this.awaitingPlayer=false;u.cp-=row.cost;u.traitAction='tech';
   if(action==='techbuild_blades'||action==='techbuild_armor'){
    s.construct={kind:action==='techbuild_blades'?'blades':'armor',left:2};say(ev,row.label+'准备完成 · 两次有效命中后消耗。');
   }else{const ally=this.units[Number(action.split(':')[1])];s.borrow={flag:ally.flag,name:ally.techName,source:ally.name};say(ev,'借式准备 · '+ally.name+' / '+ally.techName+'；下一次施术临时借用。');}
   ev.push({type:'style',stylePhase:'charge',from:u.name,fromIndex:this.units.indexOf(u),text:row.label});
   this.afterAction(u,ev);return this.pack(ev);
  }
  const s=state(this),t=this.units[targetIndex]?.alive?this.units[targetIndex]:this.pickEnemyTarget();
  const packet=act.call(this,action,targetIndex);
  if(packet.retryInput)return packet;
  if(action==='defend'&&!this.ended){
   if(has(this,'guardCast')){s.guardCast=true;say(packet.events,'守势施术 · 下一次术式命中可推进自己的行动。');}
   if(has(this,'healReserve')){const n=Math.min(this.player.maxCp-this.player.cp,Math.round(this.player.maxCp*.03));this.player.cp+=n;if(n)say(packet.events,'续航储备 · 咒力 +'+n+'。');}
   if(has(this,'toxicCover')&&t&&toxic(this,t)){heal(this.player,packet.events,.03,'毒蚀掩护');t.atb=Math.max(0,t.atb-10);say(packet.events,'毒蚀掩护 · '+t.name+' 行动值 -10。');}
  }
  if(['defend','domain','ult','style_burst'].includes(action))s.chainUntil=-1;
  return packet;
 };
 const damage=proto.dealDamage;proto.dealDamage=function(u,t,base,mult,kind,ev,...rest){
  originalHP(this,t);const direct=kind==='melee'||kind==='tech',s=state(this),player=u===this.player,eligible=player&&direct&&u.side!==t.side;
  const mark=!!t.traitEffects?.weak||t.traitEffects?.nail?.source===this.units.indexOf(u);
  const tox=eligible&&kind==='tech'&&toxic(this,t)&&has(this,'toxicBurst')&&ready(this,'toxicBurst');
  const alternate=eligible&&!u.techniqueBuildHit&&has(this,'alternation')&&s.lastKind&&s.lastKind!==kind&&ready(this,'alternation');
  if(tox)base*=1.25;if(alternate)base*=1.12;
  if(eligible&&has(this,'bloodEdge')&&u.hp<=u.maxHp*.5)base*=1.2;
  if(t===this.player&&direct&&u.side!==t.side&&has(this,'bloodEdge')&&t.hp<=t.maxHp*.5)base*=1.1;
  const riposte=eligible&&kind==='tech'&&s.riposte&&has(this,'guardRiposte');if(riposte)base*=1.2;
  const blade=eligible&&kind==='melee'&&s.construct?.kind==='blades'&&ready(this,'construct');if(blade)base*=1.2;
  const armor=t===this.player&&direct&&u.side!==t.side&&s.construct?.kind==='armor';if(armor)base*=.8;
  const n=damage.call(this,u,t,base,mult,kind,ev,...rest);
  if(!(n>0))return n;
  if(t===this.player&&direct&&u.side!==t.side&&t.buff.defend&&has(this,'guardRiposte'))s.riposte=true;
  if(armor&&--s.construct.left===0)s.construct=null;
  if(!eligible)return n;
  u.techniqueBuildHit=true;
  if(tox){spend(this,'toxicBurst');if(t.buff.gu>0)t.buff.gu--;else if(t.buff.poison>0)t.buff.poison--;say(ev,'侵蚀引爆 · 利用已有侵蚀，额外伤害25%。');}
  if(alternate){spend(this,'alternation');say(ev,'交替衔接 · '+(kind==='tech'?'体术→施术':'施术→体术')+'，伤害+12%。');}
  if(blade){spend(this,'construct');if(--s.construct.left===0)s.construct=null;say(ev,'造物刃阵 · 有效近战伤害+20%。');}
  if(riposte){s.riposte=false;say(ev,'防护反攻 · 守势后的施术伤害+20%。');}
  if(mark&&has(this,'weakFollow')&&ready(this,'weakFollow')){spend(this,'weakFollow');advance(u,12);say(ev,'标记追打 · 行动值 +12。');}
  if(controlled(t)&&has(this,'controlFollow')&&ready(this,'controlFollow')){spend(this,'controlFollow');t.atb=Math.max(0,t.atb-12);say(ev,'控后追打 · '+t.name+' 行动值 -12。');}
  if(kind==='tech'&&s.guardCast&&has(this,'guardCast')){s.guardCast=false;advance(u,12);say(ev,'守势施术 · 行动值 +12。');}
  if(s.healReady&&has(this,'healFollow')){s.healReady=false;advance(u,12);say(ev,'复原追击 · 行动值 +12。');}
  if(kind==='tech'&&has(this,'adaptCast')&&ready(this,'adaptCast')){spend(this,'adaptCast');refund(this,ev,.15,'应变施术');}
  if(matchup(this,t)&&has(this,'typeFollow')&&ready(this,'typeFollow')){spend(this,'typeFollow');advance(u,12);say(ev,'识别追击 · 行动值 +12。');}
  if(has(this,'tempo')&&ready(this,'tempo')){spend(this,'tempo');advance(u,12);say(ev,'抢势出手 · 行动值 +12。');}
  if(u.arsenalMove==='charged'&&has(this,'castBreak')&&ready(this,'castBreak')){
   const f=DC.active(this,t);if(f&&f.side!==u.side){spend(this,'castBreak');f.stability=Math.max(0,f.stability-6);if(f.stability<=0)DC.collapse(this,f,ev,'聚能破界');else ev.push({type:'domain_state',domainSnapshot:DC.snapshot(this),text:'聚能破界 · 稳定度 -6。'});}
  }
  return n;
 };
 const strike=proto.performStrike;proto.performStrike=function(u,t,kind,ev){
  u.techniqueBuildHit=false;
  const s=state(this),start=ev.length,player=u===this.player,borrow=player&&kind==='tech'&&t?.alive&&!reason(this)&&s.borrow;
  const oldFlags=u.flags;if(borrow){s.borrow=null;u.flags=[...new Set([...oldFlags,borrow.flag])];say(ev,'借式施放 · '+borrow.source+' / '+borrow.name+'。');}
  try{strike.call(this,u,t,kind,ev);}finally{u.flags=oldFlags;}
  if(!player||!t)return;
  const landed=ev.slice(start).some(h=>h.dmg>0&&h.fromIndex===this.units.indexOf(u)&&h.toIndex===this.units.indexOf(t)&&h.attackKind===kind);
  if(!landed)return;
  if(ready(this,'attackRecord')){
   spend(this,'attackRecord');
   if(has(this,'cadence')&&kind==='melee'){if(++s.hits%3===0){const n=Math.min(u.maxCp-u.cp,Math.round(u.maxCp*.03));u.cp+=n;if(n)say(ev,'接触节奏 · 三次命中，咒力 +'+n+'。');}}
   if(kind==='tech'&&has(this,'castChain')){if(s.chainUntil>=stamp(this))refund(this,ev,.25,'连式回路');s.chainUntil=stamp(this)+2;}else s.chainUntil=-1;
   s.lastKind=kind;
  }
  if(kind==='tech'&&controlled(t)&&has(this,'controlFlow')&&ready(this,'controlFlow')){spend(this,'controlFlow');refund(this,ev,.25,'命令回路');}
  if(kind==='tech'&&has(this,'bloodRecovery')&&ready(this,'bloodRecovery')&&!this.ended){spend(this,'bloodRecovery');heal(u,ev,.04,'血偿回补');}
 };
 const turn=proto.onTurnStart;proto.onTurnStart=function(u,ev){const hp=u.hp;turn.call(this,u,ev);if(u===this.player&&u.alive&&u.hp>hp&&has(this,'healFollow')){state(this).healReady=true;say(ev,'复原追击准备 · 下一次实际命中推进行动。');}};
 const notes=window.BattleTraits.status;window.BattleTraits.status=function(e,u){const rows=notes(e,u);if(u!==e.player)return rows;const s=state(e);if(s.construct)rows.push((s.construct.kind==='blades'?'造物刃阵':'造物护甲')+' · '+s.construct.left+'次');if(s.borrow)rows.push('借式待命 · '+s.borrow.name);if(s.guardCast)rows.push('守势施术就绪');if(s.riposte)rows.push('防护反攻就绪');if(s.healReady)rows.push('复原追击就绪');return rows;};
 window.TechniqueBuildCombat={state,has,borrowable,matchup};
})();

// BattleScenes is loaded before this core so DomainCombat can capture it.
// Apply its canonical NPC identity mapping after BattleEngine becomes available.
if(window.BattleScenes){
 const make=BattleEngine.prototype.makeNpcUnit;
 BattleEngine.prototype.makeNpcUnit=function(...args){
  const u=make.apply(this,args),name=window.BattleScenes.npcDomain(u.name);
  if(name)u.domainName=name;else if(u.canDomain)u.domainName='领域';return u;
 };
}
window.PlayerBattleRules={Player,BattleEngine,Game,Campaign,techniques:WHEEL_TECHNIQUE,
identity:WHEEL_IDENTITY,age:WHEEL_AGE,gender:WHEEL_GENDER,face:WHEEL_FACE,era:WHEEL_ERA,
cp:buildStatWheel('cp'),ctl:buildStatWheel('ctl'),melee:buildStatWheel('melee'),eff:buildStatWheel('eff'),hp:WHEEL_HP,growth:WHEEL_GROWTH};
