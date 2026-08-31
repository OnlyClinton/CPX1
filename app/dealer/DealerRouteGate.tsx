"use client";

import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";

export default function DealerRouteGate({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const publicEntry=pathname==="/dealer"||pathname==="/dealer/login";
  const[verifiedPath,setVerifiedPath]=useState(publicEntry?pathname:"");
  const[error,setError]=useState("");

  useEffect(()=>{
    if(publicEntry){setVerifiedPath(pathname);setError("");return}
    let active=true;
    const controller=new AbortController();
    setVerifiedPath("");setError("");
    fetch("/api/auth/session",{cache:"no-store",credentials:"include",signal:controller.signal}).then(response=>response.json().catch(()=>({})).then(json=>({ok:response.ok,status:response.status,json}))).then(({ok,status,json})=>{
      if(!active)return;
      const role=String(json?.user?.role||json?.role||json?.session?.role||"").toLowerCase();
      if(ok&&json.authenticated===true&&["dealer_agent","tenant_admin","platform_admin"].includes(role)){setVerifiedPath(pathname);return}
      if(status===401||status===403||(ok&&json.authenticated!==true)){window.location.replace("/dealer");return}
      setError("Dealer access could not be verified. Check the connection and try again.");
    }).catch(reason=>{if(active&&reason?.name!=="AbortError")setError("Dealer access could not be verified. Check the connection and try again.")});
    return()=>{active=false;controller.abort()};
  },[pathname,publicEntry]);

  if(!publicEntry&&verifiedPath!==pathname)return <main className="dealerRouteGate"><img src="/wdcc-official-logo.webp" alt="WDCC"/><strong>{error||"Checking secure dealer access…"}</strong>{error?<button type="button" onClick={()=>window.location.reload()}>TRY AGAIN</button>:null}</main>;
  return children;
}
