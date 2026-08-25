import LeadForm from "../LeadForm";
import { Footer, Header } from "../components";
export default function Page() {
	return (
		<>
			<Header />
			<main className="section light">
				<div className="wrap leadPage">
					<div className="eyebrow muted">START HERE</div>
					<h1>Get Approved</h1>
					<p>
						Start the conversation without a hard-credit application on this
						page.
					</p>
					<LeadForm kind="approval" source="get-approved" />
				</div>
			</main>
			<Footer />
		</>
	);
}
