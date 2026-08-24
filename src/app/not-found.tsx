import PublicPage from "./components/PublicPage";

export default function NotFound() {
  return <PublicPage eyebrow="404" title="That page isn't here." description="The vehicle may have moved or the link may be outdated." primaryLabel="Browse current inventory" primaryHref="/inventory"><section className="content-panel"><h2>Need help?</h2><p>Call or text Sean at 813-516-4752 to ask about current inventory.</p></section></PublicPage>;
}
