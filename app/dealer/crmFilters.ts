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
