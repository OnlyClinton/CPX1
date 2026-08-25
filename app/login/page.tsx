"use client";

import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";

const destinationForRole=(value:unknown)=>{
  const role=String(value||"").trim().toLowerCase();
  if(["platform_admin","tenant_admin","admin"].includes(role))return "/admin";
  if(["dealer_agent","dealer"].includes(role))return "/dealer";
  return "";
};

export default function UnifiedLogin(){
  const[username,setUsername]=useState("");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("Enter the login and password provided by your WDCC administrator.");
  const[busy,setBusy]=useState(false);
  const[showPassword,setShowPassword]=useState(false);

  useEffect(()=>{
    let active=true;
    fetch("/api/auth/session",{cache:"no-store",credentials:"include",signal:AbortSignal.timeout(6000)})
      .then(r=>r.json())
      .then(session=>{
        if(!active||!session?.authenticated)return;
        const destination=destinationForRole(session?.user?.role);
        if(destination)location.replace(destination);
      })
      .catch(()=>{});
    return()=>{active=false};
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();
    if(busy)return;
    const login=username.trim();
    if(!login||!password){setMessage("Login and password are required.");return;}
    setBusy(true);setMessage("Verifying secure access…");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({email:login,username:login,password}),signal:AbortSignal.timeout(12000)});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j?.ok){
        if(r.status===401)throw Error("Login or password is incorrect.");
        if(r.status===429)throw Error("Too many sign-in attempts. Wait a moment and try again.");
        if(r.status>=500)throw Error("WDCC secure access is temporarily unavailable. Please try again.");
        throw Error(j?.error||"Sign-in failed.");
      }
      let destination=destinationForRole(j?.role||j?.user?.role);
      if(!destination){
        const s=await fetch("/api/auth/session",{cache:"no-store",credentials:"include",signal:AbortSignal.timeout(7000)});
        const sj=await s.json().catch(()=>({}));
        if(s.ok&&sj?.authenticated)destination=destinationForRole(sj?.user?.role);
      }
      if(destination){setMessage("Access verified. Opening your portal…");location.replace(destination);return;}
      await fetch("/api/auth/logout",{method:"POST",credentials:"include",cache:"no-store"}).catch(()=>{});
      throw Error("This account is active but does not have a WDCC portal role.");
    }catch(error){
      const text=error instanceof DOMException&&error.name==="TimeoutError"?"Secure access timed out. Please try again.":error instanceof Error?error.message:"Sign-in failed.";
      setMessage(text);
    }finally{setBusy(false)}
  }

  return <main className="loginShell">
    <section className="brandPanel" aria-label="We Don't Care Cars"><div className="shade"/><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/><div className="copy"><span>WDCC SECURE ACCESS</span><h1>PORTAL LOGIN</h1><p>One secure sign-in. Your assigned role sends you directly to Dealer Operations or Admin Control.</p></div></section>
    <section className="formPanel"><form onSubmit={submit} aria-busy={busy}><span>AUTHORIZED ACCESS</span><h2>Sign In</h2><p className="introCopy">Use the login and password assigned to your account.</p><label>LOGIN<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} inputMode="email" disabled={busy} required/></label><label>PASSWORD<div className="passwordRow"><input value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?"text":"password"} autoComplete="current-password" disabled={busy} required/><button className="showPassword" type="button" onClick={()=>setShowPassword(v=>!v)} disabled={busy} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?"HIDE":"SHOW"}</button></div></label><button className="submit" disabled={busy}>{busy?"VERIFYING…":"SIGN IN"}</button><div className="message" role="status" aria-live="polite">{message}</div><div className="portalLinks"><Link href="/">← Storefront</Link><span>Secure WDCC access</span></div></form></section>
    <style jsx>{`
      .loginShell{min-height:100svh;background:#02060b;color:#fff;display:grid;grid-template-columns:minmax(320px,44%) 1fr;font-family:Inter,system-ui,sans-serif}.brandPanel{min-height:100svh;position:relative;background:url('/wdcc-hero-v2.webp') center/cover no-repeat;overflow:hidden}.shade{position:absolute;inset:0;background:linear-gradient(180deg,#02060b12,#02060b66 55%,#02060bf5)}.brandPanel img{position:absolute;z-index:2;top:24px;left:28px;width:132px}.copy{position:absolute;z-index:2;left:32px;right:32px;bottom:36px}.copy span,.formPanel form>span{color:#ef233c;font-size:10px;letter-spacing:.16em;font-weight:900}.copy h1{margin:5px 0 8px;font-size:clamp(38px,5vw,68px);line-height:.9;letter-spacing:-.06em}.copy p{color:#c7d2dc;max-width:440px;font-size:13px}.formPanel{display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 55% 5%,#122337,#06101a 38%,#02060b 76%)}form{width:min(430px,100%);background:#0c1723;border:1px solid #22364a;border-radius:14px;padding:28px;box-shadow:0 28px 70px #0009}h2{font-size:31px;margin:4px 0 6px}.introCopy{margin:0 0 20px;color:#95a7b8;font-size:13px;line-height:1.5}label{display:grid;gap:7px;margin-top:14px;font-size:10px;font-weight:900;letter-spacing:.08em;color:#c6d1dc}input{box-sizing:border-box;width:100%;height:50px;border:1px solid #34485e;border-radius:7px;background:#fff;color:#111;padding:0 13px;font:inherit;font-size:16px;outline:none}input:focus{border-color:#5fa8ff;box-shadow:0 0 0 3px #2384ff28}input:disabled{opacity:.72}.passwordRow{display:grid;grid-template-columns:1fr auto;gap:8px}.showPassword{width:68px;height:50px;margin:0;border:1px solid #34485e;border-radius:7px;background:#122235;color:#dbe7f3;font-size:10px;font-weight:900;letter-spacing:.08em;cursor:pointer}.submit{width:100%;height:49px;margin-top:20px;border:0;border-radius:7px;background:#ed1c2e;color:#fff;font-weight:950;cursor:pointer}.submit:disabled,.showPassword:disabled{cursor:not-allowed;opacity:.7}.message{min-height:36px;margin-top:12px;color:#ffb7bd;font-size:12px;line-height:1.45}.portalLinks{display:flex;justify-content:space-between;gap:12px;margin-top:12px;padding-top:14px;border-top:1px solid #1d3042;font-size:11px;color:#71869a}.portalLinks :global(a){color:#d5e3ef;text-decoration:none}.portalLinks :global(a:hover){text-decoration:underline}@media(max-width:760px){.loginShell{display:block}.brandPanel{min-height:42svh}.formPanel{padding:18px;min-height:58svh;align-items:start}form{margin-top:-28px;position:relative;z-index:3;padding:23px}.brandPanel img{left:22px;top:18px;width:104px}.copy{left:22px;bottom:24px}.copy h1{font-size:38px}}
    `}</style>
  </main>;
}
