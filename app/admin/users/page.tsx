"use client";
import {useEffect,useState} from "react";
export default function AdminUsers(){
  const [users,setUsers]=useState<any[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function load(){
    try{
      const r=await fetch("/api/admin/users",{cache:"no-store"});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.ok)throw Error(j.message||j.error||"User access could not be loaded.");
      setUsers(j.users||[]);
    }catch(error){setMessage(error instanceof Error?error.message:"User access could not be loaded.")}
  }
  useEffect(()=>{void load()},[]);
  async function act(id:string,action:string){
    if(busy)return;
    setBusy(true);setMessage("Updating access…");
    try{
      const r=await fetch("/api/admin/users",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,action})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.ok)throw Error(j.message||j.error||"Update failed.");
      setMessage("Access updated.");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Update failed.")}
    finally{setBusy(false)}
  }
  return <main style={{minHeight:"100vh",background:"#07090c",color:"#fff",
    padding:24,fontFamily:"Arial"}}>
    <div style={{maxWidth:1100,margin:"auto"}}>
      <h1>WDCC USER MANAGEMENT</h1>
      <section style={{background:"#11161d",padding:18,borderRadius:14,
        border:"1px solid #253241",marginBottom:18}}>
        <strong style={{display:"block",marginBottom:6}}>IDENTITY MANAGEMENT</strong>
        <span style={{color:"#aeb9c5"}}>
          Sign-in identities and password resets are managed by Neon Auth. This page controls
          WDCC role access for identities that are already linked to the dealership.
        </span>
      </section>
      <p role="status">{message}</p>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["ID","USERNAME","EMAIL","ROLE","STATUS","ACTION"].map(x=>
            <th key={x} style={{textAlign:"left",padding:10}}>{x}</th>)}</tr></thead>
          <tbody>{users.map(u=><tr key={u.id}>
            <td style={{padding:10}}>{u.id}</td><td>{u.username}</td>
            <td>{u.email}</td><td>{u.role}</td>
            <td>{u.disabled?"DISABLED":"ACTIVE"}</td>
            <td>{u.id!=="000"&&<button disabled={busy} onClick={()=>act(u.id,u.disabled?"enable":"disable")}>
              {u.disabled?"ENABLE":"DISABLE"}</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </main>;
}
