import Link from "next/link";

export function SiteHeader() {
  return <header className="topbar public-header">
    <Link className="brand" href="/" aria-label="Known Robot home"><span className="brand-mark">KR</span><span>Known Robot</span><span className="alpha">ALPHA</span></Link>
    <nav aria-label="Primary navigation"><Link href="/">Registry</Link><Link href="/validator">Validator</Link><Link href="/assessments">Assessments</Link><Link href="/sprints">Sprints</Link><Link href="/thesis">Thesis</Link><Link href="/field-notes">Field notes</Link><Link href="/participate">Participate</Link><Link href="/account">Account</Link></nav>
    <div className="top-actions"><Link className="mobile-account-link" href="/account">Account</Link><Link className="primary-link" href="/sprints">Reproduction sprints <span>↗</span></Link></div>
  </header>;
}
