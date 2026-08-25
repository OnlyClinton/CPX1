const AUTH_BASE="https://ep-curly-breeze-ay2iih1f.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
const DATA_BASE="https://ep-curly-breeze-ay2iih1f.apirest.c-5.us-east-2.aws.neon.tech/neondb/rest/v1";

export type DealerIdentity={id:string;email:string;role:string;dealerId:string|null};

function asObject(value:any){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
function asMedia(value:any){
  if(Array.isArray(value))return {photos:value,description:"",details:{}};
  const obj=asObject(value);
  return {photos:Array.isArray(obj.photos)?obj.photos:Array.isArray(obj.photoPathnames)?obj.photoPathnames:[],description:String(obj.description||""),details:asObject(obj.details)};
}
function photoUrls(value:any){
  return asMedia(value).photos.map((item:any)=>typeof item==="string"?item:String(item?.url||item?.pathname||"")).filter(Boolean);
}

export function rowToVehicle(row:any){
  const media=asMedia(row?.media);
  const photos=photoUrls(row?.media);
  const mappedStatus=String(row?.status||"").toLowerCase()==="available"?"published":String(row?.status||"draft").toLowerCase();
  return {
    id:String(row?.id||""),
    dealerId:row?.dealer_id||null,
    tenantId:"wdcc",
    year:Number(row?.year||0),
    make:String(row?.make||""),
    model:String(row?.model||""),
    trim:String(row?.trim||""),
    price:Number(row?.price||0),
    downPayment:Number(row?.down_payment||0),
    mileage:Number(row?.mileage||0),
    stock:String(row?.stock_id||""),
    vin:String(row?.vin||""),
    description:media.description,
    status:mappedStatus,
    photoPathnames:photos,
    primaryPhotoPathname:String(row?.primary_image_url||photos[0]||"" )||null,
    image:String(row?.primary_image_url||photos[0]||""),
    primaryPhotoUrl:String(row?.primary_image_url||photos[0]||""),
    bodyStyle:String(row?.body_style||media.details.bodyStyle||""),
    fuel:String(row?.fuel_type||media.details.fuel||""),
    transmission:String(row?.transmission||media.details.transmission||""),
    exteriorColor:String(media.details.exteriorColor||""),
    interiorColor:String(media.details.interiorColor||""),
    drivetrain:String(media.details.drivetrain||""),
    createdAt:row?.created_at||null,
    updatedAt:row?.updated_at||null,
    _dbStatus:String(row?.status||""),
  };
}

async function tokenFromSession(request:Request){
  const cookie=request.headers.get("cookie")||"";
  if(!cookie)return null;
  const upstream=await fetch(`${AUTH_BASE}/token`,{method:"GET",headers:{accept:"application/json",cookie},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(10000)});
  const text=await upstream.text();
  let json:any={};try{json=text?JSON.parse(text):{};}catch{}
  return upstream.ok?String(json?.token||upstream.headers.get("set-auth-jwt")||"")||null:null;
}

export async function dataApi(request:Request,path:string,init:RequestInit={},auth=true){
  const headers=new Headers(init.headers||{});
  headers.set("accept","application/json");
  if(init.body&&!headers.has("content-type"))headers.set("content-type","application/json");
  if(auth){const token=await tokenFromSession(request);if(!token)return new Response(JSON.stringify({message:"auth_required"}),{status:401,headers:{"content-type":"application/json"}});headers.set("authorization",`Bearer ${token}`);}
  return fetch(`${DATA_BASE}/${path.replace(/^\//,"")}`,{...init,headers,cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(12000)});
}

export async function dealerIdentity(request:Request):Promise<DealerIdentity|null>{
  const cookie=request.headers.get("cookie")||"";
  if(!cookie)return null;
  const sessionResponse=await fetch(`${AUTH_BASE}/get-session`,{headers:{accept:"application/json",cookie},cache:"no-store",signal:AbortSignal.timeout(10000)});
  const session=await sessionResponse.json().catch(()=>null);
  if(!sessionResponse.ok||!session?.user?.id)return null;
  const membership=await dataApi(request,"dealer_memberships?select=dealer_id,status&status=eq.active&limit=1",{},true);
  const rows=await membership.json().catch(()=>[]);
  const dealerId=membership.ok&&Array.isArray(rows)&&rows[0]?.dealer_id?String(rows[0].dealer_id):null;
  const email=String(session.user.email||"").toLowerCase();
  const role=email==="admin@internal.wedontcarecars.com"?"platform_admin":"dealer";
  return {id:String(session.user.id),email,role,dealerId};
}

export function publicVehicleRow(row:any){
  const item=rowToVehicle(row);
  const stock=item.stock.toUpperCase();
  const tags=Array.isArray(row?.tags)?row.tags.map((v:any)=>String(v||"").toUpperCase()):[];
  const qa=/^(QA|TEST|WDCC-QA|R36TEST)[-_]/.test(stock)||tags.some((t:string)=>["QA","TEST","R36-TEST"].includes(t));
  return !qa&&["available","published"].includes(String(row?.status||"").toLowerCase())&&item.year>1900&&Boolean(item.make)&&Boolean(item.model)&&item.price>0?item:null;
}

export function mediaForUpdate(current:any,patch:any){
  const media=asMedia(current?.media);
  const currentUrls=photoUrls(current?.media);
  const requested=Array.isArray(patch?.photoPathnames)?patch.photoPathnames.map((v:any)=>String(v||"")).filter(Boolean):[];
  const urls=[...new Set([...currentUrls,...requested])].slice(0,50);
  return {
    photos:urls.map(url=>({url})),
    description:patch?.description!==undefined?String(patch.description||""):media.description,
    details:{...media.details,...asObject(patch?.details)},
  };
}
