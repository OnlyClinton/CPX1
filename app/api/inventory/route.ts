import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {publicVehicles,readState,writeState} from "../../../lib/store";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const PHOENIX_BASE=(process.env.WDCC_PHOENIX_BASE_URL||"https://wdcc-cpx-launch.vercel.app").replace(/\/$/,"");

async function phoenixPublicInventory(){
  const response=await fetch(`${PHOENIX_BASE}/api/inventory?storefront_fallback=${Date.now()}`,{
    cache:"no-store",
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw Error(`PHOENIX_INVENTORY_${response.status}`);
  const json=await response.json();
  const raw=Array.isArray(json)?json:(json?.items||json?.inventory||json?.vehicles||[]);
  const state:any={revision:0,tenants:[],users:[],vehicles:Array.isArray(raw)?raw:[],leads:[],audit:[]};
  return publicVehicles(state);
}

export async function GET(){
  const user=await currentUser().catch(()=>null);
  try{
    const state=await readState();
    let items;
    if(user&&editorRoles.has(String(user.role||"").toLowerCase())){
      items=String(user.role).toLowerCase()==="platform_admin"?
        state.vehicles:
        state.vehicles.filter(vehicle=>String(vehicle.tenantId||"wdcc")===String(user.tenantId||"wdcc"));
    }else{
      items=publicVehicles(state);
    }
    return NextResponse.json({ok:true,count:items.length,items,source:"local-ledger"},{headers:{"Cache-Control":"private, no-store"}});
  }catch(localError){
    try{
      const items=await phoenixPublicInventory();
      return NextResponse.json({ok:true,count:items.length,items,source:"phoenix-fallback"},{headers:{"Cache-Control":"private, no-store"}});
    }catch(fallbackError){
      return NextResponse.json({
        ok:false,items:[],error:"inventory_unavailable",
        localError:localError instanceof Error?localError.message:"local_read_failed",
        fallbackError:fallbackError instanceof Error?fallbackError.message:"phoenix_read_failed"
      },{status:503,headers:{"Cache-Control":"no-store"}});
    }
  }
}

export async function POST(req:Request){
  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
    return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  }
  try{
    const body=await req.json();
    const year=Math.trunc(Number(body?.year));
    const make=text(body?.make,80);
    const model=text(body?.model,80);
    const trim=text(body?.trim,80);
    const price=Number(body?.price);
    const downPayment=Number(body?.downPayment||0);
    const mileage=Math.trunc(Number(body?.mileage||0));
    const stock=text(body?.stock,80);
    const description=text(body?.description,3000);
    const maxYear=new Date().getUTCFullYear()+1;

    if(!Number.isInteger(year)||year<1901||year>maxYear)return NextResponse.json({ok:false,error:"valid_year_required"},{status:400});
    if(!make||!model)return NextResponse.json({ok:false,error:"make_and_model_required"},{status:400});
    if(!Number.isFinite(price)||price<=0||price>10_000_000)return NextResponse.json({ok:false,error:"valid_price_required"},{status:400});
    if(!Number.isFinite(downPayment)||downPayment<0||downPayment>price)return NextResponse.json({ok:false,error:"invalid_down_payment"},{status:400});
    if(!Number.isInteger(mileage)||mileage<0||mileage>2_000_000)return NextResponse.json({ok:false,error:"invalid_mileage"},{status:400});

    const now=new Date().toISOString();
    const tenantId=String(user.tenantId||"wdcc");
    const state=await readState();
    if(stock&&state.vehicles.some(vehicle=>
      String(vehicle.tenantId||"wdcc")===tenantId&&
      String(vehicle.stock||"").toLowerCase()===stock.toLowerCase()&&
      String(vehicle.status||"").toLowerCase()!=="archived"
    ))return NextResponse.json({ok:false,error:"stock_number_already_exists"},{status:409});

    const item={
      id:crypto.randomUUID(),tenantId,year,make,model,trim,price,downPayment,mileage,stock,description,
      status:"draft",photoPathnames:[],primaryPhotoPathname:null,createdAt:now,updatedAt:now
    };
    state.vehicles.push(item);
    state.audit.push({id:crypto.randomUUID(),at:now,action:"vehicle.create_draft",actor:user.id,vehicleId:item.id});
    await writeState(state);
    return NextResponse.json({ok:true,item},{status:201});
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:"create_failed"
    },{status:500});
  }
}
