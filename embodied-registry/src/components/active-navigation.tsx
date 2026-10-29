"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  sections?: string[];
};

const primaryItems: NavigationItem[] = [
  { href: "/discover", label: "Discover" },
  { href: "/artifacts", label: "Artifacts", sections: ["/artifacts", "/evaluations", "/hardware"] },
  { href: "/collections", label: "Collections" },
  { href: "/discussions", label: "Discussions" },
  { href: "/validator", label: "Validator" },
  { href: "/assessments", label: "Assessments" },
  { href: "/sprints", label: "Sprints" },
  { href: "/terms", label: "Terms", sections: ["/terms", "/privacy"] },
];

const accountItems: NavigationItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/contributions", label: "Contributions" },
  { href: "/organizations", label: "Organizations" },
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/security", label: "Security" },
];

function isCurrent(pathname: string, item: NavigationItem) {
  const sections = item.sections || [item.href];
  return sections.some(section => pathname === section || pathname.startsWith(`${section}/`));
}

function NavigationLinks({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  return items.map(item => {
    const current = isCurrent(pathname, item);
    return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={current ? "nav-active" : undefined}>{item.label}</Link>;
  });
}

export function PrimaryNavigation() {
  return <nav aria-label="Primary navigation"><NavigationLinks items={primaryItems} /></nav>;
}

export function MobilePrimaryNavigation() {
  const pathname = usePathname();
  const activeLabel = primaryItems.find(item => isCurrent(pathname, item))?.label;
  return <details className="mobile-nav"><summary aria-label={activeLabel ? `Open navigation, current section: ${activeLabel}` : "Open navigation"}><span>Menu</span>{activeLabel ? <strong>{activeLabel}</strong> : null}</summary><nav aria-label="Mobile navigation"><NavigationLinks items={primaryItems} /></nav></details>;
}

export function AccountNavigation() {
  return <nav className="account-nav" aria-label="Account navigation"><NavigationLinks items={accountItems} /></nav>;
}
