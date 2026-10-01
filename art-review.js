'use strict';
(async()=>{
  const names=['五条悟','虎杖悠仁','伏黑惠','钉崎野蔷薇','七海建人','禅院真希','乙骨忧太','东堂葵','加茂宪纪','禅院直哉','九十九由基','伏黑甚尔','虎杖受肉宿傩','十影宿傩','神武真身宿傩','羂索','真人','漏壶','花御','陀艮','胀相','坏相','血涂','咒胎怠天','吉野顺平','蝗虫咒灵','魔虚罗','禅院直毘人','里梅','多鲁布','黑沐死','乌鹭亨子','石流龙','日车宽见','鹿紫云一','秤金次'];
  const el=id=>document.getElementById(id),escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=s=>/^https?:\/\//.test(s||'')?escape(s):'#';
  try{
    const response=await fetch('ART_REFERENCE_MAP.json');if(!response.ok)throw Error('参考清单加载失败');
    const refs=(await response.json()).references.sort((a,b)=>a.index-b.index);
    el('list').innerHTML=refs.map(ref=>{
      const a=window.ArtCatalog[ref.index],name=names[ref.index]||ref.key;let display='等待立绘';
      if(a){
        const w=a.width||1254,h=a.height||1254,c=a.cell||0,r=a.rect||[(c%2)*w/2,Math.floor(c/2)*h/2,w/2,h/2];
        display=a.single?`<img loading="lazy" decoding="async" src="assets/${escape(a.file)}" alt="${escape(name)}游戏立绘">`:`<svg viewBox="${r.join(' ')}" role="img" aria-label="${escape(name)}游戏立绘" preserveAspectRatio="xMidYMax meet"><defs><clipPath id="clip-${ref.index}"><rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/></clipPath></defs><image clip-path="url(#clip-${ref.index})" href="assets/${escape(a.file)}" width="${w}" height="${h}"/></svg>`;
      }
      const notes=ref.index===31?'沿用现有立绘':ref.index>=12&&ref.index<=14?'当前宿傩版本':'统一画风 · 新版';
      return `<article id="art-${ref.index}" data-name="${escape(name+' '+ref.key)}"><div class="row-heading"><h2>${escape(name)}</h2><small>${notes}</small></div>${ref.caption?`<p class="note">${escape(ref.caption)}</p>`:''}<div class="pair"><figure><figcaption>原作参考</figcaption><div class="frame"><img loading="lazy" decoding="async" src="${escape(ref.file)}" alt="${escape(name)}原作参考"></div></figure><figure><figcaption>游戏立绘</figcaption><div class="frame">${display}</div></figure></div><div class="sources"><a href="${url(ref.source)}" target="_blank" rel="noopener noreferrer">参考图出处 ↗</a>${(ref.additional||[]).map(x=>`<a href="${url(x.source)}" target="_blank" rel="noopener noreferrer">${escape(x.label)} ↗</a>`).join('')}</div>${(ref.additional||[]).some(x=>x.file)?`<details class="support"><summary>补充参考</summary><div class="support-grid">${ref.additional.filter(x=>x.file).map(x=>`<figure><img loading="lazy" src="${escape(x.file)}" alt="${escape(x.label)}"><figcaption>${escape(x.label)}</figcaption></figure>`).join('')}</div></details>`:''}</article>`;
    }).join('');
    el('artJump').innerHTML+=[...refs].map(r=>`<option value="${r.index}">${escape(names[r.index]||r.key)}</option>`).join('');
    const filter=()=>{const q=el('artSearch').value.trim().toLowerCase();let count=0;document.querySelectorAll('article').forEach(a=>{a.hidden=!a.dataset.name.toLowerCase().includes(q);if(!a.hidden)count++;});el('artCount').textContent=`${count} / ${refs.length} 位角色`;};
    el('artSearch').oninput=filter;filter();
    el('artJump').onchange=()=>{const value=el('artJump').value;if(value==='')return;el('artSearch').value='';filter();el('art-'+value)?.scrollIntoView({block:'start'});};
    if(/^#art-\d+$/.test(location.hash))document.querySelector(location.hash)?.scrollIntoView({block:'start'});
    el('backdropToggle').onclick=()=>{const light=document.body.classList.toggle('light-stage');el('backdropToggle').setAttribute('aria-pressed',String(light));el('backdropToggle').textContent=light?'切换深色背景':'切换浅色背景';};
  }catch(error){el('list').textContent=error.message;}
})();
