/**
 * Server-side Supabase client (singleton).
 *
 * The app has no user login, so this is a plain client on the publishable
 * key — no cookies or session handling. Anchored on globalThis because
 * Next.js bundles each API route separately and a module-level instance
 * would not be shared between routes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const g = globalThis as unknown as { __supabase?: SupabaseClient };

export function getSupabase(): SupabaseClient {
  if (!g.__supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) {
      throw new Error(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env."
      );
    }
    g.__supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      // global: {
      //   // Next.js patches global fetch and may cache GETs in its Data Cache;
      //   // database reads must always be live, so opt every request out.
      //   fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      // },
    });
  }
  return g.__supabase;
}
