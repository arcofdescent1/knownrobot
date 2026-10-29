"use client";
import { useActionState, type ReactNode } from "react";
import { initialAuthState, type AuthActionState } from "@/lib/auth-contract";

export function AuthForm({ action, label, children }: { action: (state: AuthActionState, form: FormData) => Promise<AuthActionState>; label: string; children: ReactNode }) {
  const [state, submit, pending] = useActionState(action, initialAuthState);
  return <form action={submit} className="auth-form"><fieldset disabled={pending}>{children}<button className="auth-submit" type="submit">{pending ? "Working…" : label}</button></fieldset>{state.message ? <p className={state.ok ? "form-success" : "form-error"} aria-live="polite" role={state.ok ? "status" : "alert"}>{state.message}</p> : null}</form>;
}
export function PasswordFields({ confirmation = false }: { confirmation?: boolean }) {
  return <><label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} aria-describedby="password-help" /></label><p id="password-help" className="field-help">At least 10 characters with uppercase, lowercase, and a number.</p>{confirmation ? <label htmlFor="confirm-password">Confirm password<input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></label> : null}</>;
}
