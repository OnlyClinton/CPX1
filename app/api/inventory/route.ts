import {NextResponse} from "next/server";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {dataApi,dealerIdentity,publicVehicleRow,rowToVehicle} from "../../../lib/neonDealerData";

export const dynamic="force-dynamic";
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function response(body:any,status:number,rid:string,extra:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,"X-WDCC-Inventory-Authority":"neon",...extra}});
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/inventory");
  const rid=requestId(request);
  try{
    const identity=await dealerIdentity(request).catch(()=>null);
    if(identity){
      const upstream=await dataApi(request,"vehicles?select=*&order=updated_at.desc",{},true);
      const rows=await upstream.json().catch(()=>[]);
      if(!upstream.ok)return response({ok:false,items:[],error:rows?.message||rows?.code||"inventory_read_failed"},upstream.status,rid);
      const items=Array.isArray(rows)?rows.map(rowToVehicle):[];
      return response({ok:true,count:items.length,items,authority:"neon",dealerId:identity.dealerId},200,rid);
    }

    const upstream=await dataApi(request,"vehicles?select=*&status=in.(available,published)&order=updated_at.desc",{},false);
    const rows=await upstream.json().catch(()=>[]);
    if(!upstream.ok)return response({ok:false,items:[],error:rows?.message||rows?.code||"public_inventory_unavailable"},upstream.status,rid,{"Cache-Control":"public, max-age=0, must-revalidate"});
    const items=(Array.isArray(rows)?rows:[]).map(publicVehicleRow).filter(Boolean);
    return response({ok:true,count:items.length,items,authority:"neon"},200,rid,{"Cache-Control":"public, max-age=0, must-revalidate"});
  }catch(error){
    return response({ok:false,items:[],error:error instanceof Error?error.message:"inventory_read_failed"},500,rid);
  }
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/inventory");
  const rid=requestId(request);
  const identity=await dealerIdentity(request).catch(()=>null);
  if(!identity||!identity.dealerId)return response({ok:false,error:"Unauthorized"},401,rid);
  try{
    const body=await request.json();
    const year=Math.trunc(Number(body?.year));
    const make=text(body?.make,80);
    const model=text(body?.model,80);
    const trim=text(body?.trim,80);
    const price=Number(body?.price);
    const downPayment=Number(body?.downPayment||0);
    const mileage=Math.trunc(Number(body?.mileage||0));
    const stock=text(body?.stock,80)||`WDCC-${Date.now()}`;
    const description=text(body?.description,3000);
    const maxYear=new Date().getUTCFullYear()+1;
    if(!Number.isInteger(year)||year<1901||year>maxYear)return response({ok:false,error:"valid_year_required"},400,rid);
    if(!make||!model)return response({ok:false,error:"make_and_model_required"},400,rid);
    if(!Number.isFinite(price)||price<=0||price>10_000_000)return response({ok:false,error:"valid_price_required"},400,rid);
    if(!Number.isFinite(downPayment)||downPayment<0||downPayment>price)return response({ok:false,error:"invalid_down_payment"},400,rid);
    if(!Number.isInteger(mileage)||mileage<0||mileage>2_000_000)return response({ok:false,error:"invalid_mileage"},400,rid);

    const dbBody={
      dealer_id:identity.dealerId,
      stock_id:stock,
      year,make,model,trim,mileage,price,
      down_payment:downPayment,
      status:"draft",
      media:{photos:[],description,details:{}},
      primary_image_url:null,
    };
    const upstream=await dataApi(request,"vehicles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(dbBody)},true);
    const rows=await upstream.json().catch(()=>[]);
    if(!upstream.ok){
      const duplicate=String(rows?.code||"")==="23505";
      return response({ok:false,error:duplicate?"stock_number_already_exists":rows?.message||rows?.code||"vehicle_create_failed"},duplicate?409:upstream.status,rid);
    }
    const row=Array.isArray(rows)?rows[0]:rows;
    if(!row?.id)return response({ok:false,error:"vehicle_create_missing_row"},502,rid);
    const item=rowToVehicle(row);
    return response({ok:true,item,authority:"neon",requestId:rid},201,rid);
  }catch(error){
    return response({ok:false,error:error instanceof Error?error.message:"vehicle_create_failed"},500,rid);
  }
}
