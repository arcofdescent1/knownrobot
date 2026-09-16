import { sprint } from "@/lib/sprints";
import { sprintCalendar } from "@/lib/sprint-calendar";
export const dynamic = "force-dynamic";
export function GET() {
  return new Response(sprintCalendar(sprint), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "attachment; filename=reproduction-sprints.ics", "Cache-Control": "no-store" } });
}
