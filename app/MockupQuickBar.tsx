import Link from"next/link";
export default function MockupQuickBar(){return <nav className="mockup-quickbar" aria-label="Quick actions"><a href="tel:+18135164752">☎ Call</a><a href="sms:+18135164752">✉ Text</a><Link href="/get-approved?source=mobile-quickbar">Apply now</Link></nav>}
