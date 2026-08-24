import type { Metadata } from "next";
import PublicPage from "../components/PublicPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How the WDCC website handles form details, anonymous conversion events and direct call or text requests.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PublicPage eyebrow="Effective August 23, 2026" title="Privacy policy." description="A plain-language summary of what the WDCC website records and what stays in your phone's call or text flow.">
      <div className="legal-copy">
        <h2>Information you choose to send</h2><p>Pre-approval, test-drive and contact forms prepare a text message on your device. You review the message before sending it to Sean. The website&apos;s analytics endpoint does not receive the name, phone, email, income range or other personal fields entered in those forms.</p>
        <h2>Anonymous site measurement</h2><p>The site records limited events such as page views, vehicle views, call clicks, text clicks, application starts and completed form-to-text actions. Events may include the page, vehicle, campaign parameters, referring site and a random session identifier. WDCC uses this information to understand which pages and marketing sources produce customer action.</p>
        <h2>Browser storage</h2><p>The site may store a random session identifier, first-touch campaign attribution and saved-vehicle preference in your browser. Public form details are not stored in browser storage by the storefront.</p>
        <h2>Service providers</h2><p>The website is hosted by Vercel and uses Vercel Web Analytics and Speed Insights for traffic and performance measurement. Calls and texts are handled by your phone carrier and messaging app.</p>
        <h2>Your choices</h2><p>You can avoid analytics browser storage by using your browser&apos;s privacy controls, and you can call Sean directly instead of using a form. For privacy questions, call 813-516-4752.</p>
      </div>
    </PublicPage>
  );
}
