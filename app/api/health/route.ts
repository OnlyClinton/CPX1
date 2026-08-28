import {NextResponse} from "next/server";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {neonAuthReadiness,neonAuthUrl} from "../../../lib/neonAuth";
import {vehicleBlobClientUploadToken,vehicleBlobReadConfigured,vehicleMediaCaptureRoot} from "../../../lib/vehicleMedia";
import {databaseConfigured,databaseHealth,databaseIdentity,leadEmailReadiness} from "../../../lib/wdccDb";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","X-WDCC-Data-Authority":"neon"};

function provider(){
  if(process.env.RAILWAY_DEPLOYMENT_ID||process.env.RAILWAY_GIT_COMMIT_SHA)return "railway";
  if(process.env.VERCEL_PROJECT_ID)return "vercel";
  return "portable";
}

function mediaReadiness(){
  let local=false;
  try{local=Boolean(vehicleMediaCaptureRoot());}catch{}
  const clientUpload=Boolean(vehicleBlobClientUploadToken());
  return {
    configured:clientUpload||local,
    uploadConfigured:clientUpload||local,
    readConfigured:vehicleBlobReadConfigured()||local,
    provider:local?"e2e-local-capture":clientUpload?"vercel-blob-client":"missing",
    requiredProductionVariable:"BLOB_READ_WRITE_TOKEN"
  };
}

function authReadiness(database:ReturnType<typeof databaseIdentity>){
  const configured=neonAuthReadiness();
  if(!configured.valid)return {...configured,ready:false,databaseMatched:null,sessionLifecycle:"upstream-revoked-before-app-session"};
  try{
    const parsed=new URL(neonAuthUrl());
    const expected=database.database?`/${database.database}/auth`:null;
    const databaseMatched=expected?parsed.pathname===expected:true;
    return {...configured,ready:databaseMatched,databaseMatched,reason:databaseMatched?null:"database_mismatch",sessionLifecycle:"upstream-revoked-before-app-session"};
  }catch{
    return {...configured,valid:false,ready:false,databaseMatched:null,reason:"invalid",sessionLifecycle:"upstream-revoked-before-app-session"};
  }
}

function readinessReasons(input:{session:boolean;email:boolean;media:boolean;outboxRetry:boolean;auth:{ready:boolean;reason:string|null}}){
  const authReason=!input.auth.ready?(input.auth.reason==="missing"?"neon_auth_url_missing":input.auth.reason==="database_mismatch"?"neon_auth_database_mismatch":"neon_auth_url_invalid"):null;
  return [
    ...(!input.session?["session_secret_missing"]:[]),
    ...(!input.auth.ready&&authReason?[authReason]:[]),
    ...(!input.email?["lead_email_not_ready"]:[]),
    ...(!input.media?["vehicle_media_upload_not_ready"]:[]),
    ...(!input.outboxRetry?["lead_outbox_retry_not_ready"]:[])
  ];
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/health");
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.RAILWAY_GIT_COMMIT_SHA||process.env.CF_PAGES_COMMIT_SHA||null;
  const identity=databaseIdentity();
  const email=leadEmailReadiness();
  const media=mediaReadiness();
  const auth=authReadiness(identity);
  const session=String(process.env.SESSION_SECRET||"").length>=32;
  const outboxRetry=String(process.env.CRON_SECRET||"").trim().length>=32;
  const integrationReasons=readinessReasons({session,email:email.configured,media:media.configured,outboxRetry,auth});
  const base={
    service:"wdcc-neon-business-flow",release:"WDCC-V54-NEON-AUTHORITY",authority:"neon",provider:provider(),commit,
    database:identity,session:session?"configured":"missing",
    integrations:{
      auth,
      email:{configured:email.configured,apiKey:email.apiKey,recipients:email.recipients,from:email.from,baseUrl:email.baseUrl,override:email.override,reason:email.reason},
      dashboard:{configured:true},media,outboxRetry:{configured:outboxRetry,schedule:"*/5 * * * *"}
    }
  };
  if(!databaseConfigured()){
    return NextResponse.json({ok:false,degraded:true,...base,state:"unconfigured",reasons:["database_missing",...integrationReasons]},{status:503,headers});
  }
  try{
    const state=await databaseHealth();
    const reasons=integrationReasons;
    const ok=reasons.length===0;
    return NextResponse.json({ok,degraded:!ok,...base,database:state.identity,state:"readable",counts:{vehicles:state.vehicles,leads:state.leads,pendingOutbox:state.pendingOutbox,staleOutbox:state.staleOutbox,deadLetterOutbox:state.deadLetterOutbox},reasons},{status:ok?200:503,headers});
  }catch{
    return NextResponse.json({ok:false,degraded:true,...base,state:"unreadable",reasons:["database_unreadable",...integrationReasons],error:"database_health_failed"},{status:503,headers});
  }
}
