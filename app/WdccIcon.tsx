import type {SVGProps} from "react";

export type WdccIconName=
  |"application"
  |"arrow-right"
  |"badge"
  |"camera"
  |"car"
  |"chat"
  |"check"
  |"close"
  |"community"
  |"dollar"
  |"dollar-mark"
  |"handshake"
  |"home"
  |"image"
  |"key"
  |"menu"
  |"phone"
  |"telephone"
  |"pin"
  |"plus"
  |"shield"
  |"spark"
  |"square"
  |"diamond"
  |"check-mark"
  |"upload"
  |"users";

type Props=SVGProps<SVGSVGElement>&{name:WdccIconName};

export default function WdccIcon({name,...props}:Props){
  return <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{drawing(name)}</svg>;
}

function drawing(name:WdccIconName){
  switch(name){
    case "application":return <><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5v4h4M8.2 17.2c.5-1.4 1.6-2.2 3.3-2.2s2.8.8 3.3 2.2M11.5 12.8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></>;
    case "arrow-right":return <><path d="M5 12h14M14 7l5 5-5 5"/></>;
    case "badge":return <><path d="M12 2.8 15 5l3.7.4.4 3.6 2.1 3-2.1 3 .1 3.7-3.5.8L12 21l-3.1-1.3-3.5-.8.1-3.7-2.1-3 2.1-3 .4-3.6L9 5l3-2.2Z"/><path d="m9.2 12.1 1.8 1.8 3.9-4"/></>;
    case "camera":return <><path d="M4 7.5h3l1.4-2h7.2l1.4 2h3a1 1 0 0 1 1 1v9.7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="4"/></>;
    case "car":return <><path d="m4.2 10.2 1.7-4h12.2l1.7 4M3 11.2h18v6.2H3zM6.3 17.4v2M17.7 17.4v2M6.2 14.2h.1M17.7 14.2h.1"/><path d="M5.2 10.2h13.6"/></>;
    case "chat":return <><path d="M4 4.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"/><path d="M9 17.5h6l4 3v-3h1a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/></>;
    case "check":return <><circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.6 2.6 5.5-6"/></>;
    case "close":return <><path d="m6 6 12 12M18 6 6 18"/></>;
    case "community":return <><path d="M12 21s7-4.4 7-11V5.5L12 3 5 5.5V10c0 6.6 7 11 7 11Z"/><path d="M8.5 14.8c.5-1.7 1.7-2.6 3.5-2.6s3 .9 3.5 2.6M12 10.3a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z"/></>;
    case "dollar":return <><circle cx="12" cy="12" r="9"/><path d="M15.2 8.3c-.7-.8-1.7-1.2-3-1.2-1.8 0-3 .9-3 2.3 0 3.6 5.9 1.5 5.9 5 0 1.5-1.3 2.5-3.2 2.5-1.4 0-2.6-.5-3.4-1.4M12 5.3v13.4"/></>;
    case "dollar-mark":return <><path d="M15.2 7.5c-.7-.8-1.7-1.2-3-1.2-1.8 0-3 .9-3 2.3 0 3.6 5.9 1.5 5.9 5 0 1.5-1.3 2.5-3.2 2.5-1.4 0-2.6-.5-3.4-1.4M12 4.5v15"/></>;
    case "handshake":return <><path d="m3 9 4-4 4 2 2-1.2c1-.6 2.2-.4 3 .4L21 11M3 9l5.8 5.8a1.4 1.4 0 0 0 2-2l-1.1-1.1M21 11l-5.7 5.7a1.4 1.4 0 0 1-2-2l1.1-1.1"/><path d="m11 7 2.1 2.1a2 2 0 0 0 2.8 0l.8-.8"/></>;
    case "home":return <><path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6"/></>;
    case "image":return <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 4.5-4.5 3.3 3.3 2.2-2.2 6 6"/></>;
    case "key":return <><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/></>;
    case "menu":return <><path d="M4 6h16M4 12h16M4 18h16"/></>;
    case "phone":return <><path d="M7.3 3.5 4.7 5.2c-.9.6-1.2 1.8-.8 2.8 2.1 5.3 5.1 8.3 10.4 10.4 1 .4 2.2.1 2.8-.8l1.7-2.6-4.1-2-1.4 1.6c-2.2-1-4-2.8-5-5L9.8 8 7.3 3.5Z"/></>;
    case "telephone":return <><path d="M6.2 9.1c1.5-1.2 3.4-1.8 5.8-1.8s4.3.6 5.8 1.8l1.6-1.8c-1.9-1.8-4.4-2.7-7.4-2.7s-5.5.9-7.4 2.7l1.6 1.8Z"/><path d="M8 10v2.3l-2.2 2.2v4.2h12.4v-4.2L16 12.3V10M9.5 15.4h5M10 12h4"/></>;
    case "pin":return <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></>;
    case "plus":return <><path d="M12 5v14M5 12h14"/></>;
    case "shield":return <><path d="M12 21s7-4.4 7-11V5.5L12 3 5 5.5V10c0 6.6 7 11 7 11Z"/><path d="m8.8 11.7 2 2 4.3-4.5"/></>;
    case "spark":return <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/></>;
    case "square":return <><rect x="7" y="7" width="10" height="10" rx=".4"/></>;
    case "diamond":return <><path d="m12 6 6 6-6 6-6-6 6-6Z"/></>;
    case "check-mark":return <><path d="m6.5 12.2 3.4 3.4 7.6-8"/></>;
    case "upload":return <><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></>;
    case "users":return <><circle cx="9" cy="9" r="3"/><path d="M3.5 19c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.2.4 3.4 1.9 3.5 4"/></>;
  }
}
