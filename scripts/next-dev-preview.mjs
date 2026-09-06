import {spawn} from "node:child_process";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const nextBin=require.resolve("next/dist/bin/next");
const forwarded=[];
for(let index=0;index<process.argv.slice(2).length;index++){
  const args=process.argv.slice(2);
  const value=args[index];
  if(value==="--strictPort")continue;
  if(value==="--host"){
    forwarded.push("--hostname");
    if(args[index+1])forwarded.push(args[++index]);
    continue;
  }
  forwarded.push(value);
}

const mode=process.env.WDCC_PREVIEW_PRODUCTION==="1"?"start":"dev";
const child=spawn(process.execPath,[nextBin,mode,...forwarded],{stdio:"inherit",env:process.env});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",code=>process.exit(code??1));
