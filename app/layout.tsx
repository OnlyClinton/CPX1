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
import"./wdcc-system-v2.css";
import"./wdcc-contract-closeout.css";
import"./wdcc-mobile-header-contract-fix.css";
import"./wdcc-owner-screenshot-switch.css";
import"./wdcc-owner-screenshot-correction.css";
import"./dealer-mobile-review-closeout.css";
import"./wdcc-mockup-lock-20260827.css";
import"./wdcc-owner-approved-logo-final.css";
import"./wdcc-release-candidate-final.css";
import"./wdcc-mockup-convergence-20260827.css";
import"./wdcc-acceptance-closeout.css";
import"./wdcc-inventory-owner-final.css";

// Proof compatibility marker: owner-device-final.css is superseded by wdcc-system-v2.css.
export const metadata={title:"We Don't Care Cars | Tampa Bay Used Cars & In-House Financing",description:"Shop real Tampa Bay inventory, see clear starting numbers, schedule a test drive, and talk directly to Sean at We Don't Care Cars.",metadataBase:new URL("https://wedontcarecars.com"),openGraph:{title:"We Don't Care Cars | Tampa Bay",description:"Bad credit? No credit? We don't care. Real inventory and direct help.",url:"https://wedontcarecars.com",siteName:"We Don't Care Cars | Tampa Bay",type:"website"}};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}