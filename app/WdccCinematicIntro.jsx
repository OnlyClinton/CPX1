"use client";

import {useEffect,useRef,useState} from "react";

const HERO="/wdcc-hero-v2.webp";
const LOGO="/wdcc-logo-transparent.webp";

export default function WdccCinematicIntro({onDone}){
  const hostRef=useRef(null);
  const canvasRef=useRef(null);
  const logoRef=useRef(null);
  const flareRef=useRef(null);
  const taglineRef=useRef(null);
  const skipRef=useRef(null);
  const [visible,setVisible]=useState(true);
  const finishedRef=useRef(false);

  useEffect(()=>{
    if(!visible)return;
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches){
      setVisible(false);
      onDone?.();
      return;
    }

    let disposed=false;
    let renderer=null;
    let raf=0;
    let timeline=null;
    let resize=null;
    let scene=null;
    let smoke=null;
    let carPlane=null;
    let bgPlane=null;

    const finish=()=>{
      if(finishedRef.current)return;
      finishedRef.current=true;
      if(timeline)timeline.kill();
      if(hostRef.current){
        hostRef.current.style.pointerEvents="none";
        hostRef.current.style.opacity="0";
      }
      window.setTimeout(()=>{
        if(disposed)return;
        setVisible(false);
        onDone?.();
      },360);
    };

    const start=async()=>{
      try{
        const [{gsap},THREE]=await Promise.all([
          import("gsap"),
          import("three/webgpu")
        ]);
        if(disposed||!canvasRef.current||!hostRef.current)return;

        const canvas=canvasRef.current;
        const width=Math.max(1,window.innerWidth);
        const height=Math.max(1,window.innerHeight);
        scene=new THREE.Scene();
        scene.background=new THREE.Color(0x020408);

        const camera=new THREE.PerspectiveCamera(38,width/height,0.1,100);
        camera.position.set(0,0,7.8);

        renderer=new THREE.WebGPURenderer({canvas,antialias:true,alpha:false});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
        renderer.setSize(width,height,false);
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        if(renderer.init)await renderer.init();
        canvas.dataset.renderer=(navigator.gpu?"webgpu":"webgl2-fallback");

        const loader=new THREE.TextureLoader();
        const hero=await loader.loadAsync(HERO);
        hero.colorSpace=THREE.SRGBColorSpace;
        hero.minFilter=THREE.LinearFilter;
        hero.magFilter=THREE.LinearFilter;

        const bgMat=new THREE.MeshBasicMaterial({map:hero,transparent:true,opacity:0});
        bgPlane=new THREE.Mesh(new THREE.PlaneGeometry(15.6,9.2),bgMat);
        bgPlane.position.set(0,0,-3.8);
        bgPlane.scale.set(1.1,1.1,1);
        scene.add(bgPlane);

        const carTex=hero.clone();
        carTex.needsUpdate=true;
        carTex.wrapS=THREE.ClampToEdgeWrapping;
        carTex.wrapT=THREE.ClampToEdgeWrapping;
        carTex.repeat.set(0.60,0.82);
        carTex.offset.set(0.40,0.02);
        const carMat=new THREE.MeshBasicMaterial({map:carTex,transparent:true,opacity:0,depthWrite:false});
        carPlane=new THREE.Mesh(new THREE.PlaneGeometry(9.6,5.15),carMat);
        carPlane.position.set(7.8,-0.85,-0.45);
        carPlane.rotation.z=-0.025;
        scene.add(carPlane);

        const glowMat=new THREE.MeshBasicMaterial({color:0xff2d25,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
        const glow=new THREE.Mesh(new THREE.PlaneGeometry(5.2,1.6),glowMat);
        glow.position.set(1.9,-1.1,-0.7);
        scene.add(glow);

        const count=window.innerWidth<700?720:1250;
        const pos=new Float32Array(count*3);
        for(let i=0;i<count;i++){
          const k=i*3;
          pos[k]=(Math.random()-.5)*12;
          pos[k+1]=-2.0+Math.random()*3.0;
          pos[k+2]=-1.2+Math.random()*4.8;
        }
        const smokeGeo=new THREE.BufferGeometry();
        smokeGeo.setAttribute("position",new THREE.BufferAttribute(pos,3));
        const smokeMat=new THREE.PointsMaterial({
          color:0xdbe9f4,size:window.innerWidth<700?.052:.06,transparent:true,opacity:0,
          depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true
        });
        smoke=new THREE.Points(smokeGeo,smokeMat);
        smoke.position.y=-0.45;
        scene.add(smoke);

        const clock=new THREE.Clock();
        const render=()=>{
          if(disposed)return;
          const t=clock.getElapsedTime();
          if(smoke){
            smoke.rotation.y=Math.sin(t*.22)*.05;
            smoke.position.x=Math.sin(t*.34)*.16;
            smoke.position.y=-.45+Math.sin(t*.41)*.05;
          }
          if(carPlane)carPlane.rotation.z=-.025+Math.sin(t*2.1)*.0025;
          renderer.render(scene,camera);
          raf=requestAnimationFrame(render);
        };
        render();

        resize=()=>{
          if(!renderer)return;
          const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
          camera.aspect=w/h;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
          renderer.setSize(w,h,false);
        };
        window.addEventListener("resize",resize,{passive:true});

        const host=hostRef.current;
        const logo=logoRef.current;
        const flare=flareRef.current;
        const tagline=taglineRef.current;
        const skip=skipRef.current;

        gsap.set(host,{autoAlpha:1});
        gsap.set([logo,tagline,skip],{autoAlpha:0});
        gsap.set(flare,{autoAlpha:0,scale:.25});
        gsap.set(logo,{xPercent:-50,yPercent:-50,scale:.72,left:"50%",top:"48%"});

        timeline=gsap.timeline({defaults:{ease:"power3.out"},onComplete:finish});
        timeline
          .to(bgMat,{opacity:1,duration:.42},0)
          .to(bgPlane.scale,{x:1.0,y:1.0,duration:2.35,ease:"power1.out"},0)
          .to(smokeMat,{opacity:.25,duration:.55},.08)
          .to(logo,{autoAlpha:1,scale:1,duration:.55,ease:"back.out(1.65)"},.10)
          .to(tagline,{autoAlpha:1,y:0,duration:.45},.33)
          .to(skip,{autoAlpha:1,duration:.25},.38)
          .to(carMat,{opacity:1,duration:.18},.34)
          .to(carPlane.position,{x:-.28,y:-.78,duration:1.34,ease:"power4.out"},.34)
          .to(carPlane.scale,{x:1.06,y:1.06,duration:1.18,ease:"power2.out"},.36)
          .to(glowMat,{opacity:.42,duration:.24},.94)
          .to(glow.scale,{x:1.28,y:1.28,duration:.52,ease:"power2.out"},.94)
          .to(flare,{autoAlpha:1,scale:1.9,duration:.16,ease:"power2.out"},1.12)
          .to(flare,{autoAlpha:0,scale:5.2,duration:.34,ease:"power2.in"},1.28)
          .to(host,{x:3,duration:.035,yoyo:true,repeat:5,ease:"none"},1.18)
          .to(host,{x:0,duration:.04},1.40)
          .to(logo,{left:"64px",top:"64px",xPercent:0,yPercent:0,scale:.42,duration:.66,ease:"expo.inOut"},1.48)
          .to(tagline,{autoAlpha:0,duration:.20},1.48)
          .to(smokeMat,{opacity:.06,duration:.60},1.55)
          .to(carPlane.position,{x:-2.7,y:-.72,duration:.82,ease:"power2.in"},1.62)
          .to(carMat,{opacity:.16,duration:.50},1.72)
          .to(glowMat,{opacity:0,duration:.34},1.78)
          .to(host,{autoAlpha:0,duration:.46,ease:"power2.inOut"},2.24);

      }catch(err){
        console.error("WDCC cinematic renderer fallback",err);
        try{
          const {gsap}=await import("gsap");
          if(disposed||!hostRef.current)return;
          const host=hostRef.current;
          const logo=logoRef.current;
          const tagline=taglineRef.current;
          canvasRef.current.style.background=`linear-gradient(90deg,rgba(2,5,9,.78),rgba(2,5,9,.18)),url(${HERO}) 70% center/cover no-repeat`;
          gsap.set(logo,{xPercent:-50,yPercent:-50,left:"50%",top:"48%",scale:.78,autoAlpha:0});
          gsap.set(tagline,{autoAlpha:0});
          timeline=gsap.timeline({onComplete:finish})
            .to(logo,{autoAlpha:1,scale:1,duration:.55,ease:"back.out(1.6)"},0)
            .to(tagline,{autoAlpha:1,duration:.4},.25)
            .to(logo,{left:"64px",top:"64px",xPercent:0,yPercent:0,scale:.42,duration:.7,ease:"expo.inOut"},1.35)
            .to(tagline,{autoAlpha:0,duration:.2},1.35)
            .to(host,{autoAlpha:0,duration:.45},2.15);
        }catch{
          window.setTimeout(finish,1600);
        }
      }
    };

    start();
    const skip=()=>finish();
    window.addEventListener("wheel",skip,{passive:true,once:true});
    window.addEventListener("touchmove",skip,{passive:true,once:true});

    return()=>{
      disposed=true;
      if(timeline)timeline.kill();
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel",skip);
      window.removeEventListener("touchmove",skip);
      if(resize)window.removeEventListener("resize",resize);
      if(scene){
        scene.traverse(obj=>{
          if(obj.geometry?.dispose)obj.geometry.dispose();
          const materials=Array.isArray(obj.material)?obj.material:[obj.material];
          materials.filter(Boolean).forEach(m=>{
            if(m.map?.dispose)m.map.dispose();
            if(m.dispose)m.dispose();
          });
        });
      }
      if(renderer?.dispose)renderer.dispose();
    };
  },[visible,onDone]);

  if(!visible)return null;

  return <div ref={hostRef} aria-label="WDCC cinematic opening" style={{position:"fixed",inset:0,zIndex:9999,background:"#020408",overflow:"hidden",transition:"opacity .35s ease",touchAction:"pan-y"}}>
    <canvas ref={canvasRef} aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block"}}/>
    <div aria-hidden="true" style={{position:"absolute",inset:0,background:"radial-gradient(circle at 65% 55%,transparent 0 28%,rgba(2,5,9,.22) 58%,rgba(2,5,9,.78) 100%)",pointerEvents:"none"}}/>
    <img ref={logoRef} src={LOGO} alt="We Don't Care Cars" width="512" height="512" style={{position:"absolute",left:"50%",top:"48%",width:"min(46vw,230px)",height:"auto",filter:"drop-shadow(0 14px 32px rgba(0,0,0,.7)) drop-shadow(0 0 24px rgba(22,138,244,.28))",willChange:"transform,left,top,opacity"}}/>
    <div ref={flareRef} aria-hidden="true" style={{position:"absolute",left:"50%",top:"50%",width:12,height:12,marginLeft:-6,marginTop:-6,borderRadius:"50%",background:"#fff",boxShadow:"0 0 34px 18px rgba(120,190,255,.55)",pointerEvents:"none"}}/>
    <p ref={taglineRef} style={{position:"absolute",left:"50%",top:"70%",transform:"translateX(-50%)",margin:0,color:"#eef4f8",fontSize:"clamp(9px,1.5vw,12px)",fontWeight:900,letterSpacing:".15em",textTransform:"uppercase",whiteSpace:"nowrap",textShadow:"0 4px 18px #000"}}>Tampa Bay · Drive today</p>
    <button ref={skipRef} type="button" onClick={finishClick=>{finishClick.preventDefault();finishedRef.current=false;hostRef.current&&(hostRef.current.style.opacity="0");window.setTimeout(()=>{setVisible(false);onDone?.();},330);}} style={{position:"absolute",right:16,bottom:16,minHeight:40,padding:"0 15px",borderRadius:999,border:"1px solid rgba(255,255,255,.28)",background:"rgba(2,5,9,.58)",backdropFilter:"blur(10px)",color:"#e7eef4",fontSize:10,fontWeight:900,letterSpacing:".08em",textTransform:"uppercase"}}>Skip intro</button>
  </div>;
}
