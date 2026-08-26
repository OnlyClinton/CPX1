import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {requestId} from "../../../lib/dealerRuntime";
import {createVehicle,listVehicles} from "../../../lib/wdccDb";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function response(body:any,status:number,rid:string,publicResponse=false){
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":publicResponse?"public, max-age=0, must-revalidate":"private, no-store",
    "X-WDCC-Request-ID":rid,"X-WDCC-Data-Authority":"neon"
  }});
}

export async function GET(request:Request){
  const rid=requestId(request);
  try{
    const user=await currentUser().catch(()=>null);
    const editor=Boolean(user&&editorRoles.has(String(user.role||"").toLowerCase()));
    const items=await listVehicles({includeNonPublic:editor});
    return response({ok:true,count:items.length,items,inventory:items,source:"neon-canonical"},200,rid,!editor);
  }catch(error){
    return response({ok:false,items:[],inventory:[],error:error instanceof Error?error.message:"read_failed",source:"neon-canonical"},500,rid);
  }
}

export async function POST(request:Request){
  const rid=requestId(request);
  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
    await recordVehicleAudit({action:"vehicle.create_draft",outcome:"denied",requestId:rid,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
    return response({ok:false,error:"Unauthorized"},401,rid);
  }
  try{
    const body=await request.json();
    const year=Math.trunc(Number(body?.year)),make=text(body?.make,80),model=text(body?.model,80),trim=text(body?.trim,80);
    const price=Number(body?.price),downPayment=Number(body?.downPayment??body?.down_payment??0),mileage=Math.trunc(Number(body?.mileage??0));
    const stock=text(body?.stock??body?.stock_id,80),vin=text(body?.vin,40),bodyStyle=text(body?.bodyStyle??body?.body_style,60);
    const condition=text(body?.condition,60),transmission=text(body?.transmission,60),exteriorColor=text(body?.exteriorColor??body?.exterior_color,60);
    const interiorColor=text(body?.interiorColor??body?.interior_color,60),drivetrain=text(body?.drivetrain,60),fuelType=text(body?.fuelType??body?.fuel_type,60);
    const description=text(body?.description,5000),internalOnly=body?.internalOnly===true||String(body?.visibility||"").toLowerCase()==="internal";
    const maxYear=new Date().getUTCFullYear()+1;
    const fail=async(error:string,status=400)=>{
      await recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:user.id,actorRole:user.role,year,make,model,mileage,stock,detail:error});
      return response({ok:false,error},status,rid);
    };
    if(!Number.isInteger(year)||year<1901||year>maxYear)return fail("valid_year_required");
    if(!make||!model)return fail("make_and_model_required");
    if(!Number.isFinite(price)||price<=0||price>10_000_000)return fail("valid_price_required");
    if(!Number.isFinite(downPayment)||downPayment<0||downPayment>price)return fail("invalid_down_payment");
    if(!Number.isInteger(mileage)||mileage<0||mileage>2_000_000)return fail("invalid_mileage");
    if(stock){
      const existing=await listVehicles({includeNonPublic:true});
      if(existing.some((vehicle:any)=>String(vehicle.stock||"").toLowerCase()===stock.toLowerCase()&&String(vehicle.status||"").toLowerCase()!=="archived"))return fail("stock_number_already_exists",409);
    }
    const item=await createVehicle({year,make,model,trim,price,downPayment,mileage,stock,vin,bodyStyle,condition,transmission,exteriorColor,interiorColor,drivetrain,fuelType,description,internalOnly,createdBy:user.id,uploadSource:"dealer-ui"});
    await recordVehicleAudit({action:"vehicle.create_draft",outcome:"ok",requestId:rid,vehicleId:item.id,actorId:user.id,actorRole:user.role,year,make,model,mileage,stock:item.stock,status:"draft",photoCount:0,detail:"neon-canonical"});
    return response({ok:true,item,requestId:rid,source:"neon-canonical"},201,rid);
  }catch(error){
    const message=error instanceof Error?error.message:"create_failed";
    const status=/duplicate key|unique constraint/i.test(message)?409:500;
    await recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:user.id,actorRole:user.role,detail:message});
    return response({ok:false,error:status===409?"stock_number_already_exists":message},status,rid);
  }
}
