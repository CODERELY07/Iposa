import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/marketplace/ProductCard'
import { Store, PackageX } from 'lucide-react'
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
      <div className="relative overflow-hidden border-b bg-hero-wash">
        <div className="mx-auto flex max-w-310 items-center gap-5 px-4 py-10 sm:px-6">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand-soft shadow-card">
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logo_url} alt={business.name} className="h-full w-full object-cover" />
            ) : (
              <Store className="size-8 text-primary/60" />
            )}
          </div>
          <div>
            <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground">{business.name}</h1>
            {business.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{business.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-310 px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load products: {error.message}
          </div>
        )}

        {!error && (products ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
              <PackageX className="size-6 text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">This shop hasn&apos;t listed any products yet.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(products as MarketplaceProduct[] ?? []).map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  )
}
