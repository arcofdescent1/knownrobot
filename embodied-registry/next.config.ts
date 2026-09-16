import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  headers() {
    const exports = ["record.json", "manifest.json", "citation.json", "credits.json", "badge.svg"].map(name => `/evaluations/:id/${name}`);
    const sources = [...exports, "/sprints/status.json", "/adapters/record.json", "/reproduction-sprints.ics", "/schema/robot-skill/:version.json"];
    if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") sources.push("/:path*");
    return sources.map(source => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }] }));
  },
};

export default nextConfig;
