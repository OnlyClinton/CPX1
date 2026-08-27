"use client";

import {useEffect} from "react";
import * as THREE_GL from "three";

type Runtime={renderer:any;scene:any;camera:any;objects:any[];raf:number;resize:()=>void;observer:MutationObserver|null};

export default function WdccThreeRuntime(){
  useEffect(()=>{
    let runtime:Runtime|null=null;
    let disposed=false;
    let rootObserver:MutationObserver|null=null;

    const dispose=()=>{
      const r=runtime;if(!r)return;
      cancelAnimationFrame(r.raf);window.removeEventListener("resize",r.resize);r.observer?.disconnect();
      for(const o of r.objects){try{o.material?.map?.dispose?.();o.material?.dispose?.()}catch{}}
      try{r.renderer?.dispose?.()}catch{}
      try{r.renderer?.domElement?.remove?.()}catch{}
      runtime=null;
    };

    const attach=async(root:HTMLElement)=>{
      if(disposed||runtime||document.documentElement.classList.contains("wdcc-visual-proof"))return;
      const host=root.querySelector<HTMLElement>(".li-gpu");if(!host)return;
      let THREE:any=THREE_GL,renderer:any=null,mode="webgl";
      if("gpu" in navigator){
        try{const WEBGPU:any=await import("three/webgpu");renderer=new WEBGPU.WebGPURenderer({alpha:true,antialias:true});if(renderer.init)await renderer.init();THREE=WEBGPU;mode="webgpu"}catch{renderer=null;THREE=THREE_GL;mode="webgl"}
      }
      if(!renderer){try{renderer=new (THREE_GL as any).WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"})}catch{return}
      if(disposed||!root.isConnected){try{renderer.dispose()}catch{};return}
      const setMode=()=>{root.dataset.threeRuntimeMode=mode;root.dataset.renderMode=mode};setMode();
      const observer=new MutationObserver(()=>{if(root.dataset.threeRuntimeMode!==mode)root.dataset.threeRuntimeMode=mode;if(root.dataset.renderMode!==mode)root.dataset.renderMode=mode});
      observer.observe(root,{attributes:true,attributeFilter:["data-render-mode","data-three-runtime-mode"]});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute("aria-hidden","true");host.replaceChildren(renderer.domElement);
      const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
      const objects:any[]=[];
      const radial=(inner:string,outer:string)=>{const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext("2d");if(!x)return null;const g=x.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,inner);g.addColorStop(.24,inner);g.addColorStop(1,outer);x.fillStyle=g;x.fillRect(0,0,96,96);const tex=new THREE.CanvasTexture(c);tex.needsUpdate=true;return tex};
      const smokeTex=radial("rgba(236,243,248,.38)","rgba(184,204,218,0)");
      if(smokeTex)for(let i=0;i<10;i++){const mat=new THREE.SpriteMaterial({map:smokeTex,transparent:true,depthWrite:false,opacity:.045+Math.random()*.05});const s=new THREE.Sprite(mat);s.position.set(-1.12+Math.random()*2.24,-.76+Math.random()*1.52,.1);const k=.28+Math.random()*.48;s.scale.set(k,k*.58,1);s.userData={vx:(Math.random()-.5)*.00013,vy:.00009+Math.random()*.00011,base:mat.opacity,smoke:true};scene.add(s);objects.push(s)}
      const blue=radial("rgba(205,237,255,.74)","rgba(42,149,255,0)"),red=radial("rgba(255,176,176,.46)","rgba(255,36,48,0)");
      const flare=(tex:any,x:number,y:number,sx:number,sy:number,opacity:number)=>{if(!tex)return;const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,opacity});const s=new THREE.Sprite(mat);s.position.set(x,y,.2);s.scale.set(sx,sy,1);s.userData={base:opacity,smoke:false};scene.add(s);objects.push(s)};
      flare(blue,-.50,-.30,.38,.20,.18);flare(blue,-.14,-.30,.31,.17,.14);flare(red,.73,-.59,.46,.22,.09);
      const resize=()=>renderer.setSize(host.clientWidth||window.innerWidth,host.clientHeight||window.innerHeight,false);resize();window.addEventListener("resize",resize,{passive:true});
      const started=performance.now();let raf=0,last=started;
      const frame=(now:number)=>{if(disposed||!root.isConnected){dispose();return}const elapsed=(now-started)/1000,dt=Math.min(.034,(now-last)/1000);last=now;const settle=1-Math.min(1,Math.max(0,(elapsed-.20)/1.02));for(const o of objects){if(o.userData?.smoke){o.position.x+=o.userData.vx*(dt*1000);o.position.y+=o.userData.vy*(dt*1000);o.material.opacity=o.userData.base*settle}else{o.material.opacity=o.userData.base*(.45+.55*settle)}}try{renderer.render(scene,camera)}catch{};if(elapsed<1.84)raf=requestAnimationFrame(frame)};raf=requestAnimationFrame(frame);
      runtime={renderer,scene,camera,objects,raf,resize,observer};
    };

    const scan=()=>{const root=document.querySelector<HTMLElement>('[data-wdcc-cinematic-intro="webgpu-three"]');if(root)void attach(root);else dispose()};
    scan();rootObserver=new MutationObserver(scan);rootObserver.observe(document.body,{childList:true,subtree:true});
    return()=>{disposed=true;rootObserver?.disconnect();dispose()};
  },[]);
  return null;
}
