import { Footer, Header } from "../components";
export default function PrivacyPage() {
	return (
		<>
			<Header />
			<main className="section light">
				<div className="wrap leadPage">
					<div className="eyebrow muted">PRIVACY</div>
					<h1>Privacy Notice</h1>
					<p>
						When you submit a WDCC form, we may collect the contact information
						and vehicle/request details you provide, plus basic referral and
						campaign attribution used to understand where the request came from.
					</p>
					<p>
						We use that information to respond to your request, support dealer
						operations, prevent duplicate submissions, and maintain an audit
						trail. We do not ask for payment-card information on these lead
						forms.
					</p>
					<p>
						By checking the consent box on a request form, you agree that WDCC
						may contact you about that request using the contact information you
						provided. You can ask us to stop marketing communications at any
						time.
					</p>
					<p>
						For privacy questions or requests, use the Contact page or call Sean
						at 813-516-4752.
					</p>
				</div>
			</main>
			<Footer />
		</>
	);
}
