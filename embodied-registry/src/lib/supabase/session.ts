import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export function emailAuthReady() {
  return process.env.KNOWNROBOT_EMAIL_AUTH_READY === "true";
}
export async function getSessionClient() {
  // Reading the request cookie jar before checking configuration keeps every
  // account-aware header request-bound instead of accidentally prerendering a
  // signed-out header during a build that omits runtime credentials.
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        // Server Components cannot write; the account proxy refreshes their cookies.
        try {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        } catch {
          /* Read-only rendering. */
        }
      },
    },
  });
}
export async function requireIdentity() {
  const client = await getSessionClient();
  if (!client) redirect("/login");
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) redirect("/login");
  return { client, user };
}
