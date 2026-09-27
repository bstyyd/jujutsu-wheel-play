
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
      const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=1.02;u.pitch=.8;u.volume=1;
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
  cp:  [2,2,4,8,12,50,60,440,460,180,1100,3000,5200,40000],
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
 {name:'十划咒法',flag:'ratio',domain:'真视斩击',desc:'近战伤害+50%；持有该术式时黑闪触发概率+20%（共30%）。领域：真视斩击。'},
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
    return `<div class="lg-item${i===hitIdx?' hit':''}" title="${(it.desc||txt).replace(/"/g,'&quot;')}"><span class="lg-dot" style="background:${WHEEL_COLORS[i%WHEEL_COLORS.length]}"></span><span>${txt}</span>${w}</div>`;
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
    if(!cfg.player.reverse&&Math.random()<0.05){
      cfg.player.reverse=true;this.player.reverse=true;
      this.events.push({type:'learn',text:'✦ 生死之间灵光乍现——你领悟了被动技能【反转术式】！'});
      cfg.player.notes.push('在战斗中领悟了【反转术式】');
    }
    // 开局 5% 领悟黑闪（另：京都篇战胜东堂葵可100%学会）
    if(!cfg.player.blackFlash&&Math.random()<0.05){
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
            charge:false,poison:0,gu:0,adaptM:0,adaptT:0};
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
    if(this.hasFlag(actor,'shadows'))this.shadowSummon(actor,ev);
    if(this.hasFlag(actor,'spiritControl')){for(let i=0;i<3;i++)this.summonFromKilled(actor,ev,'咒灵式神');}
    if(this.hasFlag(actor,'seance'))this.summonFromKilled(actor,ev,'亡灵式神');
    if(this.hasFlag(actor,'puppet')){const n=this.alive(actor.side).filter(u=>u.summonTag==='傀儡'&&u.ownerName===actor.name).length;if(n<3)this.addSummon(actor,'傀儡',.70,'傀儡');}
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
    // —— 即死类（tech）——
    if(kind==='tech'){
      if(this.hasFlag(att,'jacob')&&(target.type==='受肉体'||target.name.includes('受肉'))){ev.push({type:'domain',text:`【雅各布天梯】圣光剥离受肉灵魂，${target.name} 被瞬间抹除！`});this.kill(target,ev,att);this.afterStrike(ev);return;}
      if(this.hasFlag(att,'judge')&&(target.type==='式神'||target.summonTag==='式神'||target.name.includes('式神'))){ev.push({type:'domain',text:`【判决术式】定罪完成，式神 ${target.name} 被处刑抹除！`});this.kill(target,ev,att);this.afterStrike(ev);return;}
      if(this.hasFlag(att,'negate')&&target.maxCp<att.maxCp){ev.push({type:'domain',text:`【万象拒绝】${att.name} 否定了咒力更低的 ${target.name}，将其存在直接拒绝（秒杀）！`});this.kill(target,ev,att);this.afterStrike(ev);return;}
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
      if(this.hasFlag(att,'mass'))mult*=2.0;            // 质量 近战+100%
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
    // —— 黑闪 ——（玩家需学会；NPC 需 bf）
    let flash=false;const flashP=(att.isPlayer&&this.cfg.player.blackFlash)?0.10:(att.bf?0.10:0)+(this.hasFlag(att,'ratio')?0.20:0);
    if(flashP>0&&Math.random()<flashP){mult*=10;flash=true;}
    const dmg=this.dealDamage(att,target,base,mult,kind,ev,label,flash,false);
    // —— 附加伤害（命中后追加，不再触发叠层/即死递归）——
    if(target.alive&&dmg>0){
      const bonus=(kind==='melee'?this.meleeBonus(att):0)+(kind==='tech'?this.techBonus(att):0)+amberBonus;
      if(bonus>0)this.dealDamage(att,target,Math.round(bonus),1,kind,ev,att.techName+'·附加',false,true);
      // 质量术式·星之怒：tech 时与目标同归于尽的毁灭一击（自身承受50%当前血）
      if(kind==='tech'&&this.hasFlag(att,'mass')){const sd=Math.round((att.eff[0]+att.eff[1])*3);this.dealDamage(att,target,sd,1,'tech',ev,'质量术式·星之怒',false,true);}
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
  dealDamage(att,tar,base,mult,kind,ev,label,flash,ignoreImmune){
    if(!tar.alive)return 0;
    let dmg=base*mult*randF(0.9,1.1);
    dmg*=(1+0.10*Math.floor(this.actionsTotal/15)); // 战意升温
    if(tar.buff.vuln>0)dmg*=1.30;
    if(att.buff&&att.buff.seal>0)dmg*=0.8;
    if(tar.buff.defend&&!att.toolPierceGuard)dmg*=0.5;
    // —— 术式免疫 / 闪避（领域与空间斩无视）——
    if(!ignoreImmune&&kind!=='domain'){
      if(this.hasFlag(tar,'limitless')&&!att.toolNullify){ev.push({type:'skill',text:`${tar.name} 的【无下限·无穷】将 ${label} 完全化解（免疫非领域攻击）。`});return 0;}
      if(this.hasFlag(tar,'requiem')){ev.push({type:'skill',text:`${tar.name} 的【黄金体验镇魂曲】令 ${label} 归零无效。`});return 0;}
      if(this.hasFlag(tar,'swap')&&tar.ctl>att.ctl){ev.push({type:'skill',text:`${tar.name}【不义游戏】操控占优，闪避了 ${label}！`});return 0;}
      if(this.hasFlag(tar,'sky')&&kind==='melee'&&!att.toolNullify){ev.push({type:'skill',text:`${tar.name}【天空术式】扭曲空间，${label}（近战）伤害为0。`});return 0;}
    }
    // —— 魔虚罗·适应：每次承受某类攻击，该类后续-20%（可叠加）——
    if(tar.skills&&tar.skills.adapt&&!ignoreImmune){
      if(kind==='melee'){dmg*=Math.max(0,1-0.20*tar.buff.adaptM);tar.buff.adaptM++;}
      if(kind==='tech'){dmg*=Math.max(0,1-0.20*tar.buff.adaptT);tar.buff.adaptT++;}
    }
    dmg=Math.max(1,Math.round(dmg));
    if(flash){
      if(att.isPlayer){
        this.cfg.player.flashCount=(this.cfg.player.flashCount||0)+1;
        this.cfg.player.statBoost=+((this.cfg.player.statBoost||1)*1.10).toFixed(4);
        const P=this.cfg.player;
        P.maxHp=Math.round(P.maxHp*1.10);P.maxCp=Math.round(P.maxCp*1.10);P.ctl=Math.round((P.ctl||0)*1.10);
        P.melee=P.melee.map(v=>Math.round(v*1.10));P.eff=P.eff.map(v=>Math.round(v*1.10));
        att.maxHp=Math.round(att.maxHp*1.10);att.maxCp=Math.round(att.maxCp*1.10);att.ctl=Math.round((att.ctl||0)*1.10);
        att.melee=att.melee.map(v=>Math.round(v*1.10));att.eff=att.eff.map(v=>Math.round(v*1.10));
      }
      ev.push({type:'flash',actorName:att.name,isPlayer:!!att.isPlayer,text:`★ 黑 闪 ★ 空间被一击扭曲！本次伤害×10${att.isPlayer?'，且你全属性永久+10%':''}！`});
    }
    tar.hp-=dmg;
    ev.push({type:flash?'flash':'hit',from:att.name,to:tar.name,text:`${label} → 命中 ${tar.name}，造成 ${dmg} 点伤害。`,dmg});
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
      p.buff.saved=true;p.alive=true;p.hp=Math.round(p.maxHp*0.50);p.cp=Math.round(p.maxCp*0.50);
      ev.push({type:'skillcut',actorName:'你',text:'死而替生 · 替死夺式'});
      if(!P.stolen)P.stolen=[];if(!P.stolenTechs)P.stolenTechs=[];
      // 被击杀即胜：击溃所有敌人，并夺取其生得术式（多术式并存、各自独立熟练度）
      this.alive('enemy').forEach(e=>{
        if(e.flag&&!P.stolenTechs.some(t=>t.flag===e.flag)){
          P.stolenTechs.push({name:e.techName,flag:e.flag,domain:e.domainName,
            flags:(e.flags||[]).filter(f=>f!==e.flag),prof:30});
          if(!p.flags.includes(e.flag))p.flags.push(e.flag); // 当场立即生效
          P.notes.push(`死而替生，夺取了【${e.name}】的术式「${e.techName}」`);
          ev.push({type:'skill',text:`你夺取了【${e.name}】的生得术式「${e.techName}」（独立熟练度30%起）。`});
        }
        if(!P.stolen.includes(e.name))P.stolen.push(e.name);
        this.kill(e,ev);
      });
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
      winSkill:'blackFlash',winSkillText:'东堂葵认可了你的拳头：“不错嘛！”——在激战中你学会了技能【黑闪】：每次攻击10%概率触发，当次伤害×10，并使全属性永久提升10%。'}]},
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

/* ============================ VII. 界面工具 & 战斗 UI ============================ */
function showModal(html){$('modalMask').classList.remove('hidden');$('modalBox').innerHTML=html;}
function closeModal(){$('modalMask').classList.add('hidden');$('modalBox').innerHTML='';}
function pct(cur,max){return clamp(Math.round(cur/max*100),0,100)+'%';}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

