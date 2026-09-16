import type { Metadata } from "next";
import { registryUrl, type RegistryFilters } from "./evidence-contract";

export const siteOrigin = "https://knownrobot.com";
export function isPreview() { return process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development"; }
export const publicPages = ["/", "/validator", "/sprints", "/thesis", "/field-notes", "/participate", "/adapters", "/corrections"] as const;
export function pageMetadata(path: string, title: string, description: string, options: { index?: boolean; article?: boolean; published?: string } = {}): Metadata {
  if (!path.startsWith("/") || path.startsWith("//") || new URL(path, siteOrigin).origin !== siteOrigin) throw new Error("Metadata paths must remain on Known Robot");
  const url = new URL(path, siteOrigin).href;
  return {
    title, description, alternates: { canonical: url },
    robots: { index: options.index !== false && !isPreview(), follow: true },
    openGraph: { type: options.article ? "article" : "website", siteName: "Known Robot", title, description, url, ...(options.published ? { publishedTime: options.published } : {}) },
    twitter: { card: "summary_large_image", title, description },
  };
}
export function registryMetadata(filters: RegistryFilters, state: string): Metadata {
  return pageMetadata(registryUrl(filters), "Known Robot — LeRobot Policy Compatibility & Reproduction", "Explore robot-policy compatibility and reproduction evidence for low-cost LeRobot arms, starting with SO-100 and SO-101. Check configurations and review results.", { index: state === "live" && !filters.query && !filters.status && filters.page === 1 });
}
