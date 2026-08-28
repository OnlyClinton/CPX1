import Link from "next/link";

export default function PortalServiceUnavailable({area}:{area:string}){
  return <main style={{minHeight:"100svh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at 50% 0%,#15324b,#071522 40%,#03090f 78%)",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"}}>
    <section role="alert" style={{width:"min(560px,100%)",border:"1px solid #2d4458",borderRadius:16,background:"#0a1723",padding:28,boxShadow:"0 24px 70px #0008"}}>
      <span style={{color:"#ef3344",fontSize:11,fontWeight:950,letterSpacing:".14em"}}>503 · SECURE ACCESS TEMPORARILY UNAVAILABLE</span>
      <h1 style={{margin:"9px 0 10px",fontSize:"clamp(30px,6vw,48px)",letterSpacing:"-.045em"}}>Your {area} data is still protected.</h1>
      <p style={{margin:"0 0 20px",color:"#b6c5d1",lineHeight:1.55}}>WDCC could not verify the secure portal session, so no private data was shown. Retry when the connection is restored.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <a href="" style={{display:"inline-flex",minHeight:44,alignItems:"center",justifyContent:"center",padding:"0 16px",borderRadius:7,background:"#ed1c2e",color:"#fff",fontSize:12,fontWeight:900}}>Retry secure access</a>
        <Link href="/" style={{display:"inline-flex",minHeight:44,alignItems:"center",justifyContent:"center",padding:"0 16px",border:"1px solid #3b5366",borderRadius:7,color:"#e5edf3",fontSize:12,fontWeight:800}}>Return to storefront</Link>
      </div>
    </section>
  </main>;
}
