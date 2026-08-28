import"./globals.css";
import"./routing.css";
import"./premium.css";
import"./crm.css";
import"./dealer-reference.css";
import"./dealer-dashboard-reference.css";
import"./reference-clone.css";
import"./dealer-editor-final.css";
import"./dealer-dashboard-final.css";
import"./interior-pages-final.css";
import"./responsive-modules-final.css";
import"./responsive-public-detail-final.css";
import"./approval-board-final.css";
import"./inventory-owner-final.css";
import"./legal-credit.css";
import"./wdcc-owner-board-final.css";
import"./wdcc-round-header-contract.css";
import"./owner-supplied-board-final-lock.css";

export const metadata={title:"We Don't Care Cars | Tampa Bay Used Cars & In-House Financing",description:"Shop real Tampa Bay inventory, see clear starting numbers, schedule a test drive, and talk directly to Sean at We Don't Care Cars.",metadataBase:new URL("https://wedontcarecars.com"),openGraph:{title:"We Don't Care Cars | Tampa Bay",description:"Bad credit? No credit? We don't care. Real inventory and direct help.",url:"https://wedontcarecars.com",siteName:"We Don't Care Cars | Tampa Bay",type:"website"}};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<div className="wdcc-global-legal" data-wdcc-legal-credit="cpx-chyphnx"><span>© 2026 We Don&apos;t Care Cars. All Rights Reserved.</span><span>Designed &amp; engineered by <a href="https://cpx.agency" rel="noopener noreferrer">CPX.agency</a> · <strong>CHYPHNX</strong></span></div></body></html>}
