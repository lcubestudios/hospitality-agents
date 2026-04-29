import { BrandPanel } from '@/components/BrandPanel'
import { CampaignCreator } from '@/components/CampaignCreator'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

export default async function Home() {
  const supabase = await getAuthedSupabaseAdmin()
  const { data: brands } = await supabase.from('brands').select('id, name, description').limit(1)
  const brand = brands?.[0]

  if (!brand) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <p className="text-gray-500">No brand found. Please save a brand first.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <BrandPanel id={brand.id} name={brand.name} description={brand.description ?? ''} />
        <CampaignCreator brandId={brand.id} />
      </div>
    </main>
  )
}
