import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
export function AuthShell({ eyebrow, title, intro, children, footer }: { eyebrow: string; title: string; intro: string; children: ReactNode; footer?: ReactNode }) {
  return <><SiteHeader /><main className="auth-page"><section className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-intro">{intro}</p>{children}{footer ? <div className="auth-footer">{footer}</div> : null}<p className="auth-boundary"><Link href="/privacy">Privacy and account-data boundaries</Link></p></section></main></>;
}
