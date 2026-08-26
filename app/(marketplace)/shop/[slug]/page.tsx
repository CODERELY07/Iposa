import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/marketplace/ProductCard'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, description, logo_url, banner_url, status')
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()

  if (!business) {
    notFound()
  }

  const { data: products, error } = await supabase
    .from('marketplace_products')
    .select('*')
    .eq('business_slug', slug)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logo_url} alt={business.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">🏪</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{business.name}</h1>
            {business.description && (
              <p className="text-sm text-zinc-500 mt-1 max-w-2xl">{business.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
            Failed to load products: {error.message}
          </div>
        )}

        {!error && (products ?? []).length === 0 && (
          <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
            This shop hasn&apos;t listed any products yet.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(products as MarketplaceProduct[] ?? []).map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  )
}
