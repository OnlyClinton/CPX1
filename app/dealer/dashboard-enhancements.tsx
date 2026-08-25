"use client";

import {useEffect} from "react";

const KPI_TARGETS=[
  {href:"/dealer/leads?tab=new",label:"View new leads from today"},
  {href:"/dealer/leads?tab=hot",label:"View hot buyers"},
  {href:"/dealer/leads?tab=appointments",label:"View appointments"},
  {href:"/dealer/inventory?status=published",label:"View live inventory"},
  {href:"/dealer/leads?tab=sold",label:"View sold opportunities"},
];

function vehicleIdFromHref(href:string){
  const match=href.match(/\/vehicle\/([^/?#]+)/);
  return match?decodeURIComponent(match[1]):"";
}

function photoPath(vehicle:any){
  return vehicle?.primaryPhotoPathname||vehicle?.primary_photo_pathname||vehicle?.primaryPhoto?.pathname||vehicle?.photos?.[0]?.pathname||vehicle?.photos?.[0]?.path||"";
}

function makeThumb(row:HTMLAnchorElement,vehicle:any){
  if(row.dataset.wdccThumb==="1")return;
  const identity=row.firstElementChild as HTMLElement|null;
  if(!identity)return;
  row.dataset.wdccThumb="1";

  const copy=document.createElement("div");
  copy.style.minWidth="0";
  while(identity.firstChild)copy.appendChild(identity.firstChild);

  const holder=document.createElement("span");
  holder.setAttribute("aria-hidden","true");
  Object.assign(holder.style,{
    width:"58px",height:"42px",flex:"0 0 58px",borderRadius:"6px",overflow:"hidden",
    background:"#07111a",border:"1px solid #294052",display:"grid",placeItems:"center",margin:"0"
  });

  const path=photoPath(vehicle);
  if(path){
    const img=document.createElement("img");
    img.src=`/api/media?p=${encodeURIComponent(path)}`;
    img.alt="";
    Object.assign(img.style,{width:"100%",height:"100%",objectFit:"cover",display:"block"});
    holder.appendChild(img);
  }else{
    const pending=document.createElement("small");
    pending.textContent="NO PHOTO";
    Object.assign(pending.style,{color:"#738596",fontSize:"6px",fontWeight:"900",lineHeight:"1.1",textAlign:"center"});
    holder.appendChild(pending);
  }

  Object.assign(identity.style,{display:"flex",alignItems:"center",gap:"10px",minWidth:"0"});
  const title=copy.querySelector("strong") as HTMLElement|null;
  if(title)Object.assign(title.style,{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"});
  identity.append(holder,copy);
}

export default function DealerDashboardEnhancements(){
  useEffect(()=>{
    if(location.pathname.replace(/\/+$/,"")!=="/dealer")return;
    let cancelled=false;
    let observer:MutationObserver|undefined;

    const enhanceKpis=()=>{
      const cards=Array.from(document.querySelectorAll<HTMLElement>(".crmKpis > article"));
      cards.slice(0,KPI_TARGETS.length).forEach((card,index)=>{
        if(card.querySelector(":scope > [data-wdcc-kpi-link]"))return;
        const target=KPI_TARGETS[index];
        const link=document.createElement("a");
        link.href=target.href;
        link.setAttribute("aria-label",target.label);
        link.dataset.wdccKpiLink="1";
        Object.assign(card.style,{position:"relative",cursor:"pointer",transition:"transform .16s,border-color .16s"});
        Object.assign(link.style,{position:"absolute",inset:"0",zIndex:"5",borderRadius:"inherit"});
        link.addEventListener("focus",()=>{card.style.borderColor="#4a708d"});
        link.addEventListener("blur",()=>{card.style.borderColor=""});
        card.appendChild(link);
      });
    };

    const enhanceInventory=async()=>{
      const pulse=document.querySelector<HTMLElement>(".inventoryPulseList");
      if(!pulse||pulse.dataset.wdccThumbFetch==="1")return;
      pulse.dataset.wdccThumbFetch="1";
      try{
        const response=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});
        const data=await response.json().catch(()=>({}));
        if(cancelled||!response.ok)return;
        const inventory=Array.isArray(data?.inventory)?data.inventory:[];
        const byId=new Map(inventory.map((vehicle:any)=>[String(vehicle.id),vehicle]));
        pulse.querySelectorAll<HTMLAnchorElement>(":scope > a").forEach(row=>{
          const id=vehicleIdFromHref(row.getAttribute("href")||"");
          makeThumb(row,byId.get(id));
        });
      }catch{
        // Keep the existing text-only row if media data is temporarily unavailable.
      }
    };

    const run=()=>{enhanceKpis();void enhanceInventory();};
    run();
    observer=new MutationObserver(run);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{cancelled=true;observer?.disconnect()};
  },[]);
  return null;
}
