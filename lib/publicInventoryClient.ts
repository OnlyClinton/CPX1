const TRANSIENT_INVENTORY_STATUSES=new Set([408,425,429,500,502,503,504]);
const DEFAULT_RETRY_DELAYS_MS=Object.freeze([200,800]);
const DEFAULT_ATTEMPT_TIMEOUT_MS=5_000;

export type PublicInventoryFetch=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
type Sleep=(delayMs:number,signal?:AbortSignal)=>Promise<void>;

export class PublicInventoryRequestError extends Error{
  readonly status:number|null;
  readonly code:string;
  readonly retryable:boolean;

  constructor(message:string,{status=null,code="inventory_unavailable",retryable=false}:{status?:number|null;code?:string;retryable?:boolean}={}){
    super(message);
    this.name="PublicInventoryRequestError";
    this.status=status;
    this.code=code;
    this.retryable=retryable;
  }
}

const defaultFetch:PublicInventoryFetch=(input,init)=>fetch(input,init);

function abortError(){
  return new DOMException("The inventory request was aborted.","AbortError");
}

const defaultSleep:Sleep=(delayMs,signal)=>new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return;}
  const timer=setTimeout(done,delayMs);
  function done(){signal?.removeEventListener("abort",cancel);resolve();}
  function cancel(){clearTimeout(timer);signal?.removeEventListener("abort",cancel);reject(abortError());}
  signal?.addEventListener("abort",cancel,{once:true});
});

function isAbort(error:unknown){
  return typeof error==="object"&&error!==null&&"name" in error&&(error as {name?:unknown}).name==="AbortError";
}

async function fetchAttempt(fetchImpl:PublicInventoryFetch,signal:AbortSignal|undefined,timeoutMs:number){
  const controller=new AbortController();
  let rejectBoundary!:(reason?:unknown)=>void;
  const boundary=new Promise<never>((_resolve,reject)=>{rejectBoundary=reject});
  const externalAbort=()=>{
    rejectBoundary(abortError());
    controller.abort();
  };
  if(signal?.aborted)throw abortError();
  signal?.addEventListener("abort",externalAbort,{once:true});
  const timer=setTimeout(()=>{
    rejectBoundary(new PublicInventoryRequestError("Inventory request timed out.",{
      code:"inventory_timeout",retryable:true
    }));
    controller.abort();
  },timeoutMs);
  try{
    return await Promise.race([
      fetchImpl("/api/inventory",{cache:"no-store",credentials:"same-origin",signal:controller.signal}),
      boundary
    ]);
  }finally{
    clearTimeout(timer);
    signal?.removeEventListener("abort",externalAbort);
  }
}

export async function requestPublicInventory({
  fetchImpl=defaultFetch,
  retryDelaysMs=DEFAULT_RETRY_DELAYS_MS,
  attemptTimeoutMs=DEFAULT_ATTEMPT_TIMEOUT_MS,
  sleep=defaultSleep,
  signal
}:{
  fetchImpl?:PublicInventoryFetch;
  retryDelaysMs?:readonly number[];
  attemptTimeoutMs?:number;
  sleep?:Sleep;
  signal?:AbortSignal;
}={}):Promise<any>{
  const delays=retryDelaysMs.map(delay=>Math.max(0,Math.min(2_000,Math.trunc(Number(delay)||0))));
  const timeoutMs=Math.max(1,Math.min(10_000,Math.trunc(Number(attemptTimeoutMs)||DEFAULT_ATTEMPT_TIMEOUT_MS)));

  for(let attempt=0;attempt<=delays.length;attempt++){
    if(signal?.aborted)throw abortError();
    let failure:unknown;
    try{
      const response=await fetchAttempt(fetchImpl,signal,timeoutMs);
      let body:any;
      try{body=await response.json();}
      catch{
        throw new PublicInventoryRequestError("Inventory returned an invalid response.",{
          status:response.status,code:"inventory_invalid_response",retryable:TRANSIENT_INVENTORY_STATUSES.has(response.status)
        });
      }
      if(response.ok){
        if(!body||typeof body!=="object"||Array.isArray(body)){
          throw new PublicInventoryRequestError("Inventory returned an invalid payload.",{
            status:response.status,code:"inventory_invalid_payload",retryable:false
          });
        }
        return body;
      }
      const retryable=TRANSIENT_INVENTORY_STATUSES.has(response.status);
      failure=new PublicInventoryRequestError(String(body?.error||`Inventory ${response.status}`),{
        status:response.status,code:String(body?.error||"inventory_unavailable"),retryable
      });
    }catch(error){
      if(isAbort(error))throw error;
      failure=error instanceof PublicInventoryRequestError
        ?error
        :new PublicInventoryRequestError("Inventory request failed.",{retryable:true});
    }

    const retryable=failure instanceof PublicInventoryRequestError&&failure.retryable;
    if(!retryable||attempt===delays.length)throw failure;
    await sleep(delays[attempt],signal);
  }

  throw new PublicInventoryRequestError("Inventory request failed.");
}

const inFlightByFetcher=new WeakMap<PublicInventoryFetch,Promise<any>>();

export function loadPublicInventory(options:{
  fetchImpl?:PublicInventoryFetch;
  retryDelaysMs?:readonly number[];
  attemptTimeoutMs?:number;
  sleep?:Sleep;
  signal?:AbortSignal;
  dedupe?:boolean;
}={}):Promise<any>{
  const fetchImpl=options.fetchImpl??defaultFetch;
  if(options.dedupe===false||options.signal)return requestPublicInventory({...options,fetchImpl});
  const existing=inFlightByFetcher.get(fetchImpl);
  if(existing)return existing;
  const pending=requestPublicInventory({...options,fetchImpl}).finally(()=>{
    if(inFlightByFetcher.get(fetchImpl)===pending)inFlightByFetcher.delete(fetchImpl);
  });
  inFlightByFetcher.set(fetchImpl,pending);
  return pending;
}
