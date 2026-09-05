"use client";

import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";

export default function ResetPassword(){
  const [token,setToken]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("Open the reset link from your WDCC recovery email, then choose a new password.");

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const value=query.get("token")||"";
    const error=query.get("error")||"";
    setToken(value);
    if(error||!value)setMessage("This reset link is invalid or expired. Request a new link.");
    if(value||error)window.history.replaceState({},"","/reset-password");
  },[]);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(busy)return;
    if(token.length<20){setMessage("This reset link is invalid or expired. Request a new link.");return;}
    if(password!==confirm){setMessage("New password entries do not match.");return;}
    if(password.length<12){setMessage("Use at least 12 characters for the new password.");return;}
    if(password.length>128){setMessage("Use no more than 128 characters for the new password.");return;}
    setBusy(true);setMessage("Saving your new password…");
    try{
      const response=await fetch("/api/auth/password-reset/confirm",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({token,password}),signal:AbortSignal.timeout(15_000)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body?.ok){
        if(body?.error==="reset_link_invalid_or_expired")throw Error("This reset link is invalid or expired. Request a new one.");
        if(body?.error==="password_must_be_at_least_12_characters")throw Error("Use at least 12 characters for the new password.");
        if(body?.error==="password_is_too_long")throw Error("Use no more than 128 characters for the new password.");
        throw Error("Password could not be reset. Request a new link and try again.");
      }
      setMessage("Password updated. Returning to secure sign in…");
      window.setTimeout(()=>location.replace("/login"),500);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Password could not be reset.");
    }finally{setBusy(false);}
  }

  return <main className="recoveryShell"><form onSubmit={submit} aria-busy={busy}>
    <img src="/wdcc-official-logo.webp" alt="We Don't Care Cars"/>
    <span>WDCC SECURE ACCESS</span><h1>Choose a new password</h1>
    <p>Use 12–128 characters. After the reset, sign in again with your new password.</p>
    <label>NEW PASSWORD<input value={password} onChange={event=>setPassword(event.target.value)} type="password" autoComplete="new-password" disabled={busy} minLength={12} maxLength={128} required/></label>
    <label>CONFIRM NEW PASSWORD<input value={confirm} onChange={event=>setConfirm(event.target.value)} type="password" autoComplete="new-password" disabled={busy} minLength={12} maxLength={128} required/></label>
    <button disabled={busy}>{busy?"SAVING…":"RESET PASSWORD"}</button>
    <div role="status" aria-live="polite">{message}</div>
    <Link href="/forgot-password">Request another link</Link>
  </form><style jsx>{css}</style></main>;
}

const css=`
.recoveryShell{min-height:100svh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 65% 0,#17334e,#06111b 42%,#02060b 88%);color:#fff;font-family:Inter,system-ui,sans-serif}.recoveryShell form{width:min(460px,100%);padding:30px;border:1px solid #29445c;border-radius:14px;background:#0b1723;box-shadow:0 30px 90px #0009}.recoveryShell img{width:112px;height:72px;object-fit:contain;margin-bottom:14px}.recoveryShell span{display:block;color:#ef233c;font-size:10px;font-weight:950;letter-spacing:.14em}.recoveryShell h1{margin:6px 0;font-size:32px;letter-spacing:-.04em}.recoveryShell p{margin:0 0 20px;color:#a8bac9;font-size:13px;line-height:1.5}.recoveryShell label{display:grid;gap:7px;margin-top:13px;color:#d6e0e9;font-size:10px;font-weight:950;letter-spacing:.08em}.recoveryShell input{height:50px;border:1px solid #38546b;border-radius:7px;background:#fff;color:#111;padding:0 12px;font-size:16px}.recoveryShell button{width:100%;height:49px;margin-top:18px;border:0;border-radius:7px;background:#ed1c2e;color:#fff;font-weight:950}.recoveryShell button:disabled{opacity:.7}.recoveryShell [role=status]{min-height:38px;margin-top:13px;color:#d1dce6;font-size:12px;line-height:1.45}.recoveryShell a{color:#d5e6f5;font-size:12px;text-decoration:none}.recoveryShell a:hover{text-decoration:underline}
`;
