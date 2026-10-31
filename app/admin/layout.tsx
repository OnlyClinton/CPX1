import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Admin Portal | We Don't Care Cars",
  description:"Restricted administration.",
  robots:{index:false,follow:false,noarchive:true},
  openGraph:{title:"Admin Portal | We Don't Care Cars",description:"Restricted administration.",url:"https://wedontcarecars.com/admin"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
