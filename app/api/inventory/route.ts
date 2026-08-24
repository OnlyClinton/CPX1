import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {publicVehicles,readState,writeState} from "../../../lib/store";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

export async function GET(){
  try{
    const [state,user]=await Promise.all([readState(),currentUser()]);
    let items;
    if(user&&editorRoles.has(String(user.role||"").toLowerCase())){
      items=String(user.role).toLowerCase()==="platform_admin"?
        state.vehicles:
        state.vehicles.filter(vehicle=>String(vehicle.tenantId||"wdcc")===String(user.tenantId||"wdcc"));
    }else{
      items=publicVehicles(state);
    }
    return NextResponse.json({ok:true,count:items.length,items},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    return NextResponse.json({
      ok:false,items:[],error:error instanceof Error?error.message:"read_failed"
    },{status:500,headers:{"Cache-Control":"no-store"}});
  }
}

export async function POST(req:Request){
  const user=await currentUser();
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
    const visibility=body?.internalOnly===true||String(body?.visibility||"").toLowerCase()==="internal"?"internal":"public";
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
      visibility,internalOnly:visibility==="internal",status:"draft",photoPathnames:[],primaryPhotoPathname:null,createdAt:now,updatedAt:now
    };
    state.vehicles.push(item);
    state.audit.push({id:crypto.randomUUID(),at:now,action:"vehicle.create_draft",actor:user.id,vehicleId:item.id,visibility});
    await writeState(state);
    return NextResponse.json({ok:true,item},{status:201});
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:"create_failed"
    },{status:500});
  }
}
