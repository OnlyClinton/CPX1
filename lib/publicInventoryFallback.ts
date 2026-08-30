export type PublicInventoryVehicle={
  id:string;
  slug:string;
  year:number;
  make:string;
  model:string;
  trim?:string;
  price:number;
  downPayment:number;
  mileage:number;
  primary_image_url:string;
  bodyStyle:string;
  transmission?:string;
  drivetrain?:string;
  description:string;
  status:"published";
};

export const PUBLIC_INVENTORY_FALLBACK:PublicInventoryVehicle[]=[
  {id:"2004-nissan-350z",slug:"2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,primary_image_url:"/assets/cars/2004-nissan-350z-1.webp",bodyStyle:"Car",drivetrain:"RWD",description:"Available WDCC Tampa Bay vehicle. Call Sean to confirm current details and schedule a test drive.",status:"published"},
  {id:"2016-ford-f150-limited",slug:"2016-ford-f150-limited",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,primary_image_url:"/assets/cars/2016-ford-f150-limited-1.webp",bodyStyle:"Truck",transmission:"Automatic",drivetrain:"4x4",description:"Available WDCC Tampa Bay vehicle. Call Sean to confirm current details and schedule a test drive.",status:"published"},
  {id:"2019-honda-pilot",slug:"2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,primary_image_url:"/assets/cars/2019-honda-pilot-1.webp",bodyStyle:"SUV",transmission:"Automatic",description:"Available WDCC Tampa Bay vehicle. Call Sean to confirm current details and schedule a test drive.",status:"published"},
  {id:"2019-kia-sportage",slug:"2019-kia-sportage",year:2019,make:"Kia",model:"Sportage",price:6500,downPayment:2500,mileage:127000,primary_image_url:"/assets/cars/2019-kia-sportage-1.webp",bodyStyle:"SUV",description:"Available WDCC Tampa Bay vehicle. Call Sean to confirm current details and schedule a test drive.",status:"published"},
  {id:"2019-toyota-rav4",slug:"2019-toyota-rav4",year:2019,make:"Toyota",model:"RAV4",price:10500,downPayment:4500,mileage:240000,primary_image_url:"/assets/cars/2019-toyota-rav4-1.webp",bodyStyle:"SUV",description:"Available WDCC Tampa Bay vehicle. Call Sean to confirm current details and schedule a test drive.",status:"published"}
];

export function fallbackVehicle(id:string){
  const key=String(id||"").trim().toLowerCase();
  return PUBLIC_INVENTORY_FALLBACK.find(vehicle=>vehicle.id===key||vehicle.slug===key);
}