/** 通用转盘模态（日常行动 / 抉择 / 战场 / 狩猎），Promise  resolve 选中项 */
function openWheelModal(opt){
  return new Promise(resolve=>{
    showModal(`
      <h2>${opt.title}</h2>
      <div style="display:flex;justify-content:center;margin:6px 0">
        <div class="wheel-box" style="position:relative;width:min(380px,72vw);height:min(380px,72vw)">
          <div class="wheel-pointer"></div>
          <canvas width="500" height="500" style="width:100%;height:100%;filter:drop-shadow(0 0 22px rgba(123,47,247,.35))"></canvas>
          <div class="wheel-hub">转盘</div>
        </div>
      </div>
      <div class="wheel-result" id="mWheelResult" style="margin:10px 0">点击抽取，聆听命运……</div>
      <div class="wheel-legend" id="mWheelLegend"></div>
      <div class="center" style="margin-top:14px"><button class="btn" id="mWheelSpin">抽 取</button></div>`);
    const cv=$('modalBox').querySelector('canvas');
    const wv=new WheelView(cv);wv.setItems(opt.items);
    $('mWheelLegend').innerHTML=wheelLegendHtml(opt.items);
    let done=false;
    const finish=(item)=>{if(done)return;done=true;setTimeout(()=>{closeModal();resolve(item);},opt.delay??900);};
    $('mWheelSpin').onclick=function(){
      this.disabled=true;
      wv.spin((item,idx)=>{
        $('mWheelLegend').innerHTML=wheelLegendHtml(opt.items,idx);
        const hitEl=$('mWheelLegend').querySelector('.lg-item.hit');/* keep viewport stable */
        $('mWheelResult').innerHTML=`<span class="hl">${item.label}</span>${item.desc?'<br><small>'+item.desc+'</small>':''}`;
        finish(item);
      },opt.selectedIndex);
    };
    if(opt.auto)$('mWheelSpin').click();
  });
}

