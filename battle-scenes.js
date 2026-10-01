/* Canonical names are an explicit allowlist. Ordinary skills never select a domain. */
(() => {
  const profiles = {
    '无量空处': {key:'void', color:0x080e22, floor:0x080b16},
    '伏魔御厨子': {key:'shrine', color:0x20070c, floor:0x281316, open:true},
    '嵌合暗翳庭': {key:'shadow', color:0x071513, floor:0x091311, incomplete:true, overlay:true},
    '盖棺铁围山': {key:'lava', color:0x2c100b, floor:0x362119},
    '自闭圆顿裹': {key:'hands', color:0x140d25, floor:0x161023},
    '荡蕴平线': {key:'beach', color:0x60c4ed, floor:0xf8e7b5},
    '诛伏赐死': {key:'court', color:0x2d1b0b, floor:0x4a3e30, nonlethal:true}
  };
  for(const p of Object.values(profiles))p.file=`domains/v3/${p.key}.png`;
  Object.assign(profiles,{
    '坐杀博徒':{key:'jackpot',color:0x17352e,floor:0x6c7e77},
    '胎藏遍野':{key:'womb',color:0x231f19,floor:0x39332b,open:true},
    '真赝相爱':{key:'love',color:0x101a35,floor:0x393d4a},
    '时胞月宫殿':{key:'moon',color:0x08060e,floor:0x62526c},
    '朵颐光海':{key:'blossom',color:0xcce9e7,floor:0x748849,light:'#f6e3a3',motif:true,referenceKind:'game'}
  });
  for(const p of Object.values(profiles))p.file ||= `domains/v4/${p.key}.png`;
  const aliases={'嵌合暗翳廷':'嵌合暗翳庭','荡漾平线':'荡蕴平线','荡蕴平線':'荡蕴平线','自闭圆顿裏':'自闭圆顿裹'};
  const name = n => aliases[n] || n || '领域';
  const profile = n => profiles[name(n)] || null;
  // NPC identities are independent of the shared combat-stat technique flags.
  // Unnamed/unshown domains keep the game's expanded rules without borrowing a canon name.
  const npcDomains={
    '五条悟':'无量空处','宿傩':'伏魔御厨子','伏黑惠':'嵌合暗翳庭',
    '漏壶':'盖棺铁围山','真人':'自闭圆顿裹','花御':'朵颐光海','陀艮':'荡蕴平线',
    '日车宽见':'诛伏赐死','秤金次':'坐杀博徒','羂索':'胎藏遍野',
    '乙骨忧太':'真赝相爱','禅院直哉':'时胞月宫殿',
    '虎杖悠仁':'领域（名称未公开）','九十九由基':'领域（名称未公开）',
    '乌璐亨子':'领域（名称未公开）','石流龙':'领域（名称未公开）',
    '多鲁布':'领域（名称未公开）','里梅':'领域（扩展设定）','黑沐死':'领域（扩展设定）'
  };
  const actorName = actor => /宿傩/.test(actor||'')?'宿傩':({'漏瑚':'漏壶','乌鹭亨子':'乌璐亨子'})[actor]||actor;
  const npcDomain = actor => npcDomains[actorName(actor)] || null;
  // A shared "unnamed" title is never a shared environment identity.
  const actorProfiles={
    '虎杖悠仁':{key:'station',file:'domains/v4/station.png',color:0x53616a,floor:0x737a7a}
  };
  const motifs={
    '九十九由基':{key:'mass',light:'#e8c494',note:'质量重压岩场 · 术式主题演绎'},
    '乌璐亨子':{key:'sky',light:'#a3ddf2',note:'折叠天空 · 术式主题演绎'},
    '石流龙':{key:'output',light:'#d4bcf3',note:'咒力轰击废墟 · 术式主题演绎'},
    '多鲁布':{key:'orbit',light:'#e0d1a7',note:'式神巡游轨迹 · 术式主题演绎'},
    '里梅':{key:'frost',light:'#bfeaff',note:'冰凝街道 · 游戏扩展设定'},
    '黑沐死':{key:'swarm',light:'#bcce8d',note:'虫群巢域 · 游戏扩展设定'}
  };
  for(const p of Object.values(motifs))Object.assign(p,{file:`domains/v4/${p.key}.png`,motif:true,cinemaOnly:true});
  const neutral={key:'barrier',light:'#b7cadb',note:'游戏扩展领域 · 保留当前战场'};
  const domainPortraits={'五条悟':{domain:'无量空处',file:'battle/v1/gojo-domain.png',width:1024,height:1536,rect:[300,9,430,1483]}};
  const shibuyaSukuna={file:'battle/v1/sukuna-shibuya.png',width:1024,height:1536,rect:[262,14,546,1504]};
  const characterArt={'15指宿傩':shibuyaSukuna,'16指宿傩':shibuyaSukuna}; // old review/save labels remain readable
  const portrait=(actor,domain)=>{const art=domainPortraits[actor];return art&&art.domain===name(domain)?art:characterArt[actor]||null;};
  const profileFor = (field,units=[]) => {
    const unit=units[field.owner]||units.find(u=>u.name===field.actorName);
    const player=unit?.isPlayer||field.isPlayer||field.actorName==='你';
    const actor=actorName(unit?.name||field.actorName),expected=npcDomain(actor);
    if(player)return profile(field.name);
    return expected&&name(expected)===name(field.name)?(actorProfiles[actor]||profile(field.name)):null;
  };
  const presentationFor = (field,units=[]) => {
    const scene=profileFor(field,units);if(scene)return scene;
    const unit=units[field.owner]||units.find(u=>u.name===field.actorName);
    const actor=actorName(unit?.name||field.actorName),expected=npcDomain(actor);
    const player=unit?.isPlayer||field.isPlayer||field.actorName==='你';
    if(player)return neutral;
    if(expected&&name(expected)===name(field.name))return motifs[actor]||neutral;
    if(!expected&&name(field.name)==='领域')return neutral;
    return null;
  };
  const domainRoster=Object.entries(npcDomains).map(([who,title])=>({who,name:title,...presentationFor({actorName:who,name:title})}));
  if(typeof BattleEngine!=='undefined'){
    const make=BattleEngine.prototype.makeNpcUnit;
    BattleEngine.prototype.makeNpcUnit=function(...args){
      const unit=make.apply(this,args),domain=npcDomain(unit.name);
      if(domain)unit.domainName=domain;
      else if(unit.canDomain)unit.domainName='领域';
      return unit;
    };
  }
  // One registry drives the production stage, static fallback and scene rehearsal.
  const locations={
    rooftop:{file:'rooftop.png',place:'杉泽第三高校 · 屋顶'},
    campus:{file:'scenes/v1/campus-dusk.png',place:'东京咒术高专'},
    bridge:{file:'scenes/v1/bridge-night.png',place:'八十八桥周边 · 山路'},
    road:{file:'scenes/v1/bridge-night.png',place:'五条移动途中 · 林间公路'},
    shibuya:{file:'scenes/v1/shibuya-night.png',place:'涩谷 · 夜间街区'},
    detention:{file:'scenes/v2/detention.png',place:'少年院 · 生得领域'},
    subway:{file:'scenes/v2/subway.png',place:'涩谷站 · 地下通道'},
    passage:{file:'scenes/v2/subway.png',place:'明治神宫前 · 地下通道'},
    abandoned:{place:'废楼内部 · 钉崎初次任务'},
    forest:{place:'交流会 · 森林赛场'},
    'bridge-cave':{place:'八十八桥下 · 咒胎结界'},
    school:{place:'里樱高校 · 校舍外'},
    'school-hall':{place:'里樱高校 · 校内礼堂'},
    platform:{place:'涩谷站 · 地下站台'},
    restroom:{place:'涩谷站 · 洗手间'},
    'shibuya-ruins':{place:'涩谷 · 受损街区'},
    theatre:{place:'东京第一结界 · 剧场'},
    sendai:{place:'仙台结界 · 城区'},
    harbor:{place:'东京第二结界 · 港口货场'},
    sakurajima:{place:'樱岛结界 · 居住街区'},
    shinjuku:{place:'新宿 · 决战街道'},
    'shinjuku-ruins':{place:'新宿 · 决战废墟'}
  };
  for(const [key,p] of Object.entries(locations))p.file ||= `scenes/v3/${key}.png`;
  const background = key => locations[key]?.file || ({colony:locations.sendai.file,ruins:locations['shinjuku-ruins'].file})[key] || '';
  const location = (key,place) => ({key,...locations[key],...(place?{place}:{})});
  const world = day => {
    if(day<5)return {key:'rooftop',place:'杉泽第三高校 · 屋顶',chapter:'咒物现世'};
    if(day<25)return {key:'campus',place:'东京咒术高专',chapter:'高专生活'};
    if(day<34)return {key:'campus',place:'东京咒术高专',chapter:day<33?'少年院任务准备':'少年院事件之后'};
    if(day<49)return {key:'campus',place:'东京咒术高专',chapter:'幼鱼与逆罚'};
    if(day<69)return {key:'campus',place:'交流会会场 · 高专',chapter:'京都姐妹校交流会'};
    if(day<85)return {key:'bridge',place:'八十八桥周边',chapter:'起首雷同'};
    if(day<100)return {key:'shibuya',place:'涩谷街区',chapter:'涩谷事变'};
    if(day<118)return {key:'colony',place:'回游结界 · 城区',chapter:'死灭回游'};
    return {key:'ruins',place:'新宿战场',chapter:'人外魔境新宿决战'};
  };
  const battle = (cfg={},day=0) => {
    const d=Number.isFinite(cfg.chapterDay)?cfg.chapterDay:Number((cfg.scene||'').match(/^s(\d+)_/)?.[1]||day);
    const names=[...(cfg.enemies||[]),...(cfg.allies||[])].map(e=>e.name).join(' '), narrative=cfg.v3||!!cfg.scene;
    const stage=Number.isInteger(cfg.chapterStage)?cfg.chapterStage:Number((cfg.scene||'').match(/^s\d+_(\d+)$/)?.[1]||0);
    // Random hunts and ordinary encounters stay at the current location.
    if(!narrative)return world(day);
    if(d===3)return location('rooftop');
    if(d===10)return location('abandoned');
    if(d===33)return location('detention');
    if(d===35)return location('road');
    if(d===47)return location('school-hall');
    if(d===48)return location('school');
    if(d>=49&&d<69)return location('forest');
    if(d===78)return location(/血涂|坏相/.test(names)?'bridge':'bridge-cave');
    if(d===88)return location(/蝗虫/.test(names)?'passage':'platform');
    if(d===90){
      if(/蝗虫/.test(names))return location('passage');
      if(/陀艮|真人/.test(names))return location('subway');
      if(/魔虚罗|羂索|里梅/.test(names))return location('shibuya-ruins');
      if(/胀相/.test(names))return location('restroom');
      return location('shibuya');
    }
    if(d===105){
      if(/日车/.test(names))return location('theatre');
      if(/鹿紫云|秤金次/.test(names))return location('harbor');
      if(/直哉|加茂/.test(names))return location('sakurajima');
      return location('sendai');
    }
    if(d===120)return location(stage>0||/神武真身/.test(names)?'shinjuku-ruins':'shinjuku');
    return world(d);
  };
  window.BattleScenes={locations,background,location,profiles,actorProfiles,motifs,name,profile,profileFor,presentationFor,domainRoster,npcDomain,npcDomains,domainPortraits,characterArt,portrait,world,battle};
})();
