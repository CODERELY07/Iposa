import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/marketplace/ProductCard'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

type SearchParams = {
  category?: string
  business?: string
  min_price?: string
  max_price?: string
  q?: string
}

export const revalidate = 0

export default async function MarketplaceHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase.from('marketplace_products').select('*').order('created_at', { ascending: false })

  if (params.category) query = query.eq('category_slug', params.category)
  if (params.business) query = query.eq('business_slug', params.business)
  if (params.min_price) query = query.gte('price', Number(params.min_price))
  if (params.max_price) query = query.lte('price', Number(params.max_price))
  if (params.q) query = query.ilike('name', `%${params.q}%`)

  const [{ data: products, error }, { data: categories }, { data: businesses }] = await Promise.all([
    query,
    supabase.from('categories').select('id, name, slug').not('slug', 'is', null).order('name'),
    supabase.from('businesses').select('id, name, slug').eq('status', 'approved').order('name'),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Discover products from local shops</h1>
        <p className="text-sm text-zinc-500 mt-1">Browse everything on the marketplace, or narrow it down below.</p>
      </div>

      <form className="bg-white border border-zinc-200 rounded-xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <div className="col-span-2 sm:col-span-1 space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Product name…"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Category</label>
          <select
            name="category"
            defaultValue={params.category ?? ''}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">All categories</option>
            {(categories ?? []).map(c => (
              <option key={c.id} value={c.slug ?? ''}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Shop</label>
          <select
            name="business"
            defaultValue={params.business ?? ''}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">All shops</option>
            {(businesses ?? []).map(b => (
              <option key={b.id} value={b.slug}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Min price</label>
          <input
            type="number" min="0" step="0.01" name="min_price" defaultValue={params.min_price ?? ''}
            placeholder="₱0"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Max price</label>
            <input
              type="number" min="0" step="0.01" name="max_price" defaultValue={params.max_price ?? ''}
              placeholder="Any"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <button
            type="submit"
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition h-[38px] self-end"
          >
            Filter
          </button>
        </div>
      </form>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
          Failed to load products: {error.message}
        </div>
      )}

      {!error && (products ?? []).length === 0 && (
        <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
          No products match your filters yet.{' '}
          <Link href="/" className="text-blue-600 hover:underline">Clear filters</Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {(products as MarketplaceProduct[] ?? []).map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}