/* ---------------- 战斗 UI ---------------- */
/* ============================ VII-0. 全屏特效 & 战斗台词 ============================ */
const Fx={
  _timer:null,
  /** kind: fx-quote(蓝台词) / fx-skill(金技能) / fx-ult(极之番·碎裂震屏) */
  show(kind,who,text,dur){
    dur=dur||(kind==='fx-ult'?2200:kind==='fx-quote'?2200:1600);
    return new Promise(res=>{
      const ov=$('fxOverlay');if(!ov){res();return;}
      clearTimeout(this._timer);
      ov.className='';void ov.offsetWidth;
      const w=$('fxWho'),m=$('fxMain');
      w.textContent=who?`【${who}】`:'';m.textContent=text;
      ov.classList.add('show',kind);
      if(kind==='fx-ult'){
        setTimeout(()=>ov.classList.add('ult-shake'),450);
        setTimeout(()=>ov.classList.add('cracked'),950);
      }
      this._timer=setTimeout(()=>{ov.className='';res();},dur);
    });
  },
  quote(who,text){return this.show('fx-quote',who,text);},
  skill(who,text){return this.show('fx-skill',who,text);},
  ult(who,text){return this.show('fx-ult',who,text);},
  async seq(list){for(const x of list)await this.show(x.kind||'fx-quote',x.who,x.text);}
};
/** 战斗台词表：key=场景(s+天数_场次/战场名)，value={角色名:{e进场,w胜利,l战败}} */
const QUOTES={
's3_0':{'准二级咒灵':{e:'女人.....我需要更多的女人！！！',l:'啊啊啊啊——',w:'与我融为一体吧！'}},
's3_1':{'1指受肉宿傩':{e:'我出来了！女人在哪？小孩在哪？啊哈哈哈哈！',l:'我记住你了小鬼，下次见面我就会杀了你',w:'现代咒术师弱到这种程度了吗？'}},
's3_2':{
 '1指受肉宿傩':{e:'我出来了！女人在哪？小孩在哪？啊哈哈哈哈！',l:'我记住你了小鬼，下次见面我就会杀了你',w:'现代咒术师弱到这种程度了吗？'},
 '五条悟':{e:'真有趣，那就让我来试试你的底色吧',l:'打得很爽啊......',w:'就这种程度嘛？让人失望。'},
 '伏黑惠':{e:'敢打我？由良由良......',l:'救，救命，我还不想死，牢师呢？乙骨学长呢？特级咒术师在哪里？快来救救我！！',w:'又是被大爹们带飞的一天~'}},
's10_0':{
 '二级咒灵':{e:'小妞~不想这个小鬼死的话，就乖乖把衣服脱了~欸嘿嘿嘿！！',l:'不！不可能......',w:'爽......爽！这个小妞的滋味真不错！'},
 '钉崎野蔷薇':{e:'该死！该死！该死！都怪我！',l:'该死的色孽咒灵......',w:'谢谢你，如果不是你，我可能只能......不过只是谢谢而已哦！你敢乱想我就杀了你！'}},
's33_0':{
 '咒胎怠天':{e:'嘻！嘻嘻嘻！',l:'嘎啊！！！',w:'嘻嘻嘻！'},
 '伏黑惠':{e:'敢打我？由良由良......',l:'救，救命，我还不想死，牢师呢？乙骨学长呢？特级咒术师在哪里？快来救救我！！',w:'又是被大爹们带飞的一天~'},
 '钉崎野蔷薇':{e:'你和伏黑快走！这里我来垫底！至少你们要活下去......',l:'谢谢能遇见你们，我的一生，没有遗憾。',w:'这不是很强嘛，你这家伙！比伏黑那家伙靠谱多了。'}},
's33_1':{
 '咒胎怠天':{e:'嘻！嘻嘻嘻！',l:'嘎啊！！！',w:'嘻嘻嘻！'},
 '2指宿傩':{e:'真让人不愉悦，你也要与我对着干吗？',l:'现代中居然还有这样的强者嘛，真让人愉悦。',w:'特级吗？就你们这帮家伙？也配和我齐名？'}},
's35_0':{
 '漏壶':{e:'你这个嚣张的小鬼！我会撕碎你那张轻浮的娃娃脸！',l:'居然......强大到这种地步，被脑花那家伙骗了！',w:'人类最强？就你这种水平吗？'},
 '五条悟':{e:'没关系的啦哈哈，因为你们这帮家伙真的很弱嘛~',l:'居然是规则系的能力嘛......大意了！',w:'咒灵这种东西就是弱啊，哪怕是天灾也不过如此。'}},
's47_0':{'顺平（二级变化人·精英）':{e:'求求你，杀了我',l:'谢谢你，出现在我的生命里，谢谢你......',w:'不......我都做了什么？'}},
's48_0':{
 '真人':{e:'为什么杀人？因为有趣啊哈哈哈！',l:'这，这不对吧？',w:'哈哈哈，把你改造成好用的家伙吧！'},
 '七海建人':{e:'你快走，这里我来垫底',l:'终于可以好好休息一下了......',w:'加完这场班，还有下场班.......'}},
's62_0':{'准一级咒灵':{e:'厄啊啊啊',l:'厄啊啊啊',w:'厄啊啊啊'}},
's63_0':{'东堂葵':{e:'你喜欢什么类型的女人？',l:'哼，有几分水平',w:'不过如此，真让人无趣的家伙'}},
's68_0':{
 '花御':{e:'漏壶的目的就是我的目的！',l:'对，对不起，漏壶......真人......',w:'我算是帮上忙了嘛？'},
 '伏黑惠':{e:'敢打我？由良由良......',l:'救，救命，我还不想死，牢师呢？乙骨学长呢？特级咒术师在哪里？快来救救我！！',w:'又是被大爹们带飞的一天~'},
 '禅院真希':{e:'你们快走，这里由我顶上！',l:'惠！停下！不要自爆！接下来交给他们吧。',w:'没想到你居然强到这个地步。'}},
's68_1':{
 '花御':{e:'又来了一些更强的家伙吗？',l:'对，对不起，漏壶......真人......',w:'我算是帮上忙了嘛？'},
 '虎杖悠仁':{e:'交给我们吧！',l:'对不起给你们添麻烦了.......',w:'你们这些伤人的咒灵！我会一个不剩的屠杀干净！'},
 '东堂葵':{e:'我们上！Bro！我来给你打辅助！',l:'操作不过来了.......',w:'打得漂亮！兄弟！'}},
's68_2':{
 '花御':{e:'不，不好！是五条悟！快走！',l:'呃啊啊啊啊！',w:'你居然这么强？我觉得复活宿傩是没有必要的.......'},
 '五条悟':{e:'又是你这家伙',l:'居然强到这种地步吗？大意了.......',w:'你们这些咒灵，说白了就是一群不入流的货色罢了！'}},
's78_咒胎战场':{
 '咒胎怠天':{e:'嘻嘻嘻',l:'嘎啊！',w:'嘻嘻嘻！'},
 '伏黑惠':{e:'尼玛，老子不自爆了，领域展开！',l:'嘎啊！！我还不想死，牢师呢？乙骨学长呢？特级咒术师在哪里？快来救救我！！',w:'OK啊家人们，找回自信了！'}},
's78_血涂与坏相战场':{
 '血涂':{e:'弟弟！我们上',l:'胀相哥哥.......我不想死.......',w:'好难过.......为什么，虎杖悠仁，你究竟是.......'},
 '坏相':{e:'哥哥！我们上',l:'哥哥，对不起，我没能帮上忙。',w:'心好痛，虎杖悠仁，你难道是.......'},
 '虎杖悠仁':{e:'这里我来上，钉崎！你们快走！',l:'对不起，哥哥......',w:'不知道为什么，心好痛.......'},
 '钉崎野蔷薇':{e:'呃哈哈哈哈哈！杀了你们！杀了你们！',l:'可惜......',w:'黑闪！！！！哈哈哈！爽了~'}},
's88_是（30%）':{
 '五条悟':{e:'堵上一切！0.2秒的领域展开！',l:'呵呵，那就暂时交给我的好学生们吧......',w:'也就这样吗？让宿傩过来吧。'},
 '漏壶':{e:'五条悟！看这里！',l:'百年后咒灵一定会获胜，即使活下来的人不是我......',w:'新世界是我们的！'},
 '花御':{e:'漏壶，我来支援你！',l:'活下去，漏壶',w:'一切顺利'},
 '胀相':{e:'啊啊，真麻烦',l:'对不起，我的弟弟们......',w:'虎杖悠仁，你在哪里。'},
 '羂索':{e:'哟，悟！好久不见~',l:'意料之外啊',w:'意料之中'}},
's90_蝗虫战场':{
 '蝗虫':{e:'我不笨，我不笨！',l:'我居然是笨蛋吗？',w:'哈哈哈，你们才是笨蛋~'},
 '虎杖悠仁':{e:'你吃过人，对不起，我要杀了你',l:'对不起，老师，没能帮上忙',w:'安息吧'}},
's90_真人战场':{
 '真人':{e:'又是你吗，悠仁。',l:'这、这不可能......',w:'灵魂的形状，真是丑陋啊。'},
 '虎杖悠仁':{e:'真人！！！我要杀了你！！',l:'对不起，钉崎、老师、七海海......',w:'真人，无论你转生多少次，只要我还活着，我就会无休止尽的杀了你'},
 '东堂葵':{e:'现在跟不上兄弟的人是你啊，东堂葵！你甘心吗？',l:'我的不义游戏结束了。',w:'如果满足于现状那就不是我，你要让兄弟再一个人独自战斗吗？东堂葵！！'}},
's90_魔虚罗战场':{
 '魔虚罗':{e:'嗡嗡嗡嗡',l:'嗡',w:'嗡嗡！'},
 '15指宿傩':{e:'居然强大到这个地步吗？伏黑惠，你真是有个好术式啊哈哈哈！',l:'居然没秒掉吗？可惜',w:'有点意思，打得我好痛快'}},
's90_陀艮战场':{
 '陀艮':{e:'我即是大海！',l:'漏壶，对不起。',w:'我也算是帮上忙了吧？'},
 '伏黑惠':{e:'我来当领域中和器，至于战斗？你们别想让我上，不然我就由良由良。',l:'忘记自爆了，该死，我还不想死，牢师呢？乙骨学长呢？特级咒术师在哪里？快来救救我！！',w:'哼，这都是我一个人的功劳'},
 '七海建人':{e:'你们走！我来垫后',l:'总算可以休息了吗',w:'还不能停，还有下一场战斗等着我'},
 '禅院家主':{e:'老头子我还能再发光发热一会呢',l:'直哉.......',w:'没有意识了吗？甚尔......'},
 '真希':{e:'老爷子，你走，我来垫后',l:'真依......对不起',w:'是你吗？甚尔堂哥？'},
 '伏黑甚尔':{e:'杀......',l:'唔.......',w:'杀，杀，杀！'}},
's90_漏壶宿傩战场':{
 '漏壶':{e:'我不在乎我的生死，我在乎的是千千万万的咒灵们',l:'为什么，我会哭？',w:'履行承诺吧，诅咒之王'},
 '15指宿傩':{e:'如果你能伤到我，我可以听你们的指挥',l:'呵，咒灵吗？',w:'不必妄自菲薄，你很强，我打得很愉悦'}},
's90_羂索里梅战场':{
 '羂索':{e:'一切将从我这里开始',l:'那就开启吧，死灭回游',w:'只有这种程度吗？'},
 '里梅':{e:'不要妨碍我们的计划！',l:'对不起，宿傩大人',w:'胜利的荣光是属于宿傩大人的'},
 '九十九由基':{e:'你喜欢什么类型的女人？',l:'哼，星之怒！',w:'哎哟，可惜，再努努力说不定人家也会喜欢上你呢？'}},
's90_胀相虎杖战场':{
 '胀相':{e:'虎杖悠仁！！还我弟弟的命来！',l:'对不起，是我的错，都怪我的选择错误',w:'对不起悠仁，是我的错，都怪我的选择错误才导致我们兄弟相残'},
 '虎杖悠仁':{e:'胀相哥......我会阻止你！',l:'对不起......',w:'我们一定还能做回兄弟。'}},
's90_伏黑父子对决战场':{
 '伏黑甚尔':{e:'小子，你叫什么名字',l:'不姓禅院就好。',w:'你不合适在咒术界生存，去当个普通人吧'},
 '伏黑惠':{e:'爸......爸爸？',l:'怎么会......',w:'他最后，是笑着的。'}},
's105_仙台战场':{
 '多鲁布':{e:'嘎嘎',l:'呃啊',w:'嘎嘎嘎'},
 '黑沐死':{e:'我喜欢铁的味道',l:'呃',w:'血！！！'},
 '乌璐亨子':{e:'你很喜欢说教嘛？',l:'我也想为自己而活',w:'这样就好了'},
 '石流龙':{e:'让我来尝尝，你是主菜还是甜点',l:'我吃饱了',w:'原来只是个餐前甜点吗'},
 '乙骨忧太':{e:'控制一下实力，别把他们打死了',l:'居然，失误了吗？',w:'请把分给我，谢谢？'}},
's105_东京第一结界·剧场':{
 '虎杖悠仁':{e:'日车，我不想伤害你，把分给我',l:'你怎么停下了？',w:'谢谢你，日车'},
 '日车宽见':{e:'虎杖悠仁，我不想伤害你',l:'谢谢你让我找回一丝清醒',w:'你是无罪的，虎杖悠仁，可是为什么你要认罪？'}},
's105_东京第二结界·港口':{
 '鹿紫云一':{e:'把音量调到最大！为你做好最后的送葬！',l:'快点给我个痛快吧',w:'性！？'},
 '秤金次':{e:'熊猫，你变瘦了不少啊？',l:'哦齁齁齁',w:'牵到小鹿的手啦家人们，看我不让他哦齁齁齁'}},
's105_樱岛战场':{
 '禅院直哉':{e:'杀了你',l:'呃啊！',w:'现在追上他们的人，是我！'},
 '禅院真希·天裕暴君':{e:'.......',l:'.......',w:'.......'},
 '加茂宪纪':{e:'尽我所能，为大家做出点贡献',l:'我尽力了吗？',w:'我有帮上忙吗？'}},
's120_0':{
 '五条悟':{e:'提前说好，你才是挑战者',l:'打得很爽啊',w:'会赢的'},
 '十影宿傩':{e:'魔虚罗！出来！',l:'结束了，打得漂亮五条悟，我认可你了',w:'真是令人愉悦，五条悟，我想我一辈子也不会忘记你了吧'}},
's120_1':{
 '一削·神武真身宿傩':{e:'少了一条手臂，也足够杀你。',l:'竟被逼到这份田地......',w:'这就是你们的极限吗？'},
 '鹿紫云一':{e:'一刻也没有为五条悟的死亡感到悲伤，立马赶到战场的是',l:'鹿紫云一什么的，无所谓的，忘了吧',w:'真是无趣啊宿傩，我想我下一刻就会忘了你吧'}},
's120_2':{
 '二削·神武真身宿傩':{e:'车轮战吗？正合我意。',l:'审判之剑......吗。',w:'你们的术式，对我无效。'},
 '日车宽见':{e:'我以审判员之名，剥夺你的武力！',l:'我的判决......到此为止了。',w:'有罪——宿傩，你被判有罪！'},
 '虎杖悠仁':{e:'日车先生，剩下的交给我们！',l:'还没......我还不能倒下！',w:'再来一拳！我还能再打！'}},
's120_3':{
 '三削·神武真身宿傩':{e:'复制术式？有点意思。',l:'乙骨忧太......棘手。',w:'不过如此。'},
 '虎杖悠仁':{e:'乙骨前辈，我们一起上！',l:'可恶......身体要散架了。',w:'还差一点，就差一点！'},
 '乙骨忧太':{e:'悠仁，我会把全部咒力借给你。',l:'咒力......见底了吗。',w:'这就是大家汇聚起来的力量！'}},
's120_4':{
 '四削·神武真身宿傩':{e:'不义游戏......烦人的交换。',l:'被摆了一道吗。',w:'你们的配合也就到此为止。'},
 '虎杖悠仁':{e:'东堂哥，再来一次最佳配合！',l:'拳头......握不住了。',w:'黑闪！给我中！'},
 '东堂葵':{e:'兄弟！我给你开路！',l:'不义游戏......用不了了。',w:'上吧兄弟，这一拳定胜负！'}},
's120_5':{
 '五削·神武真身宿傩':{e:'来吧，人类最后的拳头。',l:'......被小鬼打败了吗。',w:'诅咒之王，永不落败。'},
 '虎杖悠仁':{e:'宿傩！这一拳，是为了所有被你伤害的人！',l:'对不起......大家......',w:'我们......赢了啊。'}}
};
/** 进场台词列表（敌方先、我方后） */
function enterQuoteList(scene,units){
  const q=QUOTES[scene];if(!q)return[];const out=[];
  const push=u=>{const z=q[u.name];if(z&&z.e)out.push({who:u.name,text:z.e});};
  units.filter(u=>u.side==='enemy'&&!u.isPlayer).forEach(push);
  units.filter(u=>u.side==='ally'&&!u.isPlayer).forEach(push);
  return out;
}
/** 结算台词列表：玩家胜→敌人说战败(l)、队友说胜利(w)；玩家败反之 */
function endQuoteList(scene,units,playerWin){
  const q=QUOTES[scene];if(!q)return[];
  const line=(u)=>{const z=q[u.name];if(!z)return null;
    const t=u.side==='enemy'?(playerWin?z.l:z.w):(playerWin?z.w:z.l);
    return t?{who:u.name,text:t}:null;};
  const out=[];
  // 玩家胜：先敌人败辞，后队友胜辞；玩家败：先队友败辞，后敌人胜辞
  const firstSide=playerWin?'enemy':'ally',secondSide=playerWin?'ally':'enemy';
  [firstSide,secondSide].forEach(sd=>units.filter(u=>u.side===sd&&!u.isPlayer).forEach(u=>{const x=line(u);if(x)out.push(x);}));
  return out;
}

