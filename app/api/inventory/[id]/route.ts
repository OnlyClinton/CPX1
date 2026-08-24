import {proxyDealer} from"../../../../lib/dealerProxy";
export const dynamic="force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params;return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;
  const requestCopy=request.clone();
  const body=await requestCopy.json().catch(()=>({}));
  const response=await proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
  if(!response.ok||String(body?.status||"").toLowerCase()!=="published")return response;

  const upstreamText=await response.text();
  let upstreamJson:any={};try{upstreamJson=JSON.parse(upstreamText);}catch{}
  let visible=false;
  let verification="pending";
  for(let attempt=0;attempt<4;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
    try{
      const publicResponse=await fetch(`https://wedontcarecars.com/api/inventory?verify=${Date.now()}-${attempt}`,{cache:"no-store",signal:AbortSignal.timeout(7000)});
      const publicJson=await publicResponse.json().catch(()=>({}));
      const items=Array.isArray(publicJson?.items)?publicJson.items:Array.isArray(publicJson?.inventory)?publicJson.inventory:[];
      visible=publicResponse.ok&&items.some((item:any)=>String(item?.id)===String(id));
      if(visible){verification="verified";break;}
      verification=publicResponse.ok?"not_yet_visible":"storefront_unavailable";
    }catch{verification="storefront_unreachable";}
  }
  return Response.json({...upstreamJson,storefront:{visible,verification,vehicleId:id}},{status:response.status,headers:{"Cache-Control":"no-store","X-WDCC-Storefront-Verified":visible?"1":"0"}});
}
