import { z } from "zod";
import { manifestIssues } from "./manifest-contract";

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-]{2,38}$/,
    "Use 3–39 lowercase letters, numbers or dashes.",
  )
  .refine(
    (value) => !["admin", "knownrobot", "support", "system"].includes(value),
    "This handle is reserved.",
  );
const optionalLink = z.union([
  z.literal(""),
  z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use an HTTPS URL without credentials."),
]);
export const profileSchema = z.object({
  handle: handleSchema,
  display_name: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(1000),
  affiliation: z.string().trim().max(200),
  github_url: optionalLink,
  huggingface_url: optionalLink,
});
export const teamSchema = z.object({
  slug: handleSchema,
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000),
});
const object = z.record(z.string(), z.json());
export const submissionSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    summary: z.string().trim().min(20).max(2000),
    source_url: z.url().refine((value) => {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password;
    }),
    source_revision: z
      .string()
      .regex(/^[a-f0-9]{40,64}$/i, "Supply an immutable Git revision."),
    framework: z.string().trim().min(1).max(100),
    license: z.string().trim().min(1).max(100),
    manifest: object.superRefine((value, ctx) => {
      for (const message of manifestIssues(value)) ctx.addIssue({ code: "custom", message });
    }),
    robot_family: z.string().trim().min(2).max(100),
    configuration: object.refine((value) => Object.keys(value).length > 0),
    benchmark_name: z.string().trim().min(2).max(150),
    benchmark_version: z.string().trim().min(1).max(100),
    protocol: object.refine((value) => Object.keys(value).length > 0),
    trial_count: z.number().int().min(1).max(1000000),
    success_count: z.number().int().min(0),
    runtime: object.refine((value) => Object.keys(value).length > 0),
    evidence: z
      .array(
        z.object({
          label: z.string().trim().min(2).max(100),
          url: z.url().refine((value) => {
            const u = new URL(value);
            return u.protocol === "https:" && !u.username && !u.password;
          }),
        }),
      )
      .min(1)
      .max(20),
    team_id: z.uuid().nullable(),
  })
  .refine(
    (value) => value.success_count <= value.trial_count,
    "Successes cannot exceed trials.",
  );
export type IdentityActionState = { message: string; ok: boolean };
export const initialIdentityState: IdentityActionState = {
  message: "",
  ok: false,
};