const BattleUI={
  speed:1,auto:false,_awaitingInput:false,_autoTimer:null,runId:0,_finished:false,resolve:null,_liveTimers:[],
  sd(ms){return ms/this.speed;},
  /** 受运行代号管控的延时：本场战斗结束/切换到下一场后，旧场遗留回调一律作废，杜绝跨场残留链导致断链/卡死 */
  later(ms,fn){
    const id=this.runId,t=setTimeout(()=>{if(id===this.runId)fn();},this.sd(ms));
    this._liveTimers.push(t);return t;
  },
  /** 固定时长（不被战斗倍速压缩）：用于台词/技能/领域/极之番等大字展现，保证高倍速下也至少停留约1秒以上 */
  laterFixed(ms,fn){
    const id=this.runId,t=setTimeout(()=>{if(id===this.runId)fn();},ms);
    this._liveTimers.push(t);return t;
  },
  _clearTimers(){clearTimeout(this._autoTimer);clearTimeout(this._domTimer);
    (this._liveTimers||[]).forEach(t=>clearTimeout(t));this._liveTimers=[];},
  run(cfg){
    return new Promise(resolve=>{
      this.runId++;this._finished=false;this._clearTimers(); // 开新一场：作废旧场全部异步链
      const eng=new BattleEngine(cfg);this.eng=eng;this.selectedTargetIdx=null;
      this.speed=1;this.auto=false;this._awaitingInput=false;
      this.scene=cfg.scene||null;this._introDone=!this.scene; // 无场景（狩猎）不播剧情台词
      showModal(`
        <h2 style="letter-spacing:1px;font-size:18px">${cfg.villain?'<span style="color:#ff5a5a">【反派路线】</span> ':''}${cfg.title||'战 斗'}</h2>
        <div class="seq-wrap">
          <div class="seq-cap"><span>行动序列 · 综合实力越强越靠前（星铁式轮轴）</span><span id="seqHint">1×</span></div>
          <div class="seq-axis" id="boOrder"></div>
        </div>
        <div class="battle-field">
          <div class="side-col ally"><h4>我方</h4><div id="bfAlly"></div></div>
          <div class="side-col enemy"><h4>敌方（点击头像选择攻击目标）</h4><div id="bfEnemy"></div></div>
        </div>
        <div class="battle-log" id="bfLog"></div>
        <div class="battle-tip" id="bfTip"></div>
        <div class="battle-ctl">
          <div class="ctl-group">自动战斗
            <button class="auto-btn" id="btnAuto">关</button>
          </div>
          <div class="ctl-group">速度
            <button class="spd-btn on" data-spd="1">1×</button>
            <button class="spd-btn" data-spd="2">2×</button>
            <button class="spd-btn" data-spd="3">3×</button>
            <button class="spd-btn" data-spd="5">5×</button>
          </div>
        </div>
        <div class="battle-actions" id="bfActions">
          <button class="btn small" id="actMelee">体 术 攻 击</button>
          <button class="btn small" id="actTech">咒 力 术 式</button>
          <button class="btn small" id="actDomain">领 域 展 开</button>
          <button class="btn small" id="actUlt" style="display:none">极 之 番</button>
          <button class="btn small ghost" id="actDefend">防 御</button>
          <button class="btn small ghost" id="actFlee" style="border-color:rgba(255,120,120,.5);color:#ff9a9a">撤 退</button>
        </div>`);
      $('modalMask').scrollTop=0;
      if(eng.events.length)eng.events.forEach(e=>this.appendLog(e));
      $('actMelee').onclick=()=>{SFX.click();this.input('melee');};
      $('actTech').onclick=()=>{SFX.click();this.input('tech');};
      $('actDomain').onclick=()=>{SFX.click();this.input('domain');};
      $('actUlt').onclick=()=>{SFX.click();this.input('ult');};
      $('actDefend').onclick=()=>{SFX.click();this.input('defend');};
      $('actFlee').onclick=()=>{SFX.click();this.tryFlee();};
      $('btnAuto').onclick=()=>{
        this.auto=!this.auto;const b=$('btnAuto');
        b.textContent=this.auto?'开':'关';b.classList.toggle('on',this.auto);
        if(this.auto&&this._awaitingInput)this.scheduleAuto();
      };
      document.querySelectorAll('.spd-btn').forEach(b=>b.onclick=()=>{
        this.speed=+b.dataset.spd;
        document.querySelectorAll('.spd-btn').forEach(x=>x.classList.toggle('on',x===b));
        $('seqHint').textContent=this.speed+'×';
      });
      this.resolve=resolve;
      this.render();
      this._playIntro();
      this.loop();
    });
  },
  /** 进场台词：敌方先、我方后，蓝色大字依次呈现；播完前战斗轮轴暂不推进 */
  async _playIntro(){
    const id=this.runId;
    const list=enterQuoteList(this.scene,this.eng.units);
    if(!list.length){this._introDone=true;return;}
    for(const x of list){
      if(id!==this.runId)return;
      await Fx.quote(x.who,x.text);
    }
    if(id===this.runId)this._introDone=true;
  },
  appendLog(e){
    const box=$('bfLog');if(!box)return;
    const d=document.createElement('div');
    d.className=e.type==='hit'?'hit':e.type==='heal'?'heal':e.type==='domain'?'domain':e.type==='flash'?'flash':e.type==='die'?'lred':'sys';
    d.textContent=e.text;box.appendChild(d);box.scrollTop=box.scrollHeight;
  },
  /** 星铁式行动序列轴渲染 */
  renderSeq(){
    const first=this.eng.awaitingPlayer?this.eng.player:null;
    const seq=this.eng.previewOrder(8,first);const box=$('boOrder');if(!box)return;
    box.innerHTML=seq.map((u,i)=>{
      const cls=i===0?'current':i<=3?'':i<=5?'dim':'dim2';
      const ava=u.isPlayer?'你':(u.name||'?').slice(0,1);
      return `${i?'<span class="seq-arrow">›</span>':''}<div class="seq-node ${u.side} ${cls}" title="${u.name} · ${lvName(u.li)} · ${u.type||''}">
        <div class="seq-ava">${ava}</div><div class="seq-name">${u.isPlayer?'你':u.name}</div></div>`;
    }).join('');
  },
  unitBadges(u){
    const b=u.buff,bd=[];
    if(u.summonTag)bd.push(`<em class="bdg summon">${u.summonTag}</em>`);
    if(b.stun>0)bd.push('<em class="bdg stun">眩晕</em>');
    if(b.defend)bd.push('<em class="bdg defend">防御</em>');
    if(b.charge)bd.push('<em class="bdg charge">蓄力中</em>');
    if(b.poison>0)bd.push(`<em class="bdg poison">毒×${b.poison}</em>`);
    if(b.gu>0)bd.push(`<em class="bdg gu">蛊×${b.gu}</em>`);
    if(u.skills&&u.skills.adapt&&(b.adaptM>0||b.adaptT>0))bd.push(`<em class="bdg adapt">适应 近${b.adaptM}/术${b.adaptT}</em>`);
    if(this.hasFlagUi(u,'ssj')&&b.ssj>0&&b.ssj<5)bd.push(`<em class="bdg ssj">超赛余${b.ssj}</em>`);
    if(u.reverse)bd.push('<em class="bdg rev">反转</em>');
    if(u.isPlayer?(this.eng&&this.eng.cfg&&this.eng.cfg.player&&this.eng.cfg.player.blackFlash):u.bf)bd.push('<em class="bdg" style="background:rgba(255,120,40,.18);color:#ff9a4a;border-color:rgba(255,140,60,.5)">黑闪</em>');
    if(u.canDomain&&u.domainUsed<1)bd.push('<em class="bdg dom">可领域</em>');
    if(u.canUlt&&!u.ultUsed)bd.push('<em class="bdg" style="background:rgba(255,200,60,.18);color:#ffd24a;border-color:rgba(255,200,60,.5)">极之番</em>');
    return bd.join('');
  },
  hasFlagUi(u,f){return u.flag===f||(u.flags&&u.flags.includes(f));},
  unitHtml(u,side){
    const idx=this.eng.units.indexOf(u);
    const sub=u.summonTag?u.summonTag:(u.techName&&u.techName!=='咒力'?u.techName:(u.type||''));
    return `<div class="unit ${u.alive?'':'dead'} ${side==='enemy'&&u.alive?'targetable':''} ${this.actingIdx===idx?'acting':''} ${u.summonTag?'is-summon':''}" data-idx="${idx}">
      <div class="uname"><span>${u.name}${u.isPlayer?'（你）':''}</span><span class="utype">${lvName(u.li)}${sub?'·'+sub:''}</span></div>
      <div class="badges">${this.unitBadges(u)}</div>
      <div class="mini-bar hp"><i style="width:${pct(u.hp,u.maxHp)}"></i></div>
      <div class="nums"><span>HP ${Math.max(0,Math.round(u.hp))}/${u.maxHp}</span></div>
      <div class="mini-bar cp"><i style="width:${pct(u.cp,u.maxCp)}"></i></div>
      <div class="nums"><span>CP ${Math.round(u.cp)}/${u.maxCp}</span></div>
      <div class="mini-bar atb"><i style="width:${clamp(u.atb,0,100)}%"></i></div>
    </div>`;
  },
  render(){
    const eng=this.eng;
    this.actingIdx=null;
    $('bfAlly').innerHTML=eng.units.filter(u=>u.side==='ally').map(u=>this.unitHtml(u,'ally')).join('');
    $('bfEnemy').innerHTML=eng.units.filter(u=>u.side==='enemy').map(u=>this.unitHtml(u,'enemy')).join('');
    // 目标点击
    $('bfEnemy').querySelectorAll('.unit').forEach(el=>{
      el.onclick=()=>{const i=+el.dataset.idx;if(eng.units[i]&&eng.units[i].alive){this.selectedTargetIdx=i;this.render();}};
    });
    this.renderSeq();
    const p=eng.player;
    // 仅在真正等待玩家输入时启用指令按钮，防止敌人行动间隙误点导致额外行动
    const canInput=eng.awaitingPlayer&&!eng.ended;
    ['actMelee','actTech','actDefend'].forEach(id=>{const b=$(id);if(b)b.disabled=!canInput;});
    const domBtn=$('actDomain');
    if(domBtn){domBtn.disabled=!(canInput&&p.canDomain);
      domBtn.textContent=(p.domainCd||0)>0?(p.reverse?'修复熔断中':'领域熔断中'):'领 域 展 开';}
    const ultBtn=$('actUlt');
    if(ultBtn){
      const ultOk=p.canUlt&&!p.ultUsed&&p.cp>=p.maxCp*0.5;
      ultBtn.style.display=p.canUlt&&!p.ultUsed?'':'none';
      ultBtn.disabled=!(canInput&&ultOk);
      ultBtn.textContent=p.ultUsed?'极之番·已用':'极 之 番（耗半蓝·回满血）';
    }
    const cost=eng.techCost(p);
    $('actTech').textContent=`咒 力 术 式（耗${cost}）`;
    const t=eng.units[this.selectedTargetIdx];
    $('bfTip').textContent=(!t||!t.alive)?'系统将自动选择血量最低的敌人为目标':(`当前目标：${t.name}`);
  },
  loop(){
    const id=this.runId;
    const step=()=>{
      if(id!==this.runId||!this.eng)return; // 已切换到下一场，旧链立即作废
      if(!this._introDone){this.later(180,()=>this.loop());return;} // 进场台词未播完，轮轴等待
      let r;
      try{r=this.eng.advance();}catch(err){console&&console.error&&console.error('战斗推进异常:',err);return this._battleFail(err);}
      this.render();
      if(r.events&&r.events.length){
        // 行动者高亮（使用引擎记录的实际行动者）
        if(this.eng.lastActor)this.flashCard(this.eng.units.indexOf(this.eng.lastActor));
        this.eventsAnim(r.events,()=>{
          if(id!==this.runId)return;
          if(r.ended)return this.finish(r.result==='win');
          if(r.needInput)return this.waitInput();
          this.later(240,()=>this.loop());
        });
      }else{
        if(r.ended)return this.finish(r.result==='win');
        if(r.needInput)return this.waitInput();
        this.later(120,()=>this.loop());
      }
    };
    this.later(250,step);
  },
  /** 战斗内任何意外都安全结算为战败，保证 Promise 绝不悬挂、剧情链不卡死 */
  _battleFail(err){
    if(typeof window!=='undefined'&&window.alert){try{window.alert('本场战斗出现异常，已按战败安全结算以继续剧情。');}catch(e){}}
    if(this._finished)return;this._finished=true;
    try{closeModal();}catch(e){}
    this.resolve&&this.resolve(false);this.resolve=null;
  },
  eventsAnim(events,cb){
    let i=0;
    const next=()=>{
      if(i>=events.length)return cb();
      const e=events[i++];
      this.appendLog(e);
      this.sfxFor(e);
      if(e.type==='domain')this.playDomainCut(e);
      else if(e.type==='skillcut'){if(SFX.skill)SFX.skill();Fx.skill(e.actorName,e.text);} // 普通技能：仅音效，不语音播报
      else if(e.type==='ultcut'){if(SFX.ult)SFX.ult();SFX.speak('极之番，'+(e.text||'').replace(/^极之番\s*·\s*/,''));Fx.ult(e.actorName,e.text);} // 极之番：音效+语音念诵
      // 飘字
      if(e.to){const idx=this.eng.units.findIndex(u=>u.name===e.to);this.floatNum(idx,e.dmg,'');}
      if(e.type==='heal'&&e.from){const idx=this.eng.units.findIndex(u=>u.name===e.from);this.floatNum(idx,e.heal,'heal');}
      this.render();
      // 大字展现（领域/极之番/技能）使用固定时长，不被倍速压缩，保证至少停留约1秒以上
      const bigHold=e.type==='domain'?2200:e.type==='ultcut'?2200:e.type==='skillcut'?1600:null;
      if(bigHold!=null)this.laterFixed(bigHold,next);
      else this.later(e.type==='flash'?420:300,next);
    };
    next();
  },
  /** 按事件类型配战斗音效 */
  sfxFor(e){
    if(e.type==='flash')return SFX.crit();
    if(e.type==='die')return SFX.die();
    if(e.type==='heal')return SFX.heal();
    if(e.type==='hit'&&e.to)return SFX.hit();
  },
  /** 领域展开：全屏超大红字 + 念诵「领域展开·领域名」+ 轰鸣音效 */
  playDomainCut(e){
    SFX.domain();
    SFX.speak(`领域展开，${e.domainName||''}`);
    const ov=$('domainOverlay');if(!ov)return;
    const nm=$('domName'),who=$('domWho');
    if(nm)nm.textContent=(e.domainName||'领域');
    if(who)who.textContent=e.isPlayer?'—— 你 ——':(e.side==='ally'?`队友 · ${e.actorName||''}`:`敌方 · ${e.actorName||''}`);
    ov.classList.remove('show');void ov.offsetWidth;ov.classList.add('show');
    ov.classList.remove('shake');void ov.offsetWidth;ov.classList.add('shake');
    clearTimeout(this._domTimer);
    this._domTimer=setTimeout(()=>ov.classList.remove('show'),2200);
  },
  flashCard(idx){
    if(idx<0)return;
    const side=this.eng.units[idx].side==='ally'?'bfAlly':'bfEnemy';
    const el=$(side).querySelector(`[data-idx="${idx}"]`);
    if(el){el.classList.add('acting');setTimeout(()=>el.classList.remove('acting'),500);}
  },
  floatNum(idx,val,cls){
    if(idx<0||!val)return;
    const u=this.eng.units[idx];const side=u.side==='ally'?'bfAlly':'bfEnemy';
    const el=$(side).querySelector(`[data-idx="${idx}"]`);if(!el)return;
    const f=document.createElement('div');f.className='float-dmg '+cls;
    f.textContent=(cls==='heal'?'+':'-')+val;el.appendChild(f);setTimeout(()=>f.remove(),1000);
  },
  waitInput(){
    this._awaitingInput=true;
    ['actMelee','actTech','actDomain','actDefend'].forEach(id=>{const b=$(id);if(id!=='actDomain')b.disabled=false;});
    const p=this.eng.player;
    $('actDomain').disabled=!p.canDomain;$('actDomain').textContent=(p.domainCd||0)>0?(p.reverse?'修复熔断中':'领域熔断中'):'领 域 展 开';
    const ultBtn=$('actUlt');
    if(ultBtn){const ultOk=p.canUlt&&!p.ultUsed&&p.cp>=p.maxCp*0.5;ultBtn.style.display=p.canUlt&&!p.ultUsed?'':'none';ultBtn.disabled=!ultOk;}
    $('bfTip').textContent=this.auto?'自动战斗中……（也可手动点指令接管）':'轮到你的行动——选择指令（可点击敌方头像切换目标）';
    if(this.auto)this.scheduleAuto();
  },
  /** 自动战斗：选择最优目标与指令 */
  autoChoose(){
    const p=this.eng.player,es=this.eng.alive('enemy');
    if(!es.length)return 'defend';
    // 目标：优先血量最低（收割），否则等级最高
    const target=es.slice().sort((a,b)=>(a.hp-b.hp)||(b.li-a.li))[0];
    this.selectedTargetIdx=this.eng.units.indexOf(target);
    const cost=this.eng.techCost(p);
    // 极之番：已学会、本场未用、蓝够半管，且多敌/强敌/敌方血线高时优先释放（一场仅一次）
    if(p.canUlt&&!p.ultUsed&&p.cp>=p.maxCp*0.5&&(es.length>=2||es.some(e=>e.li>=7)||target.hp>target.maxHp*0.5))return'ult';
    // 领域：可开且（多敌 / 强敌 / 敌方血线高）
    if(p.canDomain&&(p.domainCd||0)<=0&&p.cp>=p.maxCp*0.30&&(es.length>=2||es.some(e=>e.li>=7)||target.hp>target.maxHp*0.6))return'domain';
    // 残血且缺蓝 -> 防御回蓝
    if(p.hp<p.maxHp*0.28&&p.cp<cost)return'defend';
    if(p.cp>=cost)return Math.random()<0.88?'tech':'melee';
    return Math.random()<0.5?'melee':'defend';
  },
  scheduleAuto(){
    clearTimeout(this._autoTimer);
    const id=this.runId;
    this._autoTimer=setTimeout(()=>{
      if(id!==this.runId)return;
      if(!this.eng||this.eng.ended||!this._awaitingInput)return;
      this.input(this.autoChoose());
    },this.sd(420));
  },
  tryFlee(){
    if(!this.eng||this.eng.ended)return;
    let ok=true;
    try{ok=window.confirm('确定撤退吗？\n· 剧情战：按本场战败规则结算（标注“战败不死 / 连战”的战斗可安全撤离，死斗场撤退等于败亡）\n· 狩猎：放弃本次狩猎，安全返回、无奖励');}catch(e){}
    if(!ok)return;
    this._awaitingInput=false;clearTimeout(this._autoTimer);
    let r;try{r=this.eng.flee();}catch(err){console&&console.error&&console.error('撤退异常:',err);return this._battleFail(err);}
    this.render();
    this.eventsAnim(r.events,()=>this.finish(false));
  },
  input(action){
    this._awaitingInput=false;clearTimeout(this._autoTimer);
    ['actMelee','actTech','actDomain','actUlt','actDefend'].forEach(id=>{const b=$(id);if(b)b.disabled=true;});
    let r;
    try{r=this.eng.playerAct(action,this.selectedTargetIdx);}
    catch(err){console&&console.error&&console.error('玩家行动异常:',err);return this._battleFail(err);}
    this.render();
    this.eventsAnim(r.events,()=>{
      if(r.ended)return this.finish(r.result==='win');
      if(r.retryInput)return this.waitInput(); // 熔断/缺蓝：不耗回合，重新等待指令
      this.loop();
    });
  },
  finish(win){
    if(this._finished)return;this._finished=true; // 幂等：一场只结算一次，杜绝重复 resolve/跨场误结算
    this.lastResult=this.eng?this.eng.result:null; // 记录 win/lose/flee，供狩猎区分主动撤退与战死
    const id=this.runId;
    (async()=>{
      // 结算台词：玩家胜→敌人败辞+队友胜辞，玩家败→队友败辞+敌人胜辞；主动撤退不播台词
      const list=this.lastResult==='flee'?[]:endQuoteList(this.scene,this.eng.units,win);
      for(const x of list){if(id!==this.runId)return;await Fx.quote(x.who,x.text);}
      this.later(900,()=>{if(id!==this.runId)return;closeModal();this.resolve&&this.resolve(win);this.resolve=null;});
    })();
  }
};

