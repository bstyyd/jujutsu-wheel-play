import * as THREE from './vendor/three.module.min.js';

// Two environments share one camera, actor roster and WebGL context.
// Scissoring keeps the perspective identical on both sides of a clash.
export class DomainStage {
  constructor(stage){this.stage=stage;this.groups=[];this.key='';this.version=0;}
  sync(fields){
    const order=fields.length>1?['ally','enemy'].map(s=>fields.find(f=>f.side===s)):fields;
    const nextProfiles=order.map(f=>f?window.BattleScenes.profileFor(f,typeof BattleUI!=='undefined'?BattleUI.eng?.units||[]:[]):null);
    const key=nextProfiles.map(p=>p?.key||'base').join('/');if(key===this.key)return;
    this.key=key;this.version++;const v=this.version,s=this.stage;
    for(const g of this.groups){s.clearGroup(g);s.scene.remove(g);}this.groups=[];
    this.profiles=nextProfiles;
    for(const p of this.profiles){
      const g=new THREE.Group();g.visible=false;s.scene.add(g);this.groups.push(g);if(!p)continue;
      if(!p.open){
        const floor=new THREE.Mesh(new THREE.PlaneGeometry(46,44),new THREE.MeshBasicMaterial({color:p.floor,toneMapped:false,transparent:!!p.overlay,opacity:p.overlay?.85:1}));
        floor.rotation.x=-Math.PI/2;floor.position.y=.018;floor.userData.ownedGeometry=true;floor.userData.ownedMaterial=true;g.add(floor);
      }
      const light=new THREE.PointLight(p.key==='beach'?0xc4e8ff:p.key==='lava'?0xff6320:0x9283ed,18,18);light.position.set(0,3,-2);g.add(light);
      this.backdrop(p,g,v);
    }
    s.host?.setAttribute('data-domain',key||'none');s.start();
  }
  async backdrop(p,g,version){
    const s=this.stage;
    try{
      const map=await s.loadTexture(p.file||'domains.webp');if(version!==this.version)return;
      const w=p.open?10:1,h=p.open?6:1,geometry=new THREE.PlaneGeometry(w,h);
      if(p.atlas){const [x,y,w,h]=p.atlas,uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,x+.002+uv.getX(i)*(w-.004),y+.002+uv.getY(i)*(h-.004));}
      const material=new THREE.MeshBasicMaterial({map,fog:false,toneMapped:false,transparent:!!(p.open||p.overlay),opacity:p.open?.92:p.overlay?.65:1,depthWrite:!p.overlay});
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(0,p.open?h/2-.12:3.28,p.open?-5.8:-8);mesh.userData.ownedGeometry=true;mesh.userData.ownedMaterial=true;
      if(!p.open){mesh.userData.backdropAspect=(map.image.width*(p.atlas?.[2]||1))/(map.image.height*(p.atlas?.[3]||1));g.userData.backdrop=mesh;}
      g.add(mesh);s.start();
    }catch{ /* Colored geometry is kept if a local image cannot be loaded. */ }
  }
  render(target){
    const s=this.stage,r=s.renderer,bg=s.scene.background.clone(),fog=s.scene.fog.color.clone();
    r.setRenderTarget(target);
    // setScissor already applies renderer pixel ratio, even for an RT.
    const size=r.getSize(new THREE.Vector2());
    const count=this.groups.length||1,split=count>1,half=Math.floor(size.x/2);
    r.setScissorTest(split);
    for(let i=0;i<count;i++){
      const p=this.profiles?.[i];this.groups.forEach((g,j)=>g.visible=i===j);
      // Cover wide PC and narrow phone views without stretching the reference.
      const backdrop=this.groups[i]?.userData.backdrop;
      if(backdrop){const w=Math.max(15,s.camera.right-s.camera.left+4),h=Math.max(6.8,w/backdrop.userData.backdropAspect);backdrop.scale.set(w,h,1);}
      s.environmentGroup.visible=!p||!!(p.open||p.overlay);
      s.scene.background.set(p&&!p.open&&!p.overlay?p.color:bg);s.scene.fog.color.set(p&&!p.open&&!p.overlay?p.color:fog);
      if(split)r.setScissor(i?half:0,0,i?size.x-half:half,size.y);
      r.render(s.scene,s.camera);
    }
    r.setScissorTest(false);s.environmentGroup.visible=true;this.groups.forEach(g=>g.visible=false);s.scene.background.copy(bg);s.scene.fog.color.copy(fog);
  }
}
