import { CampaignCreator } from '@/components/CampaignCreator'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

export default async function Home() {
  const supabase = await getAuthedSupabaseAdmin()
  const { data: brands } = await supabase.from('brands').select('id').limit(1)
  const brandId = brands?.[0]?.id

  if (!brandId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <p className="text-gray-500">No brand found. Please save a brand first.</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <CampaignCreator brandId={brandId} />
    </main>
  )
}