/* ============================ VIII. 游戏主控 ============================ */
const Game={
  player:null,day:0,draws:{},logEl:null,
  /* ---------- 创建流程：12 转盘 ---------- */
  createSteps:[
    {title:'初始身份',items:WHEEL_IDENTITY,key:'identity'},
    {title:'穿越的时间点',items:WHEEL_ERA,key:'era'},
    {title:'穿越后的年龄',items:WHEEL_AGE,key:'age'},
    {title:'穿越后的性别',items:WHEEL_GENDER,key:'gender'},
    {title:'穿越后的颜值',items:WHEEL_FACE,key:'face'},
    {title:'生得术式',items:WHEEL_TECHNIQUE.map(t=>({label:t.name,desc:t.desc,name:t.name,flag:t.flag,domain:t.domain,flags:t.flags})),key:'technique'},
    {title:'初始咒力总量',items:buildStatWheel('cp'),key:'cp'},
    {title:'初始咒力操控',items:buildStatWheel('ctl'),key:'ctl'},
    {title:'初始体术水平',items:buildStatWheel('melee'),key:'melee'},
    {title:'初始体质水平',items:WHEEL_HP,key:'hp'},
    {title:'初始咒力效率',items:buildStatWheel('eff'),key:'eff'},
    {title:'成长值',items:WHEEL_GROWTH,key:'growth'}],
  stepIdx:0,wheel:null,autoTimer:null,
  startCreate(){
    $('titleScreen').classList.add('hidden');
    $('mainScreen').classList.add('hidden');
    $('createScreen').classList.remove('hidden');
    this.createSession=(this.createSession||0)+1;this.draws={};this.stepIdx=0;
    if(!this.wheel)this.wheel=new WheelView($('wheelCanvas'));
    $('progressDots').innerHTML=this.createSteps.map((_,i)=>`<div class="dot"></div>`).join('');
    this.loadStep(0);
  },
  loadStep(i){
    this.stepIdx=i;
    const s=this.createSteps[i];
    $('stepIdx').textContent=i+1;
    $('wheelTitle').textContent=s.title;
    $('wheelResult').textContent='点击「抽取」转动命运之轮……';
    $('btnSpin').disabled=false;$('btnSpin').classList.remove('hidden');
    $('btnNextWheel').classList.add('hidden');
    this.wheel.setItems(s.items);
    $('wheelLegend').innerHTML=wheelLegendHtml(s.items);
    $('wheelLegend').scrollTop=0;
    document.querySelectorAll('#progressDots .dot').forEach((d,k)=>{
      d.className='dot'+(k<i?' done':k===i?' cur':'');
    });
    this.renderCreateAttrs();
  },
  doSpin(){
    $('btnSpin').disabled=true;
    const s=this.createSteps[this.stepIdx];
    const spinSession=this.createSession;this.wheel.spin((item,idx)=>{if(spinSession!==this.createSession)return;
      const picked=deepCopy(item);
      if(s.key==='hp')picked.tierIdx=idx;
      this.draws[s.key]=picked;
      $('wheelLegend').innerHTML=wheelLegendHtml(s.items,idx);
      const hitEl=$('wheelLegend').querySelector('.lg-item.hit');/* keep viewport stable */
      $('wheelResult').innerHTML=`<span class="hl">${item.label}</span>${item.desc?'<br><small>'+item.desc+'</small>':''}`;
      this.renderCreateAttrs();
      const btn=$('btnNextWheel');
      btn.classList.remove('hidden');
      btn.textContent=this.stepIdx===11?'✔ 进入《咒术回战》世界':'前往下一个转盘 →';
      clearTimeout(this.autoTimer);
      /* HD2D: explicit next step; saves remain reviewable. */
    });
  },
  nextStep(){
    clearTimeout(this.autoTimer);
    if(this.stepIdx<11){this.loadStep(this.stepIdx+1);}
    else{this.finishCreate();}
  },
  renderCreateAttrs(){
    const nameMap={identity:'初始身份',era:'穿越时间点',age:'年龄',gender:'性别',face:'颜值',technique:'生得术式',
      cp:'咒力总量',ctl:'咒力操控',melee:'体术水平',hp:'体质水平',eff:'咒力效率',growth:'成长值'};
    const keys=Object.keys(nameMap);
    const got=keys.filter(k=>this.draws[k]);
    if(!got.length){$('createAttrList').innerHTML='<div class="attr-row"><span class="k">尚未抽取</span><span class="v" style="color:var(--txt3)">命运的轮盘尚未开始转动……</span></div>';return;}
    $('createAttrList').innerHTML=got.map(k=>{
      const d=this.draws[k];
      return `<div class="attr-row"><span class="k">${nameMap[k]}</span><span class="v">${d.label}${d.desc?`<br><small>${d.desc}</small>`:''}</span></div>`;
    }).join('');
  },
  finishCreate(){
    this.player=Player.create(this.draws);
    this.day=this.player.startDay;
    $('titleScreen').classList.add('hidden');
    $('createScreen').classList.add('hidden');
    $('mainScreen').classList.remove('hidden');
    this.logEl=$('mainLog');
    this.addLog('lp',`════ 你穿越到了《咒术回战》的世界 ════`);
    this.addLog('lg',`时间点：${this.player.eraLabel}（游戏第 ${this.day} 天）。${this.player.eraDesc}`);
    this.addLog('lg',`身份【${this.player.identity}】：${this.player.identityDesc}`);
    this.addLog('lg',`生得术式【${this.player.technique.name}】：${this.player.technique.desc}`);
    this.addLog('lgold',`综合评级：${lvName(this.player.levelIndex)}｜成长：${this.player.growthLabel}（固定增量×${this.player.growthMult}）｜${this.player.ageNote}`);
    this.addLog('lg','提示：转动行动转盘度过每一天，剧情日将自动触发战斗；第120天新宿决战后迎来结局。');
    this.render();
  },
  /* ---------- 主界面渲染 ---------- */
  addLog(cls,txt){
    if(!this.logEl)return;
    const d=document.createElement('div');d.className=cls||'lg';d.textContent=txt;
    this.logEl.appendChild(d);this.logEl.scrollTop=this.logEl.scrollHeight;
  },
  render(){
    const P=this.player;if(!P)return;
    $('dayNum').textContent=this.day;$('dayEra').textContent=eraOfDay(this.day);
    const nextD=EVENT_DAYS.find(d=>d>this.day);
    $('chapterTag').textContent=nextD?`下一剧情：第${nextD}天 · ${STORY[nextD].chapter}`:'终局将近';
    $('playerCard').innerHTML=`
      <h3>角色面板</h3>
      <div class="stat-line"><span>身份 / 年龄</span><b>${P.identity}${P.isVillain?' <span style=\"color:#ff5a5a\">（反派阵营）</span>':' <span style=\"color:#7fd0ff\">（咒术师阵营）</span>'} · ${P.age}岁 · ${P.gender}</b></div>
      <div class="stat-line"><span>颜值 / 成长</span><b>${P.face}级 / ${P.growthLabel}（固定×${P.growthMult}）</b></div>
      <div class="stat-line"><span>生得术式</span><b style="font-size:12px">${P.technique.name}（领域·${P.technique.domain}）</b></div>
      <div class="stat-line"><span>综合评级</span><b style="color:var(--gold)">${lvName(P.levelIndex)}</b></div>
      <div class="stat-line" style="margin-top:8px"><span>体质层级</span><b style="font-size:12px">${HP_TIERS[hpTierIndexOf(P.maxHp)][0]}</b></div>
      <div style="font-size:12px;color:var(--txt2)">生命 HP <b style="color:#ff9aa4">${Math.round(P.hp)}/${P.maxHp}</b></div>
      <div class="bar hp"><i style="width:${pct(P.hp,P.maxHp)}"></i></div>
      <div style="margin-top:8px;font-size:12px;color:var(--txt2)">咒力 CP【${lvName(tierIndexOf(P.maxCp,CP_TIERS))}】 <b style="color:#8fdcf5">${Math.round(P.cp)}/${P.maxCp}</b></div>
      <div class="bar cp"><i style="width:${pct(P.cp,P.maxCp)}"></i></div>
      <div class="stat-line" style="margin-top:8px"><span>体术伤害【${lvName(tierIndexOf(P.melee[1],DMG_TIERS))}】</span><b>${P.melee[0]}~${P.melee[1]}</b></div>
      <div class="stat-line"><span>术式伤害【${lvName(tierIndexOf(P.eff[1],DMG_TIERS))}】</span><b>${P.eff[0]}~${P.eff[1]}</b></div>
      <div class="stat-line"><span>咒力操控【${lvName(tierIndexOf(P.ctl,CTL_TIERS))}】</span><b>减免 ${P.ctl}</b></div>
      <div class="stat-line"><span>术式熟练度（300%领悟极之番）</span><b>${Math.round(P.prof)}%${P.domainLearned?' ✔领域':''}${P.ultimateLearned?' ✔极之番':''}</b></div>
      <div class="bar"><i style="width:${clamp(P.prof/3,0,100)}%"></i></div>`;
    const sk=[];
    sk.push(P.domainLearned?'✔ 领域展开（大招；用后熔断，反转者间隔一回合可再开）':'✘ 领域展开（熟练度100%领悟）');
    sk.push(P.ultimateLearned?'✔ 极之番（熟练度300%领悟：耗半蓝、敌全体500%、回满血，每场一次）':'✘ 极之番（熟练度300%领悟终极奥义）');
    sk.push(P.reverse?'✔ 反转术式（被动：回合耗5%咒力回20%血）':'✘ 反转术式（每场战斗5%几率领悟）');
    sk.push(P.blackFlash?'✔ 黑闪（10%触发，伤害×10+五维+10%）':'✘ 黑闪（战斗5%自行领悟，或战胜东堂葵学会）');
    sk.push(`主术式：${P.technique.name}（领域：${P.technique.domain}）`);
    if(P.stolenTechs&&P.stolenTechs.length)P.stolenTechs.forEach(t=>sk.push(`夺取术式：${t.name}（熟练度${Math.round(t.prof)}%${t.domain?'，领域：'+t.domain:''}）`));
    $('skillList').innerHTML=sk.map(s=>'<div>· '+s+'</div>').join('');
    // 下一事件
    if(nextD){
      const node=STORY[nextD];
      $('nextEvent').innerHTML=`距下一剧情事件还有 <b style="color:var(--gold)">${nextD-this.day}</b> 天｜第${nextD}天【${node.title}】`;
    }else{$('nextEvent').innerHTML='所有主线剧情已落幕。';}
  },
  showDetail(){
    const P=this.player;
    showModal(`<h2>详细属性</h2>
      <p style="line-height:2.2">
      <b>穿越档案</b>：${P.identity}，${P.age}岁，${P.gender}，颜值${P.face}；穿越时间点【${P.eraLabel}】（第${P.startDay}天）。<br>
      <b>生得术式</b>：${P.technique.name}——${P.technique.desc}<br>
      <b>成长资质</b>：${P.growthLabel}（每次修炼/战胜按当前等级给<b>固定数值</b>，系数×${P.growthMult}，不随已有属性滚动）。${P.ageNote}。<br>
      <b>体质层级</b>：${HP_TIERS[hpTierIndexOf(P.maxHp)][0]}（最大生命 ${P.maxHp}）<br>
      <b>咒力总量【${lvName(tierIndexOf(P.maxCp,CP_TIERS))}】</b>：${P.maxCp}（综合评级${lvName(Player.evalLevel(P))}）｜<b>咒力操控【${lvName(tierIndexOf(P.ctl,CTL_TIERS))}】</b>：减免 ${P.ctl}<br>
      <b>体术【${lvName(tierIndexOf(P.melee[1],DMG_TIERS))}】</b>：${P.melee[0]}~${P.melee[1]}｜<b>术式伤害【${lvName(tierIndexOf(P.eff[1],DMG_TIERS))}】</b>：${P.eff[0]}~${P.eff[1]}<br>
      <b>术式熟练度</b>：${Math.round(P.prof)}%｜黑闪累计加成×${P.statBoost}<br>
      <b>战绩</b>：剧情/战斗 ${P.battleCount} 场，狩猎 ${P.huntCount} 次，击溃敌人 ${P.killCount}，触发黑闪 ${P.flashCount} 次。
      </p><div class="center"><button class="btn" onclick="closeModal()">闭</button></div>`);
  },
  /* ---------- 每日行动 ---------- */
  async dailyAction(){
    $('btnActionWheel').disabled=true;
    this.day++;
    if(STORY[this.day]&&this.day>=this.player.startDay){
      this.render();this.addLog('lred',`◆ 第${this.day}天——剧情事件【${STORY[this.day].title}】触发！`);
      try{await this.triggerEvent(this.day);}
      catch(err){console&&console.error&&console.error('剧情推进异常:',err);this.addLog('lred','剧情推进出现异常，已安全收尾。');
        const _node=STORY[this.day];if(_node&&_node.final)return this.ending('loseFinal',_node);}
      this.afterBattleRecover();
      this.render();
      $('btnActionWheel').disabled=false;
      return;
    }
    const pick=await openWheelModal({title:`第 ${this.day} 天 · 行动转盘`,items:WHEEL_DAILY});
    if(pick.act==='hunt'){await this.hunt();}
    else{const txt=Player.train(this.player,pick.act);this.addLog('lcyan',`【${pick.label}】${txt}`);}
    this.render();
    $('btnActionWheel').disabled=false;
  },
  afterBattleRecover(){const P=this.player;P.hp=P.maxHp;P.cp=P.maxCp;},
  /** 反派路线阵营翻转：原主线BOSS/对手变队友，原主线队友变敌人；noFlip场（正派切磋）保持不变 */
  flipSides(enemies,allies,noFlip){
    const v=!!this.player.isVillain&&!noFlip;
    if(!v)return {enemies:deepCopy(enemies||[]),allies:deepCopy(allies||[]),villain:false};
    return {enemies:deepCopy(allies||[]),allies:deepCopy(enemies||[]),villain:true};
  },
  async hunt(){
    const P=this.player;
    const pool=Player.huntPool(P);
    const items=pool.map(p=>({label:`${lvName(p.tier)}咒灵`,weight:p.weight,tier:p.tier}));
    const pick=await openWheelModal({title:'狩猎转盘（同级咒灵权重50%）',items});
    this.addLog('lg',`你外出狩猎，遭遇了【${pick.label}】。`);
    let win;
    try{win=await BattleUI.run({title:`狩猎 · ${pick.label}`,player:P,
      enemies:[{name:lvName(pick.tier)+'咒灵',li:pick.tier,type:'咒灵',wild:true}],allies:[]});}
    catch(err){console&&console.error&&console.error('狩猎异常:',err);win=false;}
    P.battleCount++;
    this.afterBattleRecover();
    if(win){P.huntCount++;P.killCount++;const t=Player.reward(P,pick.tier);this.addLog('lgreen',`狩猎成功！${t}`);}
    else if(BattleUI.lastResult==='flee'){this.addLog('lg','你主动脱离了狩猎，安全返回，未获收益。');}
    else if(P.isVillain){this.addLog('lgold','【反派路线】你从狩猎中脱身，未致死亡。');}
    else{this.ending('death',{title:'狩猎咒灵'});}
  },
  /* ---------- 剧情事件 ---------- */
  async triggerEvent(day){
    const node=STORY[day],P=this.player;
    await this.storyModal(node.title,node.intro,node.chapter);
    if(node.wheel){
      const pick=await openWheelModal({title:node.wheel.title,items:node.wheel.items});
      if(pick.skipText){this.addLog('lg',pick.skipText);return;}
      const b=pick.battle;
      await this.storyModal(node.title+' · '+pick.label,b.intro);
      await this.runBattleCfg(day,b,node,pick.label);
    }else{
      await this.runStage(day,node,0);
    }
  },
  runStage(day,node,si){
    const stage=node.stages[si];
    return (async()=>{
      if(stage.intro)await this.storyModal(node.title+(node.stages.length>1?`（第${si+1}场）`:''),stage.intro);
      const sides=this.flipSides(stage.enemies,stage.allies,stage.noFlip);
      const isLast=si>=node.stages.length-1;
      // 反派路线：翻转后若没有敌人（本场原无正派队友，皆为同阵营），不交战直接推进
      if(sides.villain&&sides.enemies.length===0){
        this.addLog('lgold','【反派路线】此处尽是同阵营的存在，未发生交战，你顺势推进。');
        if(node.final)return isLast?this.ending('win'):this.runStage(day,node,si+1);
        return;
      }
      let win;
      try{
        win=await BattleUI.run({title:`${node.title}${node.stages.length>1?' · 第'+(si+1)+'场':''}`,player:this.player,
          enemies:sides.enemies,allies:sides.allies,villain:sides.villain,scene:`s${day}_${si}`});
      }catch(err){console&&console.error&&console.error('连战第'+(si+1)+'场异常:',err);win=false;
        this.addLog('lred','本场战斗出现异常，已按战败安全结算并继续剧情。');}
      this.player.battleCount++;
      this.afterBattleRecover();
      // 反派·新宿决战：必须依次击溃六组正派，赢则进下一组、输也由宿傩掩护撤到下一组，仅第六场终局
      const villainFinal=node.final&&sides.villain;
      if(win){
        this.player.killCount+=sides.enemies.length;
        const maxLi=Math.max(...sides.enemies.map(e=>e.li));
        const rw=Player.reward(this.player,maxLi);
        this.addLog('lgreen',`✔ 战胜：${node.title}。${rw}`);
        if(stage.winQuote){await this.storyModal('顺平的遗言','',null,`<div class="story-quote">「${stage.winQuote}」</div>`);}
        if(stage.winSkill==='blackFlash'&&!this.player.blackFlash){
          this.player.blackFlash=true;this.player.notes.push('京都篇战胜东堂葵，学会【黑闪】');
          await this.storyModal('领悟 · 黑闪',stage.winSkillText);
          this.addLog('lgold','★ 你学会了【黑闪】！');
        }
        if(villainFinal){
          if(isLast)return this.ending('win');
          this.addLog('lgold','【反派路线】你击溃了这组咒术师，新宿决战继续——扑向下一组对手。');
          return this.runStage(day,node,si+1);
        }
        if(node.final)return this.ending('win');
        return;
      }
      // 战败分支
      if(villainFinal){
        if(isLast)return this.ending('loseFinal',node);
        this.addLog('lred','【反派路线】宿傩掩护你撤出本场，重整后扑向下一组咒术师。');
        return this.runStage(day,node,si+1);
      }
      // 反派普通剧情战：战败一律安全撤退、不死亡（高容错，避免五条悟等堵门）
      if(sides.villain){
        this.addLog('lgold','【反派路线】你从容撤退保住性命，剧情继续推进。');
        return;
      }
      if(stage.lose==='die'){
        if(node.final)return this.ending('loseFinal',node);
        return this.ending('death',node);
      }
      if(stage.lose==='continue'){
        this.addLog('lred','你在本场战斗中倒下，但剧情并未因此终结——同伴接住了战局。');
        return;
      }
      if(stage.lose==='next'){
        const ns=node.stages[si+1];
        if(!ns){this.addLog('lg','同伴们完成了收尾。');return;}
        this.addLog('lred','本场败北，战局进入下一阶段……');
        return this.runStage(day,node,si+1);
      }
    })();
  },
  async runBattleCfg(day,b,node,sceneLabel){
    const sides=this.flipSides(b.enemies,b.allies,b.noFlip);
    if(sides.villain&&sides.enemies.length===0){this.addLog('lgold','【反派路线】此处尽是同阵营的存在，未发生交战，你顺势推进。');return;}
    let win;
    try{win=await BattleUI.run({title:node.title,player:this.player,enemies:sides.enemies,allies:sides.allies,villain:sides.villain,scene:`s${day}_${sceneLabel}`});}
    catch(err){console&&console.error&&console.error('剧情战斗异常:',err);win=false;this.addLog('lred','本场战斗出现异常，已按战败安全结算。');}
    this.player.battleCount++;this.afterBattleRecover();
    if(win){
      this.player.killCount+=sides.enemies.length;
      const rw=Player.reward(this.player,Math.max(...sides.enemies.map(e=>e.li)));
      this.addLog('lgreen',`✔ 战胜：${node.title}。${rw}`);
    }else{
      if(sides.villain){this.addLog('lgold','【反派路线】你从容撤退保住性命，剧情继续推进。');}
      else if(b.lose==='continue'){this.addLog('lred','你在本场战斗中倒下，但同伴掩护你撤出，未致死亡。');}
      else if(node.final){this.ending('loseFinal',node);}
      else{this.ending('death',node);}
    }
  },
  storyModal(title,text,chapter,extraHtml){
    return new Promise(res=>{
      showModal(`<h2>${title}</h2>${chapter?`<div class="center" style="color:var(--purple);letter-spacing:3px;margin-bottom:10px">${chapter}</div>`:''}
        <p>${text||''}</p>${extraHtml||''}
        <div class="center"><button class="btn" id="storyOk">继 续</button></div>`);
      $('storyOk').onclick=()=>{closeModal();res();};
    });
  },
  /* ---------- 结局与后日谈 ---------- */
  ending(kind,node){
    const P=this.player;
    closeModal();$('mainScreen').classList.add('hidden');
    let screen=document.createElement('section');screen.className='screen';
    const records=`
      <div class="records">
        <div class="r-item"><span>初始身份</span><b>${P.identity}</b></div>
        <div class="r-item"><span>穿越时间点</span><b>${P.eraLabel}</b></div>
        <div class="r-item"><span>年龄 / 性别 / 颜值</span><b>${P.age}岁 / ${P.gender} / ${P.face}</b></div>
        <div class="r-item"><span>生得术式</span><b>${P.technique.name}</b></div>
        <div class="r-item"><span>最终综合评级</span><b>${lvName(P.levelIndex)}</b></div>
        <div class="r-item"><span>最终咒力总量</span><b>【${lvName(tierIndexOf(P.maxCp,CP_TIERS))}】${P.maxCp}</b></div>
        <div class="r-item"><span>最终生命上限</span><b>${P.maxHp}</b></div>
        <div class="r-item"><span>术式伤害区间</span><b>【${lvName(tierIndexOf(P.eff[1],DMG_TIERS))}】${P.eff[0]}~${P.eff[1]}</b></div>
        <div class="r-item"><span>历经战斗 / 狩猎</span><b>${P.battleCount} 场 / ${P.huntCount} 次</b></div>
        <div class="r-item"><span>黑闪触发</span><b>${P.flashCount} 次（累计加成×${P.statBoost}）</b></div>
      </div>`;
    const skills=[];
    if(P.domainLearned)skills.push('术式熟练度圆满，展开过自己的领域');
    if(P.reverse)skills.push('在生死边缘掌握了反转术式');
    if(P.blackFlash)skills.push('掌握黑闪');
    if(P.stolen.length)skills.push('通过死而替生夺取了：'+P.stolen.join('、'));
    let title='',tcls='',body='';
    if(kind==='win'){
      title='新 宿 决 战 · 胜 利';tcls='win';
      body=P.isVillain
       ?`新宿的废墟上，人类最强五条悟与咒术师联军相继倒下——你与诅咒一方并肩作战到最后，亲眼见证了咒术师时代的落幕。\n\n你以【${P.identity}】之身、凭【${P.technique.name}】，从${P.eraLabel}起步，一路站到了诅咒的王座旁。${skills.length?'你的传奇履历：'+skills.join('；')+'。':''}${P.notes.length?'\n\n旅途印记：\n· '+P.notes.slice(-8).join('\n· '):''}\n\n后日谈（反派路线）：诅咒的时代彻底降临，阴影重新笼罩世界。而你——作为亲手改写战局的穿越者，名字被诅咒们以敬畏之音传颂。轮回转盘停止，这一次，是属于诅咒的结局。`
       :`五条悟、虎杖、乙骨、东堂……无数咒术师的意志汇于你一身。第120天，随着最后一击落下，两面宿傩的诅咒终于消散在新宿的晨光里。\n\n你以【${P.identity}】之身、凭【${P.technique.name}】，从${P.eraLabel}起步，一路走到了诅咒时代的终幕。${skills.length?'你的传奇履历：'+skills.join('；')+'。':''}${P.notes.length?'\n\n旅途印记：\n· '+P.notes.slice(-8).join('\n· '):''}\n\n后日谈：咒术高专恢复了往日的课程，东京的街头不再有咒灵徘徊。而你——作为亲历了一切的穿越者，你的名字被悄然载入咒术界的隐秘档案。轮回转盘停止，这一次，是最好的结局。`;
    }else if(kind==='loseFinal'){
      title='新 宿 决 战 · 败 北';tcls='lose';
      body=`六连战接连败北，第五削的宿傩终究未能被阻止。你倒在新宿的废墟中，意识沉入黑暗。\n\n以【${P.identity}】之身、凭【${P.technique.name}】，你从${P.eraLabel}坚持到了最终决战，历经 ${P.battleCount} 场战斗——这份斗志无人可以否定。${P.notes.length?'\n\n旅途印记：\n· '+P.notes.slice(-8).join('\n· '):''}\n\n后日谈（战败）：诅咒的时代以最沉重的方式落幕，幸存的人们在废墟上重建一切。某个世界线里，轮回转盘仍在等待下一位穿越者改写结局。`;
    }else{
      title='战 死 · 轮 回 终 止';tcls='lose';
      body=`你倒在了【${node?node.title:'战场'}】。\n\n穿越者的生命只有一次——战败即死亡，没有第二种惩罚，也没有重来。你的档案永远停在了第 ${this.day} 天：【${P.identity}】，术式【${P.technique.name}】，最终评级${lvName(P.levelIndex)}。${P.notes.length?'\n\n旅途印记：\n· '+P.notes.slice(-8).join('\n· '):''}\n\n后日谈：咒术界少了一位无名的战士，而诅咒仍在暗处涌动。轮回转盘缓缓停下——要再试一次吗？下一次，或许就能活到新宿决战的终幕。`;
    }
    screen.innerHTML=`<div class="ending-wrap">
      <div class="ending-title ${tcls}">${title}</div>
      ${records}
      <div class="ending-text"><b>▍后日谈</b>\n\n${body}</div>
      <div class="center" style="margin-top:20px"><button class="btn" onclick="location.reload()">重 新 转 动 轮 回</button></div>
    </div>`;
    document.body.appendChild(screen);
    window.scrollTo(0,0);
  }
};

