export type VehicleStatus = "available" | "pending" | "sold" | "archived";

export type Vehicle = {
  id: string;
  slug: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  payment: number;
  downPayment: number;
  mileage: number;
  bodyType: "Car" | "Truck" | "SUV";
  transmission: string;
  drivetrain: string;
  engine: string;
  exterior: string;
  interior: string;
  vin: string;
  badges: string[];
  images: string[];
  description: string;
  highlights: string[];
  featured: boolean;
  status: VehicleStatus;
};

export const heroImage = "/wdcc-hero-v2.webp";

export const inventoryVehicles: Vehicle[] = [
  {
    id: "veh-001",
    slug: "2004-nissan-350z",
    year: 2004,
    make: "Nissan",
    model: "350Z",
    trim: "",
    price: 4900,
    payment: 0,
    downPayment: 2000,
    mileage: 154000,
    bodyType: "Car",
    transmission: "Call for details",
    drivetrain: "RWD",
    engine: "3.5L V6",
    exterior: "Call for details",
    interior: "Call for details",
    vin: "Call Sean",
    badges: ["Available"],
    images: [
      "/assets/cars/2004-nissan-350z-1.webp",
      "/assets/cars/2004-nissan-350z-2.webp",
      "/assets/cars/2004-nissan-350z-3.webp",
      "/assets/cars/2004-nissan-350z-4.webp",
    ],
    description: "Dealer-listed 2004 Nissan 350Z. Call or text Sean for current condition, equipment and availability details.",
    highlights: ["In-house financing", "$2,000 listed down payment", "Direct help from Sean"],
    featured: true,
    status: "available",
  },
  {
    id: "veh-002",
    slug: "2016-ford-f150-limited",
    year: 2016,
    make: "Ford",
    model: "F-150",
    trim: "Limited",
    price: 15000,
    payment: 0,
    downPayment: 6000,
    mileage: 164000,
    bodyType: "Truck",
    transmission: "Automatic",
    drivetrain: "Call for details",
    engine: "Call for details",
    exterior: "Call for details",
    interior: "Call for details",
    vin: "Call Sean",
    badges: ["Available"],
    images: [
      "/assets/cars/2016-ford-f150-limited-1.webp",
      "/assets/cars/2016-ford-f150-limited-2.webp",
      "/assets/cars/2016-ford-f150-limited-3.webp",
      "/assets/cars/2016-ford-f150-limited-4.webp",
      "/assets/cars/2016-ford-f150-limited-5.webp",
      "/assets/cars/2016-ford-f150-limited-6.webp",
      "/assets/cars/2016-ford-f150-limited-7.webp",
    ],
    description: "Dealer-listed 2016 Ford F-150 Limited. Call or text Sean for current condition, equipment and availability details.",
    highlights: ["Limited trim", "$6,000 listed down payment", "Direct help from Sean"],
    featured: true,
    status: "available",
  },
  {
    id: "veh-003",
    slug: "2019-honda-pilot",
    year: 2019,
    make: "Honda",
    model: "Pilot",
    trim: "",
    price: 7900,
    payment: 0,
    downPayment: 3000,
    mileage: 380000,
    bodyType: "SUV",
    transmission: "Automatic",
    drivetrain: "Call for details",
    engine: "3.5L V6",
    exterior: "Call for details",
    interior: "Call for details",
    vin: "Call Sean",
    badges: ["Available"],
    images: ["/assets/cars/2019-honda-pilot-1.webp"],
    description: "Dealer-listed 2019 Honda Pilot. Call or text Sean for current condition, equipment and availability details.",
    highlights: ["Three-row SUV", "380,000 listed miles — confirm current reading", "$3,000 listed down payment"],
    featured: true,
    status: "available",
  },
  {
    id: "veh-004",
    slug: "2019-kia-sportage",
    year: 2019,
    make: "Kia",
    model: "Sportage",
    trim: "",
    price: 6500,
    payment: 0,
    downPayment: 2500,
    mileage: 127000,
    bodyType: "SUV",
    transmission: "Automatic",
    drivetrain: "Call for details",
    engine: "Call for details",
    exterior: "Call for details",
    interior: "Call for details",
    vin: "Call Sean",
    badges: ["Available"],
    images: ["/assets/cars/2019-kia-sportage-1.webp"],
    description: "Dealer-listed 2019 Kia Sportage. Call or text Sean for current condition, equipment and availability details.",
    highlights: ["Compact SUV", "$2,500 listed down payment", "Direct help from Sean"],
    featured: true,
    status: "available",
  },
  {
    id: "veh-005",
    slug: "2019-toyota-rav4",
    year: 2019,
    make: "Toyota",
    model: "RAV4",
    trim: "",
    price: 10500,
    payment: 0,
    downPayment: 4500,
    mileage: 240000,
    bodyType: "SUV",
    transmission: "Automatic",
    drivetrain: "Call for details",
    engine: "2.5L I4",
    exterior: "Call for details",
    interior: "Call for details",
    vin: "Call Sean",
    badges: ["Available"],
    images: [
      "/assets/cars/2019-toyota-rav4-1.webp",
      "/assets/cars/2019-toyota-rav4-2.webp",
    ],
    description: "Dealer-listed 2019 Toyota RAV4. Call or text Sean for current condition, equipment and availability details.",
    highlights: ["Compact SUV", "$4,500 listed down payment", "Direct help from Sean"],
    featured: true,
    status: "available",
  },
];

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export const formatMiles = (value: number) => `${Math.round(value / 100) * 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
