"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const measurementId = "G-VX8E3S5LCB";
const consentKey = "knownrobot.analytics-consent.v1";
const consentEvent = "knownrobot:analytics-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type Consent = "accepted" | "declined" | null;

function subscribeToConsent(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(consentEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(consentEvent, callback);
  };
}

function consentSnapshot(): Consent {
  const saved = window.localStorage.getItem(consentKey);
  return saved === "accepted" || saved === "declined" ? saved : null;
}

function eventNameForLink(href: string) {
  if (href.includes("public-evaluation-artifact.yml")) return "artifact_submission_start";
  if (href.includes("problem-conversation.yml")) return "practitioner_conversation_start";
  if (href.includes("design-partner.yml")) return "design_partner_application_start";
  if (href.includes("sprint-application.yml")) return "sprint_application_start";
  if (href === "/submit" || href.startsWith("/submit?")) return "evaluation_submission_start";
  if (href.includes("docs/validator.md")) return "validator_guide_open";
  if (href === "/schema/robot-skill/1.0.json") return "validator_schema_download";
  return null;
}

function routeEvent(pathname: string) {
  if (pathname === "/artifacts/import") return "artifact_import_view";
  if (/^\/artifacts\/[^/]+$/.test(pathname)) return "artifact_detail_view";
  if (/^\/artifacts\/[^/]+\/collaborate$/.test(pathname)) return "artifact_collaboration_view";
  if (/^\/assessments\/[^/]+$/.test(pathname)) return "assessment_detail_view";
  if (pathname === "/assessments") return "assessment_index_view";
  if (pathname === "/validator") return "validator_view";
  if (pathname === "/participate") return "participation_view";
  if (pathname === "/sprints") return "sprint_view";
  return null;
}

function sendEvent(name: string, parameters: Record<string, string> = {}) {
  window.gtag?.("event", name, parameters);
}

export function Analytics() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeToConsent, consentSnapshot, () => null);

  useEffect(() => {
    if (consent !== "accepted" || !window.gtag) return;
    window.gtag("config", measurementId, {
      page_path: pathname,
      page_title: document.title,
    });
    const name = routeEvent(pathname);
    if (name) sendEvent(name, { page_path: pathname });
  }, [consent, pathname]);

  useEffect(() => {
    if (consent !== "accepted") return;
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      const name = eventNameForLink(href);
      if (name) sendEvent(name, { link_url: anchor.href, page_path: window.location.pathname });
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const workflowEvent = form.dataset.analyticsEvent;
      if (workflowEvent) {
        sendEvent(workflowEvent, { page_path: window.location.pathname });
      }
      if (window.location.pathname === "/submit") {
        const mode = new FormData(form).get("mode");
        sendEvent("evaluation_submit_attempt", {
          submission_mode: mode === "publish" ? "publish" : "draft",
        });
      }
    };
    document.addEventListener("click", click);
    document.addEventListener("submit", submit);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("submit", submit);
    };
  }, [consent]);

  const choose = (value: Exclude<Consent, null>) => {
    window.localStorage.setItem(consentKey, value);
    window.dispatchEvent(new Event(consentEvent));
  };

  return <>
    {consent === "accepted" && <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="knownrobot-google-analytics" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', '${measurementId}', { send_page_view: false, allow_google_signals: false });
      `}</Script>
    </>}
    {consent === null && <aside className="analytics-consent" aria-label="Analytics preference">
      <div><strong>Help improve KnownRobot.</strong><p>Optional Google Analytics measures which public evidence and workflows are useful. We do not send account form contents, policy files, email addresses, or private drafts.</p><a href="/privacy">Privacy details</a></div>
      <div><button type="button" onClick={() => choose("accepted")}>Allow analytics</button><button type="button" className="secondary" onClick={() => choose("declined")}>No thanks</button></div>
    </aside>}
  </>;
}