/* 把数据与逻辑暴露给测试环境（浏览器中无副作用） */
G.JJK_DATA={LEVELS,CP_TIERS,CTL_TIERS,DMG_TIERS,HP_TIERS,TIER_W,GROWTH,
  WHEEL_IDENTITY,WHEEL_ERA,WHEEL_AGE,WHEEL_GENDER,WHEEL_FACE,WHEEL_TECHNIQUE,WHEEL_GROWTH,WHEEL_DAILY,WHEEL_HP,
  buildStatWheel,GAIN_BASE,fixedGain,weightedIndex,weightedPick,rand,clamp,lvName,Player,BattleEngine,STORY,EVENT_DAYS,
  tierIndexOf,hpTierIndexOf,npcHpRange,tierCp,tierDmg,tierCtl,NPC_CHARS,getCharSpec,TECH_DOMAIN,TECH_MOVE,tierMidCp,tierMidDmg,tierMidCtl,charHp};

/* ============================ IX. 事件绑定 & 启动 ============================ */
$('btnStart').onclick=()=>Game.startCreate();
$('btnRestartTitle').onclick=()=>location.reload();
$('btnSpin').onclick=()=>Game.doSpin();
$('btnNextWheel').onclick=()=>Game.nextStep();
$('btnActionWheel').onclick=()=>Game.dailyAction();
$('btnShowAttr').onclick=()=>Game.showDetail();
$('modalMask').addEventListener('click',e=>{/* 战斗/剧情模态禁止点遮罩关闭，防误触 */});
// —— 抽取/开始按钮点击音 ——
['btnStart','btnSpin','btnNextWheel','btnActionWheel','btnShowAttr','btnRestartTitle'].forEach(id=>{const el=$(id);if(el)el.addEventListener('click',()=>SFX.click());});
// —— 音效开关 ——
(function(){const b=$('btnSound');if(!b)return;
  const sync=()=>{b.textContent=SFX.muted?'🔇 音效关':'🔊 音效开';b.classList.toggle('off',SFX.muted);};
  sync();b.onclick=()=>{SFX.setMuted(!SFX.muted);if(!SFX.muted)SFX.unlock()||SFX.click();sync();};})();
