import type {ReactNode} from "react";
import "./dealer-target.css";
import DealerRouteGate from "./DealerRouteGate";

export default function DealerLayout({children}:{children:ReactNode}){
  return <DealerRouteGate>{children}</DealerRouteGate>;
}
