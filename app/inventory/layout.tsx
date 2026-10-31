import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Used Car Inventory | We Don't Care Cars Tampa Bay",
  description:"Browse current used-vehicle listings, cash prices, mileage and estimated down payments. Verify availability before visiting.",
  alternates:{canonical:"/inventory"},
  openGraph:{title:"Used Car Inventory | We Don't Care Cars Tampa Bay",description:"Browse current used-vehicle listings, cash prices, mileage and estimated down payments. Verify availability before visiting.",url:"https://wedontcarecars.com/inventory"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
