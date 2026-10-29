import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { requestPasswordReset } from "@/app/auth-actions";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/forgot-password", "Reset password — Known Robot", "Request a secure KnownRobot password reset.", { index: false });
export default function ForgotPasswordPage() { return <AuthShell eyebrow="Account recovery" title="Reset your password" intro="Enter your account email. The response is identical whether or not an account exists." footer={<Link href="/login">Return to login</Link>}><AuthForm action={requestPasswordReset} label="Send reset link"><label htmlFor="reset-email">Email<input id="reset-email" name="email" type="email" autoComplete="email" required maxLength={254} /></label></AuthForm></AuthShell>; }
