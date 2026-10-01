/* Batch E2 事件图鉴：回顾事件引擎（event-engine.js）的 16 个原创事件。
   已触发（Campaign.state.eventsSeen）→ 完整标题/场景文本/选项；未触发 → 「？？？」+ 解锁线索。
   入口按钮注入世界屏「羁绊」面板之后（#favorPanel 由 favor.js 维护，按钮作兄弟节点不被重写）。
   增强层：独立文件 + Game.render 包装，不动引擎。 */
(() => {
'use strict';
const $=id=>document.getElementById(id);

/* 解锁线索（不泄露场景内容） */
function hintOf(e){
 const c=e.cond||{},parts=[];
 if(c.day)parts.push(`第 ${c.day} 天后`);
 if(c.endDay!==undefined)parts.push(`第 ${c.endDay} 天前`);
 if(c.character)parts.push('角色可联系时');
 if(c.prof)parts.push(`熟练度 ${c.prof}%`);
 if(c.favor)for(const [n,v] of Object.entries(c.favor))parts.push(`${n} 羁绊 ${v}`);
 parts.push(c.villainOk?'正邪两线可触发':'仅正派路线');
 return parts.join(' · ');
}

/* 纯函数：生成图鉴 HTML（vm QA 可直接断言）。seenIds 为事件 id 数组。 */
function buildHtml(seenIds){
 const seen=new Set(seenIds||[]);
 const all=(window.EventEngine&&EventEngine.EVENTS)||[];
 const done=all.filter(e=>seen.has(e.id)).length;
 const cards=all.map(e=>{
  if(!seen.has(e.id))return `<div class="codex-card locked"><div class="codex-head"><b>？？？</b><small>未触发</small></div><p class="codex-hint">线索：${HD.escape(hintOf(e))}</p></div>`;
  return `<div class="codex-card"><div class="codex-head"><b>${HD.escape(e.title)}</b><small>已触发</small></div><p class="codex-scene">${HD.escape(e.scene)}</p><ul class="codex-choices">${e.choices.map(c=>`<li>${HD.escape(c.label)}</li>`).join('')}</ul></div>`;
 }).join('');
 return `<section class="event-codex"><p class="eyebrow">旅途回顾</p><h2>事件图鉴 · ${done}/${all.length}</h2><p class="codex-cap">非剧情日的际遇有 40% 概率触发原创事件；同一事件每周目只记录一次。</p><div class="codex-grid">${cards}</div><button class="btn" id="codexClose">返回旅程</button></section>`;
}

function open(){
 showModal(buildHtml(Campaign.state?.eventsSeen||[]));
 const b=$('codexClose');if(b)b.onclick=()=>closeModal();
}

/* 入口：羁绊面板之后的兄弟按钮（favorPanel 每次 render 重写 innerHTML，兄弟节点不受影响） */
function injectButton(){
 if($('codexBtn'))return;
 const host=$('favorPanel')||$('compactStats');
 if(!host)return;
 const b=document.createElement('button');
 b.id='codexBtn';b.className='btn ghost small codex-btn';b.textContent='📖 事件图鉴';
 b.onclick=()=>{SFX.click();open();};
 host.after(b);
}
const render=Game.render;Game.render=function(...a){const r=render.apply(this,a);injectButton();return r;};

window.EventCodex={buildHtml,hintOf,open};
})();
