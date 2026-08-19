import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Constructed lazily, on first property access, rather than at module load —
// eager construction throws when env vars are absent, which broke Next.js's
// build-time page data collection (it imports every route's module graph
// without those vars present, e.g. in CI).
let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return client
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
})
