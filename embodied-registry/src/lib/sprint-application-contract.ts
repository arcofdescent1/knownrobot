import { z } from "zod";

const optionalHttpsUrl = z.union([
  z.literal(""),
  z.url().refine((value) => new URL(value).protocol === "https:", "Use an HTTPS link."),
]);

export const sprintApplicationSchema = z.object({
  sprint_id: z.string().regex(/^sprint-[a-z0-9-]+$/),
  role: z.enum(["team", "reviewer", "event_lead"]),
  team_name: z.string().trim().max(120),
  environment: z.enum(["physical", "simulation", "both"]),
  configuration: z.string().trim().min(20).max(1500),
  evidence_url: optionalHttpsUrl,
  availability: z.string().trim().min(10).max(1000),
  commitment: z.literal("on", { message: "Confirm that you can complete the published sprint commitment." }),
  attribution_consent: z.literal("on", { message: "Consent to publish your profile and configuration if accepted." }),
}).superRefine((value, context) => {
  if (value.role === "team" && value.team_name.length < 2) {
    context.addIssue({ code: "custom", path: ["team_name"], message: "Enter the team or lab name." });
  }
});

export type SprintApplicationState = { ok: boolean; message: string };
export const initialSprintApplicationState: SprintApplicationState = { ok: false, message: "" };

