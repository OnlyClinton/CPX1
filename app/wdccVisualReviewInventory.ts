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

/* Owner-review fixture only. These target records are never returned by the live inventory API. */
const description="";
const strip="/wdcc-v32-proof-vehicles.webp";

export const WDCC_VISUAL_REVIEW_INVENTORY:WdccVisualReviewVehicle[]=[
  {id:"proof-vdp",year:2020,make:"Dodge",model:"Challenger",trim:"SXT",price:24995,downPayment:2000,mileage:41000,stock:"DGC2020SXT",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"RWD",bodyStyle:"Coupe",fuelType:"Gasoline",description,primary_image_url:`${strip}?slot=1`},
  {id:"proof-charger",year:2019,make:"Dodge",model:"Charger",trim:"R/T",price:21995,downPayment:1500,mileage:53000,stock:"DCR2019RT",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"RWD",bodyStyle:"Sedan",fuelType:"Gasoline",description,primary_image_url:`${strip}?slot=2`},
  {id:"proof-camaro",year:2018,make:"Chevrolet",model:"Camaro",trim:"LT",price:20995,downPayment:1500,mileage:38000,stock:"CCLT2018",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"RWD",bodyStyle:"Coupe",fuelType:"Gasoline",description,primary_image_url:`${strip}?slot=3`},
  {id:"proof-jeep",year:2020,make:"Jeep",model:"Grand Cherokee",trim:"Laredo",price:23995,downPayment:2000,mileage:60000,stock:"JGCL2020",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"4x4",bodyStyle:"SUV",fuelType:"Gasoline",description,primary_image_url:`${strip}?slot=4`},
  {id:"proof-f150",year:2018,make:"Ford",model:"F-150",trim:"XLT",price:22995,downPayment:2000,mileage:71000,stock:"FF150XLT2018",status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",drivetrain:"4x4",bodyStyle:"Truck",fuelType:"Gasoline",description,primary_image_url:`${strip}?slot=5`}
];

const REVIEW_KEY="wdcc-owner-review-fixture-v5-v32-hybrid";

export function isWdccVisualReviewFixture(){
  if(typeof window==="undefined")return false;
  try{
    const p=new URL(window.location.href).searchParams;
    if(p.get("owner-review")==="0"){sessionStorage.removeItem(REVIEW_KEY);return false}
    if(p.get("owner-review")==="1"||p.get("visual-fixture")==="v32-target"){
      sessionStorage.setItem(REVIEW_KEY,"1");
      return true;
    }
    return sessionStorage.getItem(REVIEW_KEY)==="1";
  }catch{return false}
}

export function wdccVisualReviewVehicle(id:string){
  return WDCC_VISUAL_REVIEW_INVENTORY.find(v=>v.id===id)||null;
}

export const WDCC_VISUAL_REVIEW_LABEL="OWNER VISUAL REVIEW · V32 TARGET FIXTURE · NOT LIVE";
