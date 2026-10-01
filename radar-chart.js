/* ============================================================
 * 六维雷达图（咒术等级刻度版）
 * - 六轴：咒力 / 操控 / 体术 / 咒效 / 体质 / 熟练
 * - 刻度环对应咒术师·咒灵等级：四级→三级→二级→一级→特级→超特级
 * - 轴值 = 该属性所处档位（0~11，对应 LEVELS 十二级），
 *   档位顶点之外（如体质第 13 档「超地表级」、数值突破表上限）
 *   以金色尖刺溢出图框 + 「规格外」标签夸张表现。
 * - 通用组件 RadarChart.draw(canvas, axes, opts)，玩家数据由
 *   RadarChart.playerAxes() 单独换算（用户要求：玩家另算）。
 * ============================================================ */
(function(){
'use strict';
if(typeof window==='undefined'||typeof document==='undefined')return;

const RING_LABELS=['四级','三级','二级','一级','特级','超特级'];
const TIER_MAX={cp:999999,ctl:9999,dmg:99999,hp:999999}; // 各表最高档上限

/** 由玩家对象换算六轴数据（依赖 engine.js 的全局表） */
function playerAxes(P){
  const t=(v,table)=>tierIndexOf(v,table);          // 0~11
  const over=(v,max)=>v>max?Math.min(0.35,0.12*Math.log10(v/max)):0;
  const hpTier=hpTierIndexOf(P.maxHp);              // 0~12（12=超地表级，天然溢出）
  const profTier=clamp(P.prof/300*11,0,11);         // 熟练度 0~300% → 0~11
  return [
    {key:'cp',   name:'咒力', tier:t(P.maxCp,CP_TIERS),       over:over(P.maxCp,TIER_MAX.cp),  text:fmtNum(P.maxCp)},
    {key:'ctl',  name:'操控', tier:t(P.ctl,CTL_TIERS),        over:over(P.ctl,TIER_MAX.ctl),   text:'减免'+fmtNum(P.ctl)},
    {key:'melee',name:'体术', tier:t(P.melee[1],DMG_TIERS),   over:over(P.melee[1],TIER_MAX.dmg), text:P.melee[0]+'~'+fmtNum(P.melee[1])},
    {key:'eff',  name:'咒效', tier:t(P.eff[1],DMG_TIERS),     over:over(P.eff[1],TIER_MAX.dmg), text:P.eff[0]+'~'+fmtNum(P.eff[1])},
    {key:'hp',   name:'体质', tier:Math.min(hpTier,11),       over:hpTier>=12?0.18+over(P.maxHp,TIER_MAX.hp):over(P.maxHp,TIER_MAX.hp), text:fmtNum(P.maxHp)},
    {key:'prof', name:'熟练', tier:profTier,                  over:0,                          text:Math.round(P.prof)+'%'},
  ];
}
function fmtNum(n){n=Math.round(n);return n>=10000?(n/10000).toFixed(n>=100000?0:1)+'万':String(n);}

/**
 * 绘制六维图。
 * canvas 建议正方形；axes: [{name,tier(0~11),over(0~0.35),text}]
 * opts: {centerLabel, centerValue, gold(整体金色边框，用于爆表玩家)}
 */
function draw(canvas,axes,opts){
  opts=opts||{};
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const cssW=canvas.clientWidth||260,cssH=canvas.clientHeight||260;
  canvas.width=cssW*dpr;canvas.height=cssH*dpr;
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  const cx=cssW/2,cy=cssH/2+4;
  const R=Math.min(cssW,cssH)/2-52;             // 外圈半径（左右留足轴标签位）
  if(R<40)return;
  const N=axes.length,ang=i=>-Math.PI/2+i*2*Math.PI/N;
  const pt=(i,r)=>[cx+Math.cos(ang(i))*r,cy+Math.sin(ang(i))*r];

  /* ---- 底：六边形刻度环（6 环 = 六个大等级） ---- */
  for(let k=1;k<=6;k++){
    const r=R*k/6;
    ctx.beginPath();
    for(let i=0;i<=N;i++){const [x,y]=pt(i%N,r);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
    ctx.strokeStyle=k===6?'rgba(212,176,119,.55)':'rgba(64,83,93,.5)';
    ctx.lineWidth=k===6?1.6:1;
    ctx.stroke();
    /* 环标签：放在顶轴左侧 */
    ctx.font='9px "Microsoft YaHei",sans-serif';
    ctx.fillStyle=k===6?'#d4b077':'rgba(168,187,195,.6)';
    ctx.textAlign='right';ctx.textBaseline='middle';
    ctx.fillText(RING_LABELS[k-1],cx-4,cy-r);
  }
  /* 轴线 */
  for(let i=0;i<N;i++){
    const [x,y]=pt(i,R);
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);
    ctx.strokeStyle='rgba(64,83,93,.45)';ctx.lineWidth=1;ctx.stroke();
  }

  /* ---- 玩家多边形（tier→半径；over→溢出） ---- */
  const rad=a=>R*(clamp(a.tier,0,11)+1)/12*(1+(a.over||0));
  ctx.beginPath();
  axes.forEach((a,i)=>{const [x,y]=pt(i,rad(a));i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.closePath();
  const anyOver=axes.some(a=>(a.over||0)>0.01);
  ctx.fillStyle=anyOver?'rgba(212,176,119,.22)':'rgba(130,190,205,.20)';
  ctx.strokeStyle=anyOver?'#d4b077':'#82becd';
  ctx.lineWidth=2;
  ctx.fill();ctx.stroke();

  /* ---- 顶点：普通圆点；溢出画金色尖刺星芒 ---- */
  axes.forEach((a,i)=>{
    const r=rad(a),[x,y]=pt(i,r);
    if((a.over||0)>0.01){
      /* 尖刺：沿轴继续向外 */
      const [sx,sy]=pt(i,r+8+6*a.over/0.35);
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(sx,sy);
      ctx.strokeStyle='rgba(212,176,119,.9)';ctx.lineWidth=2.5;ctx.stroke();
      /* 星芒 */
      ctx.save();ctx.translate(sx,sy);ctx.rotate(ang(i)+Math.PI/2);
      ctx.beginPath();
      for(let k=0;k<8;k++){
        const rr=k%2?2.5:6.5,a2=k*Math.PI/4;
        const px=Math.cos(a2)*rr,py=Math.sin(a2)*rr;
        k?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
      ctx.closePath();
      ctx.fillStyle='#ffe9a8';ctx.shadowColor='#d4b077';ctx.shadowBlur=10;ctx.fill();
      ctx.restore();
    }else{
      ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);
      ctx.fillStyle='#82becd';ctx.fill();
      ctx.strokeStyle='rgba(9,17,26,.9)';ctx.lineWidth=1.2;ctx.stroke();
    }
  });

  /* ---- 轴标签：名字【档位】+ 数值（爆表轴直接写「规格外」） ---- */
  axes.forEach((a,i)=>{
    const lr=R+20,[x,y]=pt(i,lr);
    const isOver=(a.over||0)>0.01;
    const tierName=isOver?'规格外⚡':(typeof lvName==='function'?lvName(clamp(Math.round(a.tier),0,11)):'');
    ctx.textAlign=x<cx-8?'right':x>cx+8?'left':'center';
    ctx.textBaseline='middle';
    ctx.font=(isOver?'900 ':'700 ')+'11px "Microsoft YaHei",sans-serif';
    ctx.fillStyle=isOver?'#ffe9a8':'#f2efe5';
    ctx.shadowColor='rgba(4,7,11,.95)';ctx.shadowBlur=4;
    ctx.fillText(`${a.name}·${tierName}`,x,y-7);
    ctx.font='10px "Microsoft YaHei",sans-serif';
    ctx.fillStyle=isOver?'rgba(255,233,168,.9)':'rgba(168,187,195,.85)';
    ctx.fillText(a.text,x,y+6);
    ctx.shadowBlur=0;
  });

  /* ---- 中心：综合评级（衬底小胶囊，防止和多边形糊在一起） ---- */
  if(opts.centerLabel){
    const label=opts.centerLabel,value=opts.centerValue||'';
    ctx.font='900 15px SimSun,"Songti SC",serif';
    const vw=ctx.measureText(value).width;
    const pw=Math.max(64,vw+18),ph=40;
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(cx-pw/2,cy-ph/2,pw,ph,8);else ctx.rect(cx-pw/2,cy-ph/2,pw,ph);
    ctx.fillStyle='rgba(9,17,26,.88)';ctx.fill();
    ctx.strokeStyle=anyOver?'rgba(212,176,119,.7)':'rgba(64,83,93,.8)';ctx.lineWidth=1;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='10px "Microsoft YaHei",sans-serif';ctx.fillStyle='rgba(168,187,195,.85)';
    ctx.fillText(label,cx,cy-10);
    ctx.fillStyle=anyOver?'#ffe9a8':'#d4b077';
    ctx.shadowColor=anyOver?'rgba(212,176,119,.7)':'transparent';ctx.shadowBlur=anyOver?10:0;
    ctx.fillText(value,cx,cy+8);
    ctx.shadowBlur=0;
  }
}

/* ---------------- 接入角色档案 ---------------- */
let box=null,lastDrawW=0;
function ensureBox(){
  if(box&&document.body.contains(box))return box;
  const pane=document.querySelector('[data-pane="overview"]');
  if(!pane)return null;
  box=document.createElement('div');
  box.className='radar-box';
  box.innerHTML='<div class="radar-cap"><b>六维评纹</b><span>环阶：四级→超特级</span></div><canvas aria-label="六维雷达图"></canvas><div class="radar-note"></div>';
  pane.insertBefore(box,pane.firstChild);
  /* 抽屉打开/尺寸变化时按实际宽度重绘（隐藏时 canvas 宽为 0，跳过） */
  if(typeof ResizeObserver==='function'){
    const cv=box.querySelector('canvas');
    new ResizeObserver(()=>{
      const w=cv.clientWidth;
      if(w>40&&Math.abs(w-lastDrawW)>4){renderPlayerRadar();}
    }).observe(box);
  }
  return box;
}
function renderPlayerRadar(){
  if(typeof Game==='undefined'||!Game||!Game.player)return;
  if(typeof tierIndexOf!=='function')return;
  const b=ensureBox();if(!b)return;
  const P=Game.player;
  const cv=b.querySelector('canvas');
  if(cv.clientWidth>40)lastDrawW=cv.clientWidth;
  draw(cv,playerAxes(P),{centerLabel:'综合评级',centerValue:lvName(P.levelIndex)});
  const over=playerAxes(P).filter(a=>(a.over||0)>0.01);
  b.querySelector('.radar-note').textContent=over.length
    ?`⚡ ${over.map(a=>a.name).join('、')}已突破超特级量程，评纹无法容纳。`
    :'各轴按当前数值对照十二级档位；突破量程将以金芒溢出。';
}
/* 挂进渲染链（与项目既有增强层同风格） */
if(typeof Game!=='undefined'&&Game&&Game.render){
  const prev=Game.render;
  Game.render=function(...args){const r=prev.apply(this,args);try{renderPlayerRadar();}catch(e){}return r;};
}else{
  window.addEventListener('load',()=>{
    if(typeof Game!=='undefined'&&Game&&Game.render){
      const prev=Game.render;
      Game.render=function(...args){const r=prev.apply(this,args);try{renderPlayerRadar();}catch(e){}return r;};
    }
  });
}
window.RadarChart={draw,playerAxes,renderPlayerRadar};
})();
