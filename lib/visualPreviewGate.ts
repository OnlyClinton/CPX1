type HeadersLike={get(name:string):string|null};

function normalizedHostname(value:unknown){
  const raw=String(value??"").trim().toLowerCase();
  if(!raw||/[\s\\/@]/.test(raw))return "";
  try{
    const parsed=new URL(`https://${raw}`);
    if(parsed.username||parsed.password||parsed.pathname!=="/"||parsed.search||parsed.hash)return "";
    return parsed.hostname.replace(/\.$/,"");
  }catch{return "";}
}

export function isIsolatedWorkersDevPreviewHost(host:unknown,enabled=process.env.WDCC_MOCKUP_PREVIEW){
  if(enabled!=="1")return false;
  const hostname=normalizedHostname(host);
  return hostname!=="workers.dev"&&hostname.endsWith(".workers.dev");
}

export function isIsolatedWorkersDevPreview(headers:HeadersLike){
  return isIsolatedWorkersDevPreviewHost(headers.get("host"));
}
