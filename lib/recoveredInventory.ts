export const WDCC_RECOVERED_INVENTORY=[
  {
    id:"2004-nissan-350z",slug:"2004-nissan-350z",tenantId:"wdcc",year:2004,make:"Nissan",model:"350Z",trim:"",bodyStyle:"Car",condition:"Used",exteriorColor:"Black",interiorColor:"",transmission:"",drivetrain:"RWD",fuelType:"Gasoline",location:"Tampa Bay",price:4900,downPayment:2000,mileage:154000,vin:"",stock:"RECOVERED-2004-NISSAN-350Z",description:"2004 Nissan 350Z available from We Don't Care Cars in Tampa Bay.",features:[],badges:["RECOVERED"],featured:true,status:"published",internalOnly:false,visibility:"public",
    image:"/assets/cars/2004-nissan-350z-1.webp",primary_image_url:"/assets/cars/2004-nissan-350z-1.webp",images:["/assets/cars/2004-nissan-350z-1.webp","/assets/cars/2004-nissan-350z-2.webp","/assets/cars/2004-nissan-350z-3.webp","/assets/cars/2004-nissan-350z-4.webp"]
  },
  {
    id:"2016-ford-f150-limited",slug:"2016-ford-f150-limited",tenantId:"wdcc",year:2016,make:"Ford",model:"F-150",trim:"Limited",bodyStyle:"Truck",condition:"Used",exteriorColor:"White",interiorColor:"Black",transmission:"Automatic",drivetrain:"4x4",fuelType:"Gasoline",location:"Tampa Bay",price:15000,downPayment:6000,mileage:164000,vin:"",stock:"RECOVERED-2016-FORD-F150-LIM",description:"2016 Ford F-150 Limited available from We Don't Care Cars in Tampa Bay.",features:[],badges:["RECOVERED"],featured:true,status:"published",internalOnly:false,visibility:"public",
    image:"/assets/cars/2016-ford-f150-limited-1.webp",primary_image_url:"/assets/cars/2016-ford-f150-limited-1.webp",images:["/assets/cars/2016-ford-f150-limited-1.webp","/assets/cars/2016-ford-f150-limited-2.webp","/assets/cars/2016-ford-f150-limited-3.webp","/assets/cars/2016-ford-f150-limited-4.webp","/assets/cars/2016-ford-f150-limited-5.webp","/assets/cars/2016-ford-f150-limited-6.webp","/assets/cars/2016-ford-f150-limited-7.webp"]
  },
  {
    id:"2019-honda-pilot",slug:"2019-honda-pilot",tenantId:"wdcc",year:2019,make:"Honda",model:"Pilot",trim:"",bodyStyle:"SUV",condition:"Used",exteriorColor:"Black",interiorColor:"",transmission:"Automatic",drivetrain:"",fuelType:"Gasoline",location:"Tampa Bay",price:7900,downPayment:3000,mileage:380000,vin:"",stock:"RECOVERED-2019-HONDA-PILOT",description:"2019 Honda Pilot available from We Don't Care Cars in Tampa Bay.",features:[],badges:["RECOVERED"],featured:true,status:"published",internalOnly:false,visibility:"public",
    image:"/assets/cars/2019-honda-pilot-1.webp",primary_image_url:"/assets/cars/2019-honda-pilot-1.webp",images:["/assets/cars/2019-honda-pilot-1.webp"]
  },
  {
    id:"2019-kia-sportage",slug:"2019-kia-sportage",tenantId:"wdcc",year:2019,make:"Kia",model:"Sportage",trim:"",bodyStyle:"SUV",condition:"Used",exteriorColor:"Grey",interiorColor:"",transmission:"Automatic",drivetrain:"",fuelType:"Gasoline",location:"Tampa Bay",price:6500,downPayment:2500,mileage:127000,vin:"",stock:"RECOVERED-2019-KIA-SPORTAGE",description:"2019 Kia Sportage available from We Don't Care Cars in Tampa Bay.",features:[],badges:["RECOVERED"],featured:true,status:"published",internalOnly:false,visibility:"public",
    image:"/assets/cars/2019-kia-sportage-1.webp",primary_image_url:"/assets/cars/2019-kia-sportage-1.webp",images:["/assets/cars/2019-kia-sportage-1.webp"]
  },
  {
    id:"2019-toyota-rav4",slug:"2019-toyota-rav4",tenantId:"wdcc",year:2019,make:"Toyota",model:"RAV4",trim:"",bodyStyle:"SUV",condition:"Used",exteriorColor:"Black",interiorColor:"",transmission:"Automatic",drivetrain:"",fuelType:"Gasoline",location:"Tampa Bay",price:10500,downPayment:4500,mileage:240000,vin:"",stock:"RECOVERED-2019-TOYOTA-RAV4",description:"2019 Toyota RAV4 available from We Don't Care Cars in Tampa Bay.",features:[],badges:["RECOVERED"],featured:true,status:"published",internalOnly:false,visibility:"public",
    image:"/assets/cars/2019-toyota-rav4-1.webp",primary_image_url:"/assets/cars/2019-toyota-rav4-1.webp",images:["/assets/cars/2019-toyota-rav4-1.webp","/assets/cars/2019-toyota-rav4-2.webp"]
  }
] as const;

export type RecoveredVehicle=(typeof WDCC_RECOVERED_INVENTORY)[number];
