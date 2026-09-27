import * as THREE from './vendor/three.module.min.js';
import {DomainStage} from './stage-domains.js';

// Presentation only. No game RNG, combat clocks, save payloads or audio ownership.
const el = id => document.getElementById(id);
const PALETTE = {
  sky:0x0c1b28, fog:0x152c38, floor:0x37434a, seam:0x182830, edge:0x53656d,
  building:0x243641, roof:0x152b34, steel:0x617782, wood:0x423a34, stone:0x637174,
  blue:0x78b8cd, gold:0xeac48d, red:0xad5147, ink:0x060c13, white:0xe8eee8,
  leaf:0x203e3d, glass:0x597786, cyan:0x99e0e9
};
const qualityModes = {
  balanced:{label:'均衡',dpr:1.4,fps:30,dof:true},
  fine:{label:'精细',dpr:1.8,fps:45,dof:true},
  low:{label:'省电',dpr:1,fps:24,dof:false}
};
const noise = n => { const v=Math.sin(n*127.1+13.7)*43758.5453; return v-Math.floor(v); };
const visible = node => node && !node.classList.contains('hidden') && !node.hidden;
const create = (tag, cls, html='') => { const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n; };

class Diorama {
  constructor(art) {
    this.art=art;this.textures=new Map();this.actors=[];this.fx=[];this.mode='';this.environment='';this.generation=0;
    this.angle=0;this.pointer=new THREE.Vector2();this.target=new THREE.Vector3();this.focus=new THREE.Vector3();
    this.ray=new THREE.Raycaster();this.walkTo=new THREE.Vector3(-1.6,0,.4);this.last=0;this.lastDraw=0;this.time=0;
    try { this.quality=localStorage.getItem('jjk_hd_quality')||'balanced'; } catch { this.quality='balanced'; }
    if(!qualityModes[this.quality])this.quality='balanced';
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
    this.renderer.domElement.className='hd-canvas';this.renderer.domElement.setAttribute('aria-hidden','true');
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.failed=true;this.host?.classList.remove('hd-ready');this.host?.parentElement.classList.remove('has-hd');this.renderer.domElement.hidden=true;document.documentElement.dataset.hdStage='fallback';this.stop();this.status('场景已切换为静态画面');});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.failed=false;this.renderer.domElement.hidden=false;this.host?.classList.add('hd-ready');this.host?.parentElement.classList.add('has-hd');document.documentElement.dataset.hdStage='ready';this.status();this.safely(()=>this.sync());});
    this.camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,100);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(PALETTE.sky);this.scene.fog=new THREE.FogExp2(PALETTE.fog,.027);
    this.environmentGroup=new THREE.Group();this.actorGroup=new THREE.Group();this.effectGroup=new THREE.Group();
    this.scene.add(this.environmentGroup,this.actorGroup,this.effectGroup);
    this.scene.add(new THREE.HemisphereLight(0x91b8d5,0x142323,1.3));
    const moon=new THREE.DirectionalLight(0x89b6db,2.2);moon.position.set(-8,14,6);this.scene.add(moon);
    const rim=new THREE.DirectionalLight(PALETTE.gold,1.1);rim.position.set(6,5,-8);this.scene.add(rim);
    this.hitLight=new THREE.PointLight(PALETTE.cyan,0,8);this.scene.add(this.hitLight);
    this.materials=new Map();this.geoBox=new THREE.BoxGeometry(1,1,1);this.geoPlane=new THREE.PlaneGeometry(1,1);
    this.makeSurfaceTextures();
    this.domains=new DomainStage(this);
    this.initPost();this.initUI();this.installHooks();this.sync();
  }
  makeSurfaceTextures() {
    // Original procedural material, not a modification of any character image.
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
    c.fillStyle='#53646b';c.fillRect(0,0,256,256);
    for(let i=0;i<28000;i++){const p=noise(i+2000);c.fillStyle=`rgba(${p>.5?'173,190,190':'11,24,32'},${.02+p*.07})`;c.fillRect(noise(i)*256,noise(i+7)*256,1+noise(i+5)*2,1);}
    c.strokeStyle='rgba(9,21,28,.4)';c.lineWidth=1;c.strokeRect(.5,.5,255,255);
    this.floorTexture=new THREE.CanvasTexture(canvas);this.floorTexture.wrapS=this.floorTexture.wrapT=THREE.RepeatWrapping;this.floorTexture.repeat.set(24,24);this.floorTexture.colorSpace=THREE.SRGBColorSpace;
    this.floorMaterial=new THREE.MeshStandardMaterial({map:this.floorTexture,color:0x748a93,roughness:.68,metalness:.18});
    const glow=document.createElement('canvas');glow.width=128;glow.height=128;const g=glow.getContext('2d'),radial=g.createRadialGradient(64,64,0,64,64,64);
    radial.addColorStop(0,'rgba(238,206,149,.3)');radial.addColorStop(.4,'rgba(223,191,134,.12)');radial.addColorStop(1,'rgba(223,191,134,0)');g.fillStyle=radial;g.fillRect(0,0,128,128);this.glowTexture=new THREE.CanvasTexture(glow);
    const shadow=document.createElement('canvas');shadow.width=128;shadow.height=128;const s=shadow.getContext('2d'),r=s.createRadialGradient(64,64,0,64,64,64);
    r.addColorStop(0,'rgba(0,5,9,.75)');r.addColorStop(.45,'rgba(0,5,9,.45)');r.addColorStop(1,'rgba(0,5,9,0)');s.fillStyle=r;s.fillRect(0,0,128,128);this.shadowTexture=new THREE.CanvasTexture(shadow);
  }
  material(color,emissive=false) {
    const key=`${color}/${emissive}`;if(!this.materials.has(key))this.materials.set(key,emissive?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:.83,metalness:.12}));
    return this.materials.get(key);
  }
  box(x,y,z,w,h,d,color,group=this.environmentGroup) {
    const m=new THREE.Mesh(this.geoBox,this.material(color));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;
  }
  plane(x,y,z,w,h,color,group=this.environmentGroup,glow=false) {
    const m=new THREE.Mesh(this.geoPlane,this.material(color,glow));m.position.set(x,y,z);m.scale.set(w,h,1);group.add(m);return m;
  }
  textTexture(text,bg,fg,width=512,height=128) {
    const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');
    x.fillStyle=`#${bg.toString(16).padStart(6,'0')}`;x.fillRect(0,0,width,height);
    x.strokeStyle=`#${fg.toString(16).padStart(6,'0')}`;x.lineWidth=3;x.strokeRect(9,9,width-18,height-18);
    x.fillStyle=x.strokeStyle;x.font=`600 ${Math.floor(height*.42)}px "Microsoft YaHei", sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,width/2,height/2,width-35);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  sign(text,x,y,z,w,h,bg=PALETTE.ink,fg=PALETTE.gold) {
    const map=this.textTexture(text,bg,fg);const m=new THREE.Mesh(this.geoPlane,new THREE.MeshBasicMaterial({map}));m.userData.ownedMaterial=true;m.userData.ownedTexture=true;m.scale.set(w,h,1);m.position.set(x,y,z);this.environmentGroup.add(m);return m;
  }
  lamp(x,z,height=3.8) {
    this.box(x,height/2,z,.08,height,.08,PALETTE.steel);this.box(x+.25,height,z,.65,.09,.16,PALETTE.ink);
    this.plane(x+.24,height-.05,z+.085,.45,.06,PALETTE.gold,this.environmentGroup,true);
    const light=new THREE.PointLight(PALETTE.gold,8,7,2);light.position.set(x+.24,height-.18,z);this.environmentGroup.add(light);
    const patch=new THREE.Mesh(this.geoPlane,new THREE.MeshBasicMaterial({map:this.glowTexture,transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}));
    patch.scale.set(5,5,1);patch.rotation.x=-Math.PI/2;patch.position.set(x,.02,z);patch.userData.ownedMaterial=true;this.environmentGroup.add(patch);
  }
  rail(x,z,length,rotation=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;this.environmentGroup.add(g);
    this.box(0,.64,0,length,.06,.07,PALETTE.steel,g);this.box(0,.16,0,length,.05,.07,PALETTE.steel,g);
    for(let i=-length/2;i<=length/2+.1;i+=.56)this.box(i,.4,0,.035,.77,.035,PALETTE.steel,g);
  }
  building(x,z,w,h,d,seed,ruin=false) {
    this.box(x,h/2-.2,z,w,h,d,PALETTE.building);this.box(x,h-.13,z,w+.13,.18,d+.13,PALETTE.edge);
    const cols=Math.max(2,Math.floor(w/.62)),rows=Math.floor(h/.7),instance=new THREE.InstancedMesh(this.geoBox,this.material(PALETTE.glass,true),cols*rows);
    const dummy=new THREE.Object3D();let n=0;
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      if(ruin&&noise(seed+i*3+j)>.53)continue;
      dummy.position.set(x-w/2+.36+i*(w-.6)/cols,.55+j*.69,z+d/2+.014);dummy.scale.set(.28,.37,.025);dummy.updateMatrix();instance.setMatrixAt(n,dummy.matrix);
      const lit=noise(seed+i*17+j*9);instance.setColorAt(n,new THREE.Color(lit>.72?PALETTE.gold:lit>.34?PALETTE.glass:PALETTE.roof));n++;
    }
    instance.count=n;this.environmentGroup.add(instance);
    for(let i=0;i<2;i++)this.box(x+(i-.5)*w*.4,h+.25,z,.5,.65,.65,PALETTE.roof);
  }
  tree(x,z,h=5) {
    this.box(x,h*.35,z,.2,h*.7,.22,PALETTE.wood);
    for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(h*(.28-i*.035),1),this.material(PALETTE.leaf));m.position.set(x+Math.sin(i*5)*.45,h*(.54+i*.13),z);m.scale.set(1,.8,1);m.userData.ownedGeometry=true;this.environmentGroup.add(m);}
  }
  clearGroup(g) {
    for(const o of [...g.children]){g.remove(o);o.traverse?.(x=>{if(x.userData?.ownedTexture)x.material?.map?.dispose();if(x.userData?.ownedMaterial)x.material?.dispose();if(x.userData?.ownedGeometry)x.geometry?.dispose();if(x.isInstancedMesh)x.dispose();});}
  }
  environmentFor(day) { return window.BattleScenes.world(day).key; }
  buildEnvironment(kind) {
    this.clearGroup(this.environmentGroup);this.environment=kind;this.backdropMeshes=[];const buildId=this.buildId=(this.buildId||0)+1;
    if(['detention','subway','sewer','forest'].includes(kind)){this.buildLocation(kind,buildId);return;}
    const roof=kind==='rooftop',campus=kind==='campus',bridge=kind==='bridge',ruins=kind==='ruins';
    this.scene.background.set(campus?0x102328:PALETTE.sky);this.scene.fog.color.set(campus?0x233c3d:PALETTE.fog);
    const floor=this.box(0,-.22,roof?1.8:-1,roof?19:46,.42,roof?13:42,PALETTE.floor);floor.material=this.floorMaterial;
    // Tile joints, with real world coordinates so the camera reveals the perspective.
    for(let i=roof?-5:-10;i<=(roof?5:10);i++){
      this.box(i*1.7,.004,roof?1.8:-2,.012,.008,roof?13:30,PALETTE.seam);
      if(!roof||i>=-2)this.box(0,.005,i*1.7,roof?19:36,.008,.012,PALETTE.seam);
    }
    if(campus){
      for(let i=0;i<5;i++)this.box(0,-.01+i*.1,-5.7-i*.3,8,.15,.4,PALETTE.stone);
      this.box(0,2,-8,10,3.5,2.5,PALETTE.wood);this.box(0,4,-8,11,.24,3.6,PALETTE.roof);
      for(let j=0;j<7;j++){this.box((j-3)*1.3,2.1,-6.7,.12,3.5,.14,PALETTE.ink);this.plane((j-3)*1.3,2,-6.72,1.1,2.3,0x7b8877);}
      for(let i=0;i<12;i++)this.box(0,4.1+Math.sin(i/12*Math.PI)*.35,-9.6+i*.29,11,.12,.12,PALETTE.edge);
      this.sign('東京都立 呪術高等専門学校',0,3.45,-6.57,5.5,.52);
      this.tree(-7,-5,6);this.tree(7,-7,7);this.tree(-10,-10,7);this.tree(11,-13,8);
      for(const x of [-5,5]){this.box(x,.55,-4,.5,1.1,.5,PALETTE.stone);this.box(x,1.1,-4,.9,.13,.9,PALETTE.stone);this.box(x,1.4,-4,.55,.5,.55,PALETTE.wood);this.plane(x,1.4,-3.716,.3,.32,PALETTE.gold,this.environmentGroup,true);this.box(x,1.78,-4,1,.2,1,PALETTE.roof);}
      this.lamp(-6,3);this.box(5,.22,3,2.6,.25,.7,PALETTE.wood);
    }else{
      const cityStart=this.environmentGroup.children.length;
      for(let i=0;i<17;i++){const h=5+noise(i+8)*11;this.building((i-8)*3.2,-16-noise(i+2)*6,2.2+noise(i+3),h,3,i*13,ruins);}
      if(roof)for(const o of this.environmentGroup.children.slice(cityStart))o.position.y-=9;
      this.backdropMeshes.push(...this.environmentGroup.children.slice(cityStart));
      if(roof){
        this.rail(0,-4.5,25);this.rail(-8,1,11,Math.PI/2);this.rail(9,1,11,Math.PI/2);
        this.box(-6,.45,-2,2.1,.9,1.3,PALETTE.edge);this.box(-6,.94,-2,2.35,.1,1.45,PALETTE.steel);
        for(let i=0;i<7;i++)this.box(-6.8+i*.26,.5,-1.34,.12,.55,.03,PALETTE.roof);
        this.box(8,2.1,-6,3,4.2,2,PALETTE.stone);this.plane(8,1.2,-4.98,1.1,2.4,PALETTE.wood);
        this.lamp(-7,-2);this.lamp(7,2);this.rail(-4,5.8,5);
        this.box(5,.13,-3,3,.25,.5,PALETTE.wood);this.box(4,.3,-3,.08,.6,.1,PALETTE.steel);this.box(6,.3,-3,.08,.6,.1,PALETTE.steel);
        // Moon over a lower city skyline; the roof no longer extends into the city.
        const moonDisk=new THREE.Mesh(new THREE.CircleGeometry(.9,48),this.material(0x9bbaca,true));moonDisk.position.set(-9,7,-29);moonDisk.userData.ownedGeometry=true;this.environmentGroup.add(moonDisk);
      }else if(bridge){
        this.rail(-6,0,28,Math.PI/2);this.rail(6,0,28,Math.PI/2);
        for(const x of [-6.2,6.2]){this.box(x,3,-4,.5,6,.5,PALETTE.stone);this.box(x,3,-10,.5,6,.5,PALETTE.stone);}
        this.box(0,6,-4,13,.4,.5,PALETTE.steel);this.lamp(-5,-2);this.lamp(5,2);this.tree(-10,-5,5);this.tree(10,-8,7);
      }else{
        const nearStart=this.environmentGroup.children.length;
        this.building(-8,-6,5,9,4,101,ruins);this.building(9,-7,6,11,4,103,ruins);
        this.backdropMeshes.push(...this.environmentGroup.children.slice(nearStart));
        // Crossing and curb are geometry, never painted perspective in a background image.
        for(let i=-5;i<=5;i++)this.box(i*.9,.014,1.5,.5,.015,3.5,0x86928f);
        this.box(-7,.15,1,1.5,.3,15,PALETTE.stone);this.box(7,.15,1,1.5,.3,15,PALETTE.stone);
        this.lamp(-6,-1);this.lamp(6,3);this.lamp(6,-8);
        this.box(0,1.3,-9,8,2.6,2,PALETTE.wood);this.box(0,2.8,-8.8,9,.22,3,PALETTE.roof);
        this.sign(kind==='shibuya'?'渋谷駅':kind==='colony'?'結界内 / 立入禁止':'新宿',0,2.2,-7.96,4.3,.55,PALETTE.roof,PALETTE.white);
        this.sign('TOKYO',-7.8,6,-3.96,3.2,.85,0x243e4d,PALETTE.cyan);
        this.sign('呪',8.4,6,-4.96,1.7,2,PALETTE.red,PALETTE.white);
        for(const x of [-5.7,5.7]){this.box(x,.32,4,.45,.64,.45,PALETTE.ink);this.box(x,.8,4,.05,.4,.05,PALETTE.steel);}
        if(ruins)for(let i=0;i<20;i++){const x=(noise(i+60)-.5)*15,z=noise(i+70)*10-8,m=this.box(x,.1+noise(i+10)*.2,z,.25+noise(i+20),.2+noise(i+30)*.4,.5,PALETTE.stone);m.rotation.y=i;m.rotation.z=noise(i+4)*.3;}
      }
    }
    // A thin foreground mist layer and softly lit particles emphasize depth.
    const pts=new Float32Array(66*3);for(let i=0;i<66;i++){pts[i*3]=(noise(i+400)-.5)*25;pts[i*3+1]=noise(i+800)*7+.4;pts[i*3+2]=(noise(i+900)-.5)*22;}
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pts,3));
    this.dust=new THREE.Points(pg,new THREE.PointsMaterial({color:PALETTE.gold,size:.028,transparent:true,opacity:.52,depthWrite:false}));this.dust.userData.ownedGeometry=true;this.dust.userData.ownedMaterial=true;this.environmentGroup.add(this.dust);
    this.host?.setAttribute('data-environment',kind);
    this.loadBackdrop(kind,buildId);
  }
  async loadBackdrop(kind,buildId) {
    const selectedFile='scenes/v1/'+(({campus:'campus-dusk.webp',bridge:'bridge-night.webp',colony:'urban-ruins.webp',ruins:'urban-ruins.webp'})[kind]||'shibuya-night.webp');
    try{
      const texture=await this.loadTexture(selectedFile);if(this.buildId!==buildId)return;
      this.backdropMeshes.forEach(m=>m.visible=false);
      if(kind==='campus')this.environmentGroup.children.forEach(m=>{if(m.position.z<-5.5)m.visible=false;});
      if(['shibuya','colony','ruins','bridge'].includes(kind))this.environmentGroup.children.forEach(m=>{if(m.position.z<-3.9&&m.position.y>.2)m.visible=false;});
      // The distant painting is a scenic flat, compressed vertically to keep
      // its roofline in the low camera frame while the ground keeps real depth.
      const w=kind==='rooftop'?38:25,h=kind==='rooftop'?w/1.5*.8:6.8;
      const geometry=new THREE.PlaneGeometry(w,h),uv=geometry.attributes.uv;
      // Atlas-style UV window: omit the apron already supplied by the 3D ground.
      for(let i=0;i<uv.count;i++)uv.setY(i,.2+uv.getY(i)*.8);
      const mat=new THREE.MeshBasicMaterial({map:texture,color:0xffffff,fog:false,toneMapped:false});
      const backdrop=new THREE.Mesh(geometry,mat);backdrop.position.set(0,h/2+(kind==='rooftop'?-10:-.25),kind==='rooftop'?-23:-8);
      backdrop.userData.ownedGeometry=true;backdrop.userData.ownedMaterial=true;this.environmentGroup.add(backdrop);this.host.dataset.backdrop=selectedFile;this.start();
    }catch{ /* Geometry remains a complete offline/error fallback. */ }
  }
  buildLocation(kind,buildId) {
    const colors={detention:0x32231d,subway:0x405568,sewer:0x23302e,forest:0x243425},floorColor=colors[kind];
    this.scene.background.set(kind==='forest'?0x233b38:0x101822);this.scene.fog.color.copy(this.scene.background);
    this.box(0,-.2,-2,46,.4,42,floorColor);
    if(kind==='forest'){
      for(let i=0;i<28;i++)this.tree((i%2?1:-1)*(5+i%6*2),-3-Math.floor(i/2)*1.4,5+i%4);
      for(let i=0;i<6;i++)this.box((i%2?1:-1)*(5+i%3),.13,i-2,1,.26,.65,PALETTE.stone);
    }else{
      this.box(0,4,-9,28,8,.7,floorColor);
      for(const x of [-10,-7,7,10])this.box(x,3,-4,.7,6,.7,PALETTE.edge);
      for(let i=0;i<4;i++)this.box(0,5.6,-3-i*3,19,.3,.4,PALETTE.ink);
      if(kind==='sewer'){
        for(const x of [-5,5])this.box(x,.1,-2,2,.2,25,PALETTE.stone);
        for(let i=0;i<8;i++)this.box(0,.01,-i*2,7,.01,.06,0x455957);
        this.lamp(-5,0,4);this.lamp(5,-5,4);
      }
    }
    this.dust=null;this.host?.setAttribute('data-environment',kind);delete this.host?.dataset.backdrop;
    if(kind==='subway'||kind==='detention'){
      const file='scenes/v2/'+kind+'.webp';this.loadTexture(file).then(map=>{
        if(this.buildId!==buildId)return;
        this.environmentGroup.children.forEach(m=>{if(m.position.y>1)m.visible=false;});
        const geo=new THREE.PlaneGeometry(25,7.6),mat=new THREE.MeshBasicMaterial({map,fog:false,toneMapped:false}),mesh=new THREE.Mesh(geo,mat);
        mesh.position.set(0,3.6,-8);mesh.userData.ownedGeometry=true;mesh.userData.ownedMaterial=true;this.environmentGroup.add(mesh);this.host.dataset.backdrop=file;this.start();
      }).catch(()=>{});
    }
  }
  initPost() {
    this.rt=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});this.rt.depthTexture=new THREE.DepthTexture(1,1);
    this.postScene=new THREE.Scene();this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.postMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{
      image:{value:this.rt.texture},depth:{value:this.rt.depthTexture},pixel:{value:new THREE.Vector2(1,1)},focus:{value:.2},dof:{value:1}
    },vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
      uniform sampler2D image;uniform sampler2D depth;uniform vec2 pixel;uniform float focus;uniform float dof;varying vec2 vUv;
      void main(){
        float d=texture2D(depth,vUv).x;float b=clamp(abs(d-focus)*32.-.5,0.,2.8)*dof;
        vec2 off=pixel*b;vec3 c=texture2D(image,vUv).rgb*.28;
        c+=texture2D(image,vUv+vec2(off.x,0.)).rgb*.12;c+=texture2D(image,vUv-vec2(off.x,0.)).rgb*.12;
        c+=texture2D(image,vUv+vec2(0.,off.y)).rgb*.12;c+=texture2D(image,vUv-vec2(0.,off.y)).rgb*.12;
        c+=texture2D(image,vUv+off).rgb*.06;c+=texture2D(image,vUv-off).rgb*.06;
        c+=texture2D(image,vUv+vec2(off.x,-off.y)).rgb*.06;c+=texture2D(image,vUv+vec2(-off.x,off.y)).rgb*.06;
        float vignette=1.-smoothstep(.18,.85,length((vUv-.5)*vec2(1.,.8)));c*=mix(.87,1.,vignette);
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`});
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.postMaterial));
  }
  initUI() {
    this.titleHost=create('div','hd-stage hd-title');this.titleHost.id='titleScene';document.querySelector('.title-backdrop').prepend(this.titleHost);
    this.worldHost=create('div','hd-stage hd-world');this.worldHost.id='worldScene';el('worldStage').prepend(this.worldHost);
    el('worldStage').append(create('div','stage-tools','<button type="button" data-view="left" aria-label="镜头向左">↶</button><button type="button" data-view="reset">归位</button><button type="button" data-view="right" aria-label="镜头向右">↷</button>'));
    el('worldStage').append(create('p','stage-hint','点击地面走动 · 方向键移动'));
    this.worldHost.tabIndex=0;this.worldHost.setAttribute('role','group');this.worldHost.setAttribute('aria-label','探索场景。点击地面或使用方向键移动角色，不消耗天数。');
    this.worldHost.addEventListener('keydown',e=>{const moves={ArrowLeft:[-.6,0],ArrowRight:[.6,0],ArrowUp:[0,-.6],ArrowDown:[0,.6]};if(moves[e.key]){e.preventDefault();this.walkTo.x=THREE.MathUtils.clamp(this.walkTo.x+moves[e.key][0],-4.4,4.4);this.walkTo.z=THREE.MathUtils.clamp(this.walkTo.z+moves[e.key][1],-1.5,2.2);this.start();}});
    el('worldStage').querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{this.angle=b.dataset.view==='reset'?0:THREE.MathUtils.clamp(this.angle+(b.dataset.view==='left'?-.18:.18),-.5,.5);this.start();});
    this.worldHost.addEventListener('pointerdown',e=>this.move(e));
    const control=create('label','config-field quality-setting','场景画质<select id="sceneQuality"><option value="balanced">均衡 · 推荐</option><option value="fine">精细 · 更清晰</option><option value="low">省电 · 降低渲染负担</option></select><small id="sceneStatus">本地场景已就绪</small>');
    el('menuDialog').querySelector('#menuMessage').before(control);el('sceneQuality').value=this.quality;
    el('sceneQuality').onchange=()=>{this.quality=el('sceneQuality').value;try{localStorage.setItem('jjk_hd_quality',this.quality);}catch{}this.resize();this.status();this.start();};
    document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.sync());
    this.ro=new ResizeObserver(()=>this.safely(()=>{this.resize();this.start();}));
    document.addEventListener('close',()=>this.safely(()=>this.sync()),true);
    document.addEventListener('pointermove',e=>{if(this.mode==='title'&&!this.reduced()){this.pointer.set((e.clientX/innerWidth-.5)*.6,(e.clientY/innerHeight-.5)*.2);}}, {passive:true});
    this.status();
  }
  installHooks() {
    const world=Game.render;Game.render=function(...args){const r=world.apply(this,args),hd=window.HDStage;try{hd?.worldHUD();}catch{}hd?.safely(()=>hd.sync());return r;};
    const render=BattleUI.render;BattleUI.render=function(...args){const r=render.apply(this,args),hd=window.HDStage;document.querySelectorAll('#bfEnemy [role=button]').forEach(n=>n.setAttribute('aria-pressed',String(n.classList.contains('selected'))));hd?.safely(()=>hd.sync());return r;};
    const wait=BattleUI.waitInput;BattleUI.waitInput=function(...args){const r=wait.apply(this,args);if(el('bfTip'))el('bfTip').textContent='选择行动 · 点击场中敌人或下方名单选择目标';return r;};
    const sfx=BattleUI.sfxFor;BattleUI.sfxFor=function(e){const r=sfx.call(this,e),hd=window.HDStage;hd?.safely(()=>hd.event(e));return r;};
    const float=BattleUI.floatNum;BattleUI.floatNum=function(idx,val,cls){const hd=window.HDStage;if(!hd?.safely(()=>hd.float(idx,val,cls)))return float.call(this,idx,val,cls);};
    this.observer=new MutationObserver(()=>{if(!this.queued){this.queued=true;queueMicrotask(()=>{this.queued=false;this.safely(()=>this.sync());});}});
    for(const node of [el('titleScreen'),el('mainScreen'),el('createScreen'),el('modalMask')])this.observer.observe(node,{attributes:true,attributeFilter:['class']});
    this.observer.observe(el('modalBox'),{childList:true});this.observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    if(el('cinema'))this.observer.observe(el('cinema'),{attributes:true,attributeFilter:['hidden']});
    this.worldHUD();
  }
  safely(fn) {
    if(this.failed)return false;
    try{return fn();}catch(e){
      this.failed=true;this.stop();this.host?.classList.remove('hd-ready');this.host?.parentElement.classList.remove('has-hd');this.renderer.domElement.hidden=true;
      document.documentElement.dataset.hdStage='fallback';this.status('场景已切换为静态画面，所有玩法仍可使用。');console.warn('HD presentation fell back safely:',e.message);return false;
    }
  }
  worldHUD() {
    if(!Game.player)return;
    const values=document.querySelectorAll('#compactStats .stat-pair b');if(values.length===3)values[2].textContent=(Math.floor(Game.player.prof*10)/10)+'%';
    let track=el('chapterTrack');if(!track){track=create('nav','chapter-track');track.id='chapterTrack';track.setAttribute('aria-label','章节进度');document.querySelector('.world-column').append(track);}
    const arcs=[{day:0,label:'入学'},{day:25,label:'少年院'},{day:49,label:'交流会'},{day:85,label:'涩谷'},{day:100,label:'回游'},{day:118,label:'新宿'}];
    const current=arcs.findLastIndex(a=>Game.day>=a.day);
    track.innerHTML=arcs.map((a,i)=>`<span class="${i<current?'passed':i===current?'current':''}" ${i===current?'aria-current="step"':''}><i></i>${a.label}</span>`).join('');
    let headline=el('worldChapter');if(!headline){headline=create('div','world-chapter');headline.id='worldChapter';document.querySelector('.day-head').prepend(headline);}
    const location=window.BattleScenes.world(Game.day);
    headline.innerHTML=`<span>当前章节</span><h1>${HD.escape(location.chapter)}</h1>`;
    const label=document.querySelector('#worldStage .scene-label b');if(label)label.textContent=location.place;
  }
  sync() {
    if(this.failed)return;
    let host,mode,env;
    if(visible(el('modalMask'))&&el('bfActions')){
      mode='battle';const field=el('modalBox').querySelector('.battle-field');host=field.querySelector('.hd-stage');
      if(!host){host=create('div','hd-stage hd-battle');host.setAttribute('role','img');host.setAttribute('aria-label','战斗场景，使用下方敌方名单选择目标');field.prepend(host);host.addEventListener('pointerdown',e=>this.select(e));}
      env=window.BattleScenes.battle(BattleUI.eng.cfg,Game.day).key;
      field.dataset.baseEnvironment=env;
    }else if(visible(el('mainScreen'))){mode='world';host=this.worldHost;env=this.environmentFor(Game.day);}
    else if(visible(el('titleScreen'))){mode='title';host=this.titleHost;env='rooftop';}
    else {this.stop();return;}
    const changed=host!==this.host||mode!==this.mode;
    if(changed){
      this.host?.classList.remove('hd-ready');this.host?.parentElement.classList.remove('has-hd');this.ro.disconnect();this.host=host;this.mode=mode;this.angle=0;this.pointer.set(0,0);
      host.prepend(this.renderer.domElement);host.classList.add('hd-ready');host.parentElement.classList.add('has-hd');this.ro.observe(host);
      host.dataset.renderer='webgl';host.dataset.scene=mode;this.resize();
    }
    if(env!==this.environment||changed)this.buildEnvironment(env);
    this.domains.sync(mode==='battle'?(BattleUI.domainShown||[]):[]);
    const roster=mode==='title'?[{name:'五条悟',index:0},{name:'虎杖悠仁',index:1}]:mode==='world'?[{name:'你',isPlayer:true,index:-1}]:BattleUI.eng.units.map((u,i)=>({...u,index:i}));
    const key=mode+'/'+(mode==='battle'?BattleUI.runId:'')+'/'+roster.map(u=>`${u.name}:${u.isPlayer?HD.silhouette().index:''}`).join(',');
    if(key!==this.rosterKey){this.rosterKey=key;this.rebuildActors(roster);}
    this.updateActors(roster);this.resize();this.start();
  }
  loadTexture(file) {
    if(!this.textures.has(file))this.textures.set(file,new Promise((resolve,reject)=>new THREE.TextureLoader().load('assets/'+file,t=>{t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.premultiplyAlpha=file.startsWith('cast/v5/');resolve(t);},undefined,reject)));
    return this.textures.get(file);
  }
  actorMaterial(options) {
    const material=new THREE.MeshBasicMaterial(options);
    if(options.map.premultiplyAlpha){
      // Keep source RGB intact. Premultiply before mipmap filtering so invisible
      // green/checker pixels cannot bleed into the visible outline; return to
      // straight alpha before the normal material shading and blending.
      material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;','sampledDiffuseColor.rgb /= max(sampledDiffuseColor.a, 0.00001);\n\tdiffuseColor *= sampledDiffuseColor;'));};
      material.customProgramCacheKey=()=> 'character-alpha-v1';
    }
    return material;
  }
  async rebuildActors(roster) {
    const generation=++this.generation;this.clearGroup(this.actorGroup);this.clearGroup(this.effectGroup);this.fx=[];this.actors=[];
    const sideCount={ally:0,enemy:0};
    for(let i=0;i<roster.length;i++){
      const u=roster[i],known=HD.artIndex(u.name),generic=known<0,genericCurse=generic&&u.name.includes('咒灵'),index=u.isPlayer?HD.silhouette().index:generic?(genericCurse?23:27):known,art=this.art[index];
      const pos=new THREE.Vector3();
      if(this.mode==='title')pos.set(i?3.6:1.3,0,i?-.5:.5);
      else if(this.mode==='world')pos.copy(this.walkTo);
      else {const side=u.side==='enemy'?'enemy':'ally',n=sideCount[side]++,dir=side==='enemy'?1:-1;pos.set(dir*(2+(n%3)*1.35),0,(1-n%3)*.85+Math.floor(n/3)*1.6);}
      const actor={name:u.name,index:u.index,player:!!u.isPlayer,side:u.side,base:pos.clone(),position:pos.clone(),group:new THREE.Group(),height:this.mode==='title'?(i?3.65:4.05):u.name.includes('魔虚罗')?3.5:u.name.includes('神武')?3.3:2.9,alive:u.alive!==false};
      this.actorGroup.add(actor.group);actor.group.position.copy(pos);this.actors.push(actor);
      const shadow=new THREE.Mesh(this.geoPlane,new THREE.MeshBasicMaterial({map:this.shadowTexture,transparent:true,opacity:.85,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.set(2.4,1.3,1);shadow.position.y=.025;shadow.userData.ownedMaterial=true;actor.group.add(shadow);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.64,.68,48),new THREE.MeshBasicMaterial({color:u.side==='enemy'?PALETTE.gold:PALETTE.blue,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;ring.userData.ownedGeometry=true;ring.userData.ownedMaterial=true;actor.ring=ring;actor.group.add(ring);
      if(art){
        try{
          const map=await this.loadTexture(art.file);if(generation!==this.generation)return;
          const [x,y,w,h]=art.rect,geometry=new THREE.PlaneGeometry(actor.height*w/h,actor.height);geometry.translate(0,actor.height/2,0);
          const uv=geometry.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,(x+uv.getX(j)*w)/art.width,1-(y+(1-uv.getY(j))*h)/art.height);
          const material=this.actorMaterial({map,color:u.isPlayer||generic?0x0b1420:0xe8e4df,transparent:true,alphaTest:.15,side:THREE.DoubleSide,depthWrite:true});
          if(u.isPlayer){const rimMat=this.actorMaterial({map,color:PALETTE.cyan,transparent:true,opacity:.35,alphaTest:.05,depthWrite:false,side:THREE.DoubleSide});actor.rim=new THREE.Mesh(geometry,rimMat);actor.rim.scale.setScalar(1.025);actor.rim.position.z=-.025;actor.rim.userData.ownedMaterial=true;actor.group.add(actor.rim);}
          actor.mesh=new THREE.Mesh(geometry,material);actor.mesh.userData.ownedGeometry=true;actor.mesh.userData.ownedMaterial=true;actor.group.add(actor.mesh);
        }catch{this.placeholder(actor);}
      }else this.placeholder(actor);
    }
    if(generation===this.generation){this.host.dataset.actors=String(this.actors.length);this.updateActors(this.mode==='battle'?BattleUI.eng.units:roster);this.start();}
  }
  placeholder(actor) {
    const geometry=new THREE.CapsuleGeometry(.32,1.35,4,10),mesh=new THREE.Mesh(geometry,this.material(PALETTE.ink));mesh.position.y=1;mesh.userData.ownedGeometry=true;actor.group.add(mesh);actor.mesh=mesh;
  }
  updateActors(roster) {
    if(this.mode!=='battle')return;
    for(const a of this.actors){const u=roster[a.index];if(!u)continue;a.alive=u.alive;a.group.visible=u.alive!==false;a.ring.visible=u.alive&&((u.side==='enemy'&&BattleUI.selectedTargetIdx===a.index)||u.isPlayer);if(a.mesh?.material)a.mesh.material.opacity=u.alive?1:.15;}
    this.host?.setAttribute('data-target',String(BattleUI.selectedTargetIdx??''));
  }
  reduced() {return document.body.classList.contains('reduced-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches;}
  resize() {
    if(!this.host)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const q=qualityModes[this.quality],dpr=Math.min(devicePixelRatio||1,q.dpr);
    this.host.dataset.quality=this.quality;
    if(w!==this.width||h!==this.height||dpr!==this.dpr){this.width=w;this.height=h;this.dpr=dpr;this.renderer.setPixelRatio(dpr);this.renderer.setSize(w,h,false);this.rt.setSize(Math.round(w*dpr),Math.round(h*dpr));this.postMaterial.uniforms.pixel.value.set(1/(w*dpr),1/(h*dpr));}
    const aspect=w/h,span=this.mode==='title'?8.5:this.mode==='battle'?Math.max(6.7,11.6/aspect):Math.max(7.6,10/aspect);
    this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();
    this.postMaterial.uniforms.dof.value=q.dof?1:0;
  }
  cameraFrame() {
    const title=this.mode==='title',a=(title?.18:this.mode==='battle'?0:.2)+this.angle;
    this.target.set(title?-.7:0,title?1.8:2,0);
    if(title&&this.width<600)this.target.set(2.3,1.8,0);
    this.camera.position.set(Math.sin(a)*17+(title?this.pointer.x:0),title?5.3:5.2,Math.cos(a)*17);
    this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
    this.focus.copy(this.target).project(this.camera);this.postMaterial.uniforms.focus.value=(this.focus.z+1)/2;
  }
  start() {if(!this.raf&&!document.hidden&&!this.failed){this.last=performance.now();this.raf=requestAnimationFrame(t=>this.safely(()=>this.frame(t)));}}
  stop() {cancelAnimationFrame(this.raf);this.raf=0;}
  frame(now) {
    this.raf=0;if(document.hidden||this.failed||!this.host?.isConnected)return;
    if(document.querySelector('dialog[open]')||el('cinema')&&!el('cinema').hidden)return;
    const reduced=this.reduced(),delta=Math.min(.06,(now-this.last)/1000);this.last=now;
    if(!reduced)this.time+=delta;
    if(now-this.lastDraw>=1000/qualityModes[this.quality].fps){
      this.lastDraw=now;this.cameraFrame();
      for(const a of this.actors){
        if(this.mode==='world'&&a.player){if(reduced)a.base.copy(this.walkTo);else a.base.lerp(this.walkTo,.09);}
        a.group.position.copy(a.base);
        const attack=a.attack?(now-a.attack)/520:2;if(attack<1&&!reduced)a.group.position.x+=Math.sin(attack*Math.PI)*.42*(a.side==='enemy'?-1:1);
        if(a.mesh){if(a.mesh.isMesh&&a.mesh.geometry.type==='PlaneGeometry')a.mesh.quaternion.copy(this.camera.quaternion);a.mesh.position.y=!reduced&&this.mode==='world'&&a.base.distanceTo(this.walkTo)>.06?Math.abs(Math.sin(now*.012))*.055:0;if(a.rim){a.rim.quaternion.copy(this.camera.quaternion);a.rim.position.y=a.mesh.position.y;}}
        if(a.ring)a.ring.material.opacity=!reduced?.55+Math.sin(this.time*2)*.1:.65;
      }
      if(this.dust&&!reduced)this.dust.position.y=Math.sin(this.time*.17)*.3;
      this.hitLight.intensity=Math.max(0,this.hitLight.intensity-.8);
      for(const f of [...this.fx]){const life=(now-f.start)/f.duration;if(life>=1){this.effectGroup.remove(f.mesh);f.mesh.material.dispose();f.mesh.geometry.dispose();this.fx.splice(this.fx.indexOf(f),1);continue;}f.mesh.scale.setScalar(1+life*1.2);f.mesh.material.opacity=(1-life)*.8;}
      if(this.quality==='low')this.domains.render(null);
      else{this.domains.render(this.rt);this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);}
    }
    if(!reduced||this.fx.length||this.hitLight.intensity>0)this.raf=requestAnimationFrame(t=>this.safely(()=>this.frame(t)));
  }
  point(e) {const rect=this.host.getBoundingClientRect();return new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);}
  move(e) {
    if(this.mode!=='world'||e.button!==0)return;this.ray.setFromCamera(this.point(e),this.camera);const p=new THREE.Vector3();
    if(this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),p)){this.walkTo.set(THREE.MathUtils.clamp(p.x,-4.4,4.4),0,THREE.MathUtils.clamp(p.z,-1.5,2.2));this.start();}
  }
  select(e) {
    if(this.mode!=='battle')return;this.ray.setFromCamera(this.point(e),this.camera);
    const targets=this.actors.filter(a=>a.side==='enemy'&&a.alive&&a.mesh);
    const hit=this.ray.intersectObjects(targets.map(a=>a.mesh),false)[0];if(!hit)return;
    const a=targets.find(a=>a.mesh===hit.object);el('bfEnemy')?.querySelector(`[data-idx="${a.index}"]`)?.click();
  }
  event(e) {
    if(this.mode!=='battle'||this.failed)return;
    const attacker=this.actors.find(a=>a.name===(e.from||e.actorName));if(attacker)attacker.attack=performance.now();
    const target=this.actors.find(a=>a.name===e.to);if(!target||!['hit','flash','heal'].includes(e.type))return;
    this.hitLight.position.copy(target.base).add(new THREE.Vector3(0,1.3,1));this.hitLight.color.set(e.type==='heal'?PALETTE.blue:PALETTE.gold);this.hitLight.intensity=this.reduced()?0:12;
    if(!this.reduced()){
      const geo=new THREE.RingGeometry(.22,.3,32),mat=new THREE.MeshBasicMaterial({color:e.type==='flash'?PALETTE.red:PALETTE.gold,transparent:true,depthWrite:false,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geo,mat);
      mesh.position.copy(target.base).add(new THREE.Vector3(0,1.4,.2));mesh.quaternion.copy(this.camera.quaternion);mesh.userData.ownedGeometry=true;mesh.userData.ownedMaterial=true;this.effectGroup.add(mesh);this.fx.push({mesh,start:performance.now(),duration:370});
    }
    this.start();
  }
  float(idx,value,cls) {
    if(this.mode!=='battle'||this.failed||!value)return false;const actor=this.actors.find(a=>a.index===idx);if(!actor)return false;
    const p=actor.base.clone().add(new THREE.Vector3(0,actor.height*.65,0)).project(this.camera),node=create('span','hd-damage '+(cls||''));
    node.textContent=(cls==='heal'?'+':'−')+Math.round(value);node.style.left=((p.x+1)*50)+'%';node.style.top=((1-p.y)*50)+'%';this.host.append(node);setTimeout(()=>node.remove(),950);return true;
  }
  status(message) {if(el('sceneStatus'))el('sceneStatus').textContent=message||({balanced:'平衡清晰度与耗电，适合日常游玩。',fine:'提高场景清晰度，适合性能较好的设备。',low:'降低渲染负担，适合手机长时间游玩。'})[this.quality];}
}

async function boot(){
  try {
    const response=await fetch('stage-art.json');if(!response.ok)throw new Error('art metadata');
    window.HDStage=new Diorama(await response.json());
    document.documentElement.dataset.hdStage='ready';
  }catch(e){
    document.documentElement.dataset.hdStage='fallback';
    document.querySelectorAll('.hd-ready').forEach(n=>n.classList.remove('hd-ready'));
    document.querySelectorAll('.has-hd').forEach(n=>n.classList.remove('has-hd'));
    document.querySelectorAll('.hd-canvas').forEach(n=>n.hidden=true);
    if(el('sceneStatus'))el('sceneStatus').textContent='此设备使用静态场景，所有玩法仍可使用。';
    console.warn('HD scene unavailable; static presentation retained.',e.message);
  }
}
boot();
