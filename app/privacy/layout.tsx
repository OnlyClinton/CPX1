import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Privacy Notice | We Don't Care Cars",
  description:"Read the We Don't Care Cars privacy notice covering site information and customer inquiries.",
  alternates:{canonical:"/privacy"},
  openGraph:{title:"Privacy Notice | We Don't Care Cars",description:"Read the We Don't Care Cars privacy notice covering site information and customer inquiries.",url:"https://wedontcarecars.com/privacy"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
