"use client";

import {FormEvent,useEffect,useState} from "react";

const destination=(role:unknown)=>["platform_admin","tenant_admin","admin"].includes(String(role||"").toLowerCase())?"/admin":"/dealer";

export default function ChangePassword(){
  const [currentPassword,setCurrentPassword]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("Confirm your temporary password, then choose a permanent password.");

  useEffect(()=>{
    fetch("/api/auth/session",{credentials:"include",cache:"no-store",signal:AbortSignal.timeout(7000)})
      .then(response=>response.json()).then(body=>{if(!body?.authenticated)location.replace("/login");})
      .catch(()=>location.replace("/login"));
  },[]);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(busy)return;
    if(password!==confirm){setMessage("New password entries do not match.");return;}
    if(password.length<12){setMessage("Use at least 12 characters for the new password.");return;}
    if(password.length>128){setMessage("Use no more than 128 characters for the new password.");return;}
    setBusy(true);setMessage("Saving your permanent password…");
    try{
      const response=await fetch("/api/auth/change-password",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({currentPassword,newPassword:password}),signal:AbortSignal.timeout(15_000)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body?.ok){
        if(body?.error==="current_password_incorrect")throw Error("Temporary password is incorrect.");
        if(body?.error==="password_must_be_at_least_12_characters")throw Error("Use at least 12 characters for the new password.");
        if(body?.error==="password_is_too_long")throw Error("Use no more than 128 characters for the new password.");
        throw Error("Password could not be changed.");
      }
      setMessage(body?.stateSynchronized===false?"Password updated. Secure account metadata will resync on the next healthy state check.":"Password updated. Opening your portal…");
      window.setTimeout(()=>location.replace(destination(body.role||body.user?.role)),650);
    }catch(error){setMessage(error instanceof Error?error.message:"Password could not be changed.");}
    finally{setBusy(false);}
  }

  return <main className="changeShell"><form onSubmit={submit} aria-busy={busy}>
    <img src="/wdcc-official-logo.webp" alt="We Don't Care Cars"/>
    <span>WDCC SECURE ACCESS</span><h1>Set your permanent password</h1><p>A temporary password can only be used once.</p>
    <label>TEMPORARY PASSWORD<input value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" disabled={busy} required/></label>
    <label>NEW PASSWORD<input value={password} onChange={event=>setPassword(event.target.value)} type="password" autoComplete="new-password" disabled={busy} minLength={12} maxLength={128} required/></label>
    <label>CONFIRM NEW PASSWORD<input value={confirm} onChange={event=>setConfirm(event.target.value)} type="password" autoComplete="new-password" disabled={busy} minLength={12} maxLength={128} required/></label>
    <button disabled={busy}>{busy?"SAVING…":"SAVE PASSWORD"}</button><div role="status" aria-live="polite">{message}</div>
  </form><style jsx>{css}</style></main>;
}

const css=`
.changeShell{min-height:100svh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 65% 0,#17334e,#06111b 42%,#02060b 88%);color:#fff;font-family:Inter,system-ui,sans-serif}.changeShell form{width:min(460px,100%);padding:30px;border:1px solid #29445c;border-radius:14px;background:#0b1723;box-shadow:0 30px 90px #0009}.changeShell img{width:112px;height:72px;object-fit:contain;margin-bottom:14px}.changeShell span{display:block;color:#ef233c;font-size:10px;font-weight:950;letter-spacing:.14em}.changeShell h1{margin:6px 0;font-size:32px;letter-spacing:-.04em}.changeShell p{margin:0 0 20px;color:#a8bac9;font-size:13px;line-height:1.5}.changeShell label{display:grid;gap:7px;margin-top:13px;color:#d6e0e9;font-size:10px;font-weight:950;letter-spacing:.08em}.changeShell input{height:50px;border:1px solid #38546b;border-radius:7px;background:#fff;color:#111;padding:0 12px;font-size:16px}.changeShell button{width:100%;height:49px;margin-top:18px;border:0;border-radius:7px;background:#ed1c2e;color:#fff;font-weight:950}.changeShell button:disabled{opacity:.7}.changeShell [role=status]{min-height:38px;margin-top:13px;color:#d1dce6;font-size:12px;line-height:1.45}
`;
