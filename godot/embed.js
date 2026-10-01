/* A presentation bridge: no game rules, RNG, save storage, or audio playback. */
(() => {
 'use strict';
 const queue=[],canvas=document.getElementById('battleCanvas');let quality='balanced',paused=true,last=0;
 const send=data=>parent.postMessage({channel:'jjk-battle',...data},location.origin);
 const resize=()=>{const dpr=Math.min(devicePixelRatio||1,quality==='low'?1:quality==='fine'?2:1.5),w=Math.max(2,Math.round(innerWidth*dpr)),h=Math.max(2,Math.round(innerHeight*dpr));if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;};
 window.JJKGodot={next:()=>queue.shift()||'',receive:raw=>{try{send(JSON.parse(raw));}catch{}}};
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin||e.data?.channel!=='jjk-battle')return;
  const data=e.data.payload;if(!data||!['state','event','pause'].includes(data.type))return;
  if(data.type==='state'){
   for(let i=queue.length-1;i>=0;i--)if(JSON.parse(queue[i]).type==='state')queue.splice(i,1);
   if(data.quality!==quality){quality=data.quality;resize();}
  }
  if(data.type==='pause')paused=!!data.value;
  if(queue.length<48)queue.push(JSON.stringify(data));
 });
 new ResizeObserver(()=>requestAnimationFrame(resize)).observe(document.documentElement);resize();
 window.addEventListener('error',e=>{if(!e.message.startsWith('ResizeObserver loop'))send({type:'error',message:e.message});});
 window.addEventListener('unhandledrejection',e=>send({type:'error',message:String(e.reason)}));
 // Download the smaller identical gzip on static hosting; retain raw-WASM fallback.
 if(typeof DecompressionStream==='function'){
  const nativeFetch=window.fetch.bind(window),wasmURL=new URL('battle.wasm',location.href).href;
  window.fetch=async(input,init)=>{
   const url=new URL(input instanceof Request?input.url:String(input),location.href).href;
   if(url!==wasmURL)return nativeFetch(input,init);
   const response=await nativeFetch(new URL('battle.wasm.gz',location.href),init);
   if(!response.ok)return nativeFetch(input,init);
   const bytes=new Uint8Array(await response.arrayBuffer());
   const body=bytes[0]===0x1f&&bytes[1]===0x8b?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
   return new Response(body,{headers:{'Content-Type':'application/wasm','Content-Length':String(body.byteLength)}});
  };
 }
 const engine=new Engine({...window.JJKEngineConfig,canvas,onPrintError:message=>{if(/SCRIPT ERROR|ERROR:|Shader compilation failed/i.test(message))send({type:'error',message});}});
 engine.startGame({onProgress:(done,total)=>{const now=performance.now();if(now-last>300){last=now;send({type:'progress',done,total});}}}).catch(error=>send({type:'error',message:String(error)}));
})();
