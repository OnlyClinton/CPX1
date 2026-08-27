// Visual-proof-only fallback for isolated workers.dev previews.
// Values are the last-known-good real public inventory rendered by exact-SHA
// Cloudflare proof 81e7fe5e680bb301b68194a15b6ce6b6a4c3d65c.
// This must never be used on production/custom domains and never performs writes.

import {WDCC_RECOVERED_MEDIA_PATHS} from "./wdccRecoveredMediaPaths";

export const VISUAL_PROOF_LKG_SHA="81e7fe5e680bb301b68194a15b6ce6b6a4c3d65c";

export const VISUAL_PROOF_LKG_INVENTORY=[
  {id:"visual-lkg-2004-nissan-350z",tenantId:"wdcc",year:2004,make:"Nissan",model:"350Z",trim:"",price:4900,downPayment:2000,mileage:154000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"Coupe",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:WDCC_RECOVERED_MEDIA_PATHS.nissan350z},
  {id:"visual-lkg-2016-ford-f150",tenantId:"wdcc",year:2016,make:"Ford",model:"F150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"Truck",transmission:"",drivetrain:"4x4",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:WDCC_RECOVERED_MEDIA_PATHS.fordF150},
  {id:"visual-lkg-2019-honda-pilot",tenantId:"wdcc",year:2019,make:"Honda",model:"Pilot",trim:"",price:7900,downPayment:3000,mileage:380000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:WDCC_RECOVERED_MEDIA_PATHS.hondaPilot},
  {id:"visual-lkg-2019-kia-sportage",tenantId:"wdcc",year:2019,make:"Kia",model:"Sportage",trim:"",price:6500,downPayment:2500,mileage:127000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:WDCC_RECOVERED_MEDIA_PATHS.kiaSportage},
  {id:"visual-lkg-2019-toyota-rav4",tenantId:"wdcc",year:2019,make:"Toyota",model:"Rav4",trim:"",price:10500,downPayment:4500,mileage:240000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:WDCC_RECOVERED_MEDIA_PATHS.toyotaRav4}
] as const;

// Synthetic design-reference inventory. This is intentionally separate from
// the historical LKG fallback above: it exists only to render the approved
// R31/R25 composition on an isolated, exact-SHA workers.dev preview.
export const WDCC_MOCKUP_PREVIEW_INVENTORY=[
  {id:"mockup-preview-2020-dodge-challenger-sxt",tenantId:"wdcc",year:2020,make:"Dodge",model:"Challenger",trim:"SXT",price:24995,downPayment:2000,mileage:41000,engine:"V6",status:"published",visibility:"public",internalOnly:false,bodyStyle:"Coupe",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:"/wdcc-mockup-preview/2020-dodge-challenger-sxt.webp"},
  {id:"mockup-preview-2019-dodge-charger-rt",tenantId:"wdcc",year:2019,make:"Dodge",model:"Charger",trim:"R/T",price:21995,downPayment:1500,mileage:53000,engine:"V8",status:"published",visibility:"public",internalOnly:false,bodyStyle:"Sedan",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:"/wdcc-mockup-preview/2019-dodge-charger-rt.webp"},
  {id:"mockup-preview-2018-chevrolet-camaro-lt",tenantId:"wdcc",year:2018,make:"Chevrolet",model:"Camaro",trim:"LT",price:20995,downPayment:1500,mileage:38000,engine:"V6",status:"published",visibility:"public",internalOnly:false,bodyStyle:"Coupe",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:"/wdcc-mockup-preview/2018-chevrolet-camaro-lt.webp"},
  {id:"mockup-preview-2020-jeep-grand-cherokee-laredo",tenantId:"wdcc",year:2020,make:"Jeep",model:"Grand Cherokee",trim:"Laredo",price:23995,downPayment:2000,mileage:60000,engine:"V6",status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:"/wdcc-mockup-preview/2020-jeep-grand-cherokee-laredo.webp"},
  {id:"mockup-preview-2018-ford-f150-xlt",tenantId:"wdcc",year:2018,make:"Ford",model:"F-150",trim:"XLT",price:22995,downPayment:2000,mileage:71000,engine:"V8",status:"published",visibility:"public",internalOnly:false,bodyStyle:"Truck",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:"/wdcc-mockup-preview/2018-ford-f150-xlt.webp"}
] as const;

export function isIsolatedWorkersDevRequest(request:Request){
  try{return new URL(request.url).hostname.toLowerCase().endsWith(".workers.dev");}catch{return false;}
}

export function visualProofInventoryFallback(upstreamStatus:number){
  const items=VISUAL_PROOF_LKG_INVENTORY.map(item=>({...item}));
  return {
    ok:true,
    count:items.length,
    items,
    previewFallback:true,
    inventorySource:"last-known-good-real-proof",
    sourceEvidenceSha:VISUAL_PROOF_LKG_SHA,
    upstreamStatus
  };
}

export function mockupPreviewInventoryPayload(){
  const items=WDCC_MOCKUP_PREVIEW_INVENTORY.map(item=>({...item}));
  return {
    ok:true,
    count:items.length,
    items,
    mockupPreview:true,
    inventorySource:"r31-r25-design-reference",
    sourceEvidenceCommit:"63245adb8c6d8dc58ced2a83bf66a7b23130ebd9",
    live:false
  };
}
