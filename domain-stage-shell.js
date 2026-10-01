/* Isolated presentation baseline; no campaign, storage, save reads or combat results. */
'use strict';
const $=id=>document.getElementById(id),Game={day:90,player:null,draws:{}},Fx={};
const BattleUI={runId:0,sfxFor(){},laterFixed(ms,fn){return setTimeout(fn,ms);}};
const SFX={muted:false,voiceOn:true,setMuted(v){this.muted=v;},setVoice(v){this.voiceOn=v;},speak(){return null;}};
const HD={cast:['五条悟','虎杖悠仁','伏黑惠','钉崎野蔷薇','七海建人','禅院真希','乙骨忧太','东堂葵','加茂宪纪','禅院直哉','九十九由基','伏黑甚尔','宿傩','十影宿傩','神武真身宿傩','羂索','真人','漏壶','花御','陀艮','胀相','坏相','血涂','咒胎怠天','顺平','蝗虫','魔虚罗','禅院家主','里梅','多鲁布','黑沐死','乌璐亨子','石流龙','日车宽见','鹿紫云一','秤金次'],escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},artIndex(n){return /宿傩/.test(n)?12:this.cast.indexOf(n);},sprite(){return '';}};
