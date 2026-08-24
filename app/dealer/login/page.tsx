"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function DealerLogin(){
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
      document.cookie="wdcc_login_context=dealer; Path=/; SameSite=Lax; Secure";
      sessionStorage.setItem("wdcc_login_context","dealer");
      router.replace("/dealer");
    }catch(x:any){setMsg(x?.message||"Sign-in failed"); setBusy(false)}
  }
  return <main style={{minHeight:"100svh",display:"grid",placeItems:"center",padding:18,background:"radial-gradient(circle at 70% 0,#13263a 0,#05080d 42%)",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"}}>
    <form onSubmit={submit} style={{width:"min(430px,100%)",background:"#0c1520",border:"1px solid #2a3b4e",borderRadius:16,padding:24}}>
      <div style={{fontSize:12,fontWeight:900,color:"#ef2029",letterSpacing:1}}>WDCC</div>
      <h1 style={{margin:"4px 0 4px",fontSize:28}}>Dealer Sign In</h1>
      <p style={{margin:"0 0 18px",color:"#9eacbc",fontSize:13}}>Inventory, photos and vehicle management.</p>
      <label style={lab}>Username</label>
      <input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required style={inp}/>
      <label style={lab}>Password</label>
      <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required style={inp}/>
      <button disabled={busy} style={btn}>{busy?"SIGNING IN…":"SIGN IN"}</button>
      <div style={{minHeight:20,marginTop:10,color:"#ffb6b9",fontSize:13}}>{msg}</div>
      <div style={{marginTop:12,padding:11,borderRadius:9,background:"#08111a",color:"#bdc9d3",fontSize:11,lineHeight:1.45}}>Usernames are case-insensitive. Passwords are case-sensitive. Changing a temporary password is recommended, not required. Admin credentials may be used here for a dealer-view session.</div>
    </form>
  </main>
}
const lab={display:"block",margin:"12px 0 6px",fontSize:10,fontWeight:900,textTransform:"uppercase" as const,color:"#c7d1dc"};
const inp={width:"100%",height:48,borderRadius:9,border:"1px solid #34465f",padding:"0 12px",fontSize:16,color:"#111",background:"#fff"};
const btn={width:"100%",height:48,marginTop:18,border:0,borderRadius:9,background:"#ef2029",color:"#fff",fontWeight:950,cursor:"pointer"};

