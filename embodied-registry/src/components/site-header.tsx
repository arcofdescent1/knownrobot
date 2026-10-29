import Link from "next/link";
import { ViewerControls } from "@/components/viewer-controls";
import { readViewerShell } from "@/lib/viewer-shell";

export async function SiteHeader() {
  const viewer = await readViewerShell();
  return <header className="topbar public-header">
    <Link className="brand" href="/" aria-label="Known Robot home"><span className="brand-mark">KR</span><span>Known Robot</span><span className="alpha">ALPHA</span></Link>
    <nav aria-label="Primary navigation"><Link href="/discover">Discover</Link><Link href="/artifacts">Artifacts</Link><Link href="/collections">Collections</Link><Link href="/discussions">Discussions</Link><Link href="/validator">Validator</Link><Link href="/assessments">Assessments</Link><Link href="/sprints">Sprints</Link><Link href="/terms">Terms</Link></nav>
    <details className="mobile-nav"><summary aria-label="Open navigation">Menu</summary><nav aria-label="Mobile navigation"><Link href="/discover">Discover</Link><Link href="/artifacts">Artifacts</Link><Link href="/collections">Collections</Link><Link href="/discussions">Discussions</Link><Link href="/validator">Validator</Link><Link href="/assessments">Assessments</Link><Link href="/sprints">Sprints</Link><Link href="/terms">Terms</Link></nav></details>
    <div className="top-actions"><ViewerControls initialViewer={viewer}/></div>
  </header>;
}
