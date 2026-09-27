/* Presentation metadata only: never changes combat rules or save data. */
(() => {
 const rows=[
 ['limitless','无下限术式','orb','咒力聚合 → 空间冲击'],['shadows','十种影法术','summon','地面影池 → 召唤显现'],
 ['cleave','御厨子','slash','交叉切线 → 裂痕消散'],['straw','刍灵咒法','nail','钉束飞出 → 共鸣刺点'],
 ['ratio','十划咒法','ratio','七三分割 → 定点斩击'],['cursedSpeech','咒言','wave','扩散声环 → 束缚'],
 ['spiritControl','咒灵操术','summon','咒力漩涡 → 召唤显现'],['idleTrans','无为转变','touch','贴身触碰 → 形体扭曲'],
 ['swap','不义游戏','rush','拍手残影 → 瞬移换位'],['blood','赤血操术','beam','凝血 → 细束贯穿'],
 ['crows','黑鸟操术','swarm','黑羽掠过 → 群袭'],['projection','投射咒法','rush','分帧残影 → 快速突进'],
 ['construct','构筑术式','nail','物质凝聚 → 金属投射'],['puppet','傀儡操术','summon','地面阵纹 → 傀儡显现'],
 ['moon','淀月','poison','弧形轨迹 → 毒雾滞留'],['rot','蚀烂腐术','poison','腐蚀侵入 → 残秽滞留'],
 ['miracle','奇迹','heal','被动触发预览 · 自身恢复'],['jacob','雅各布天梯','pillar','上空显光 → 垂直光柱'],
 ['amber','幻兽琥珀','lightning','电荷聚集 → 分叉雷击'],['judge','判决术式','slash','判决攻击预览 · 处刑剑切线'],
 ['cannon','咒力大炮','cannon','聚能 → 宽束轰击'],['mass','质量术式','heavy','重击蓄势 → 地面冲击环'],
 ['arms','鬼臂罗网','heavy','追踪连臂 → 重击冲击环'],['tsukumo','付丧操术','rush','加速预览 · 多段残影'],
 ['seance','降灵术','summon','降灵阵纹 → 轮廓显现'],['sky','天空术式','ward','空间折面 → 防御屏障'],
 ['grow','生长术式','heal','自身恢复 → 上升光点'],['fire','火灾操术','fire','火种飞行 → 火焰迸发'],
 ['gu','蛊毒术式','poison','毒束 → 持续雾团'],['copy','复制术式','orb','复制的实际技能接管；此处展示咒力弹'],
 ['negate','万象拒绝','ward','拒绝屏障 → 向外排斥'],['requiem','黄金体验镇魂曲','ward','被动触发预览 · 防护回环'],
 ['kaioken','界王拳','buff','增益预览 · 赤色升腾'],['ssj','超级赛亚人变身','buff','增益预览 · 金色升腾'],
 ['sage','仙人模式','heal','被动触发预览 · 自身恢复'],['reviveWin','死而替生','heal','被动触发预览 · 恢复回环']
 ];
 const techniques=Object.fromEntries(rows.map(([flag,label,kind,description])=>[flag,{flag,label,kind,description}]));
 const profiles=[['young-m','少年 · 男',18,'男'],['young-f','少女 · 女',18,'女'],['adult-m','成年 · 男',30,'男'],['adult-f','成年 · 女',30,'女'],['older-m','年长 · 男',55,'男'],['older-f','年长 · 女',55,'女']].map(([key,label,age,gender])=>({key,label,age,gender}));
 function playerKey(p={}){const age=Number(p.age)||18;return (age<23?'young':age<45?'adult':'older')+'-'+(p.gender==='女'?'f':'m');}
 const actorKeys={0:'gojo',1:'yuji',2:'megumi',3:'nobara',4:'nanami',5:'maki',6:'yuta',7:'todo',8:'kamo',9:'naoya',10:'yuki',11:'toji',12:'sukuna-yuji',13:'sukuna-megumi',14:'sukuna-heian',15:'kenjaku',16:'mahito',17:'jogo',18:'hanami',19:'dagon',20:'choso',21:'eso',22:'kechizu',23:'finger-bearer',24:'junpei',25:'koguy',26:'mahoraga',27:'naobito',28:'uraume',29:'dhruv',30:'kurourushi',31:'uro',32:'ryu',33:'higuruma',34:'kashimo',35:'hakari'};
 function battleActorKey(index,day=0,name=''){
  // Preserve the approved Shibuya uniform; support older save labels too.
  if(index===12&&/(15|16)指/.test(name))return 'sukuna-shibuya';
  return index===0&&day>=118?'gojo-shinjuku':actorKeys[index]||null;
 }
 window.CombatPresentation={techniques,profiles,playerKey,battleActorKey,selfKinds:['heal','ward','buff']};
})();
