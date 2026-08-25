"use client";

import {FormEvent,useState} from "react";

export default function UnifiedLogin(){
  const[username,setUsername]=useState("");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault();
    setBusy(true);setMessage("Signing in…");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({email:username.trim(),password})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j?.ok)throw Error(j?.error||"Sign-in failed");
      let role=String(j?.role||j?.user?.role||"").toLowerCase();
      if(!role){
        const s=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"});
        const sj=await s.json().catch(()=>({}));
        role=String(sj?.user?.role||"").toLowerCase();
      }
      if(role.includes("admin")){location.assign("/admin");return;}
      if(role.includes("dealer")){location.assign("/dealer");return;}
      await fetch("/api/auth/logout",{method:"POST",credentials:"include"}).catch(()=>{});
      throw Error("Account has no WDCC portal role");
    }catch(error){setMessage(error instanceof Error?error.message:"Sign-in failed");}
    finally{setBusy(false)}
  }

  return <main className="loginShell">
    <section className="brandPanel"><div className="shade"/><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/><div className="copy"><span>WDCC SECURE ACCESS</span><h1>PORTAL LOGIN</h1><p>Your account determines whether you enter Dealer Operations or Admin Control.</p></div></section>
    <section className="formPanel"><form onSubmit={submit}><span>AUTHORIZED ACCESS</span><h2>Sign In</h2><label>LOGIN<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required/></label><label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label><button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button><div className="message">{message}</div></form></section>
    <style jsx>{`
      .loginShell{min-height:100svh;background:#02060b;color:#fff;display:grid;grid-template-columns:minmax(320px,44%) 1fr;font-family:Inter,system-ui,sans-serif}.brandPanel{min-height:100svh;position:relative;background:url('/wdcc-hero-v2.webp') center/cover no-repeat;overflow:hidden}.shade{position:absolute;inset:0;background:linear-gradient(180deg,#02060b12,#02060b66 55%,#02060bf5)}.brandPanel img{position:absolute;z-index:2;top:24px;left:28px;width:132px}.copy{position:absolute;z-index:2;left:32px;right:32px;bottom:36px}.copy span,.formPanel form>span{color:#ef233c;font-size:10px;letter-spacing:.16em;font-weight:900}.copy h1{margin:5px 0 8px;font-size:clamp(38px,5vw,68px);line-height:.9;letter-spacing:-.06em}.copy p{color:#c7d2dc;max-width:440px;font-size:13px}.formPanel{display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 55% 5%,#122337,#06101a 38%,#02060b 76%)}form{width:min(430px,100%);background:#0c1723;border:1px solid #22364a;border-radius:14px;padding:28px;box-shadow:0 28px 70px #0009}h2{font-size:31px;margin:4px 0 22px}label{display:grid;gap:7px;margin-top:14px;font-size:10px;font-weight:900;letter-spacing:.08em;color:#c6d1dc}input{height:50px;border:1px solid #34485e;border-radius:7px;background:#fff;color:#111;padding:0 13px;font:inherit;font-size:16px}button{width:100%;height:49px;margin-top:20px;border:0;border-radius:7px;background:#ed1c2e;color:#fff;font-weight:950;cursor:pointer}.message{min-height:20px;margin-top:12px;color:#ffb7bd;font-size:12px}@media(max-width:760px){.loginShell{display:block}.brandPanel{min-height:42svh}.formPanel{padding:18px;min-height:58svh;align-items:start}form{margin-top:-28px;position:relative;z-index:3}.brandPanel img{left:22px;top:18px;width:104px}.copy{left:22px;bottom:24px}.copy h1{font-size:38px}}
    `}</style>
  </main>;
}
