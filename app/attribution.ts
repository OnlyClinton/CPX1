"use client";

export type AttributionContext={
  sessionId:string;
  anonymousUserId:string;
  source:string;
  medium:string;
  campaign:string;
  content:string;
  term:string;
  clickId:string;
  referralCode:string;
  landingPath:string;
  referrer:string;
  firstSource:string;
  firstMedium:string;
  firstCampaign:string;
  firstContent:string;
  firstTerm:string;
  firstClickId:string;
  firstReferralCode:string;
};

const uuid=()=>crypto.randomUUID();
const safeGet=(storage:Storage,key:string)=>{try{return storage.getItem(key)||""}catch{return ""}};
const safeSet=(storage:Storage,key:string,value:string)=>{try{storage.setItem(key,value)}catch{}};
const safeRemove=(storage:Storage,key:string)=>{try{storage.removeItem(key)}catch{}};
const SESSION_MS=30*60*1000;

function hostReferrer(){
  try{return document.referrer?new URL(document.referrer).hostname.replace(/^www\./,""):""}catch{return ""}
}

export function getAttributionContext():AttributionContext{
  const url=new URL(window.location.href);const q=url.searchParams;const now=Date.now();
  let anonymousUserId=safeGet(localStorage,"wdcc_anonymous_user_id");if(!anonymousUserId){anonymousUserId=uuid();safeSet(localStorage,"wdcc_anonymous_user_id",anonymousUserId)}

  const lastSeen=Number(safeGet(localStorage,"wdcc_session_last_seen")||0);
  let sessionId=safeGet(localStorage,"wdcc_session_id");
  if(!sessionId||!lastSeen||now-lastSeen>SESSION_MS){
    sessionId=uuid();safeSet(localStorage,"wdcc_session_id",sessionId);
    for(const key of ["wdcc_landing_path","wdcc_first_referrer","wdcc_referral_code","wdcc_source","wdcc_medium","wdcc_campaign","wdcc_content","wdcc_term","wdcc_click_id"])safeRemove(sessionStorage,key);
  }
  safeSet(localStorage,"wdcc_session_last_seen",String(now));

  let landingPath=safeGet(sessionStorage,"wdcc_landing_path");if(!landingPath){landingPath=url.pathname+url.search;safeSet(sessionStorage,"wdcc_landing_path",landingPath)}
  let referrer=safeGet(sessionStorage,"wdcc_first_referrer");if(!referrer){referrer=document.referrer||"";safeSet(sessionStorage,"wdcc_first_referrer",referrer)}

  const incomingReferral=q.get("ref")||q.get("referral")||q.get("referral_code")||"";
  const incomingSource=q.get("utm_source")||q.get("source")||"";
  const incomingMedium=q.get("utm_medium")||"";
  const incomingCampaign=q.get("utm_campaign")||q.get("campaign")||"";
  const incomingContent=q.get("utm_content")||"";
  const incomingTerm=q.get("utm_term")||"";
  const incomingClickId=q.get("gclid")||q.get("fbclid")||q.get("msclkid")||q.get("ttclid")||"";

  const referralCode=incomingReferral||safeGet(sessionStorage,"wdcc_referral_code");
  const source=incomingSource||safeGet(sessionStorage,"wdcc_source")||((referralCode&&"referral")||hostReferrer()||"direct");
  const medium=incomingMedium||safeGet(sessionStorage,"wdcc_medium")||(referralCode?"referral":source==="direct"?"direct":"referral");
  const campaign=incomingCampaign||safeGet(sessionStorage,"wdcc_campaign")||"";
  const content=incomingContent||safeGet(sessionStorage,"wdcc_content")||"";
  const term=incomingTerm||safeGet(sessionStorage,"wdcc_term")||"";
  const clickId=incomingClickId||safeGet(sessionStorage,"wdcc_click_id")||"";
  for(const [k,v] of [["wdcc_referral_code",referralCode],["wdcc_source",source],["wdcc_medium",medium],["wdcc_campaign",campaign],["wdcc_content",content],["wdcc_term",term],["wdcc_click_id",clickId]] as const)if(v)safeSet(sessionStorage,k,v);

  const firstSource=safeGet(localStorage,"wdcc_first_source")||source;
  const firstMedium=safeGet(localStorage,"wdcc_first_medium")||medium;
  const firstCampaign=safeGet(localStorage,"wdcc_first_campaign")||campaign;
  const firstContent=safeGet(localStorage,"wdcc_first_content")||content;
  const firstTerm=safeGet(localStorage,"wdcc_first_term")||term;
  const firstClickId=safeGet(localStorage,"wdcc_first_click_id")||clickId;
  const firstReferralCode=safeGet(localStorage,"wdcc_first_referral_code")||referralCode;
  for(const [k,v] of [["wdcc_first_source",firstSource],["wdcc_first_medium",firstMedium],["wdcc_first_campaign",firstCampaign],["wdcc_first_content",firstContent],["wdcc_first_term",firstTerm],["wdcc_first_click_id",firstClickId],["wdcc_first_referral_code",firstReferralCode]] as const)if(v&&!safeGet(localStorage,k))safeSet(localStorage,k,v);

  return {sessionId,anonymousUserId,source,medium,campaign,content,term,clickId,referralCode,landingPath,referrer,firstSource,firstMedium,firstCampaign,firstContent,firstTerm,firstClickId,firstReferralCode};
}

export function trackEvent(event:string,extra:Record<string,unknown>={}){
  try{
    const a=getAttributionContext();
    const body=JSON.stringify({event,at:new Date().toISOString(),sessionId:a.sessionId,anonymousUserId:a.anonymousUserId,source:a.source,medium:a.medium,campaign:a.campaign,content:a.content,term:a.term,clickId:a.clickId,referralCode:a.referralCode,pagePath:window.location.pathname,landingPath:a.landingPath,referrer:a.referrer,metadata:{firstTouch:{source:a.firstSource,medium:a.firstMedium,campaign:a.firstCampaign,content:a.firstContent,term:a.firstTerm,clickId:a.firstClickId,referralCode:a.firstReferralCode},...((extra.metadata&&typeof extra.metadata==="object")?extra.metadata as Record<string,unknown>:{})},...Object.fromEntries(Object.entries(extra).filter(([key])=>key!=="metadata"))});
    const blob=new Blob([body],{type:"application/json"});
    const queued=navigator.sendBeacon?navigator.sendBeacon("/api/events",blob):false;
    if(!queued)void fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true});
  }catch{}
}
