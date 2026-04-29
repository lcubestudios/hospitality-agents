import { supabaseAdmin } from './server'

export async function getAuthedSupabaseAdmin() {
  return supabaseAdmin
}
