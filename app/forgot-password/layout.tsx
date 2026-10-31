import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Reset Password | We Don't Care Cars",
  description:"Private account recovery.",
  robots:{index:false,follow:false,noarchive:true},
  openGraph:{title:"Reset Password | We Don't Care Cars",description:"Private account recovery.",url:"https://wedontcarecars.com/forgot-password"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
