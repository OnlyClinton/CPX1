import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Dealer Login | We Don't Care Cars",
  description:"Authorized dealer sign-in.",
  robots:{index:false,follow:false,noarchive:true},
  openGraph:{title:"Dealer Login | We Don't Care Cars",description:"Authorized dealer sign-in.",url:"https://wedontcarecars.com/login"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
