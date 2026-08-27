import openNextWorker from "../.open-next/worker.js";
import {WDCCState} from "./wdcc-state-worker.mjs";

export {WDCCState};

const STATE_PREFIX="/__wdcc_state";

function stateRequest(request){
  const url=new URL(request.url);
  const pathname=url.pathname.slice(STATE_PREFIX.length)||"/";
  url.pathname=pathname.startsWith("/")?pathname:`/${pathname}`;
  return new Request(url.toString(),request);
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname===STATE_PREFIX||url.pathname.startsWith(`${STATE_PREFIX}/`)){
      const id=env.WDCC_STATE.idFromName("canonical");
      return env.WDCC_STATE.get(id).fetch(stateRequest(request));
    }
    return openNextWorker.fetch(request,env,ctx);
  }
};
