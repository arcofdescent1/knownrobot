"use client";
import { useActionState, type ReactNode } from "react";
import {
  initialIdentityState,
  type IdentityActionState,
} from "@/lib/identity-contract";
export function IdentityForm({
  action,
  children,
  label,
  disabled = false,
}: {
  action: (
    state: IdentityActionState,
    form: FormData,
  ) => Promise<IdentityActionState>;
  children: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, initialIdentityState);
  return (
    <form action={submit} className="identity-form">
      <fieldset disabled={pending || disabled}>
        {children}
        <button type="submit">{pending ? "Working…" : label}</button>
      </fieldset>
      <p aria-live="polite" role={state.ok ? "status" : "alert"}>
        {state.message}
      </p>
    </form>
  );
}
