import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/verify-email", "Verify your email — Known Robot", "Verify your KnownRobot account email.", { index: false });
export default function VerifyEmailPage() { return <AuthShell eyebrow="One more step" title="Verify your email" intro="Open the verification message from KnownRobot. After verification, return here and log in."><p>Email verification prevents impersonation and account abuse. It does not verify professional affiliation or artifact ownership.</p><p><Link className="button-link" href="/login">Continue to login</Link></p></AuthShell>; }
