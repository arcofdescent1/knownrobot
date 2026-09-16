import { Sprint, sprintState } from "./sprint-contract";

export function sprintCalendar(s: Sprint, now = new Date()) {
  const escape = (v: string) => v.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const stamp = (v: string | Date) => new Date(v).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const state = sprintState(s, now);
  const status = state.status === "Cancelled" ? "CANCELLED" : state.ready && s.start ? "CONFIRMED" : "TENTATIVE";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Known Robot//Reproduction Sprints//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const [event, start] of [["kickoff", s.schedule.kickoff], ["results", s.schedule.results]]) {
    lines.push("BEGIN:VEVENT", `UID:${s.id.replace("sprint-", "sprint")}-${event}@knownrobot.com`, `DTSTAMP:${stamp(s.updatedAt)}`, `SEQUENCE:${s.calendarVersion}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(Date.parse(start) + 3600000))}`, `STATUS:${status}`, `SUMMARY:${escape(`Known Robot ${s.id} ${event}${status === "TENTATIVE" ? " (provisional)" : ""}`)}`, `DESCRIPTION:${escape(`${state.status}. Check the public readiness record before attending. Dates do not imply confirmed participation.`)}`, "URL:https://knownrobot.com/sprints", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 folds by UTF-8 octets, not JavaScript character count.
  return lines.map(line => {
    let out = "", bytes = 0;
    for (const ch of line) {
      const size = Buffer.byteLength(ch);
      if (bytes + size > 75) { out += "\r\n "; bytes = 1; }
      out += ch; bytes += size;
    }
    return out;
  }).join("\r\n") + "\r\n";
}
