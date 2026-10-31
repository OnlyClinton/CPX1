import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Complete Password Reset | We Don't Care Cars",
  description:"Private reset flow.",
  robots:{index:false,follow:false,noarchive:true},
  openGraph:{title:"Complete Password Reset | We Don't Care Cars",description:"Private reset flow.",url:"https://wedontcarecars.com/reset-password"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
