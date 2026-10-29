import { z } from "zod";

const password = z.string().min(10, "Use at least 10 characters.").max(128).regex(/[a-z]/, "Include a lowercase letter.").regex(/[A-Z]/, "Include an uppercase letter.").regex(/[0-9]/, "Include a number.");
export const emailSchema = z.email("Enter a valid email address.").max(254).transform(value => value.trim().toLowerCase());
export const signUpSchema = z.object({ email: emailSchema, password, confirm_password: z.string(), terms: z.literal("on") }).refine(value => value.password === value.confirm_password, { path: ["confirm_password"], message: "Passwords do not match." });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const resetRequestSchema = z.object({ email: emailSchema });
export const passwordUpdateSchema = z.object({ password, confirm_password: z.string() }).refine(value => value.password === value.confirm_password, { path: ["confirm_password"], message: "Passwords do not match." });
export type AuthActionState = { ok: boolean; message: string };
export const initialAuthState: AuthActionState = { ok: false, message: "" };
