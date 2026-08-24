"use client";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin(){
  const router=useRouter();
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setMsg("Signing in…");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({email:username.trim(),password})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok || !j?.ok) throw new Error(j?.error||"Sign-in failed");
      const role=String(j?.role||j?.user?.role||"").toLowerCase();
      if(!role.includes("admin")) throw new Error("Admin account required");
      document.cookie="wdcc_login_context=admin; Path=/; SameSite=Lax; Secure";
      sessionStorage.setItem("wdcc_login_context","admin");
      router.replace("/admin/dashboard");
    }catch(x:unknown){setMsg(x instanceof Error?x.message:"Sign-in failed"); setBusy(false)}
  }
  return <main style={{minHeight:"100svh",display:"grid",placeItems:"center",padding:18,background:"radial-gradient(circle at 70% 0,#26131a 0,#05080d 42%)",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"}}>
    <form onSubmit={submit} style={{width:"min(430px,100%)",background:"#0c1520",border:"1px solid #2a3b4e",borderRadius:16,padding:24}}>
      <div style={{fontSize:12,fontWeight:900,color:"#ef2029",letterSpacing:1}}>WDCC</div>
      <h1 style={{margin:"4px 0 4px",fontSize:28}}>Admin Sign In</h1>
      <p style={{margin:"0 0 18px",color:"#9eacbc",fontSize:13}}>Full administration and dealer oversight.</p>
      <label htmlFor="admin-username" style={lab}>Username</label>
      <input id="admin-username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required style={inp}/>
      <label htmlFor="admin-password" style={lab}>Password</label>
      <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required style={inp}/>
      <button type="submit" disabled={busy} style={btn}>{busy?"SIGNING IN…":"SIGN IN"}</button>
      <div style={{minHeight:20,marginTop:10,color:"#ffb6b9",fontSize:13}}>{msg}</div>
      <div style={{marginTop:12,padding:11,borderRadius:9,background:"#08111a",color:"#bdc9d3",fontSize:11,lineHeight:1.45}}>Admin credentials only. Usernames are case-insensitive and passwords are case-sensitive.</div>
    </form>
  </main>
}
const lab={display:"block",margin:"12px 0 6px",fontSize:10,fontWeight:900,textTransform:"uppercase" as const,color:"#c7d1dc"};
const inp={width:"100%",height:48,borderRadius:9,border:"1px solid #34465f",padding:"0 12px",fontSize:16,color:"#111",background:"#fff"};
const btn={width:"100%",height:48,marginTop:18,border:0,borderRadius:9,background:"#ef2029",color:"#fff",fontWeight:950,cursor:"pointer"};
