import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/marketplace/ProductCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, PackageX, Store, PackageSearch } from 'lucide-react'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

type SearchParams = {
  category?: string
  business?: string
  min_price?: string
  max_price?: string
  q?: string
}

export const revalidate = 0

// Native <select>s here (not the shadcn Select) on purpose: this filter bar
// is a plain GET <form>, so it has to keep working without client JS —
// styled to match the design-pattern chrome (h-9.5 8px radius) directly.
const fieldClass =
  'h-9.5 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

// Stand-in texture for photography — a soft brand-gradient wash crossed with
// a diagonal stripe, used wherever the hero has no real image to show.
const placeholderTexture =
  'bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--foreground),transparent_92%)_0px,color-mix(in_oklch,var(--foreground),transparent_92%)_1px,transparent_1px,transparent_18px),var(--gradient-brand-soft)]'

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

  const [
    { data: products, error },
    { data: categories },
    { data: businesses },
    { count: totalProductCount },
    { count: approvedShopCount },
  ] = await Promise.all([
    query,
    supabase.from('categories').select('id, name, slug').not('slug', 'is', null).order('name'),
    supabase
      .from('businesses')
      .select('id, name, slug, description, logo_url')
      .eq('status', 'approved')
      .order('name'),
    supabase.from('marketplace_products').select('*', { count: 'exact', head: true }),
    supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
  ])

  const hasFilters = Boolean(params.category || params.business || params.min_price || params.max_price || params.q)
  const activeCategory = (categories ?? []).find(c => c.slug === params.category)
  const list = (products as MarketplaceProduct[]) ?? []
  const featuredShops = (businesses ?? []).slice(0, 3)

  // Builds a browse-page link that keeps every current filter except the
  // ones being overridden, and always lands back on the filter bar.
  function buildHref(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides }
    const sp = new URLSearchParams()
    ;(['q', 'category', 'business', 'min_price', 'max_price'] as const).forEach(key => {
      const value = merged[key]
      if (value) sp.set(key, value)
    })
    const qs = sp.toString()
    return `/${qs ? `?${qs}` : ''}#browse`
  }

  // Plain DM Sans (not the mono micro-label): active = solid brand-gradient
  // pill, inactive = outlined with a colored hover state.
  const chipClass = (active: boolean) =>
    `inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-all ${
      active
        ? 'border-transparent bg-gradient-brand text-white shadow-glow-primary'
        : 'border-input bg-card text-foreground hover:-translate-y-px hover:border-primary/40 hover:text-primary'
    }`

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-border bg-hero-wash">
        <div className="mx-auto grid max-w-310 gap-10 px-4 py-16 sm:px-7 sm:py-14 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div>
            <span className="label-mono inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-2.75 py-1.5 shadow-sm">
              <span className="block size-1.5 rounded-full bg-gradient-brand" />
              <Sparkles className="size-3.5 text-primary" /> Fresh finds from local shops
            </span>
            <h1 className="mt-5.5 text-pretty font-serif text-[42px] font-normal leading-[1.03] tracking-[-0.02em] text-foreground sm:text-[60px]">
              Everything your neighbourhood <em className="italic text-gradient-brand not-italic">already</em> makes well.
            </h1>
            <p className="mt-4.5 max-w-[44ch] text-base leading-[1.6] text-muted-foreground">
              One marketplace for the small shops, kitchens and makers within a short ride of you.
              Browse the whole catalogue, or narrow it to exactly what you came for.
            </p>

            <form action="/#browse" method="get" className="mt-6.5 flex max-w-115 gap-2.5">
              <Input
                type="text"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Search products…"
                className="h-11.5 flex-1 rounded-[9px] border-input bg-card px-3.75 text-[15px] shadow-sm"
              />
              <Button type="submit" className="h-11.5 shrink-0 rounded-[9px] px-5 text-[15px] font-medium">
                Browse
              </Button>
            </form>

            <div className="mt-8.5 flex gap-8.5 border-t border-border/70 pt-6.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--brand-violet),transparent_88%)] text-primary">
                  <PackageSearch className="size-4" />
                </span>
                <div>
                  <div className="font-serif text-[27px] leading-none text-foreground">{totalProductCount ?? 0}</div>
                  <div className="label-mono mt-1">Products live</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--brand-teal),transparent_88%)] text-[color:var(--brand-teal)]">
                  <Store className="size-4" />
                </span>
                <div>
                  <div className="font-serif text-[27px] leading-none text-foreground">{approvedShopCount ?? 0}</div>
                  <div className="label-mono mt-1">Approved shops</div>
                </div>
              </div>
              <div className="hidden items-center gap-2.5 sm:flex">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--brand-amber),transparent_88%)] text-[color:var(--brand-amber)]">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <div className="font-serif text-[27px] leading-none text-foreground">Same day</div>
                  <div className="label-mono mt-1">Local pickup</div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden h-115 grid-cols-2 grid-rows-2 gap-3.5 md:grid">
            <div className={`row-span-2 flex items-end rounded-[14px] border border-border p-3.5 shadow-card ${placeholderTexture}`}>
              <span className="label-mono rounded-[5px] border border-border bg-background/90 px-1.75 py-1 backdrop-blur-sm">
                shop interior
              </span>
            </div>
            <div className={`flex items-end rounded-[14px] border border-border p-3.5 shadow-card ${placeholderTexture}`}>
              <span className="label-mono rounded-[5px] border border-border bg-background/90 px-1.75 py-1 backdrop-blur-sm">
                maker at work
              </span>
            </div>
            <div className={`flex items-end rounded-[14px] border border-border p-3.5 shadow-card ${placeholderTexture}`}>
              <span className="label-mono rounded-[5px] border border-border bg-background/90 px-1.75 py-1 backdrop-blur-sm">
                product detail
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Category chips */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-310 items-center gap-2.5 overflow-x-auto px-4 py-5.5 sm:px-7">
          <span className="label-mono shrink-0 pr-1.5">Shop by</span>
          <Link href={buildHref({ category: '' })} className={chipClass(!params.category)}>
            Everything
          </Link>
          {(categories ?? []).map(c => (
            <Link key={c.id} href={buildHref({ category: c.slug ?? '' })} className={chipClass(params.category === c.slug)}>
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <div id="browse" className="mx-auto max-w-310 px-4 py-8.5 pb-20 sm:px-7">
        <div className="sticky top-16.5 z-10 -mx-4 mb-1.5 border-b border-border bg-background px-4 py-3 sm:-mx-7 sm:px-7">
          <form className="grid grid-cols-2 items-end gap-2.5 sm:grid-cols-[1.6fr_1fr_1fr_0.8fr_0.8fr_auto]">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <label className="label-mono block">Search</label>
              <Input type="text" name="q" defaultValue={params.q ?? ''} placeholder="Product name…" className="h-9.5 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="label-mono block">Category</label>
              <select name="category" defaultValue={params.category ?? ''} className={fieldClass}>
                <option value="">All categories</option>
                {(categories ?? []).map(c => (
                  <option key={c.id} value={c.slug ?? ''}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="label-mono block">Shop</label>
              <select name="business" defaultValue={params.business ?? ''} className={fieldClass}>
                <option value="">All shops</option>
                {(businesses ?? []).map(b => (
                  <option key={b.id} value={b.slug}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="label-mono block">Min ₱</label>
              <Input type="number" min="0" step="0.01" name="min_price" defaultValue={params.min_price ?? ''} placeholder="0" className="h-9.5 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="label-mono block">Max ₱</label>
              <Input type="number" min="0" step="0.01" name="max_price" defaultValue={params.max_price ?? ''} placeholder="Any" className="h-9.5 text-sm" />
            </div>

            <div className="flex gap-1.5">
              <Button
                variant="outline"
                type="button"
                className="h-9.5 rounded-lg border-input px-3.75 text-sm font-normal text-muted-foreground"
                render={<Link href="/#browse" />}
              >
                Reset
              </Button>
              <Button type="submit" className="h-9.5 rounded-lg px-3.75 text-sm">Filter</Button>
            </div>
          </form>
        </div>

        <div className="my-5.5 flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-[29px] font-normal tracking-[-0.01em] text-foreground">
            {activeCategory ? activeCategory.name : 'Fresh on the marketplace'}
          </h2>
          <span className="label-mono shrink-0 text-[11.5px] tracking-[0.06em]">
            {list.length} {list.length === 1 ? 'product' : 'products'}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load products: {error.message}
          </div>
        )}

        {!error && list.length === 0 && (
          <div className="mb-4 flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-input bg-card py-18.5 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
              <PackageX className="size-6 text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">No products match your filters yet.</p>
            {hasFilters && (
              <Button variant="outline" size="sm" render={<Link href="/#browse" />}>Clear filters</Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {list.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>

      {/* Shops worth following */}
      {featuredShops.length > 0 && (
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-310 px-4 py-17.5 sm:px-7">
            <h2 className="mb-6.5 font-serif text-[34px] font-normal tracking-[-0.015em] text-foreground">
              Shops worth following
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredShops.map(shop => (
                <Link
                  key={shop.id}
                  href={`/shop/${shop.slug}`}
                  className="card-interactive flex flex-col gap-3.5 rounded-[14px] border border-border bg-background p-4.5 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-brand-soft">
                      {shop.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="size-5 text-primary/60" />
                      )}
                    </div>
                    <div className="min-w-0 text-[15px] font-medium text-foreground">{shop.name}</div>
                  </div>
                  {shop.description && (
                    <p className="line-clamp-2 text-sm leading-[1.55] text-muted-foreground">{shop.description}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-310 px-4 py-14 sm:px-7">
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-brand px-6 py-12 shadow-glow-primary sm:px-12 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-20" />
            <div className="relative flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="max-w-[22ch] font-serif text-[32px] font-normal leading-[1.1] tracking-[-0.015em] text-white sm:text-[38px]">
                  Selling here takes an afternoon to set up.
                </h2>
                <p className="mt-3.5 max-w-[52ch] text-base leading-[1.6] text-white/80">
                  List your products, pick pickup or delivery, get paid locally. No monthly fee — we
                  take a flat cut per order.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2.5">
                <Button
                  size="lg"
                  className="h-11.5 rounded-[9px] bg-white px-5.5 text-[15px] font-medium text-primary shadow-none hover:bg-white/90 hover:brightness-100"
                  render={<Link href="/register-business" />}
                >
                  Open a shop
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11.5 rounded-[9px] border-white/30 bg-transparent px-5.5 text-[15px] font-normal text-white hover:border-white/60 hover:bg-white/10 hover:text-white"
                  render={<Link href="/become-affiliate" />}
                >
                  Become an affiliate
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
