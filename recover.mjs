import fs from 'node:fs/promises';
import path from 'node:path';
const token=process.env.VERCEL_TOKEN, team=process.env.VERCEL_TEAM_ID, dep=process.env.DEPLOYMENT_ID;
const tree=JSON.parse(await fs.readFile('files.json','utf8'));
const files=[];
function walk(nodes,prefix=''){
  for(const n of nodes||[]){
    const p=prefix?`${prefix}/${n.name}`:n.name;
    if(n.type==='directory') walk(n.children||[],p);
    else if(n.type==='file'&&n.uid) files.push({...n,path:p});
  }
}
walk(tree);
const manifest=[];
for(const f of files){
  const u=`https://api.vercel.com/v8/deployments/${dep}/files/${f.uid}?teamId=${encodeURIComponent(team)}`;
  const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});
  if(!r.ok) throw new Error(`${f.path}: ${r.status}`);
  const raw=await r.text();
  let parsed; try{parsed=JSON.parse(raw)}catch{parsed=raw}
  const b64=typeof parsed==='string'?parsed:(parsed?.data??parsed?.content??parsed?.file??parsed?.value);
  if(typeof b64!=='string') throw new Error(`${f.path}: unknown content response`);
  const buf=Buffer.from(b64,'base64');
  const out=path.join('recovered',f.path);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await fs.writeFile(out,buf);
  manifest.push({path:f.path,uid:f.uid,size:buf.length,contentType:f.contentType||null});
}
await fs.writeFile('recovered-manifest.json',JSON.stringify(manifest,null,2));
console.log(`Recovered ${manifest.length} files`);
