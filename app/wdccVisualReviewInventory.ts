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
  {id:"real-2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,stock:"WDCC-350Z-2004",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"RWD",bodyStyle:"Convertible",fuelType:"Gasoline",description,primary_image_url:"/wdcc-review-media/nissan350z"},
  {id:"real-2016-ford-f150-limited",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,stock:"WDCC-F150-2016",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"4x4",bodyStyle:"Truck",fuelType:"Gasoline",description,primary_image_url:"/wdcc-review-media/fordF150"},
  {id:"real-2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,stock:"WDCC-PILOT-2019",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"AWD",bodyStyle:"SUV",fuelType:"Gasoline",description,primary_image_url:"/wdcc-review-media/hondaPilot"},
  {id:"real-2019-kia-sportage",year:2019,make:"Kia",model:"Sportage",price:6500,downPayment:2500,mileage:127000,stock:"WDCC-SPORTAGE-2019",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"FWD",bodyStyle:"SUV",fuelType:"Gasoline",description,primary_image_url:"/wdcc-review-media/kiaSportage"},
  {id:"real-2019-toyota-rav4",year:2019,make:"Toyota",model:"RAV4",price:10500,downPayment:4500,mileage:240000,stock:"WDCC-RAV4-2019",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"AWD",bodyStyle:"SUV",fuelType:"Gasoline",description,primary_image_url:"/wdcc-review-media/toyotaRav4"}
];

const REVIEW_KEY="wdcc-owner-review-fixture-v3-recovered-media";

export function isWdccVisualReviewFixture(){
  if(typeof window==="undefined")return false;
  try{
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
