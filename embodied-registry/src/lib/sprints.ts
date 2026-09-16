import "server-only";
import data from "@/data/sprint-01.json";
import { sprintSchema, sprintState } from "./sprint-contract";

export const sprint = sprintSchema.parse(data);
export function currentSprintView() {
  const now = new Date();
  return { state: sprintState(sprint, now), applicationsOpen: now >= new Date(sprint.schedule.applicationsOpen) && now < new Date(sprint.schedule.applicationsClose) && !sprint.cancelled };
}
