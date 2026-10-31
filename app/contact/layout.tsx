import type {Metadata} from "next";
import type {ReactNode} from "react";
export const metadata:Metadata={
  title:"Contact We Don't Care Cars | Tampa Bay",
  description:"Call or message the We Don't Care Cars sales team to confirm vehicle availability, hours and appointment options.",
  alternates:{canonical:"/contact"},
  openGraph:{title:"Contact We Don't Care Cars | Tampa Bay",description:"Call or message the We Don't Care Cars sales team to confirm vehicle availability, hours and appointment options.",url:"https://wedontcarecars.com/contact"}
};
export default function Layout({children}:{children:ReactNode}){return children;}
