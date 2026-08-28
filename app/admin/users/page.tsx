"use client";
import {useEffect,useMemo,useState} from "react";

export default function AdminUsers(){
  const [users,setUsers]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  async function load(){
    const r=await fetch("/api/admin/users",{cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok)throw Error(r.status===503?"503 · Secure admin directory is temporarily unavailable.":j.error||`Admin directory ${r.status}`);
    setUsers(j.users||[]);
  }
  useEffect(()=>{load().catch(error=>setMessage(error instanceof Error?error.message:"Admin directory unavailable"))},[]);

  const metrics=useMemo(()=>({
    total:users.length,
    active:users.filter(u=>!u.disabled).length,
    admins:users.filter(u=>String(u.role||"").includes("admin")).length,
    dealers:users.filter(u=>String(u.role||"").includes("dealer")).length
  }),[users]);

  return <main className="adminUsersPage">
    <div className="adminShell">
      <header className="adminHero">
        <div className="adminBrand"><img src="/wdcc-official-logo.webp" alt="WDCC"/><div><span>WDCC ADMIN CONTROL</span><strong>User Management</strong></div></div>
        <div className="adminHeroCopy"><small>ACCESS CONTROL</small><h1>Review authorized users.</h1><p>Verify provisioned dealer and admin accounts, assigned roles, and active access from one controlled workspace.</p></div>
      </header>

      <section className="metricGrid" aria-label="User access overview">
        <article><span>Total users</span><b>{metrics.total}</b></article>
        <article><span>Active</span><b>{metrics.active}</b></article>
        <article><span>Admins</span><b>{metrics.admins}</b></article>
        <article><span>Dealer users</span><b>{metrics.dealers}</b></article>
      </section>

      <section className="adminPanel createPanel">
        <div className="panelHeading"><div><small>ACCOUNT PROVISIONING</small><h2>Managed through Neon Auth</h2><p>This screen is a read-only view of the canonical account directory.</p></div><span className="secureChip">● NEON AUTHORITY</span></div>
        <div className="adminMessage" role="status" aria-live="polite">{message||"Create, disable, and role-change operations are intentionally unavailable here. Provisioning is performed through the audited Neon Auth admin workflow."}</div>
      </section>

      <section className="adminPanel usersPanel">
        <div className="panelHeading compact"><div><small>AUTHORIZED USERS</small><h2>Account directory</h2></div><b>{users.length} total</b></div>
        <div className="desktopTableWrap"><table><thead><tr>{["ID","USER","EMAIL","ROLE","STATUS","AUTHORITY"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.id}</td><td><strong>{u.displayName||u.username||"WDCC User"}</strong><small>{u.username}</small></td><td>{u.email}</td><td><span className="rolePill">{String(u.role||"user").replaceAll("_"," ")}</span></td><td><span className={`statusPill ${u.disabled?"off":"on"}`}>{u.disabled?"Disabled":"Active"}</span></td><td><span className="protected">Neon Auth managed</span></td></tr>)}</tbody></table></div>
        <div className="mobileUserList">{users.map(u=><article key={u.id}><div><strong>{u.displayName||u.username||"WDCC User"}</strong><span>{u.email||u.username}</span></div><div className="mobileMeta"><span className="rolePill">{String(u.role||"user").replaceAll("_"," ")}</span><span className={`statusPill ${u.disabled?"off":"on"}`}>{u.disabled?"Disabled":"Active"}</span></div><span className="protected">Managed through Neon Auth admin provisioning</span></article>)}</div>
      </section>
    </div>
    <style jsx>{`
      .adminUsersPage{min-height:100vh;background:radial-gradient(circle at 75% -10%,#15324b 0,#071522 34%,#03090f 72%);color:#fff;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:28px}.adminShell{width:min(1260px,100%);margin:auto}.adminHero{min-height:220px;border:1px solid #1d3448;border-radius:18px;padding:24px 28px;background:linear-gradient(110deg,#071522f2 0,#071522e8 48%,#07152299),url('/wdcc-hero-v2.webp') 88% 48%/620px auto no-repeat;box-shadow:0 24px 65px #0007;display:flex;flex-direction:column;justify-content:space-between}.adminBrand{display:flex;align-items:center;gap:13px}.adminBrand img{width:66px;height:66px;object-fit:contain;border-radius:50%}.adminBrand span{display:block;color:#f1283c;font-size:10px;font-weight:950;letter-spacing:.14em}.adminBrand strong{display:block;font-size:15px;margin-top:3px}.adminHeroCopy{max-width:650px}.adminHeroCopy small,.panelHeading small{color:#ef3344;font-size:10px;font-weight:950;letter-spacing:.14em}.adminHeroCopy h1{font-size:clamp(38px,5vw,64px);line-height:.94;letter-spacing:-.055em;margin:6px 0 10px}.adminHeroCopy p{margin:0;max-width:560px;color:#c2d0da;font-size:14px;line-height:1.5}.metricGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.metricGrid article{min-height:98px;background:#0b1926;border:1px solid #21384b;border-radius:12px;padding:18px;box-shadow:0 9px 26px #0002}.metricGrid span{display:block;color:#91a4b3;font-size:11px;font-weight:800}.metricGrid b{display:block;font-size:32px;margin-top:9px}.adminPanel{background:#0a1723;border:1px solid #20384c;border-radius:16px;padding:22px;box-shadow:0 16px 42px #0003}.usersPanel{margin-top:14px}.panelHeading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.panelHeading.compact{align-items:end}.panelHeading h2{font-size:26px;margin:4px 0 5px;letter-spacing:-.035em}.panelHeading p{margin:0;color:#9aabb8;font-size:12px}.panelHeading>b{color:#aab9c5;font-size:12px}.secureChip{border:1px solid #245b42;background:#123829;color:#5bdc8b;border-radius:999px;padding:7px 10px;font-size:9px;font-weight:900;white-space:nowrap}.userForm{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.userForm label{display:grid;gap:7px}.userForm label>span{display:flex;justify-content:space-between;gap:8px;color:#c7d3dc;font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.userForm em{color:#71889a;font-size:8px;font-style:normal}.userForm input,.userForm select{width:100%;height:50px;min-height:50px;border:1px solid #344b5e;border-radius:8px;background:#f8fafb;color:#111820;padding:0 13px;font:600 16px/1.2 Inter,system-ui,sans-serif;outline:none}.userForm input:focus,.userForm select:focus{border-color:#358ae8;box-shadow:0 0 0 3px #2686ef28}.createButton{height:50px;min-height:50px;align-self:end;border:0;border-radius:8px;background:#ef2438;color:#fff;font-size:12px;font-weight:950;letter-spacing:.04em;cursor:pointer}.createButton:disabled{opacity:.65;cursor:wait}.adminMessage{min-height:42px;margin-top:14px;border:1px solid #1d3b52;border-radius:8px;background:#0d2232;padding:12px 14px;color:#a9c7dc;font-size:12px;line-height:1.45}.desktopTableWrap{overflow:auto;border:1px solid #1d3345;border-radius:11px}.desktopTableWrap table{width:100%;border-collapse:collapse;min-width:820px}.desktopTableWrap th{padding:11px 13px;background:#07131e;color:#8197a7;font-size:9px;letter-spacing:.1em;text-align:left}.desktopTableWrap td{padding:13px;border-top:1px solid #182f41;color:#dbe4ea;font-size:12px}.desktopTableWrap td strong,.desktopTableWrap td small{display:block}.desktopTableWrap td small{color:#778d9d;font-size:10px;margin-top:3px}.rolePill,.statusPill{display:inline-flex;align-items:center;min-height:27px;border-radius:999px;padding:0 9px;font-size:9px;font-weight:900;text-transform:capitalize}.rolePill{background:#112b40;color:#9dc8e7;border:1px solid #214662}.statusPill.on{background:#123829;color:#62dc90;border:1px solid #245b42}.statusPill.off{background:#3a2023;color:#ff919a;border:1px solid #603039}.rowAction{min-height:36px;border:1px solid #365065;border-radius:7px;background:#0d2030;color:#eef4f8;padding:0 11px;font-size:10px;font-weight:900;cursor:pointer}.protected{color:#708797;font-size:10px}.mobileUserList{display:none}
      @media(max-width:980px){.userForm{grid-template-columns:repeat(2,minmax(0,1fr))}.metricGrid{grid-template-columns:1fr 1fr}.adminHero{background-size:520px auto}}
      @media(max-width:640px){.adminUsersPage{padding:12px;background:#06111b}.adminHero{min-height:245px;padding:18px;border-radius:14px;background:linear-gradient(180deg,#06111be0,#06111bf8),url('/wdcc-hero-v2.webp') 66% 42%/cover no-repeat}.adminBrand img{width:58px;height:58px}.adminHeroCopy h1{font-size:37px}.adminHeroCopy p{font-size:13px}.metricGrid{gap:8px}.metricGrid article{min-height:84px;padding:14px}.metricGrid b{font-size:27px}.adminPanel{padding:16px;border-radius:13px}.panelHeading{display:block}.secureChip{display:inline-flex;margin-top:10px}.userForm{grid-template-columns:1fr;gap:11px}.userForm label>span{font-size:11px}.userForm input,.userForm select{height:50px;min-height:50px;font-size:16px}.createButton{height:52px;min-height:52px;font-size:13px}.adminMessage{font-size:12px}.desktopTableWrap{display:none}.mobileUserList{display:grid;gap:9px}.mobileUserList article{border:1px solid #1f394d;border-radius:10px;background:#091a27;padding:13px;display:grid;gap:11px}.mobileUserList article>div:first-child strong,.mobileUserList article>div:first-child span{display:block}.mobileUserList article>div:first-child strong{font-size:14px}.mobileUserList article>div:first-child span{color:#8195a4;font-size:11px;margin-top:3px;overflow-wrap:anywhere}.mobileMeta{display:flex;gap:7px;flex-wrap:wrap}.mobileUserList .rowAction{width:100%;min-height:46px;font-size:12px}.protected{display:block;padding:8px 0}.panelHeading h2{font-size:24px}}
    `}</style>
  </main>;
}
