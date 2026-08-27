import type {State} from "./store";

const RECOVERY_MODE="drive-r6-20260822";

export function previewRecoveryEnabled(){
  return process.env.VERCEL_ENV==="preview"&&process.env.WDCC_PREVIEW_RECOVERY_STATE===RECOVERY_MODE;
}

export function previewRecoveryMode(){
  return previewRecoveryEnabled()?RECOVERY_MODE:null;
}

export function previewRecoveryState():State{
  if(!previewRecoveryEnabled())throw Error("PREVIEW_RECOVERY_NOT_ENABLED");
  return {
    revision:1,
    tenants:[{id:"wdcc",name:"We Don't Care Cars"}],
    users:[],
    vehicles:[
      {year:2004,make:"Nissan",model:"350Z",trim:"",bodyStyle:"",condition:"Used",exteriorColor:"",interiorColor:"",transmission:"",drivetrain:"",fuelType:"",location:"Tampa Bay",price:4900,downPayment:2000,mileage:154000,vin:"",stock:"RECOVERED-2004-NISSAN-350Z",description:"",features:[],badges:["RECOVERED"],featured:true,submitForReview:false,status:"published",id:"recovered-2004-nissan-350z",tenantId:"wdcc",photoPathnames:[],primaryPhotoPathname:null,createdAt:"2026-08-21T13:32:19.309Z",updatedAt:"2026-08-21T13:32:19.309Z"},
      {year:2016,make:"Ford",model:"F150",trim:"Limited",bodyStyle:"Truck",condition:"Used",exteriorColor:"Black",interiorColor:"Black",transmission:"",drivetrain:"4x4",fuelType:"Gas",location:"Tampa Bay",price:15000,downPayment:6000,mileage:164000,vin:"",stock:"RECOVERED-2016-FORD-F150-LIM",description:"",features:[],badges:["RECOVERED"],featured:true,submitForReview:false,status:"published",id:"recovered-2016-ford-f150-limited",tenantId:"wdcc",photoPathnames:[],primaryPhotoPathname:null,createdAt:"2026-08-21T13:32:19.309Z",updatedAt:"2026-08-21T13:32:19.309Z"},
      {year:2019,make:"Honda",model:"Pilot",trim:"",bodyStyle:"",condition:"Used",exteriorColor:"",interiorColor:"",transmission:"",drivetrain:"",fuelType:"",location:"Tampa Bay",price:7900,downPayment:3000,mileage:380000,vin:"",stock:"RECOVERED-2019-HONDA-PILOT",description:"",features:[],badges:["RECOVERED"],featured:true,submitForReview:false,status:"published",id:"recovered-2019-honda-pilot",tenantId:"wdcc",photoPathnames:[],primaryPhotoPathname:null,createdAt:"2026-08-21T13:32:19.309Z",updatedAt:"2026-08-21T13:32:19.309Z"},
      {year:2019,make:"Kia",model:"Sportage",trim:"",bodyStyle:"Suv",condition:"Used",exteriorColor:"Black",interiorColor:"Charcoal",transmission:"",drivetrain:"",fuelType:"",location:"Tampa Bay",price:6500,downPayment:2500,mileage:127000,vin:"",stock:"RECOVERED-2019-KIA-SPORTAGE",description:"",features:[],badges:["RECOVERED"],featured:true,submitForReview:false,status:"published",id:"recovered-2019-kia-sportage",tenantId:"wdcc",photoPathnames:[],primaryPhotoPathname:null,createdAt:"2026-08-21T13:32:19.309Z",updatedAt:"2026-08-21T13:32:19.309Z"},
      {year:2019,make:"Toyota",model:"Rav4",trim:"",bodyStyle:"",condition:"Used",exteriorColor:"",interiorColor:"",transmission:"",drivetrain:"",fuelType:"",location:"Tampa Bay",price:10500,downPayment:4500,mileage:240000,vin:"",stock:"RECOVERED-2019-TOYOTA-RAV4",description:"",features:[],badges:["RECOVERED"],featured:true,submitForReview:false,status:"published",id:"recovered-2019-toyota-rav4",tenantId:"wdcc",photoPathnames:[],primaryPhotoPathname:null,createdAt:"2026-08-21T13:32:19.309Z",updatedAt:"2026-08-21T13:32:19.309Z"}
    ],
    leads:[],
    audit:[],
    updatedAt:"2026-08-22T04:34:34.000Z"
  };
}
