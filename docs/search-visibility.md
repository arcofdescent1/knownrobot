# Search visibility release contract

Known Robot's public identity is `https://knownrobot.com`. Every indexable HTML route has a self-canonical URL and matching Open Graph URL, title and description. The root layout deliberately supplies no canonical or sharing URL for child pages to inherit. Page metadata is centralized in `embodied-registry/src/lib/seo.ts`.

## Indexing rules

- Public thesis, validator, sprint, field-note, participation, adapter and correction pages are indexable in production. Known field-note slugs are generated at build time; unknown slugs return HTTP 404.
- The unfiltered live registry is indexable. Search, status filters and subsequent result pages are self-canonical but `noindex, follow`, allowing crawlers to discover evidence links without indexing result permutations.
- Published public evidence pages are self-canonical to their actual record ID. Demonstration, missing and unavailable evidence is not indexable. Unconfigured, demo and unavailable registry homepages are likewise excluded.
- Machine-readable evidence, badges, calendar, status and schema exports carry `X-Robots-Tag: noindex, follow`; they remain accessible to clients and crawlers. `robots.txt` must not block these paths, because crawlers need to fetch them to see that header.
- Builds with `VERCEL_ENV=preview` or `development` have noindex metadata, a global noindex response header and an empty sitemap. Static metadata and headers are build-time settings: deploy a production build to production, not a promoted preview-built artifact. Canonical identity remains the production domain in previews.

The dynamic sitemap includes indexable static pages, published field notes, and up to 30 latest genuine public evaluation records returned by the registry. Older records remain discoverable through pagination and permanent evidence links. Demos and unavailable data are never substituted. No invented modification dates are emitted. `robots.txt` advertises the production sitemap.

## Verification and release

From `embodied-registry`, run `npm test`, `npm run lint`, `npm run build`, `npm run test:smoke` and `npm run test:preview`. Smoke checks fetch built HTML using a crawler user agent and verify a single canonical, matching social URL, robots policy, crawler-head metadata, missing-note HTTP status, live/demo/outage behavior, sitemap contents and export headers. Preview checks rebuild in the preview environment, test both static and dynamic pages, then restore a production build even if a check fails. These checks also run in web CI.

After deploying, verify the same headers and tags on the public domain and confirm legacy-domain redirects point to the matching production path. Submit the sitemap in the domain owner's search-console accounts if desired; this implementation neither registers those accounts nor promises rankings or immediate indexing. Local release checks do not prove the currently deployed domain or platform redirect settings.
