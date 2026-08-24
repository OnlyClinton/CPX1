"use client";
import {FormEvent,useEffect,useState} from "react";
export default function AdminUsers(){
  const [users,setUsers]=useState<any[]>([]);
  const [message,setMessage]=useState("");
  const [form,setForm]=useState({
    email:"",secondaryEmail:"",username:"",password:"",
    displayName:"",business:"",phone:"",role:"dealer_agent"
  });
  async function load(){
    const r=await fetch("/api/admin/users",{cache:"no-store"});
    const j=await r.json();
    if(j.ok)setUsers(j.users||[]);
  }
  useEffect(()=>{load()},[]);
  async function submit(e:FormEvent){
    e.preventDefault();
    const r=await fetch("/api/admin/users",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify(form)
    });
    const j=await r.json();
    setMessage(j.ok?`Created ${j.user.id}`:(j.error||"failed"));
    if(j.ok){
      setForm({...form,email:"",secondaryEmail:"",username:"",
        password:"",displayName:"",business:"",phone:""});
      load();
    }
  }
  async function act(id:string,action:string){
    await fetch("/api/admin/users",{
      method:"PATCH",headers:{"content-type":"application/json"},
      body:JSON.stringify({id,action})
    });
    load();
  }
  return <main style={{minHeight:"100vh",background:"#07090c",color:"#fff",
    padding:24,fontFamily:"Arial"}}>
    <div style={{maxWidth:1100,margin:"auto"}}>
      <h1>WDCC USER MANAGEMENT</h1>
      <form onSubmit={submit} style={{display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
        gap:10,background:"#11161d",padding:18,borderRadius:14}}>
        {["email","secondaryEmail","username","password","displayName","business","phone"].map(k=>
          <input key={k} type={k==="password"?"password":"text"}
            required={["email","username","password"].includes(k)}
            placeholder={k} value={(form as any)[k]}
            onChange={e=>setForm({...form,[k]:e.target.value})}
            style={{padding:12,borderRadius:8}}/>
        )}
        <select value={form.role}
          onChange={e=>setForm({...form,role:e.target.value})}
          style={{padding:12,borderRadius:8}}>
          <option value="dealer_agent">Dealer Agent</option>
          <option value="tenant_admin">Dealer Admin</option>
          <option value="platform_admin">Platform Admin</option>
        </select>
        <button style={{padding:12,fontWeight:900}}>CREATE USER</button>
      </form>
      <p>{message}</p>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["ID","USERNAME","EMAIL","ROLE","STATUS","ACTION"].map(x=>
            <th key={x} style={{textAlign:"left",padding:10}}>{x}</th>)}</tr></thead>
          <tbody>{users.map(u=><tr key={u.id}>
            <td style={{padding:10}}>{u.id}</td><td>{u.username}</td>
            <td>{u.email}</td><td>{u.role}</td>
            <td>{u.disabled?"DISABLED":"ACTIVE"}</td>
            <td>{u.id!=="000"&&<button onClick={()=>act(u.id,u.disabled?"enable":"disable")}>
              {u.disabled?"ENABLE":"DISABLE"}</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </main>;
}

