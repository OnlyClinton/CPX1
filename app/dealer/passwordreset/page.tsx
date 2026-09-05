import { redirect } from "next/navigation";

/**
 * Legacy dealer recovery compatibility route.
 * Keep password recovery canonicalized through the secure WDCC recovery flow.
 */
export default function DealerPasswordResetRedirect() {
  redirect("/forgot-password");
}
