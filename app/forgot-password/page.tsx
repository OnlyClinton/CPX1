"use client";

import Link from "next/link";
import {FormEvent,useState} from "react";

export default function ForgotPassword(){
  const [login,setLogin]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("Enter your WDCC username or account email. We will send recovery instructions only when the account is eligible.");

  async function submit(event:FormEvent){
    event.preventDefault();
    if(busy||!login.trim())return;
    setBusy(true);setMessage("Checking recovery options…");
    try{
      const response=await fetch("/api/auth/password-reset/request",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({login:login.trim()}),signal:AbortSignal.timeout(15_000)});
      const body=await response.json().catch(()=>({}));
      setMessage(body?.message||"If that WDCC account is eligible for recovery, a reset link will arrive shortly. Check spam or contact a platform administrator if it does not.");
    }catch{
      setMessage("We could not start recovery right now. Try again in a moment or contact a platform administrator.");
    }finally{setBusy(false);}
  }

  return <main className="recoveryShell"><form onSubmit={submit} aria-busy={busy}>
    <img src="/wdcc-official-logo.webp" alt="We Don't Care Cars"/>
    <span>WDCC SECURE ACCESS</span><h1>Reset your password</h1>
    <p>For your protection, the same confirmation is shown whether or not an account matches.</p>
    <label>USERNAME OR EMAIL<input value={login} onChange={event=>setLogin(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy} required/></label>
    <button disabled={busy}>{busy?"SENDING…":"SEND RESET LINK"}</button>
    <div role="status" aria-live="polite">{message}</div>
    <Link href="/login">← Back to sign in</Link>
  </form><style jsx>{css}</style></main>;
}

const css=`
.recoveryShell{min-height:100svh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 65% 0,#17334e,#06111b 42%,#02060b 88%);color:#fff;font-family:Inter,system-ui,sans-serif}.recoveryShell form{width:min(460px,100%);padding:30px;border:1px solid #29445c;border-radius:14px;background:#0b1723;box-shadow:0 30px 90px #0009}.recoveryShell img{width:112px;height:72px;object-fit:contain;margin-bottom:14px}.recoveryShell span{display:block;color:#ef233c;font-size:10px;font-weight:950;letter-spacing:.14em}.recoveryShell h1{margin:6px 0;font-size:32px;letter-spacing:-.04em}.recoveryShell p{margin:0 0 20px;color:#a8bac9;font-size:13px;line-height:1.5}.recoveryShell label{display:grid;gap:7px;color:#d6e0e9;font-size:10px;font-weight:950;letter-spacing:.08em}.recoveryShell input{height:50px;border:1px solid #38546b;border-radius:7px;background:#fff;color:#111;padding:0 12px;font-size:16px}.recoveryShell button{width:100%;height:49px;margin-top:18px;border:0;border-radius:7px;background:#ed1c2e;color:#fff;font-weight:950}.recoveryShell button:disabled{opacity:.7}.recoveryShell [role=status]{min-height:55px;margin-top:13px;color:#d1dce6;font-size:12px;line-height:1.45}.recoveryShell a{color:#d5e6f5;font-size:12px;text-decoration:none}.recoveryShell a:hover{text-decoration:underline}
`;
