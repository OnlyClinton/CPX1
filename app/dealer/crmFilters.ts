export type LeadRecord=Record<string,any>;

export const stageLabels:Record<string,string>={
  new:"New",contacted:"Contacted",engaged:"Engaged",qualified:"Qualified",appointment:"Appointment",showed:"Showed",deal_working:"Deal Working",approved:"Approved",sold:"Sold",lost:"Lost",nurture:"Nurture"
};

export const pipelineStages=["new","contacted","engaged","qualified","appointment","showed","deal_working","sold"] as const;

export function stageOf(lead:LeadRecord){
  const raw=String(lead?.pipelineStage||lead?.status||"new").trim().toLowerCase().replace(/[\s-]+/g,"_");
  if(raw==="dealworking")return"deal_working";
  return raw||"new";
}

export function createdAtOf(lead:LeadRecord){
  return lead?.createdAt||lead?.created_at||lead?.receivedAt||lead?.timestamp||null;
}

export function sameLocalDay(value:any){
  if(!value)return false;
  const d=new Date(value),now=new Date();
  return !Number.isNaN(d.getTime())&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
}

export function appointmentIntent(lead:LeadRecord){
  if(stageOf(lead)==="appointment")return true;
  const text=[lead?.kind,lead?.type,lead?.source,lead?.sourceName,lead?.message].filter(Boolean).join(" ");
  return /schedule|test[\s_-]*drive|appointment/i.test(text);
}

export function leadScore(lead:LeadRecord){
  const explicit=Number(lead?.priorityScore??lead?.leadScore??lead?.score??lead?.priority);
  if(Number.isFinite(explicit))return Math.max(0,Math.min(100,Math.round(explicit)));
  let score=28;
  if(lead?.phone)score+=14;
  if(lead?.email)score+=8;
  if(lead?.vehicleInterest||lead?.vehicleId)score+=13;
  if(appointmentIntent(lead))score+=22;
  if(/approval|pre.?approv|finance|application/i.test(String(lead?.kind||lead?.type||lead?.source||"")))score+=12;
  if(sameLocalDay(createdAtOf(lead)))score+=8;
  if(["qualified","appointment","showed","deal_working","approved"].includes(stageOf(lead)))score+=12;
  return Math.max(0,Math.min(100,score));
}

export function sourceLabel(lead:LeadRecord){
  return String(lead?.source||lead?.sourceName||lead?.utmSource||lead?.kind||"Website").trim().replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase())||"Website";
}

export function when(value:any){
  if(!value)return"";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?String(value):d.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}

export function ageMinutes(lead:LeadRecord){
  const value=createdAtOf(lead);if(!value)return null;
  const time=new Date(value).getTime();if(!Number.isFinite(time))return null;
  return Math.max(0,Math.floor((Date.now()-time)/60000));
}

export function firstContactDue(lead:LeadRecord){
  if(stageOf(lead)!=="new")return false;
  const age=ageMinutes(lead);return age!=null&&age>15;
}

export function slaState(lead:LeadRecord){
  const stage=stageOf(lead),age=ageMinutes(lead);
  if(stage!=="new")return{key:"handled",label:stageLabels[stage]||"In progress",tone:"good",minutes:age};
  if(age==null)return{key:"unknown",label:"No timestamp",tone:"muted",minutes:null};
  if(age<=5)return{key:"fresh",label:`Fresh · ${age}m`,tone:"good",minutes:age};
  if(age<=15)return{key:"due",label:`Call now · ${age}m`,tone:"warn",minutes:age};
  return{key:"overdue",label:`Overdue · ${age}m`,tone:"hot",minutes:age};
}

function normalizeNotification(value:any){return String(value||"").trim().toLowerCase();}

export function notificationState(lead:LeadRecord){
  const n=lead?.notifications||{};
  const email=normalizeNotification(n.email||lead?.emailStatus);
  const sms=normalizeNotification(n.sms||lead?.smsStatus);
  if(email.includes("suppressed_qa")||sms.includes("suppressed_qa"))return{key:"qa",label:"QA suppressed",tone:"muted"};
  const emailSent=email==="sent"||email==="synced"||email==="delivered"||email==="upstream";
  const smsSent=sms==="sent"||sms==="synced"||sms==="delivered"||sms==="upstream";
  if(emailSent&&smsSent)return{key:"both",label:"Email + SMS",tone:"good"};
  if(emailSent)return{key:"email",label:"Email sent",tone:"good"};
  if(smsSent)return{key:"sms",label:"SMS sent",tone:"good"};
  if(email.startsWith("failed")||sms.startsWith("failed"))return{key:"failed",label:"Notify failed",tone:"hot"};
  if(email==="not_configured"&&sms==="not_configured")return{key:"missing",label:"Not configured",tone:"warn"};
  if(email||sms)return{key:"partial",label:[email&&`E:${email}`,sms&&`S:${sms}`].filter(Boolean).join(" · "),tone:"warn"};
  return{key:"unknown",label:"No status",tone:"muted"};
}
