import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
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
    <AppShell
      brand={{
        id: brand.id,
        name: brand.name,
        description: brand.description ?? '',
        brand_voice: brand.brand_voice ?? '',
      }}
    />
  )
}
