import { redirect } from 'next/navigation'
import { BrandPanel } from '@/components/BrandPanel'
import { CampaignCreator } from '@/components/CampaignCreator'
import { SideNav } from '@/components/SideNav'
import { getSession } from '@/lib/session'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

export default async function Home() {
  const session = await getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const supabase = await getAuthedSupabaseAdmin()
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, description, brand_voice')
    .eq('id', session.brandId)
    .single()

  if (!brand) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <p className="text-gray-500">Brand not found.</p>
      </main>
    )
  }

  return (
    <>
      <SideNav brandId={brand.id} brandName={brand.name} />
      <main className="ml-64 min-h-screen bg-gray-100 p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold text-gray-800">Campaign Creator</h1>
          <BrandPanel
            id={brand.id}
            name={brand.name}
            description={brand.description ?? ''}
            brand_voice={brand.brand_voice ?? ''}
          />
          <CampaignCreator brandId={brand.id} />
        </div>
      </main>
    </>
  )
}
