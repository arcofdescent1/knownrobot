import Link from "next/link";
import { ViewerControls } from "@/components/viewer-controls";
import { readViewerShell } from "@/lib/viewer-shell";
import { MobilePrimaryNavigation, PrimaryNavigation } from "@/components/active-navigation";

export async function SiteHeader() {
  const viewer = await readViewerShell();
  return <header className="topbar public-header">
    <Link className="brand" href="/" aria-label="Known Robot home"><span className="brand-mark">KR</span><span>Known Robot</span><span className="alpha">ALPHA</span></Link>
    <PrimaryNavigation />
    <MobilePrimaryNavigation />
    <div className="top-actions"><ViewerControls initialViewer={viewer}/></div>
  </header>;
}
