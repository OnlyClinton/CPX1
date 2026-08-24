"use client";

export type AttributionContext={
  sessionId:string;
  anonymousUserId:string;
  source:string;
  medium:string;
  campaign:string;
  content:string;
  referralCode:string;
  landingPath:string;
  referrer:string;
  clickId:string;
};

const uuid=()=>crypto.randomUUID();
const safeGet=(storage:Storage,key:string)=>{try{return storage.getItem(key)||""}catch{return ""}};
const safeSet=(storage:Storage,key:string,value:string)=>{try{storage.setItem(key,value)}catch{}};

export function getAttributionContext():AttributionContext{
  const url=new URL(window.location.href);const q=url.searchParams;
  let anonymousUserId=safeGet(localStorage,"wdcc_anonymous_user_id");if(!anonymousUserId){anonymousUserId=uuid();safeSet(localStorage,"wdcc_anonymous_user_id",anonymousUserId)}
  let sessionId=safeGet(sessionStorage,"wdcc_session_id");if(!sessionId){sessionId=uuid();safeSet(sessionStorage,"wdcc_session_id",sessionId)}
  let landingPath=safeGet(sessionStorage,"wdcc_landing_path");if(!landingPath){landingPath=url.pathname+url.search;safeSet(sessionStorage,"wdcc_landing_path",landingPath)}
  let referrer=safeGet(sessionStorage,"wdcc_first_referrer");if(!referrer){referrer=document.referrer||"";safeSet(sessionStorage,"wdcc_first_referrer",referrer)}
  const referralCode=q.get("ref")||q.get("referral")||q.get("referral_code")||safeGet(sessionStorage,"wdcc_referral_code");if(referralCode)safeSet(sessionStorage,"wdcc_referral_code",referralCode);
  const explicitSource=q.get("utm_source")||q.get("source")||safeGet(sessionStorage,"wdcc_source");
  const source=explicitSource||((referralCode&&"referral")||(document.referrer?new URL(document.referrer).hostname.replace(/^www\./,""):"direct"));
  const medium=q.get("utm_medium")||safeGet(sessionStorage,"wdcc_medium")||(referralCode?"referral":"direct");
  const campaign=q.get("utm_campaign")||safeGet(sessionStorage,"wdcc_campaign")||"";
  const content=q.get("utm_content")||safeGet(sessionStorage,"wdcc_content")||"";
  const clickId=q.get("gclid")||q.get("fbclid")||q.get("msclkid")||safeGet(sessionStorage,"wdcc_click_id")||"";
  for(const [k,v] of [["wdcc_source",source],["wdcc_medium",medium],["wdcc_campaign",campaign],["wdcc_content",content],["wdcc_click_id",clickId]] as const)if(v)safeSet(sessionStorage,k,v);
  return {sessionId,anonymousUserId,source,medium,campaign,content,referralCode,landingPath,referrer,clickId};
}

export function trackEvent(event:string,extra:Record<string,unknown>={}){
  try{
    const a=getAttributionContext();
    const body=JSON.stringify({event,at:new Date().toISOString(),sessionId:a.sessionId,anonymousUserId:a.anonymousUserId,source:a.source,medium:a.medium,campaign:a.campaign,content:a.content,referralCode:a.referralCode,pagePath:window.location.pathname,landingPath:a.landingPath,referrer:a.referrer,clickId:a.clickId,...extra});
    if(navigator.sendBeacon)navigator.sendBeacon("/api/events",new Blob([body],{type:"application/json"}));
    else void fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true});
  }catch{}
}
