/* ============================================================
 * 战斗打击感增强层（battle-impact）
 * 不改引擎：只包装 BattleUI 的表现函数。
 * 1) 飘字分级：普通 / 重创(≥18%最大生命) / 毁灭(≥35%) / 黑闪(金字特大)
 * 2) 受击抖动：单位卡按伤害比例两档震动
 * 3) 命中顿帧：黑闪/毁灭级命中时战斗窗短暂震屏 + 节奏停顿
 * 4) 出手前冲：行动者卡片向敌阵方向冲刺（CSS 承担）
 * ============================================================ */
(function(){
'use strict';
if(typeof window==='undefined'||typeof document==='undefined')return;
function install(){
  if(typeof BattleUI==='undefined'||!BattleUI)return false;
  if(BattleUI._impactInstalled)return true;
  BattleUI._impactInstalled=true;
  const get=id=>document.getElementById(id);

  /* 记录当前事件类型（eventsAnim 每条事件都会先过 sfxFor） */
  const sfx=BattleUI.sfxFor;
  BattleUI.sfxFor=function(e){this._evType=e&&e.type;return sfx.call(this,e);};

  /* 飘字分级 + 受击抖动 + 震屏
   * Batch E 修复：本层（后加载）曾整体覆盖 fx.js 的 Cinema 战场层飘字，导致战场飘字丢失。
   * 现合并为一套：战场（.battle-field）内能找到目标单位时，用 Cinema 战场层定位渲染（保留 fx.js 的视觉），
   * 并叠加本层的分级样式（fd-heavy/fd-devastate/fd-flash，CSS 选择器已放宽到 .cinema-damage）；
   * 找不到战场目标（非战斗窗布局）时退回卡片内渲染。受击抖动与震屏两种模式都保留。 */
  BattleUI.floatNum=function(idx,val,cls){
    if(idx<0||!val)return;
    const u=this.eng&&this.eng.units?this.eng.units[idx]:null;if(!u)return;
    const side=u.side==='ally'?'bfAlly':'bfEnemy';
    const el=get(side)&&get(side).querySelector(`[data-idx="${idx}"]`);if(!el)return;
    const ratio=(cls==='heal'||!u.maxHp)?0:val/u.maxHp;
    const isFlash=this._evType==='flash';
    const isBigCut=this._evType==='domain'||this._evType==='ultcut';
    let tier='';
    if(cls==='heal')tier='heal';
    else if(isFlash)tier='flash';
    else if(ratio>=0.35)tier='devastate';
    else if(ratio>=0.18||isBigCut)tier='heavy';
    const text=isFlash?'黑闪 −'+val+' !!':(cls==='heal'?'+':'-')+val;
    const life=tier==='flash'||tier==='devastate'?1500:1000;
    const tierCls=tier&&tier!=='heal'?' fd-'+tier:'';

    /* The Godot projection owns actor positions. Add impact styling without
       discarding that renderer or showing a second number over the roster. */
    const projected=window.HDStage?.float(idx,val,cls,{text,tier,life});
    const field=document.querySelector('.battle-field');
    const fieldTarget=field&&field.querySelector(`[data-idx="${idx}"]`);
    if(projected){
      // The projected renderer has displayed the number.
    }else if(field&&fieldTarget&&!fieldTarget.closest?.('.side-col')){
      requestAnimationFrame(()=>{
        const r=fieldTarget.getBoundingClientRect(),fr=field.getBoundingClientRect();
        const n=document.createElement('span');
        n.className='cinema-damage '+(cls||'')+tierCls;
        n.textContent=text;
        n.style.left=r.left-fr.left+r.width/2+'px';
        n.style.top=Math.max(36,r.top-fr.top+r.height*.38)+'px';
        field.append(n);
        setTimeout(()=>n.remove(),Math.max(life,850));
      });
    }else{
      const f=document.createElement('div');
      f.className='float-dmg '+(cls||'')+tierCls;
      f.textContent=text;
      el.appendChild(f);
      setTimeout(()=>f.remove(),life);
    }

    /* 受击抖动（两档） */
    const hard=isFlash||ratio>=0.18;
    el.classList.remove('struck','struck-hard');void el.offsetWidth;
    el.classList.add(hard?'struck-hard':'struck');
    setTimeout(()=>el.classList.remove('struck','struck-hard'),480);

    /* 黑闪/毁灭级：战斗窗震屏 + 白闪 */
    if(cls!=='heal'&&(isFlash||ratio>=0.35)){
      const m=get('modalBox');
      if(m){m.classList.remove('impact-flash');void m.offsetWidth;m.classList.add('impact-flash');
        setTimeout(()=>m.classList.remove('impact-flash'),380);}
    }
  };

  return true;
}
if(!install()){
  /* BattleUI 尚未定义（脚本顺序保险）：等页面加载完成再装 */
  window.addEventListener('load',()=>install());
}
})();
