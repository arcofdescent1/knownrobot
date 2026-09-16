# Known Robot indexing and search-intent audit

Audited September 16, 2026. This report separates deployed observations from local improvements; crawlability is not a guarantee of indexing or rankings.

## Deployed observations

- All 12 URLs in the public XML sitemap return HTTP 200 to a crawler user agent, with canonical URLs on knownrobot.com, unique titles/descriptions, and index/follow metadata. No global noindex header was present on these pages.
- Google Search Console's aggregate indexing report is still processing. Homepage URL Inspection reports **Discovered — currently not indexed**, identifies the submitted sitemap, and shows no prior crawl or Google-selected canonical.
- Google's homepage live test reports **URL is available to Google** and **Page can be indexed**. This rules out a current homepage fetch/indexing prohibition, not every possible future crawl issue.
- HTTP redirects to HTTPS with status 308. HTTPS www and the legacy embodied-registry.vercel.app alias still return 200 on /validator rather than redirecting. Their canonical identity points to the apex site.
- The public registry has no real published evaluations yet. Do not replace this with demonstration evidence to attract search traffic.

## Search intent and local improvements

These are qualitative topic choices based on the product and public LeRobot calibration/transfer documentation, not measured keyword volume or Search Console query demand.

| Route | Intended question | Improvement |
| --- | --- | --- |
| / | Where can I find LeRobot policy compatibility and reproduction evidence? | Name LeRobot compatibility in title and heading; state SO-100/SO-101 scope in visible copy. |
| /validator | How do I check policy metadata and compare declared configurations? | Descriptive CLI title, reproducibility heading, hardware scope, and explicit limits on physical-transfer claims. |
| /thesis | What is needed to reproduce a LeRobot policy on an SO-101? | Replace internal project-phase search description with the actual technical problem and scope. |
| /field-notes/* | Why does transfer fail, and what metadata is missing? | Existing descriptive article titles already answer these questions; retain them. |

No new client scripts, tracking services, fabricated testimonials, reviews, or keyword doorway pages were added. Existing preview, filtered-search, missing-record, and outage noindex policies remain intact. Regression tests explicitly cover these boundaries.

## Remaining actions

1. Publish the tested local wording changes, then recheck custom-domain metadata.
2. Configure path-preserving permanent redirects for www and the legacy public alias after checking platform domain settings. This audit did not change those settings.
3. Request homepage indexing through Search Console with owner approval. No indexing request was submitted during this audit.
4. Inspect validator and thesis URLs separately when Google's reports populate; current homepage evidence must not be presented as their Google indexing status.
5. Publish the first real reproducibility record with contributor consent, immutable sources, actual hardware and calibration, trial protocol, failures, and appropriate review status.
6. Earn links from participating GitHub repositories and Hugging Face model cards. Bing/IndexNow and directory submissions remain separate work.

Sources: [Google Search Essentials](https://developers.google.com/search/docs/essentials), [Google title-link guidance](https://developers.google.com/search/docs/appearance/title-link), [LeRobot SO-101 calibration documentation](https://github.com/huggingface/lerobot/blob/main/docs/source/so101.mdx).
