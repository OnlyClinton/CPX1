import type {ReactNode} from "react";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import PortalServiceUnavailable from "../../PortalServiceUnavailable";
import {currentUser} from "../../../lib/auth";
import {isIsolatedWorkersDevPreview} from "../../../lib/visualPreviewGate";

export const dynamic="force-dynamic";

export default async function DealerInventoryLayout({children}:{children:ReactNode}){
  // The isolated visual-reference deployment has no private data authority.
  // Its API mutations remain authenticated; this only keeps screenshot proof deterministic.
  if(isIsolatedWorkersDevPreview(await headers()))return children;

  let user;
  try{user=await currentUser();}
  catch(error){
    console.error("WDCC_DEALER_INVENTORY_GUARD_UNAVAILABLE",error);
    return <PortalServiceUnavailable area="dealer inventory"/>;
  }
  if(!user)redirect("/login?next=%2Fdealer%2Finventory");
  if(user.role!=="dealer_agent"&&user.role!=="platform_admin")redirect("/login?error=role_required");
  return children;
}
