import {NextResponse} from "next/server";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {dataApi,dealerIdentity,mediaForUpdate,publicVehicleRow,rowToVehicle} from "../../../../lib/neonDealerData";

export const dynamic="force-dynamic";
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function json(body:any,status:number,rid:string,headers:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,"X-WDCC-Inventory-Authority":"neon",...headers}});
}
function qa(item:any){const stock=String(item?.stock||"").toUpperCase();return /^(QA|TEST|WDCC-QA|R36TEST)[-_]/.test(stock);}
async function verifyStorefront(id:string,expected:"visible"|"hidden"="visible"){
  let visible=false,verified=false,verification="pending";const attempts:any[]=[];
  for(let attempt=0;attempt<4;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
    const target=`https://wedontcarecars.com/api/inventory?verify=${Date.now()}-${attempt}`;
    try{
      const r=await fetch(target,{cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(7000)});
      const raw=await r.text();let payload:any=null;try{payload=JSON.parse(raw);}catch{}
      const items=Array.isArray(payload?.items)?payload.items:Array.isArray(payload?.inventory)?payload.inventory:[];
      const contract=Array.isArray(payload?.items)||Array.isArray(payload?.inventory);
      visible=r.ok&&contract&&items.some((item:any)=>String(item?.id)===String(id));
      attempts.push({attempt,status:r.status,contractValid:contract,itemCount:items.length,visible});
      if(r.ok&&contract&&((expected==="visible"&&visible)||(expected==="hidden"&&!visible))){verified=true;verification=expected==="visible"?"verified_visible":"verified_hidden";break;}
      verification=!r.ok?`storefront_http_${r.status}`:!contract?"storefront_invalid_payload":expected==="visible"?"not_yet_visible":"unexpectedly_visible";
    }catch(error){verification="storefront_unreachable";attempts.push({attempt,error:error instanceof Error?error.message:"fetch_failed"});}
  }
  return {visible,verified,expected,verification,vehicleId:id,attempts};
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;if(!isDealerRuntime(request))return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);const rid=requestId(request);
  try{
    const identity=await dealerIdentity(request).catch(()=>null);
    const upstream=await dataApi(request,`vehicles?id=eq.${encodeURIComponent(id)}&select=*`,{},Boolean(identity));
    const rows=await upstream.json().catch(()=>[]);if(!upstream.ok)return json({ok:false,error:rows?.message||"Not found"},upstream.status===401?401:404,rid);
    const row=Array.isArray(rows)?rows[0]:null;if(!row)return json({ok:false,error:"Not found"},404,rid);
    if(!identity&&!publicVehicleRow(row))return json({ok:false,error:"Not found"},404,rid);
    return json({ok:true,item:rowToVehicle(row),authority:"neon"},200,rid);
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:"read_failed"},500,rid);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const rid=requestId(request);
  if(!isDealerRuntime(request)){
    const body=await request.clone().json().catch(()=>({}));const response=await proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
    if(!response.ok||String(body?.status||"").toLowerCase()!=="published")return response;
    const payload=await response.json().catch(()=>({}));const item=payload?.item||{};const expected=qa(item)?"hidden":"visible";const storefront=await verifyStorefront(id,expected);
    return Response.json({...payload,storefront},{status:response.status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid,"X-WDCC-Storefront-Verified":storefront.verified?"1":"0"}});
  }

  const identity=await dealerIdentity(request).catch(()=>null);if(!identity||!identity.dealerId)return json({ok:false,error:"Unauthorized"},401,rid);
  try{
    const body=await request.json();
    const currentResponse=await dataApi(request,`vehicles?id=eq.${encodeURIComponent(id)}&select=*`,{},true);
    const currentRows=await currentResponse.json().catch(()=>[]);const current=Array.isArray(currentRows)?currentRows[0]:null;
    if(!currentResponse.ok||!current)return json({ok:false,error:"Not found"},404,rid);
    const next=rowToVehicle(current);
    if(body.year!==undefined)next.year=Math.trunc(Number(body.year));if(body.make!==undefined)next.make=text(body.make,80);if(body.model!==undefined)next.model=text(body.model,80);if(body.trim!==undefined)next.trim=text(body.trim,80);if(body.price!==undefined)next.price=Number(body.price);if(body.downPayment!==undefined)next.downPayment=Number(body.downPayment);if(body.mileage!==undefined)next.mileage=Math.trunc(Number(body.mileage));if(body.stock!==undefined)next.stock=text(body.stock,80);if(body.description!==undefined)next.description=text(body.description,3000);
    if(body.status!==undefined){const status=String(body.status).toLowerCase();if(!["draft","published","archived"].includes(status))return json({ok:false,error:"invalid_status"},400,rid);next.status=status;}
    const maxYear=new Date().getUTCFullYear()+1;if(!Number.isInteger(next.year)||next.year<1901||next.year>maxYear)return json({ok:false,error:"valid_year_required"},400,rid);if(!next.make||!next.model)return json({ok:false,error:"make_and_model_required"},400,rid);if(!Number.isFinite(next.price)||next.price<=0||next.price>10_000_000)return json({ok:false,error:"valid_price_required"},400,rid);if(!Number.isFinite(next.downPayment)||next.downPayment<0||next.downPayment>next.price)return json({ok:false,error:"invalid_down_payment"},400,rid);if(!Number.isInteger(next.mileage)||next.mileage<0||next.mileage>2_000_000)return json({ok:false,error:"invalid_mileage"},400,rid);

    const media=mediaForUpdate(current,{photoPathnames:body.photoPathnames,description:next.description,details:body.details});
    const photoUrls=media.photos.map((x:any)=>String(x?.url||"")).filter(Boolean);
    const requestedPrimary=body.primaryPhotoPathname!==undefined?text(body.primaryPhotoPathname,1000):String(current.primary_image_url||photoUrls[0]||"");
    if(next.status==="published"&&!requestedPrimary&&!photoUrls.length)return json({ok:false,error:"photo_required_before_publish"},409,rid);
    const dbPatch:any={year:next.year,make:next.make,model:next.model,trim:next.trim,mileage:next.mileage,price:next.price,down_payment:next.downPayment,stock_id:next.stock,media,updated_at:new Date().toISOString()};
    if(body.status!==undefined)dbPatch.status=next.status;if(requestedPrimary)dbPatch.primary_image_url=requestedPrimary;
    const upstream=await dataApi(request,`vehicles?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(dbPatch)},true);
    const rows=await upstream.json().catch(()=>[]);if(!upstream.ok)return json({ok:false,error:rows?.message||rows?.code||"vehicle_update_failed"},upstream.status,rid);
    const row=Array.isArray(rows)?rows[0]:rows;if(!row?.id)return json({ok:false,error:"vehicle_update_missing_row"},502,rid);
    const item=rowToVehicle(row);let storefront:any=undefined;if(body.status!==undefined&&next.status==="published")storefront=await verifyStorefront(id,qa(item)?"hidden":"visible");
    return json({ok:true,item,authority:"neon",requestId:rid,storefront},200,rid,storefront?{"X-WDCC-Storefront-Verified":storefront.verified?"1":"0"}:{});
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:"vehicle_update_failed"},500,rid);}
}
