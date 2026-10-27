import { SiteHeader } from "@/components/site-header";
import { ImportArtifactForm } from "@/components/artifact-forms";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/artifacts/import", "Import an upstream robot artifact — Known Robot", "Create a canonical, attributed KnownRobot record from approved GitHub or Hugging Face metadata.", { index: false });
export default function ImportPage() { return <><SiteHeader /><main className="editorial-page identity-page"><p className="eyebrow">Metadata-only import</p><h1>Import from GitHub or Hugging Face</h1><p>KnownRobot resolves your revision to an immutable commit and downloads only approved metadata files. It never executes policy code, downloads weights, or treats model-card claims as measured results.</p><ImportArtifactForm /></main></>; }
