import { supabaseAdmin } from './supabase/server'

export async function uploadImageToStorage(file: File, campaignId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${campaignId}/original.${ext}`

  const { error } = await supabaseAdmin.storage
    .from('campaign-uploads')
    .upload(path, file, { upsert: true })

  if (error) throw new Error(error.message)

  const { data } = supabaseAdmin.storage.from('campaign-uploads').getPublicUrl(path)

  return data.publicUrl
}
