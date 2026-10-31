import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Ask About Auto Financing | We Don't Care Cars",
  description:"Contact the WDCC team to discuss vehicle and financing options. Inquiry does not guarantee approval or terms.",
  alternates:{canonical:"/get-approved"},
  openGraph:{title:"Ask About Auto Financing | We Don't Care Cars",description:"Contact the WDCC team to discuss vehicle and financing options. Inquiry does not guarantee approval or terms.",url:"https://wedontcarecars.com/get-approved"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
