import type {ReactNode} from "react";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Dealer Operations | We Don\u0027t Care Cars",robots:{index:false,follow:false,noarchive:true}};
import "./dealer-target.css";
import DealerRouteGate from "./DealerRouteGate";

export default function DealerLayout({children}:{children:ReactNode}){
  return <DealerRouteGate>{children}</DealerRouteGate>;
}
