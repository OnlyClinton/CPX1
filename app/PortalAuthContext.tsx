"use client";

import {createContext,useContext,type ReactNode} from "react";

export type PortalAuthState={
  role:"platform_admin"|"dealer_agent";
  displayName:string;
};

const PortalAuthContext=createContext<PortalAuthState|null>(null);

export function PortalAuthProvider({value,children}:{value:PortalAuthState;children:ReactNode}){
  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth(){
  return useContext(PortalAuthContext);
}