// —— 语音念诵独立开关（只控制领域/极之番的语音播报，不影响音效与大字特效）——
(function(){const b=$('btnVoice');if(!b)return;
  const sync=()=>{b.textContent=SFX.voiceOn===false?'🗣 语音关':'🗣 语音开';b.classList.toggle('off',SFX.voiceOn===false);};
  sync();b.onclick=()=>{SFX.setVoice(SFX.voiceOn===false);if(SFX.voiceOn!==false)SFX.unlock();SFX.click();sync();};})();
// —— 全屏切换（特性检测，兼容不同浏览器）——
(function(){const b=$('btnFullscreen');if(!b)return;
  const fe=()=>document.fullscreenElement||document.webkitFullscreenElement;
  b.onclick=()=>{SFX.click();
    try{
      if(!fe()){const el=document.documentElement;(el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el);}
      else{(document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document);}
    }catch(e){}
  };
  const upd=()=>{b.textContent=fe()?'⛶ 退出全屏':'⛶ 全屏';};
  document.addEventListener('fullscreenchange',upd);document.addEventListener('webkitfullscreenchange',upd);})();
// —— 转盘转速 1×/2×/3× ——
document.querySelectorAll('.wspd').forEach(b=>{
  if(+b.dataset.wspd===SPIN_SPEED){document.querySelectorAll('.wspd').forEach(x=>x.classList.remove('on'));b.classList.add('on');}
  b.onclick=()=>{SFX.click();SPIN_SPEED=+b.dataset.wspd;
    try{localStorage.setItem('jjk_spin_speed',SPIN_SPEED);}catch(e){}
    document.querySelectorAll('.wspd').forEach(x=>x.classList.toggle('on',x===b));};
});

