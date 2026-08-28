import type {ReactNode} from "react";
import {redirect} from "next/navigation";
import PortalServiceUnavailable from "../PortalServiceUnavailable";
import {PortalAuthProvider,type PortalAuthState} from "../PortalAuthContext";
import {currentUser} from "../../lib/auth";

export const dynamic="force-dynamic";

export default async function AdminLayout({children}:{children:ReactNode}){
  let user;
  try{user=await currentUser();}
  catch(error){
    console.error("WDCC_ADMIN_GUARD_UNAVAILABLE",error);
    return <PortalServiceUnavailable area="admin portal"/>;
  }
  if(!user)redirect("/login?next=%2Fadmin");
  if(user.role!=="platform_admin")redirect("/dealer?error=admin_required");
  const value:PortalAuthState={
    role:"platform_admin",
    displayName:String(user.displayName||user.username||"WDCC Admin").trim().slice(0,120)||"WDCC Admin"
  };
  return <PortalAuthProvider value={value}>{children}</PortalAuthProvider>;
}
