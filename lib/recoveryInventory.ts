// Read-only customer recovery inventory.
// These are the five last-verified real WDCC public records from the stable storefront.
// They are used only when the canonical public inventory provider is unavailable.
// They must never be presented as live or mutated through this module.

export const WDCC_RECOVERY_INVENTORY_EVIDENCE="2vfd-stable-public-five";

export const WDCC_RECOVERY_INVENTORY=[
  {id:"recovery-2004-nissan-350z",slug:"2004-nissan-350z",tenantId:"wdcc",year:2004,make:"Nissan",model:"350Z",trim:"",price:4900,downPayment:2000,mileage:154000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"Car",transmission:"",drivetrain:"RWD",photoPathnames:[],primaryPhotoPathname:null},
  {id:"recovery-2016-ford-f150-limited",slug:"2016-ford-f150-limited",tenantId:"wdcc",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"Truck",transmission:"Automatic",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null},
  {id:"recovery-2019-honda-pilot",slug:"2019-honda-pilot",tenantId:"wdcc",year:2019,make:"Honda",model:"Pilot",trim:"",price:7900,downPayment:3000,mileage:380000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"Automatic",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null},
  {id:"recovery-2019-kia-sportage",slug:"2019-kia-sportage",tenantId:"wdcc",year:2019,make:"Kia",model:"Sportage",trim:"",price:6500,downPayment:2500,mileage:127000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null},
  {id:"recovery-2019-toyota-rav4",slug:"2019-toyota-rav4",tenantId:"wdcc",year:2019,make:"Toyota",model:"RAV4",trim:"",price:10500,downPayment:4500,mileage:240000,status:"published",visibility:"public",internalOnly:false,bodyStyle:"SUV",transmission:"",drivetrain:"",photoPathnames:[],primaryPhotoPathname:null}
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
    availabilityNotice:"Verified recovery inventory. Confirm current availability with Sean at 813-516-4752."
  };
}
