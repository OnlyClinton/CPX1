import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Website Terms | We Don't Care Cars",
  description:"Review the We Don't Care Cars website terms and limitations.",
  alternates:{canonical:"/terms"},
  openGraph:{title:"Website Terms | We Don't Care Cars",description:"Review the We Don't Care Cars website terms and limitations.",url:"https://wedontcarecars.com/terms"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
