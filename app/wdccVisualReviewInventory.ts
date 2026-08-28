import {WDCC_RECOVERED_MEDIA_PATHS} from "../lib/wdccRecoveredMediaPaths";

const {nissan350z:nissan350zImage,fordF150:fordF150Image,hondaPilot:hondaPilotImage,kiaSportage:kiaSportageImage,toyotaRav4:toyotaRav4Image}=WDCC_RECOVERED_MEDIA_PATHS;

export type WdccVisualReviewVehicle={
  id:string;
  year:number;
  make:string;
  model:string;
  trim?:string;
  price:number;
  downPayment:number;
  mileage:number;
  stock:string;
  status:"published";
  visibility:"public";
  internalOnly:false;
  transmission:string;
  drivetrain:string;
  bodyStyle:string;
  fuelType:string;
  description:string;
  primary_image_url:string;
};

const description="Verified historical WDCC recovery record and recovered first-party vehicle photo used only for owner visual review. NOT LIVE inventory.";

export const WDCC_VISUAL_REVIEW_INVENTORY:WdccVisualReviewVehicle[]=[
  {id:"real-2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,stock:"WDCC-350Z-2004",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"RWD",bodyStyle:"Convertible",fuelType:"Gasoline",description,primary_image_url:nissan350zImage},
  {id:"real-2016-ford-f150-limited",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,stock:"WDCC-F150-2016",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"4x4",bodyStyle:"Truck",fuelType:"Gasoline",description,primary_image_url:fordF150Image},
  {id:"real-2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,stock:"WDCC-PILOT-2019",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"AWD",bodyStyle:"SUV",fuelType:"Gasoline",description,primary_image_url:hondaPilotImage},
  {id:"real-2019-kia-sportage",year:2019,make:"Kia",model:"Sportage",price:6500,downPayment:2500,mileage:127000,stock:"WDCC-SPORTAGE-2019",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"FWD",bodyStyle:"SUV",fuelType:"Gasoline",description,primary_image_url:kiaSportageImage},
  {id:"real-2019-toyota-rav4",year:2019,make:"Toyota",model:"RAV4",price:10500,downPayment:4500,mileage:240000,stock:"WDCC-RAV4-2019",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"AWD",bodyStyle:"SUV",fuelType:"Gasoline",description,primary_image_url:toyotaRav4Image}
];

type WdccRecoveredMediaCandidate={
  id?:string|null;
  primaryPhotoPathname?:string|null;
  primary_image_url?:string|null;
  image?:string|null;
};

const WDCC_RECOVERED_MEDIA_BY_FALLBACK_ID:Record<string,string>={
  "visual-lkg-2004-nissan-350z":nissan350zImage,
  "visual-lkg-2016-ford-f150":fordF150Image,
  "visual-lkg-2019-honda-pilot":hondaPilotImage,
  "visual-lkg-2019-kia-sportage":kiaSportageImage,
  "visual-lkg-2019-toyota-rav4":toyotaRav4Image
};

/**
 * Restores recovered first-party photos only for the five immutable visual
 * last-known-good records. Live/provider inventory is never passed here.
 */
export function withWdccRecoveredReviewMedia<T extends WdccRecoveredMediaCandidate>(items:T[]):T[]{
  return items.map(item=>{
    const recovered=WDCC_RECOVERED_MEDIA_BY_FALLBACK_ID[String(item.id||"")];
    return recovered?{...item,primaryPhotoPathname:null,primary_image_url:recovered}:item;
  });
}

const REVIEW_KEY="wdcc-owner-review-fixture-v2-real-media";

export function isWdccVisualReviewFixture(allowed=false){
  if(typeof window==="undefined")return false;
  try{
    if(!allowed){sessionStorage.removeItem(REVIEW_KEY);return false}
    const p=new URL(window.location.href).searchParams;
    if(p.get("owner-review")==="0"){sessionStorage.removeItem(REVIEW_KEY);return false}
    if(p.get("owner-review")==="1"||p.get("visual-fixture")==="verified-real"){
      sessionStorage.setItem(REVIEW_KEY,"1");
      return true;
    }
    return sessionStorage.getItem(REVIEW_KEY)==="1";
  }catch{return false}
}

export function wdccVisualReviewVehicle(id:string){
  return WDCC_VISUAL_REVIEW_INVENTORY.find(v=>v.id===id)||null;
}

export const WDCC_VISUAL_REVIEW_LABEL="OWNER VISUAL REVIEW · VERIFIED HISTORICAL RECORDS + RECOVERED FIRST-PARTY MEDIA · NOT LIVE";
