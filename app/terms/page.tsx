import { Footer, Header } from "../components";
export default function TermsPage() {
	return (
		<>
			<Header />
			<main className="section light">
				<div className="wrap leadPage">
					<div className="eyebrow muted">TERMS</div>
					<h1>Website Terms</h1>
					<p>
						Vehicle availability, pricing, mileage, down-payment examples,
						financing options, and other listing details can change and should
						be confirmed directly with the dealer before purchase.
					</p>
					<p>
						Submitting a test-drive, contact, or financing-interest form does
						not guarantee vehicle availability, financing approval, a particular
						rate, or a completed transaction.
					</p>
					<p>
						Use this site only for lawful purposes and provide accurate
						information when requesting dealer follow-up. Final transaction
						documents and lender/dealer disclosures control if they differ from
						general website information.
					</p>
					<p>
						Questions about a listing or these terms can be directed to WDCC
						through the Contact page or by calling 813-516-4752.
					</p>
				</div>
			</main>
			<Footer />
		</>
	);
}
