"use client";

import {useEffect,useRef,useState} from "react";

type Rect={x:number;y:number;width:number;height:number};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const ease=(t:number)=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3);

async function getTarget():Promise<Rect>{
  for(let i=0;i<90;i++){
    const el=document.querySelector("main.locked-storefront .rh-logo img") as HTMLElement|null;
    if(el){const r=el.getBoundingClientRect();if(r.width>30&&r.height>30)return{x:r.x,y:r.y,width:r.width,height:r.height}}
    await new Promise(requestAnimationFrame);
  }
  const s=Math.min(92,innerWidth*.22);return{x:(innerWidth-s)/2,y:2,width:s,height:s};
}

async function loadBitmap(url:string){const r=await fetch(url,{cache:"force-cache"});return createImageBitmap(await r.blob())}

export default function LockedIntro(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const sceneRef=useRef<HTMLDivElement>(null);
  const fallbackRef=useRef<HTMLImageElement>(null);
  const[done,setDone]=useState(false);

  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){setDone(true);return}
    let cancelled=false;
    document.documentElement.classList.add("wdcc-intro-active");
    const finish=()=>{if(cancelled)return;document.documentElement.classList.remove("wdcc-intro-active");setDone(true)};

    (async()=>{
      const target=await getTarget();if(cancelled)return;
      const vw=innerWidth,vh=innerHeight;
      const startSize=Math.min(vw<600?vw*.56:260,260);
      const start:Rect={x:(vw-startSize)/2,y:vh*.40-startSize/2,width:startSize,height:startSize};
      const hold=800,duration=850;
      const scene=sceneRef.current,fallback=fallbackRef.current,canvas=canvasRef.current;
      if(fallback)Object.assign(fallback.style,{left:`${start.x}px`,top:`${start.y}px`,width:`${start.width}px`,height:`${start.height}px`,opacity:"1"});
      await wait(hold);if(cancelled)return;

      try{
        const gpu=(navigator as any).gpu;if(!gpu||!canvas)throw new Error("WebGPU unavailable");
        const adapter=await gpu.requestAdapter({powerPreference:"high-performance"});if(!adapter)throw new Error("No adapter");
        const device=await adapter.requestDevice();const ctx=(canvas as any).getContext("webgpu");const format=gpu.getPreferredCanvasFormat();
        const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);ctx.configure({device,format,alphaMode:"premultiplied"});
        const bmp=await loadBitmap("/wdcc-official-logo.webp");
        const texture=device.createTexture({size:[bmp.width,bmp.height,1],format:"rgba8unorm",usage:6});
        device.queue.copyExternalImageToTexture({source:bmp},{texture},[bmp.width,bmp.height]);
        const sampler=device.createSampler({magFilter:"linear",minFilter:"linear"});
        const shader=device.createShaderModule({code:`
          struct U{rect:vec4f,viewport:vec2f,alpha:f32,pad:f32};
          @group(0) @binding(0) var<uniform> u:U;@group(0) @binding(1) var smp:sampler;@group(0) @binding(2) var tex:texture_2d<f32>;
          struct O{@builtin(position) pos:vec4f,@location(0) uv:vec2f};
          @vertex fn vs(@builtin(vertex_index)i:u32)->O{var q=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(0,1),vec2f(0,1),vec2f(1,0),vec2f(1,1));let a=q[i];let px=u.rect.xy+a*u.rect.zw;let ndc=vec2f(px.x/u.viewport.x*2.0-1.0,1.0-px.y/u.viewport.y*2.0);var o:O;o.pos=vec4f(ndc,0,1);o.uv=a;return o;}
          @fragment fn fs(i:O)->@location(0) vec4f{let c=textureSample(tex,smp,i.uv);return vec4f(c.rgb,c.a*u.alpha);}
        `});
        const pipeline=device.createRenderPipeline({layout:"auto",vertex:{module:shader,entryPoint:"vs"},fragment:{module:shader,entryPoint:"fs",targets:[{format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"}});
        const uniform=device.createBuffer({size:32,usage:72});const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:sampler},{binding:2,resource:texture.createView()}]});const data=new Float32Array(8);
        const draw=(r:Rect)=>{data.set([r.x*dpr,r.y*dpr,r.width*dpr,r.height*dpr,canvas.width,canvas.height,1,0]);device.queue.writeBuffer(uniform,0,data);const enc=device.createCommandEncoder();const pass=enc.beginRenderPass({colorAttachments:[{view:ctx.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(6);pass.end();device.queue.submit([enc.finish()])};
        draw(start);if(fallback)fallback.style.opacity="0";
        const t0=performance.now();
        await new Promise<void>(resolve=>{const frame=(now:number)=>{if(cancelled){resolve();return}const p=Math.min(1,(now-t0)/duration),e=ease(p);draw({x:start.x+(target.x-start.x)*e,y:start.y+(target.y-start.y)*e,width:start.width+(target.width-start.width)*e,height:start.height+(target.height-start.height)*e});if(scene)scene.style.opacity=String(1-ease(Math.max(0,(p-.08)/.92)));if(p<1)requestAnimationFrame(frame);else resolve()};requestAnimationFrame(frame)});
        await wait(60);finish();
      }catch{
        if(!fallback){finish();return}
        const anim=fallback.animate([{left:`${start.x}px`,top:`${start.y}px`,width:`${start.width}px`,height:`${start.height}px`},{left:`${target.x}px`,top:`${target.y}px`,width:`${target.width}px`,height:`${target.height}px`}],{duration,easing:"cubic-bezier(.22,1,.36,1)",fill:"forwards"});
        scene?.animate([{opacity:1},{opacity:0}],{duration,easing:"ease-out",fill:"forwards"});await anim.finished.catch(()=>{});await wait(60);finish();
      }
    })();
    return()=>{cancelled=true;document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  if(done)return null;
  return <div className="li gpu-intro" aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}.wdcc-intro-active main.locked-storefront .rh-logo img{opacity:0!important}
      .gpu-intro{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#06111a;isolation:isolate;animation:none!important}
      .li-scene{position:absolute;inset:0;z-index:1;background:#06111a;opacity:1;will-change:opacity}.li-scene img{width:100%;height:100%;display:block;object-fit:cover;object-position:68% 43%;filter:saturate(1.18) contrast(1.02) brightness(1.20);transform:none!important;animation:none!important}.li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,0) 68%,rgba(2,7,12,.14) 85%,rgba(2,7,12,.38) 100%)}
      .gpu-canvas{position:absolute;inset:0;z-index:5;width:100%;height:100%;pointer-events:none;animation:none!important}
      .li-badge{position:absolute;inset:0;z-index:4;pointer-events:none;background:transparent!important;box-shadow:none!important;animation:none!important;transform:none!important}.li-badge img{position:absolute;display:block;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);opacity:1;animation:none!important;transition:opacity .08s linear;will-change:left,top,width,height}
      .li-skip{position:absolute;z-index:7;right:16px;bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));min-height:44px;padding:0 17px;border-radius:999px;border:1px solid rgba(255,255,255,.42);background:rgba(3,9,14,.76);color:#fff;font:850 12px/1 system-ui,sans-serif;backdrop-filter:blur(8px)}
      @media(max-width:600px){.li-scene img{object-position:69% 42%;filter:saturate(1.20) contrast(1.01) brightness(1.24)}}
    `}</style>
    <div ref={sceneRef} className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <canvas ref={canvasRef} className="gpu-canvas" aria-hidden="true"/>
    <div className="li-badge"><img ref={fallbackRef} src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <button className="li-skip" type="button" onClick={()=>{document.documentElement.classList.remove("wdcc-intro-active");setDone(true)}}>Skip intro</button>
  </div>
}
