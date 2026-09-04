import fs from 'node:fs/promises';

const base=process.env.R31_BASE_URL||'http://127.0.0.1:3000';
const out=process.env.R31_QA_OUT||'artifacts/r31-local-visual';
const routes=[
  ['/r31-preview','BAD CREDIT?'],
  ['/r31-preview/inventory','FIND THE RIGHT CAR.'],
  ['/r31-preview/financing','START WITH THE REAL NUMBERS.'],
  ['/r31-preview/reviews','STRAIGHT ANSWERS. REAL PEOPLE.'],
  ['/r31-preview/about','THE NAME IS THE PROMISE.'],
  ['/r31-preview/get-approved','FAST START. STRAIGHT ANSWERS.'],
  ['/r31-preview/dealer-editor','ADD / EDIT VEHICLE'],
  ['/contact','Call or Contact Us'],
  ['/schedule-test-drive','test drive'],
];
const report={base,generatedAt:new Date().toISOString(),routes:[],inventory:null,vehicleDetail:null};
for(const [path,marker] of routes){
  const r=await fetch(base+path,{redirect:'manual',headers:{accept:'text/html'}});
  const text=await r.text();
  const ok=r.status===200&&text.toLowerCase().includes(marker.toLowerCase());
  report.routes.push({path,status:r.status,marker,markerFound:text.toLowerCase().includes(marker.toLowerCase()),ok});
  if(!ok)throw new Error(`route_contract_failed:${path}:${r.status}:${marker}`);
}
const inv=await fetch(base+'/api/inventory',{headers:{accept:'application/json'}});
const json=await inv.json().catch(()=>({}));
const items=Array.isArray(json.items)?json.items:[];
report.inventory={status:inv.status,count:items.length,strictHeader:inv.headers.get('x-wdcc-public-inventory-filter')};
if(inv.status!==200)throw new Error(`route_contract_inventory:${inv.status}`);
if(items.length){
  const id=String(items[0].id||'');
  const v=await fetch(base+`/vehicle/${encodeURIComponent(id)}`,{redirect:'manual'});
  report.vehicleDetail={id,status:v.status};
  if(v.status!==200)throw new Error(`route_contract_vehicle:${id}:${v.status}`);
}
await fs.mkdir(out,{recursive:true});
await fs.writeFile(`${out}/route-contract.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
