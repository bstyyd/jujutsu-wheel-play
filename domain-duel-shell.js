/* Reuse the production cinematic and full local voices without starting the campaign. */
const Fx={};
Object.assign(BattleUI,{sfxFor(){},laterFixed(ms,fn){return setTimeout(fn,ms);}});
const HD={
 cast:['五条悟','虎杖悠仁','伏黑惠','钉崎野蔷薇','七海建人','禅院真希','乙骨忧太','东堂葵','加茂宪纪','禅院直哉','九十九由基','伏黑甚尔','宿傩','十影宿傩','神武真身宿傩','羂索','真人','漏壶','花御','陀艮','胀相','坏相','血涂','咒胎怠天','顺平','蝗虫','魔虚罗','禅院家主','里梅','多鲁布','黑沐死','乌璐亨子','石流龙','日车宽见','鹿紫云一','秤金次'],
 escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
 artIndex(name){return /宿傩/.test(name)?12:this.cast.indexOf(name==='漏瑚'?'漏壶':name);},
 sprite(name,player=false){const art=window.ArtCatalog[player?2:this.artIndex(name)];if(!art)return '';const w=art.width,h=art.height,c=art.cell||0,r=art.rect||(art.single?[0,0,w,h]:[(c%2)*w/2,Math.floor(c/2)*h/2,w/2,h/2]);return `<span class="sprite ${player?'silhouette':''}"><svg width="100%" height="100%" viewBox="${r.join(' ')}" preserveAspectRatio="xMidYMax meet"><image href="assets/${art.file}" width="${w}" height="${h}"/></svg></span>`;}
};window.HD=HD;
