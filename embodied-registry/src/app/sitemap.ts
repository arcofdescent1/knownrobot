import type { MetadataRoute } from "next";
import { fieldNotes } from "@/lib/field-notes";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = "https://knownrobot.com";
  const updated = new Date("2026-09-15T00:00:00-06:00");
  const routes = ["", "/validator", "/sprints", "/thesis", "/field-notes", "/participate"];
  return [
    ...routes.map((route) => ({ url: `${origin}${route}`, lastModified: updated })),
    ...fieldNotes.map((note) => ({ url: `${origin}/field-notes/${note.slug}`, lastModified: updated })),
  ];
}
