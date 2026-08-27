"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"exit"|"done";
type RenderMode="webgpu"|"webgl"|"static";
type EngineHandle={ctx:AudioContext;master:GainNode;nodes:OscillatorNode[]};

const INTRO_KEY="wdcc-webgpu-intro-seen-v2";
const WEBGPU_URL="https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.webgpu.min.js";
const WEBGL_URL="https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";
const ease=(x:number)=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v)};

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
  const[mode,setMode]=useState<RenderMode>("static");
  const[soundOn,setSoundOn]=useState(false);
  const rootRef=useRef<HTMLDivElement|null>(null);
  const gpuRef=useRef<HTMLDivElement|null>(null);
  const engineRef=useRef<EngineHandle|null>(null);
  const disposedRef=useRef(false);

  const stopEngine=useCallback(()=>{
    const h=engineRef.current;if(!h)return;
    const now=h.ctx.currentTime;
    try{h.master.gain.cancelScheduledValues(now);h.master.gain.setValueAtTime(Math.max(.0001,h.master.gain.value),now);h.master.gain.exponentialRampToValueAtTime(.0001,now+.16)}catch{}
    window.setTimeout(()=>{for(const n of h.nodes){try{n.stop()}catch{}};h.ctx.close().catch(()=>{})},190);
    engineRef.current=null;
    setSoundOn(false);
  },[]);

  const startEngine=useCallback(async()=>{
    if(engineRef.current){stopEngine();return}
    const AudioCtor=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioCtor)return;
    const ctx=new AudioCtor();
    try{await ctx.resume()}catch{}
    if(ctx.state!=="running"){ctx.close().catch(()=>{});return}
    const now=ctx.currentTime;
    const master=ctx.createGain(),low=ctx.createBiquadFilter(),body=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor();
    master.gain.setValueAtTime(.0001,now);
    master.gain.exponentialRampToValueAtTime(.24,now+.08);
    master.gain.setValueAtTime(.24,now+.54);
    master.gain.exponentialRampToValueAtTime(.12,now+1.12);
    master.gain.exponentialRampToValueAtTime(.0001,now+1.62);
    low.type="lowpass";low.frequency.value=320;low.Q.value=.72;
    body.type="peaking";body.frequency.value=82;body.Q.value=.8;body.gain.value=7.5;
    comp.threshold.value=-18;comp.knee.value=16;comp.ratio.value=4;comp.attack.value=.012;comp.release.value=.22;
    low.connect(body);body.connect(comp);comp.connect(master);master.connect(ctx.destination);
    const nodes:OscillatorNode[]=[];
    const add=(type:OscillatorType,mult:number,gainValue:number,detune=0)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.detune.value=detune;g.gain.value=gainValue;
      o.frequency.setValueAtTime(43*mult,now);o.frequency.exponentialRampToValueAtTime(74*mult,now+.46);o.frequency.exponentialRampToValueAtTime(55*mult,now+.94);o.frequency.exponentialRampToValueAtTime(45*mult,now+1.46);
      o.connect(g);g.connect(low);o.start(now);o.stop(now+1.72);nodes.push(o);
    };
    add("sawtooth",1,.31);add("sine",.5,.50,-4);add("triangle",2,.12,5);add("sine",3,.052,-7);
    engineRef.current={ctx,master,nodes};setSoundOn(true);
    window.setTimeout(()=>{if(engineRef.current?.ctx===ctx){engineRef.current=null;setSoundOn(false);ctx.close().catch(()=>{})}},1800);
  },[stopEngine]);

  useEffect(()=>{
    disposedRef.current=false;
    const params=new URLSearchParams(window.location.search);
    const proofHold=params.has("visual-mobile")||params.has("visual-desktop");
    const forceReplay=params.has("intro")||params.has("owner-webgpu");
    if(proofHold){document.documentElement.classList.add("wdcc-visual-proof","wdcc-intro-active")}
    if(!proofHold&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    if(!proofHold&&!forceReplay){try{if(sessionStorage.getItem(INTRO_KEY)==="seen"){setPhase("done");return}}catch{}}
    document.documentElement.classList.add("wdcc-intro-active");
    if(!proofHold){try{sessionStorage.setItem(INTRO_KEY,"seen")}catch{}}

    const root=rootRef.current,gpuHost=gpuRef.current;
    let raf=0,last=performance.now(),wheelAngle=0,renderer:any=null,scene:any=null,camera:any=null,objects:any[]=[];
    const importer=(url:string)=>(new Function("u","return import(u)") as (u:string)=>Promise<any>)(url);

    const initGpu=async()=>{
      if(!gpuHost||disposedRef.current||proofHold)return;
      let THREE:any=null,next:RenderMode="static";
      if("gpu" in navigator){
        try{THREE=await importer(WEBGPU_URL);renderer=new THREE.WebGPURenderer({alpha:true,antialias:true});if(renderer.init)await renderer.init();next="webgpu"}catch{renderer=null;THREE=null}
      }
      if(!renderer){
        try{THREE=await importer(WEBGL_URL);renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"});next="webgl"}catch{return}
      }
      if(disposedRef.current){try{renderer.dispose()}catch{};return}
      setMode(next);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      renderer.setSize(gpuHost.clientWidth||window.innerWidth,gpuHost.clientHeight||window.innerHeight,false);
      renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute("aria-hidden","true");gpuHost.appendChild(renderer.domElement);
      scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
      const radial=(inner:string,outer:string)=>{const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext("2d")!,g=x.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,inner);g.addColorStop(.24,inner);g.addColorStop(1,outer);x.fillStyle=g;x.fillRect(0,0,96,96);const tex=new THREE.CanvasTexture(c);tex.needsUpdate=true;return tex};
      const smokeTex=radial("rgba(236,243,248,.38)","rgba(184,204,218,0)");
      for(let i=0;i<10;i++){const mat=new THREE.SpriteMaterial({map:smokeTex,transparent:true,depthWrite:false,opacity:.045+Math.random()*.05});const s=new THREE.Sprite(mat);s.position.set(-1.12+Math.random()*2.24,-.76+Math.random()*1.52,.1);const k=.28+Math.random()*.48;s.scale.set(k,k*.58,1);s.userData={vx:(Math.random()-.5)*.00013,vy:.00009+Math.random()*.00011,base:mat.opacity,smoke:true};scene.add(s);objects.push(s)}
      const blue=radial("rgba(205,237,255,.74)","rgba(42,149,255,0)"),red=radial("rgba(255,176,176,.46)","rgba(255,36,48,0)");
      const flare=(tex:any,x:number,y:number,sx:number,sy:number,opacity:number)=>{const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,opacity});const s=new THREE.Sprite(mat);s.position.set(x,y,.2);s.scale.set(sx,sy,1);s.userData={base:opacity,smoke:false};scene.add(s);objects.push(s)};
      flare(blue,-.50,-.30,.38,.20,.18);flare(blue,-.14,-.30,.31,.17,.14);flare(red,.73,-.59,.46,.22,.09);
    };
    void initGpu();

    const started=performance.now();
    const frame=(now:number)=>{
      if(disposedRef.current)return;
      const elapsed=(now-started)/1000,dt=Math.min(.034,(now-last)/1000);last=now;
      let rpm=0;
      if(elapsed>.12&&elapsed<.46)rpm=19*ease((elapsed-.12)/.34);
      else if(elapsed<.76)rpm=19-4*ease((elapsed-.46)/.30);
      else if(elapsed<1.26)rpm=15*(1-ease((elapsed-.76)/.50));
      wheelAngle+=rpm*dt;
      if(root){root.style.setProperty("--li-spin",`${wheelAngle}rad`);root.style.setProperty("--li-wheel-blur",`${Math.min(1.35,rpm*.065)}px`);root.style.setProperty("--li-rpm",String(Math.min(1,rpm/19)))}
      if(scene&&renderer&&camera){const settle=1-ease(Math.max(0,(elapsed-.20)/1.02));for(const o of objects){if(o.userData?.smoke){o.position.x+=o.userData.vx*(dt*1000);o.position.y+=o.userData.vy*(dt*1000);o.material.opacity=o.userData.base*settle}else{o.material.opacity=o.userData.base*(.45+.55*settle)}}try{renderer.render(scene,camera)}catch{}}
      if(elapsed<1.82)raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);

    const resize=()=>{if(renderer&&gpuHost)renderer.setSize(gpuHost.clientWidth||window.innerWidth,gpuHost.clientHeight||window.innerHeight,false)};
    window.addEventListener("resize",resize,{passive:true});
    const handoff=proofHold?0:window.setTimeout(()=>document.documentElement.classList.add("wdcc-intro-handoff"),1280);
    const exit=proofHold?0:window.setTimeout(()=>setPhase("exit"),1360);
    const done=proofHold?0:window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active","wdcc-intro-handoff");setPhase("done")},1840);

    return()=>{
      disposedRef.current=true;cancelAnimationFrame(raf);if(handoff)clearTimeout(handoff);if(exit)clearTimeout(exit);if(done)clearTimeout(done);window.removeEventListener("resize",resize);document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active","wdcc-intro-handoff");stopEngine();
      for(const o of objects){try{o.material?.map?.dispose?.();o.material?.dispose?.()}catch{}}try{renderer?.dispose?.()}catch{};if(renderer?.domElement?.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  },[stopEngine]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active","wdcc-intro-handoff");stopEngine();setPhase("done")};
  if(phase==="done")return null;

  return <div ref={rootRef} className={`li li-${phase} li-webgpu`} aria-label="WDCC opening intro" data-wdcc-cinematic-intro="webgpu-three" data-render-mode={mode}>
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      html.wdcc-intro-active body main.reference-home.locked-storefront .rh-utility,html.wdcc-intro-active body main.reference-home.locked-storefront .rh-header,html.wdcc-intro-active body main.reference-home.locked-storefront .rh-hero-inner,html.wdcc-intro-active body main.reference-home.locked-storefront .rh-hero-shade{opacity:0!important;transition:opacity .34s cubic-bezier(.2,.8,.2,1)!important}
      html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-utility,html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-header,html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-hero-inner,html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-hero-shade{opacity:1!important}
      html.wdcc-intro-active body main.reference-home.locked-storefront .rh-hero-art{object-position:58% 50%!important;filter:saturate(1.24) contrast(1.03) brightness(1.27)!important;transition:filter .42s ease-out!important}
      html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-hero-art{filter:saturate(1.08) contrast(1.04) brightness(1.04)!important}
      .li{--li-spin:0rad;--li-wheel-blur:0px;--li-rpm:0;position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050d14;isolation:isolate;opacity:1;transition:opacity .46s cubic-bezier(.22,.72,.18,1)}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050d14}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:58% 50%;filter:saturate(1.24) contrast(1.03) brightness(1.27);transform:none!important;animation:none!important;transition:none!important}
      .li-scene:before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle at 52% 43%,rgba(120,184,236,.10),transparent 42%),linear-gradient(180deg,rgba(255,255,255,.025),transparent 48%);opacity:.9;animation:liBloomResolve 1.42s ease-out .04s forwards}
      .li-scene:after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(180deg,rgba(2,7,12,.01) 0%,rgba(2,7,12,0) 56%,rgba(2,7,12,.08) 80%,rgba(2,7,12,.24) 100%)}
      @keyframes liBloomResolve{0%{opacity:.9}62%{opacity:.40}100%{opacity:0}}
      .li-wheel{position:absolute;inset:0;z-index:2;pointer-events:none;background-image:url('/wdcc-hero-v2.webp');background-size:cover;background-position:58% 50%;filter:blur(var(--li-wheel-blur)) saturate(1.06);opacity:calc(.78 + var(--li-rpm)*.20);will-change:transform,filter;transform:rotate(var(--li-spin))}
      .li-wheel-front{clip-path:circle(5.1vw at 78.2% 69.2%);transform-origin:78.2% 69.2%}
      .li-wheel-rear{clip-path:circle(4.35vw at 95.5% 68.0%);transform-origin:95.5% 68.0%;transform:rotate(calc(var(--li-spin)*.96))}
      .li-gpu{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:1;transition:opacity .30s ease-out}
      .li-gpu canvas{display:block;width:100%!important;height:100%!important}
      .li-smoke{position:absolute;inset:-8%;z-index:4;overflow:hidden;pointer-events:none;opacity:1;background:radial-gradient(ellipse at 18% 40%,rgba(236,242,247,.26) 0%,rgba(181,196,207,.12) 25%,transparent 54%),radial-gradient(ellipse at 80% 55%,rgba(225,234,241,.20) 0%,rgba(148,168,182,.10) 31%,transparent 59%),linear-gradient(180deg,rgba(15,31,43,.09),rgba(5,13,20,.22));backdrop-filter:blur(15px) saturate(.86) contrast(.96);-webkit-backdrop-filter:blur(15px) saturate(.86) contrast(.96);will-change:opacity,backdrop-filter;animation:liSmokeClear 1.02s cubic-bezier(.16,.80,.24,1) .06s forwards}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;inset:-10%;pointer-events:none;border-radius:50%;opacity:1;will-change:opacity,transform,filter}
      .li-smoke:before{background:radial-gradient(ellipse at 32% 52%,rgba(245,248,250,.24) 0%,rgba(184,199,210,.12) 31%,transparent 61%),radial-gradient(ellipse at 68% 36%,rgba(226,235,241,.20) 0%,rgba(170,188,201,.10) 29%,transparent 58%);filter:blur(19px);animation:liFogDrift 1.42s cubic-bezier(.18,.72,.20,1) .04s forwards}
      .li-smoke:after{background:linear-gradient(112deg,transparent 16%,rgba(255,255,255,.10) 42%,rgba(221,233,241,.06) 52%,transparent 74%);filter:blur(12px);animation:liMistDrift 1.34s ease-out .08s forwards}
      @keyframes liSmokeClear{0%{opacity:1;backdrop-filter:blur(15px) saturate(.86) contrast(.96);-webkit-backdrop-filter:blur(15px) saturate(.86) contrast(.96)}42%{opacity:.82;backdrop-filter:blur(10px) saturate(.92) contrast(.98);-webkit-backdrop-filter:blur(10px) saturate(.92) contrast(.98)}76%{opacity:.28;backdrop-filter:blur(3px) saturate(.99) contrast(1);-webkit-backdrop-filter:blur(3px) saturate(.99) contrast(1)}100%{opacity:0;backdrop-filter:blur(0) saturate(1) contrast(1);-webkit-backdrop-filter:blur(0) saturate(1) contrast(1)}}
      @keyframes liFogDrift{0%{opacity:.96;filter:blur(19px);transform:translate3d(-2%,1%,0)}46%{opacity:.58;filter:blur(15px);transform:translate3d(.3%,-.2%,0)}80%{opacity:.16;filter:blur(10px);transform:translate3d(1.5%,-.8%,0)}100%{opacity:0;filter:blur(8px);transform:translate3d(2%,-1%,0)}}
      @keyframes liMistDrift{0%{opacity:.72;transform:translate3d(1.5%,0,0)}50%{opacity:.32;transform:translate3d(0,-.4%,0)}82%{opacity:.08;transform:translate3d(-1%,-.7%,0)}100%{opacity:0;transform:translate3d(-1.5%,-1%,0)}}
      .li-badge{position:absolute;z-index:5;left:50%;top:39%;width:clamp(236px,29vw,292px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:transparent;box-shadow:0 18px 52px rgba(0,0,0,.46);transform:translate(-50%,-50%)!important;overflow:visible;animation:liBadgeOut .38s ease-out .92s forwards}
      .li-badge:before{content:"";position:absolute;inset:-12px;border-radius:50%;border:1px solid rgba(255,255,255,.52);box-shadow:0 0 0 1px rgba(74,154,230,.18),0 0 34px rgba(74,154,230,.26);opacity:0;animation:liBadgeHalo 1.12s ease-out .12s both;pointer-events:none}
      @keyframes liBadgeHalo{0%{opacity:0}42%{opacity:.78}100%{opacity:.10}}
      @keyframes liBadgeOut{from{opacity:1}to{opacity:0}}
      .li-badge img{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;object-fit:contain;border-radius:0!important;clip-path:none!important;opacity:1!important;filter:drop-shadow(0 12px 28px rgba(0,0,0,.48))!important;transform:none!important;transition:none!important}
      .li-tag{position:absolute;z-index:6;left:50%;top:59%;transform:translateX(-50%);margin:0;padding:9px 14px;border:1px solid rgba(255,255,255,.52);border-radius:999px;background:rgba(2,9,15,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#fff!important;white-space:nowrap;font:950 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.085em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.98),0 0 12px rgba(255,255,255,.18);opacity:0;animation:liTagResolve .34s ease-out .18s forwards,liTagOut .28s ease-out .88s forwards}
      @keyframes liTagResolve{from{opacity:0}to{opacity:1}}@keyframes liTagOut{from{opacity:1}to{opacity:0}}
      .li-controls{position:absolute;z-index:7;left:max(16px,env(safe-area-inset-left));right:max(16px,env(safe-area-inset-right));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));display:flex;justify-content:space-between;gap:10px;align-items:center}
      .li-sound,.li-skip{min-height:44px;border:1px solid rgba(255,255,255,.44);border-radius:999px;background:rgba(3,9,14,.72);color:#fff;padding:0 16px;font:850 11px/1 system-ui,sans-serif;letter-spacing:.035em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .li-sound[aria-pressed=true]{border-color:rgba(97,191,255,.78);box-shadow:0 0 0 1px rgba(97,191,255,.16)}
      .li-exit .li-gpu,.li-exit .li-smoke,.li-exit .li-wheel{opacity:0;transition:opacity .18s ease-out}
      .wdcc-visual-proof .li-wheel,.wdcc-visual-proof .li-gpu{display:none!important}.wdcc-visual-proof .li-badge,.wdcc-visual-proof .li-tag,.wdcc-visual-proof .li-scene:before{animation:none!important}.wdcc-visual-proof .li-badge,.wdcc-visual-proof .li-tag{opacity:1!important}
      @media(max-width:600px),(max-width:1180px) and (hover:none) and (pointer:coarse){html.wdcc-intro-active body main.reference-home.locked-storefront .rh-hero-art{object-position:61% 45%!important}.li-scene img{object-position:61% 45%;filter:saturate(1.25) contrast(1.02) brightness(1.30)}.li-wheel{background-position:61% 45%}.li-wheel-front{clip-path:circle(12.5vw at 77.6% 68.2%);transform-origin:77.6% 68.2%}.li-wheel-rear{clip-path:circle(10.4vw at 97.2% 67.0%);transform-origin:97.2% 67.0%}html body .li .li-badge{top:38.5%!important;width:min(70vw,276px)!important;min-width:238px!important}html body .li .li-tag{top:59%!important;font-size:13px!important;letter-spacing:.06em!important;padding:9px 13px!important}.li-smoke{inset:-10%;backdrop-filter:blur(16px) saturate(.84);-webkit-backdrop-filter:blur(16px) saturate(.84)}}
      @media(max-width:430px){html body .li .li-badge{width:min(69vw,270px)!important;min-width:236px!important}html body .li .li-tag{font-size:12px!important;letter-spacing:.05em!important}.li-sound,.li-skip{padding:0 13px;font-size:10px}}
      @media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .li{display:none!important}.li-smoke,.li-smoke:before,.li-smoke:after,.li-tag,.li-badge:before,.li-scene:before{animation:none!important;opacity:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-wheel li-wheel-front" aria-hidden="true"/><div className="li-wheel li-wheel-rear" aria-hidden="true"/>
    <div ref={gpuRef} className="li-gpu" aria-hidden="true"/>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don&apos;t Care Cars · Tampa Bay</p>
    <div className="li-controls"><button className="li-sound" type="button" onClick={()=>void startEngine()} aria-pressed={soundOn}>{soundOn?"DEEP SOUND ON":"TAP FOR DEEP SOUND"}</button><button className="li-skip" type="button" onClick={finish}>Skip intro</button></div>
  </div>
}
