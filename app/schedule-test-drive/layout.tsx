import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Request a Test Drive | We Don't Care Cars",
  description:"Ask about a used vehicle and request an appointment with the WDCC Tampa Bay sales team. Confirm before visiting.",
  alternates:{canonical:"/schedule-test-drive"},
  openGraph:{title:"Request a Test Drive | We Don't Care Cars",description:"Ask about a used vehicle and request an appointment with the WDCC Tampa Bay sales team. Confirm before visiting.",url:"https://wedontcarecars.com/schedule-test-drive"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
