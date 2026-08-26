export const V5_VISUAL_SNAPSHOT_FLAG="verified-real-20260826-2159";
export const V5_VISUAL_SNAPSHOT_CAPTURED_AT="2026-08-26T21:59:53Z";
export const V5_VISUAL_SNAPSHOT_SOURCE_SHA="adade825f9629c1757ca4457e29363c6b662dba5";
export const V5_VISUAL_SNAPSHOT_SOURCE="wdcc-dealer-visual-proof";

export type V5SnapshotVehicle={
  id:string;year:number;make:string;model:string;price:number;downPayment:number;mileage:number;stock:string;
  status:"published";visibility:"public";internalOnly:false;photoPathnames:string[];primaryPhotoPathname:null;
  bodyStyle?:string;drivetrain?:string;
};

/*
 * Verified real customer-live inventory captured by the read-only dealer proof at
 * V5_VISUAL_SNAPSHOT_CAPTURED_AT. This is not demo/synthetic inventory and is only
 * eligible when the isolated V5 Worker explicitly enables V5_VISUAL_SNAPSHOT_FLAG.
 * No media is invented: the proof showed these recovered rows without uploaded photos.
 */
export const V5_VERIFIED_INVENTORY_SNAPSHOT:V5SnapshotVehicle[]=[
  {id:"recovered-2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,stock:"RECOVERED-2004-NISSAN-350Z",status:"published",visibility:"public",internalOnly:false,photoPathnames:[],primaryPhotoPathname:null},
  {id:"recovered-2016-ford-f150-lim",year:2016,make:"Ford",model:"F150 Limited",price:15000,downPayment:6000,mileage:164000,stock:"RECOVERED-2016-FORD-F150-LIM",status:"published",visibility:"public",internalOnly:false,photoPathnames:[],primaryPhotoPathname:null,bodyStyle:"Truck",drivetrain:"4x4"},
  {id:"recovered-2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,stock:"RECOVERED-2019-HONDA-PILOT",status:"published",visibility:"public",internalOnly:false,photoPathnames:[],primaryPhotoPathname:null},
  {id:"recovered-2019-kia-sportage",year:2019,make:"Kia",model:"Sportage",price:6500,downPayment:2500,mileage:127000,stock:"RECOVERED-2019-KIA-SPORTAGE",status:"published",visibility:"public",internalOnly:false,photoPathnames:[],primaryPhotoPathname:null},
  {id:"recovered-2019-toyota-rav4",year:2019,make:"Toyota",model:"Rav4",price:10500,downPayment:4500,mileage:240000,stock:"RECOVERED-2019-TOYOTA-RAV4",status:"published",visibility:"public",internalOnly:false,photoPathnames:[],primaryPhotoPathname:null}
];

export function v5VisualSnapshotEnabled(){return process.env.WDCC_VISUAL_SNAPSHOT===V5_VISUAL_SNAPSHOT_FLAG;}
export function v5SnapshotVehicle(id:string){return V5_VERIFIED_INVENTORY_SNAPSHOT.find(v=>v.id===id)||null;}
export function v5SnapshotPayload(extra:Record<string,unknown>={}){
  return {ok:true,count:V5_VERIFIED_INVENTORY_SNAPSHOT.length,items:V5_VERIFIED_INVENTORY_SNAPSHOT,snapshot:true,snapshotCapturedAt:V5_VISUAL_SNAPSHOT_CAPTURED_AT,snapshotSource:V5_VISUAL_SNAPSHOT_SOURCE,snapshotSourceSha:V5_VISUAL_SNAPSHOT_SOURCE_SHA,...extra};
}
