import { supabaseAdmin } from './server'
import { getCurrentUserId } from '../auth'

export async function getAuthedSupabaseAdmin() {
  const userId = await getCurrentUserId()
  await supabaseAdmin.auth.admin.signInAsUser(userId)
  return supabaseAdmin
}
