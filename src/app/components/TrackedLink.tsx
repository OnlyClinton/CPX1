"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackEvent, type WdccEventName } from "../lib/analytics";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  eventName: WdccEventName;
  eventData?: Record<string, string | number | boolean | null>;
};

export default function TrackedLink({ children, eventName, eventData, onClick, ...props }: Props) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackEvent(eventName, eventData);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
