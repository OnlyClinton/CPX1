// Read-only customer recovery inventory.
// These are the five last-verified real WDCC public records from the stable storefront.
// They are used only when the canonical public inventory provider is unavailable.
// The preview-only image derivatives below come from first-party media embedded in
// WDCC_V54_BACKEND_SNAPSHOT_20260709_004713.json and are never presented as live media.
// They must never be mutated through this module.

import nissan350zImage from "../app/recoveredVisualMedia/nissan350z";
import fordF150Image from "../app/recoveredVisualMedia/fordF150";
import hondaPilotImage from "../app/recoveredVisualMedia/hondaPilot";
import kiaSportageImage from "../app/recoveredVisualMedia/kiaSportage";
import toyotaRav4Image from "../app/recoveredVisualMedia/toyotaRav4";

export const WDCC_RECOVERY_INVENTORY_EVIDENCE="v54-20260709-first-party-media+2vfd-stable-public-five";

export const WDCC_RECOVERY_INVENTORY=[
  {id:"recovery-2004-nissan-350z",slug:"2004-nissan-350z",tenantId:"wdcc",year:2004,make:"Nissan",model:"350Z",trim:"",price:4900,downPayment:2000,mileage:154000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"Convertible",transmission:"",drivetrain:"RWD",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:nissan350zImage},
  {id:"recovery-2016-ford-f150-limited",slug:"2016-ford-f150-limited",tenantId:"wdcc",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"Truck",transmission:"Automatic",drivetrain:"4x4",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:fordF150Image},
  {id:"recovery-2019-honda-pilot",slug:"2019-honda-pilot",tenantId:"wdcc",year:2019,make:"Honda",model:"Pilot",trim:"",price:7900,downPayment:3000,mileage:380000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"Automatic",drivetrain:"AWD",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:hondaPilotImage},
  {id:"recovery-2019-kia-sportage",slug:"2019-kia-sportage",tenantId:"wdcc",year:2019,make:"Kia",model:"Sportage",trim:"",price:6500,downPayment:2500,mileage:127000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"FWD",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:kiaSportageImage},
  {id:"recovery-2019-toyota-rav4",slug:"2019-toyota-rav4",tenantId:"wdcc",year:2019,make:"Toyota",model:"RAV4",trim:"",price:10500,downPayment:4500,mileage:240000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"AWD",photoPathnames:[],primaryPhotoPathname:null,primary_image_url:toyotaRav4Image}
] as const;

export function recoveryInventoryPayload(upstreamStatus:number){
  const items=WDCC_RECOVERY_INVENTORY.map(item=>({...item}));
  return {
    ok:true,
    live:false,
    count:items.length,
    items,
    recoveryFallback:true,
    inventorySource:"verified-recovery-readonly",
    sourceEvidence:WDCC_RECOVERY_INVENTORY_EVIDENCE,
    upstreamStatus,
    availabilityNotice:"Verified historical recovery inventory with recovered first-party media. Confirm current availability with Sean at 813-516-4752."
  };
}
