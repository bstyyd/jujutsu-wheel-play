/* ============================================================
 * 坐杀博徒 · 老虎机转盘（替换原 Canvas 大转盘）
 * 设计：秤金次「坐杀博徒」柏青哥风格 —— 三轴滚筒、逐轴停轮、
 *       リーチ（听牌）悬念、JACKPOT 金光结算。
 * 兼容：API 与 WheelView 完全一致（setItems/spin(cb,selectedIndex)），
 *       加载后直接接管全局 WheelView 绑定，所有调用点零改动。
 * 规则：抽取结果仍由 weightedIndex / 调用方 selectedIndex 决定，
 *       本组件只做演出，不参与随机。
 * ============================================================ */
(function(){
'use strict';
if(typeof window==='undefined'||typeof document==='undefined')return;

const REDUCED=(function(){
  try{return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}
})();

function shortLabel(s){
  s=String(s==null?'':s);
  const arr=[...s];
  return arr.length>8?arr.slice(0,8).join('')+'…':s;
}

class HakariSlotView{
  /** canvas: 原转盘 <canvas>（隐藏之，DOM 建在其父容器 .wheel-box 内） */
  constructor(canvas){
    this.cv=canvas;
    this.box=canvas.parentElement;
    this.items=[];
    this.spinning=false;
    this._timers=[];
    this._tickTimer=null;
    this._session=0;
    canvas.style.display='none';
    this.box.classList.add('slot-mode');
    this._build();
  }

  _build(){
    const root=document.createElement('div');
    root.className='hakari-slot';
    root.innerHTML=`
      <div class="hs-head"><span class="hs-title">坐殺博徒</span><span class="hs-sub">IDLE DEATH GAMBLE</span></div>
      <div class="hs-window">
        <div class="hs-payline" aria-hidden="true"></div>
        <div class="hs-reel" data-reel="0"><div class="hs-strip"></div></div>
        <div class="hs-reel" data-reel="1"><div class="hs-strip"></div></div>
        <div class="hs-reel" data-reel="2"><div class="hs-strip"></div></div>
        <div class="hs-reach" aria-hidden="true">リーチ！</div>
        <div class="hs-jackpot" aria-hidden="true"><b>JACKPOT</b><span class="hs-jp-label"></span></div>
        <div class="hs-flash" aria-hidden="true"></div>
      </div>
      <div class="hs-foot"><span class="hs-lamp"></span><span class="hs-hint">点击机器可跳过演出</span><span class="hs-lamp"></span></div>`;
    this.box.appendChild(root);
    this.root=root;
    this.reels=[...root.querySelectorAll('.hs-reel')];
    this.strips=[...root.querySelectorAll('.hs-strip')];
    root.addEventListener('click',()=>{if(this.spinning)this._skip();});
    /* 视口变化时只需重写格高变量（格子高度走 CSS 变量自适应），
     * 绝不能重绘滚筒——否则会把中奖定格画面刷掉 */
    if(typeof ResizeObserver==='function'){
      this._ro=new ResizeObserver(()=>{this._layoutCells();});
      this._ro.observe(root);
    }
  }

  /** 量出滚筒视口高度，按 3 格可见写入 --hs-cell-h。
   *  带熔断：高度异常（布局振荡）时不写，防止格高↔盒高正反馈爆炸。 */
  _layoutCells(){
    const reel=this.reels[0];
    if(!reel)return;
    const h=reel.clientHeight;
    if(h>24&&h<1200)this.root.style.setProperty('--hs-cell-h',(h/3)+'px');
  }

  setItems(items){
    this._session++;
    this._clearTimers();
    this.items=Array.isArray(items)?items:[];
    this.spinning=false;
    this.root.classList.remove('is-reach','is-jackpot','is-rolling');
    this.strips.forEach(st=>{st.style.transition='none';st.style.transform='translateY(0)';});
    this._renderIdle();
  }

  /** 静止状态：三轴各显示一个占位图案（首项 ×3，营造“待拉”感） */
  _renderIdle(){
    this._layoutCells();
    const first=this.items[0]?shortLabel(this.items[0].label||this.items[0].name||'?'):'?';
    this.strips.forEach(st=>{
      st.style.transition='none';
      st.style.transform='translateY(0)';
      st.innerHTML=`<div class="hs-cell hs-cell-idle"><span class="hs-sym">呪</span><span class="hs-txt">${first}</span></div>`;
    });
  }

  /** 与 WheelView.spin 同签名：cb(selectedItem,index)，selectedIndex 可选（种子局） */
  spin(cb,selectedIndex){
    if(this.spinning||!this.items.length)return;
    this.spinning=true;
    const session=++this._session;
    const sp=(typeof SPIN_SPEED!=='undefined'&&SPIN_SPEED)||2;
    const idx=(Number.isInteger(selectedIndex)&&selectedIndex>=0&&selectedIndex<this.items.length)
      ?selectedIndex
      :(typeof weightedIndex==='function'?weightedIndex(this.items):Math.floor(Math.random()*this.items.length));
    const winner=this.items[idx];
    const winLabel=shortLabel(winner.label||winner.name||'?');
    const n=this.items.length;
    this._layoutCells();

    /* 单选项无演出直接结算 */
    if(n===1){
      this.spinning=false;
      cb&&cb(winner,idx);
      return;
    }

    const speedScale=REDUCED?2.6:1;               // 减弱动态：大幅缩短
    const baseDur=(1.35/speedScale)/sp*2;         // 首轴基准时长（秒）
    const reelDurs=[baseDur,baseDur*1.45,baseDur*2.1];
    const holdMs=REDUCED?120:620;                  // JACKPOT 展示时长
    let stopped=0,finished=false;
    /* 供跳过/兜底使用的完成闭包 */
    const complete=fast=>{
      if(finished)return;finished=true;
      this._stopTicks();
      this._current=null;
      this.root.classList.remove('is-reach','is-rolling');
      this.reels.forEach(rl=>{rl.classList.remove('rolling');rl.classList.add('stopped');});
      this._jackpot(session,winLabel,()=>{
        this.spinning=false;
        this.reels.forEach(rl=>rl.classList.remove('stopped'));
        if(typeof SFX!=='undefined')SFX.spinEnd();
        cb&&cb(winner,idx);
      },fast?Math.min(holdMs,200):holdMs);
    };
    this._current={complete};

    this.root.classList.add('is-rolling');
    this.root.classList.remove('is-reach','is-jackpot');
    if(typeof SFX!=='undefined')SFX.spinStart();

    /* 滚筒音效：滚动期间均匀 tick，第三轴加密（听牌感） */
    this._startTicks(reelDurs[2]*1000);

    this.reels.forEach((reel,r)=>{
      const strip=this.strips[r];
      /* 组条：滚(2+r)整圈 + 末格为中奖项 */
      const laps=2+r;
      const seq=[];
      for(let l=0;l<laps;l++)for(let i=0;i<n;i++)seq.push(i);
      /* 末段接到中奖项：保证停在 winner */
      seq.push(idx);
      const cellH=this._cellH();
      /* 为了让中奖格居中，末尾补两个过渡格（视觉落回中线） */
      const html=seq.map(i=>{
        const it=this.items[i];
        const hot=i===idx?' hs-cell-hot':'';
        return `<div class="hs-cell${hot}"><span class="hs-sym">${this._symFor(i)}</span><span class="hs-txt">${shortLabel(it.label||it.name||'?')}</span></div>`;
      }).join('');
      strip.innerHTML=html;
      const cells=strip.children.length;
      /* 视口高 3 格，中奖格（最后一格）需停在正中：上方留 1 格 */
      const targetY=-((cells-1)*cellH-cellH);
      strip.style.transition='none';
      strip.style.transform='translateY(0)';
      void strip.offsetWidth;
      reel.classList.add('rolling');
      const dur=reelDurs[r];
      strip.style.transition=`transform ${dur}s cubic-bezier(.1,.6,.12,1)`;
      requestAnimationFrame(()=>{strip.style.transform=`translateY(${targetY}px)`;});

      this._after(dur*1000+40,()=>{
        if(session!==this._session)return;
        reel.classList.remove('rolling');
        reel.classList.add('stopped');
        if(typeof SFX!=='undefined')SFX.click();
        stopped++;
        if(r===1&&stopped===2){
          /* 两轴已中 → リーチ 演出 */
          this.root.classList.add('is-reach');
          if(typeof SFX!=='undefined'){SFX.tone(880,880,.14,'square',.06);SFX.tone(1174.66,1174.66,.16,'square',.05,.12);}
        }
        if(stopped===3){complete(false);}
      });
    });

    /* 兜底：任何异常都保证结算（时长上限 = 最慢轴 + 3s） */
    this._after(reelDurs[2]*1000+3000,()=>{
      if(session!==this._session)return;
      complete(true);
    });
  }

  _jackpot(session,winLabel,done,holdMs){
    this.root.classList.remove('is-reach');
    this.root.classList.add('is-jackpot');
    const lbl=this.root.querySelector('.hs-jp-label');
    if(lbl)lbl.textContent=winLabel;
    if(typeof SFX!=='undefined'){
      /*  jackpot 上行琶音 + 噪声彩带  */
      SFX.tone(523.25,523.25,.12,'triangle',.07);
      SFX.tone(659.25,659.25,.12,'triangle',.07,.1);
      SFX.tone(783.99,783.99,.14,'triangle',.08,.2);
      SFX.tone(1046.5,1046.5,.3,'triangle',.09,.3);
      SFX.noise(.5,.05,.25,3600);
    }
    this._after(holdMs,()=>{
      if(session!==this._session)return;
      this.root.classList.remove('is-jackpot');
      done();
    });
  }

  /** 跳过：滚筒立即落位，JACKPOT 短展示后结算 */
  _skip(){
    if(!this.spinning||!this._current)return;
    const complete=this._current.complete;
    /* 清掉逐轴停止与兜底定时器，改由 complete 统一收尾 */
    this._timers.forEach(t=>clearTimeout(t.id));
    this._timers=[];
    this.strips.forEach(st=>{
      st.style.transition='transform .18s ease-out';
      const cells=st.children.length;
      if(cells>0){
        const cellH=this._cellH();
        st.style.transform=`translateY(${-((cells-1)*cellH-cellH)}px)`;
      }
    });
    complete(true);
  }

  _symFor(i){
    const SYMS=['呪','霊','術','縛','域','閃','骸','怨','祓','魂','印','斬'];
    return SYMS[i%SYMS.length];
  }

  _cellH(){
    const st=this.strips[0];
    const cell=st&&st.children[0];
    if(cell)return cell.getBoundingClientRect().height||64;
    return 64;
  }

  _startTicks(totalMs){
    this._stopTicks();
    if(typeof SFX==='undefined')return;
    const started=performance.now();
    let last=0;
    this._tickTimer=setInterval(()=>{
      const now=performance.now();
      if(now-started>totalMs){this._stopTicks();return;}
      if(now-last>=70&&!document.hidden){SFX.tick();last=now;}
    },70);
  }
  _stopTicks(){if(this._tickTimer){clearInterval(this._tickTimer);this._tickTimer=null;}}

  _after(ms,fn){
    const id=setTimeout(fn,ms);
    this._timers.push({id});
  }
  _clearTimers(){
    this._timers.forEach(t=>clearTimeout(t.id));
    this._timers=[];
    this._stopTicks();
  }
}

/* 接管全局转盘：engine.js 的 class WheelView 是全局可写绑定，
 * 之后所有 new WheelView(...)（创建流程 / openWheelModal / 各增强层）
 * 都会得到老虎机实例。原类保留在 engine.js 内作回退参考，不再被实例化。 */
try{
  if(typeof WheelView!=='undefined'){ WheelView=HakariSlotView; }
  window.HakariSlotView=HakariSlotView;
}catch(e){
  window.HakariSlotView=HakariSlotView;
}
})();
