import Link from "next/link";

export function ActionEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  compact = false,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  compact?: boolean;
}) {
  return <div className={`action-empty-state${compact ? " compact" : ""}`} role="status">
    <div><h3>{title}</h3><p>{description}</p></div>
    <Link className="primary-link" href={actionHref}>{actionLabel} <span aria-hidden="true">→</span></Link>
  </div>;
}
