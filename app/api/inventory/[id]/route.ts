import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {readState,writeState} from "../../../../lib/store";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function canEdit(user:any,vehicle:any){
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return false;
  return String(user.role).toLowerCase()==="platform_admin"||
    String(vehicle.tenantId||"wdcc")===String(user.tenantId||"wdcc");
}

function isPublic(vehicle:any){
  return String(vehicle?.status||"").toLowerCase()==="published"&&
    String(vehicle?.visibility||"public").toLowerCase()!=="internal"&&
    vehicle?.internalOnly!==true;
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{id}=await params;
    const [state,user]=await Promise.all([readState(),currentUser()]);
    const item=state.vehicles.find(vehicle=>vehicle.id===id);
    if(!item||(!isPublic(item)&&!canEdit(user,item))){
      return NextResponse.json({ok:false,error:"Not found"},{status:404});
    }
    return NextResponse.json({ok:true,item},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"read_failed"},{status:500});
  }
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
    return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  }
  try{
    const{id}=await params;
    const body=await req.json();
    const state=await readState();
    const index=state.vehicles.findIndex(vehicle=>vehicle.id===id);
    if(index<0)return NextResponse.json({ok:false,error:"Not found"},{status:404});
    const current=state.vehicles[index];
    if(!canEdit(user,current))return NextResponse.json({ok:false,error:"Forbidden"},{status:403});

    const next={...current};
    if(body.year!==undefined)next.year=Math.trunc(Number(body.year));
    if(body.make!==undefined)next.make=text(body.make,80);
    if(body.model!==undefined)next.model=text(body.model,80);
    if(body.trim!==undefined)next.trim=text(body.trim,80);
    if(body.price!==undefined)next.price=Number(body.price);
    if(body.downPayment!==undefined)next.downPayment=Number(body.downPayment);
    if(body.mileage!==undefined)next.mileage=Math.trunc(Number(body.mileage));
    if(body.stock!==undefined)next.stock=text(body.stock,80);
    if(body.description!==undefined)next.description=text(body.description,3000);
    if(body.visibility!==undefined||body.internalOnly!==undefined){
      const requested=body.internalOnly===true||String(body.visibility||"").toLowerCase()==="internal"?"internal":"public";
      next.visibility=requested;
      next.internalOnly=requested==="internal";
    }

    if(Array.isArray(body.photoPathnames)){
      const requested=body.photoPathnames
        .map((value:unknown)=>text(value,500))
        .filter((value:string)=>value.startsWith(`media/wdcc/${id}/`));
      next.photoPathnames=[...new Set([...(Array.isArray(current.photoPathnames)?current.photoPathnames:[]),...requested])].slice(0,50);
    }
    if(body.primaryPhotoPathname!==undefined){
      const primary=text(body.primaryPhotoPathname,500);
      if(primary&&!next.photoPathnames.includes(primary)){
        return NextResponse.json({ok:false,error:"primary_photo_must_be_uploaded"},{status:400});
      }
      next.primaryPhotoPathname=primary||null;
    }
    if(body.status!==undefined){
      const status=String(body.status).toLowerCase();
      if(!["draft","published","archived"].includes(status))return NextResponse.json({ok:false,error:"invalid_status"},{status:400});
      next.status=status;
    }

    const maxYear=new Date().getUTCFullYear()+1;
    if(!Number.isInteger(Number(next.year))||Number(next.year)<1901||Number(next.year)>maxYear)return NextResponse.json({ok:false,error:"valid_year_required"},{status:400});
    if(!String(next.make||"").trim()||!String(next.model||"").trim())return NextResponse.json({ok:false,error:"make_and_model_required"},{status:400});
    if(!Number.isFinite(Number(next.price))||Number(next.price)<=0||Number(next.price)>10_000_000)return NextResponse.json({ok:false,error:"valid_price_required"},{status:400});
    if(!Number.isFinite(Number(next.downPayment||0))||Number(next.downPayment||0)<0||Number(next.downPayment||0)>Number(next.price))return NextResponse.json({ok:false,error:"invalid_down_payment"},{status:400});
    if(!Number.isInteger(Number(next.mileage||0))||Number(next.mileage||0)<0||Number(next.mileage||0)>2_000_000)return NextResponse.json({ok:false,error:"invalid_mileage"},{status:400});
    if(next.status==="published"&&(!Array.isArray(next.photoPathnames)||next.photoPathnames.length===0)){
      return NextResponse.json({ok:false,error:"photo_required_before_publish"},{status:409});
    }

    next.updatedAt=new Date().toISOString();
    state.vehicles[index]=next;
    const visibilityChanged=String(next.visibility||"public")!==String(current.visibility||"public")||Boolean(next.internalOnly)!==Boolean(current.internalOnly);
    state.audit.push({
      id:crypto.randomUUID(),at:next.updatedAt,
      action:next.status!==current.status?`vehicle.status.${next.status}`:visibilityChanged?`vehicle.visibility.${next.visibility||"public"}`:"vehicle.update",
      actor:user.id,vehicleId:id,visibility:next.visibility||"public"
    });
    await writeState(state);
    return NextResponse.json({ok:true,item:next});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"update_failed"},{status:500});
  }
}
