export type ActivationSignals = {
  profileComplete: boolean;
  artifactStarted: boolean;
  evidenceAction: boolean;
  collaborationAction: boolean;
  artifactSlug?: string;
  artifactTitle?: string;
};

export type ActivationStep = {
  id: "profile" | "artifact" | "evidence" | "collaboration";
  number: number;
  title: string;
  description: string;
  complete: boolean;
  href: string;
  action: string;
};

export function buildActivationJourney(signals: ActivationSignals) {
  const artifactHref = signals.artifactSlug ? `/artifacts/${signals.artifactSlug}` : "/discover";
  const discussionHref = signals.artifactSlug ? `/artifacts/${signals.artifactSlug}/discussions` : "/discussions";
  const steps: ActivationStep[] = [
    { id: "profile", number: 1, title: "Complete your contributor profile", description: "Choose a public handle so your work receives durable attribution.", complete: signals.profileComplete, href: "/settings/profile", action: "Complete profile" },
    { id: "artifact", number: 2, title: "Import or follow one artifact", description: "Start from a revision-pinned policy, dataset, repository, or hardware record.", complete: signals.artifactStarted, href: signals.profileComplete ? "/discover" : "/settings/profile", action: signals.profileComplete ? "Choose an artifact" : "Complete profile first" },
    { id: "evidence", number: 3, title: "Validate metadata or request missing evidence", description: signals.artifactTitle ? `Improve what is known about ${signals.artifactTitle}.` : "Correct metadata, attach evidence, or open a focused evidence request.", complete: signals.evidenceAction, href: signals.artifactStarted ? discussionHref : artifactHref, action: signals.artifactStarted ? "Request missing evidence" : "Choose an artifact first" },
    { id: "collaboration", number: 4, title: "Save it to a collection or join its discussion", description: "Make the artifact easier to rediscover and move the shared record forward.", complete: signals.collaborationAction, href: signals.artifactStarted ? discussionHref : "/collections", action: signals.artifactStarted ? "Join the discussion" : "Browse collections" },
  ];
  const completed = steps.filter(step => step.complete).length;
  const recommended = steps.find(step => !step.complete) ?? { id: "collaboration" as const, number: 5, title: "Keep the record useful", description: "Find another artifact that needs evidence, correction, or review.", complete: false, href: "/discover?evidence=needs-evidence", action: "Find evidence opportunities" };
  return { steps, completed, total: steps.length, percent: Math.round(completed / steps.length * 100), recommended, complete: completed === steps.length };
}
