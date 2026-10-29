import { AuthForm, PasswordFields } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { updatePassword } from "@/app/auth-actions";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/reset-password", "Choose a new password — Known Robot", "Choose a new KnownRobot password.", { index: false });
export default function ResetPasswordPage() { return <AuthShell eyebrow="Account recovery" title="Choose a new password" intro="Use the secure link from your reset email before submitting this form."><AuthForm action={updatePassword} label="Update password"><PasswordFields confirmation /></AuthForm></AuthShell>; }
