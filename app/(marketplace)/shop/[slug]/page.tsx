import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/marketplace/ProductCard'
import OfferingCard from '@/components/marketplace/OfferingCard'
import { Store, PackageX, MapPinned, Sparkles } from 'lucide-react'
import type { MarketplaceProduct, MarketplaceOffering } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, description, logo_url, banner_url, status, address, location_lat, location_lng')
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()

  if (!business) {
    notFound()
  }

  const [{ data: products, error }, { data: offerings }] = await Promise.all([
    supabase
      .from('marketplace_products')
      .select('*')
      .eq('business_slug', slug)
      .order('created_at', { ascending: false }),
    // Only the non-POS half — every retail item above already covers
    // requires_pos = true via marketplace_products, unchanged.
    supabase
      .from('marketplace_offerings')
      .select('*')
      .eq('business_slug', slug)
      .eq('requires_pos', false)
      .order('sort_order', { ascending: true }),
  ])

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
            {business.address && (
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinned className="size-3.5 shrink-0 text-primary" />
                {business.address}
                {business.location_lat != null && business.location_lng != null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${business.location_lat}&mlon=${business.location_lng}#map=17/${business.location_lat}/${business.location_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View on map
                  </a>
                )}
              </p>
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

        {!error && (products ?? []).length === 0 && (offerings ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
              <PackageX className="size-6 text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">This shop hasn&apos;t listed anything yet.</p>
          </div>
        )}

        {(products ?? []).length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(products as MarketplaceProduct[] ?? []).map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {(offerings ?? []).length > 0 && (
          <div className={(products ?? []).length > 0 ? 'mt-10' : ''}>
            <h2 className="mb-3 flex items-center gap-1.5 font-serif text-lg font-normal tracking-tight text-foreground">
              <Sparkles className="size-4 text-primary" /> Services &amp; requests
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              These aren&apos;t bought through a cart — send a request and {business.name} will follow up directly.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(offerings as MarketplaceOffering[] ?? []).map(o => (
                <OfferingCard key={o.id} offering={o} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
