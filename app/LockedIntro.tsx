"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"handoff"|"done";
type RenderMode="webgpu"|"webgl"|"static";
type EngineHandle={ctx:AudioContext;master:GainNode;nodes:OscillatorNode[]};

const INTRO_KEY="wdcc-cinematic-intro-v1";
const WEBGPU_URL="https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.webgpu.min.js";
const WEBGL_URL="https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";
const ease=(x:number)=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v)};

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
  const[mode,setMode]=useState<RenderMode>("static");
  const[soundOn,setSoundOn]=useState(false);
  const rootRef=useRef<HTMLDivElement|null>(null);
  const fxRef=useRef<HTMLDivElement|null>(null);
  const engineRef=useRef<EngineHandle|null>(null);
  const disposedRef=useRef(false);

  const stopEngine=useCallback(()=>{
    const h=engineRef.current;if(!h)return;
    const now=h.ctx.currentTime;
    try{h.master.gain.cancelScheduledValues(now);h.master.gain.setValueAtTime(Math.max(.0001,h.master.gain.value),now);h.master.gain.exponentialRampToValueAtTime(.0001,now+.18)}catch{}
    window.setTimeout(()=>{for(const n of h.nodes){try{n.stop()}catch{}};h.ctx.close().catch(()=>{})},220);
    engineRef.current=null;setSoundOn(false);
  },[]);

  const startEngine=useCallback(async()=>{
    if(engineRef.current){stopEngine();return}
    const AudioCtor=(window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext);if(!AudioCtor)return;
    const ctx=new AudioCtor();
    try{await ctx.resume()}catch{}
    if(ctx.state!=="running"){ctx.close().catch(()=>{});return}
    const now=ctx.currentTime,master=ctx.createGain(),low=ctx.createBiquadFilter(),body=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor();
    master.gain.setValueAtTime(.0001,now);master.gain.exponentialRampToValueAtTime(.23,now+.10);master.gain.setValueAtTime(.23,now+.62);master.gain.exponentialRampToValueAtTime(.105,now+1.28);master.gain.exponentialRampToValueAtTime(.0001,now+1.72);
    low.type="lowpass";low.frequency.value=310;low.Q.value=.72;body.type="peaking";body.frequency.value=86;body.Q.value=.85;body.gain.value=7;comp.threshold.value=-18;comp.knee.value=16;comp.ratio.value=4;comp.attack.value=.012;comp.release.value=.22;
    low.connect(body);body.connect(comp);comp.connect(master);master.connect(ctx.destination);
    const nodes:OscillatorNode[]=[];
    const add=(type:OscillatorType,mult:number,gainValue:number,detune=0)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.detune.value=detune;g.gain.value=gainValue;o.frequency.setValueAtTime(44*mult,now);o.frequency.exponentialRampToValueAtTime(72*mult,now+.54);o.frequency.exponentialRampToValueAtTime(54*mult,now+1.05);o.frequency.exponentialRampToValueAtTime(46*mult,now+1.52);o.connect(g);g.connect(low);o.start(now);o.stop(now+1.82);nodes.push(o)};
    add("sawtooth",1,.32);add("sine",.5,.48,-4);add("triangle",2,.12,5);add("sine",3,.055,-7);
    engineRef.current={ctx,master,nodes};setSoundOn(true);
    window.setTimeout(()=>{if(engineRef.current?.ctx===ctx){engineRef.current=null;setSoundOn(false);ctx.close().catch(()=>{})}},1900);
  },[stopEngine]);

  useEffect(()=>{
    disposedRef.current=false;
    const params=new URLSearchParams(window.location.search);
    const proofHold=params.has("visual-mobile")||params.has("visual-desktop");
    const replay=params.has("intro")||params.has("owner-webgpu");
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches&&!proofHold){setPhase("done");return}
    if(!proofHold&&!replay&&sessionStorage.getItem(INTRO_KEY)==="seen"){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    if(proofHold)document.documentElement.classList.add("wdcc-visual-proof");
    if(!proofHold)sessionStorage.setItem(INTRO_KEY,"seen");

    let raf=0,last=performance.now(),angle=0,renderer:any=null,scene:any=null,camera:any=null,fxObjects:any[]=[];
    const root=rootRef.current,fx=fxRef.current;
    const importer=(url:string)=>(new Function("u","return import(u)") as (u:string)=>Promise<any>)(url);

    const initThree=async()=>{
      if(!fx||disposedRef.current)return;
      let THREE:any=null,nextMode:RenderMode="static";
      if("gpu" in navigator){
        try{THREE=await importer(WEBGPU_URL);renderer=new THREE.WebGPURenderer({alpha:true,antialias:true});if(renderer.init)await renderer.init();nextMode="webgpu"}catch{renderer=null;THREE=null}
      }
      if(!renderer){
        try{THREE=await importer(WEBGL_URL);renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"});nextMode="webgl"}catch{return}
      }
      if(disposedRef.current){try{renderer.dispose()}catch{};return}
      setMode(nextMode);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(fx.clientWidth||window.innerWidth,fx.clientHeight||window.innerHeight,false);renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute("aria-hidden","true");fx.appendChild(renderer.domElement);
      scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
      const makeGlow=(inner:string,outer:string)=>{const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext("2d")!,g=x.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,inner);g.addColorStop(.22,inner);g.addColorStop(1,outer);x.fillStyle=g;x.fillRect(0,0,96,96);const tex=new THREE.CanvasTexture(c);tex.needsUpdate=true;return tex};
      const smokeTex=makeGlow("rgba(235,242,248,.44)","rgba(190,205,216,0)");
      for(let i=0;i<11;i++){const mat=new THREE.SpriteMaterial({map:smokeTex,transparent:true,depthWrite:false,opacity:.055+Math.random()*.055});const s=new THREE.Sprite(mat);s.position.set(-1.1+Math.random()*2.2,-.72+Math.random()*1.5,.1);const k=.28+Math.random()*.52;s.scale.set(k,k*.58,1);s.userData={vx:(Math.random()-.5)*.00016,vy:.00012+Math.random()*.00012,base:mat.opacity};scene.add(s);fxObjects.push(s)}
      const blueTex=makeGlow("rgba(180,224,255,.82)","rgba(45,151,255,0)"),redTex=makeGlow("rgba(255,165,165,.52)","rgba(255,33,47,0)");
      const flare=(tex:any,x:number,y:number,sx:number,sy:number,opacity:number)=>{const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,opacity});const s=new THREE.Sprite(mat);s.position.set(x,y,.2);s.scale.set(sx,sy,1);scene.add(s);fxObjects.push(s);return s};
      flare(blueTex,-.48,-.28,.40,.22,.22);flare(blueTex,-.08,-.28,.34,.18,.18);flare(redTex,.72,-.58,.50,.24,.11);
    };
    void initThree();

    const start=performance.now();
    const frame=(now:number)=>{
      if(disposedRef.current)return;
      const elapsed=(now-start)/1000,dt=Math.min(.034,(now-last)/1000);last=now;
      let rpm=0;
      if(elapsed>.16&&elapsed<.50)rpm=18*ease((elapsed-.16)/.34);
      else if(elapsed<.84)rpm=18-4*ease((elapsed-.50)/.34);
      else if(elapsed<1.34)rpm=14*(1-ease((elapsed-.84)/.50));
      angle+=rpm*dt;
      if(root){root.style.setProperty("--ci-spin",`${angle}rad`);root.style.setProperty("--ci-wheel-blur",`${Math.min(1.55,rpm*.075)}px`);root.style.setProperty("--ci-rpm",String(rpm/18))}
      if(scene&&renderer&&camera){const settle=proofHold?.5:1-ease(Math.max(0,(elapsed-.28)/1.02));for(let i=0;i<fxObjects.length;i++){const o=fxObjects[i];if(o.userData?.base){o.position.x+=o.userData.vx*(dt*1000);o.position.y+=o.userData.vy*(dt*1000);o.material.opacity=o.userData.base*settle}else{o.material.opacity*=proofHold?1:.992}}try{renderer.render(scene,camera)}catch{}}
      if(proofHold||elapsed<1.76)raf=requestAnimationFrame(frame)
    };
    raf=requestAnimationFrame(frame);

    const resize=()=>{if(renderer&&fx){renderer.setSize(fx.clientWidth||window.innerWidth,fx.clientHeight||window.innerHeight,false)}};window.addEventListener("resize",resize,{passive:true});
    const handoff=proofHold?0:window.setTimeout(()=>setPhase("handoff"),1420);
    const done=proofHold?0:window.setTimeout(()=>{setPhase("done");document.documentElement.classList.remove("wdcc-intro-active")},1760);
    const autoSound=()=>{if(!engineRef.current)void startEngine()};window.addEventListener("pointerdown",autoSound,{once:true,passive:true});

    return()=>{disposedRef.current=true;cancelAnimationFrame(raf);if(handoff)clearTimeout(handoff);if(done)clearTimeout(done);window.removeEventListener("resize",resize);window.removeEventListener("pointerdown",autoSound);document.documentElement.classList.remove("wdcc-intro-active","wdcc-visual-proof");stopEngine();if(scene){for(const o of fxObjects){try{o.material?.map?.dispose?.();o.material?.dispose?.()}catch{}}}try{renderer?.dispose?.()}catch{};if(renderer?.domElement?.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement)};
  },[startEngine,stopEngine]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active","wdcc-visual-proof");stopEngine();setPhase("done")};
  if(phase==="done")return null;

  return <div ref={rootRef} className={`ci ci-${phase}`} aria-label="WDCC opening intro" data-wdcc-cinematic-intro="webgpu-three">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}.ci{--ci-spin:0rad;--ci-wheel-blur:0px;--ci-rpm:0;position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#07121b;isolation:isolate;opacity:1;transition:opacity .34s cubic-bezier(.2,.8,.2,1)}.ci-handoff{opacity:0;pointer-events:none}.ci-scene{position:absolute;inset:0;z-index:1;overflow:hidden;background:#07121b}.ci-scene>img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;filter:saturate(1.12) contrast(1.035) brightness(1.13);transform:scale(1.006);animation:ciFocus 1.14s cubic-bezier(.16,.8,.24,1) forwards}.ci-vignette{position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle at 49% 46%,transparent 26%,rgba(3,10,16,.04) 60%,rgba(1,5,9,.32) 100%),linear-gradient(180deg,rgba(9,20,30,.06),transparent 58%,rgba(1,6,10,.18))}.ci-wheel{position:absolute;inset:-2%;z-index:3;pointer-events:none;background-image:url('/wdcc-hero-v2.webp');background-size:cover;background-position:center;transform:rotate(var(--ci-spin));filter:blur(var(--ci-wheel-blur)) saturate(1.08);will-change:transform,filter;opacity:calc(.72 + var(--ci-rpm)*.24)}.ci-wheel-front{clip-path:circle(8.9% at 78.2% 69.3%);transform-origin:78.2% 69.3%}.ci-wheel-rear{clip-path:circle(7.6% at 96% 67.8%);transform-origin:96% 67.8%;transform:rotate(calc(var(--ci-spin)*.96))}.ci-wheel:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78.2% 69.3%,transparent 0 3.1%,rgba(255,255,255,.05) 3.4%,transparent 7.8%);mix-blend-mode:screen;opacity:var(--ci-rpm)}.ci-fx{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:1;transition:opacity .28s ease-out}.ci-fx canvas{display:block;width:100%!important;height:100%!important}.ci-smoke{position:absolute;inset:-8%;z-index:5;pointer-events:none;background:radial-gradient(ellipse at 22% 48%,rgba(224,236,244,.19),transparent 48%),radial-gradient(ellipse at 80% 62%,rgba(214,228,238,.13),transparent 52%);backdrop-filter:blur(8px) saturate(.93);-webkit-backdrop-filter:blur(8px) saturate(.93);animation:ciSmoke 1.06s cubic-bezier(.16,.8,.24,1) forwards}.ci-badge{position:absolute;z-index:6;left:50%;top:34%;width:clamp(252px,31vw,330px);aspect-ratio:1;transform:translate(-50%,-50%);filter:drop-shadow(0 18px 34px rgba(0,0,0,.55));animation:ciBadge 1.36s cubic-bezier(.16,.8,.24,1) forwards}.ci-badge img{display:block;width:100%;height:100%;object-fit:contain}.ci-tag{position:absolute;z-index:7;left:50%;top:55.5%;transform:translateX(-50%);margin:0;white-space:nowrap;color:#fff;text-shadow:0 2px 10px #000;font:900 clamp(11px,1.2vw,14px)/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase;opacity:0;animation:ciTag .42s ease-out .22s forwards}.ci-controls{position:absolute;z-index:8;left:max(14px,env(safe-area-inset-left));right:max(14px,env(safe-area-inset-right));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));display:flex;justify-content:space-between;align-items:center;gap:10px}.ci-control{min-height:44px;border:1px solid rgba(255,255,255,.38);border-radius:999px;background:rgba(3,10,16,.68);color:#fff;padding:0 15px;font:850 11px/1 system-ui,sans-serif;letter-spacing:.05em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.ci-render{color:rgba(255,255,255,.64);font:800 9px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}.ci-handoff .ci-fx,.ci-handoff .ci-smoke{opacity:0}.ci-handoff .ci-badge,.ci-handoff .ci-tag{opacity:0!important}.ci-handoff .ci-wheel{opacity:0;transition:opacity .16s ease-out}@keyframes ciFocus{0%{filter:blur(6px) saturate(.86) brightness(.89);transform:scale(1.012)}34%{filter:blur(3px) saturate(.98) brightness(1.02)}100%{filter:blur(0) saturate(1.12) contrast(1.035) brightness(1.13);transform:scale(1)}}@keyframes ciSmoke{0%{opacity:1;backdrop-filter:blur(10px) saturate(.88);-webkit-backdrop-filter:blur(10px) saturate(.88)}62%{opacity:.42;backdrop-filter:blur(4px) saturate(.97);-webkit-backdrop-filter:blur(4px) saturate(.97)}100%{opacity:0;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0)}}@keyframes ciBadge{0%,63%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(.992)}}@keyframes ciTag{to{opacity:.92}}@keyframes liSmokeClear{from{opacity:1}to{opacity:0}}.wdcc-visual-proof .ci-scene>img,.wdcc-visual-proof .ci-badge,.wdcc-visual-proof .ci-tag,.wdcc-visual-proof .ci-smoke{animation:none!important}.wdcc-visual-proof .ci-badge{opacity:1!important}.wdcc-visual-proof .ci-tag{opacity:1!important}.wdcc-visual-proof .ci-smoke{opacity:.28!important;backdrop-filter:blur(3px) saturate(.98);-webkit-backdrop-filter:blur(3px) saturate(.98)}@media(max-width:700px){.ci-scene>img{object-position:61% 45%;filter:saturate(1.16) contrast(1.03) brightness(1.17)}.ci-wheel{background-position:61% 45%}.ci-wheel-front{clip-path:circle(10.2% at 77.6% 68.2%);transform-origin:77.6% 68.2%}.ci-wheel-rear{clip-path:circle(8.6% at 98% 66.8%);transform-origin:98% 66.8%}.ci-badge{top:33%;width:min(70vw,292px)}.ci-tag{top:54.8%;font-size:11px;letter-spacing:.075em}}@media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .ci{display:none!important}}
    `}</style>
    <div className="ci-scene li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/><div className="ci-vignette"/></div>
    <div className="ci-wheel ci-wheel-front" aria-hidden="true"/><div className="ci-wheel ci-wheel-rear" aria-hidden="true"/>
    <div ref={fxRef} className="ci-fx" aria-hidden="true"/><div className="ci-smoke li-smoke" aria-hidden="true"/>
    <div className="ci-badge li-badge"><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="512" height="512"/></div><p className="ci-tag li-tag">Tampa Bay · Drive today</p>
    <div className="ci-controls"><button className="ci-control" type="button" onClick={()=>void startEngine()} aria-pressed={soundOn}>{soundOn?"SOUND ON":"TAP FOR DEEP SOUND"}</button><span className="ci-render">{mode==="webgpu"?"WebGPU":mode==="webgl"?"WebGL fallback":"Static fallback"}</span><button className="ci-control" type="button" onClick={finish}>SKIP</button></div>
  </div>
}
