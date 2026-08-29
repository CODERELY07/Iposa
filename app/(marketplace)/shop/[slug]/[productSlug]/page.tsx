import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import ProductPageActions from '@/components/marketplace/ProductPageActions'
import ShareProductButton from '@/components/marketplace/ShareProductButton'
import { Badge } from '@/components/ui/badge'
import CategoryBadge from '@/components/marketplace/CategoryBadge'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, PackageOpen } from 'lucide-react'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productSlug: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { slug, productSlug } = await params
  const { ref } = await searchParams
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('marketplace_products')
    .select('*')
    .eq('business_slug', slug)
    .eq('slug', productSlug)
    .maybeSingle<MarketplaceProduct>()

  if (!product) {
    notFound()
  }

  // Only an approved affiliate gets a code-tagged share link, and only when
  // this product's own shop has actually turned commissions on — place_order()
  // silently skips creating a commission row for a business with no enabled
  // business_affiliate_settings row (see database_schema.sql), so handing out
  // a tagged link for one would earn nothing no matter how many sales it
  // drives, with no error or feedback anywhere. Everyone else (and every
  // product from a shop that hasn't opted in) just shares the plain URL.
  //
  // affiliateCommission answers the "is this even worth sharing?" question
  // up front, in pesos, instead of making the affiliate infer it from a
  // yes/no toggle: null means "not applicable" (not an affiliate, or this
  // page's own product lookup failed some check), 0 means "shareable, but
  // this shop isn't enrolled in the affiliate program so it pays nothing",
  // and a positive number is the real per-unit payout — computed server-side
  // by affiliate_product_commission() since the profit math needs
  // recipes/ingredients/cost_price, none of which this page (or an
  // affiliate) has direct row access to.
  let affiliateCode: string | null = null
  let affiliateCommission: number | null = null
  const role = await getCurrentUserRole()
  if (role === 'affiliate') {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const [{ data: affiliate }, { data: affiliateSettings }, { data: commissionValue }] = await Promise.all([
        supabase
          .from('affiliates')
          .select('code')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle(),
        supabase
          .from('business_affiliate_settings')
          .select('enabled')
          .eq('business_id', product.business_id)
          .eq('enabled', true)
          .maybeSingle(),
        supabase.rpc('affiliate_product_commission', { p_product_id: product.id }),
      ])
      affiliateCode = affiliateSettings ? (affiliate?.code ?? null) : null
      affiliateCommission = commissionValue === null ? null : Number(commissionValue)
    }
  }

  // A service (see lib/business/type-meta.ts) never carries a finite stock
  // count — it's always available regardless of `stock`.
  const outOfStock = product.track_stock && product.stock <= 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Browse</Link>
        <ChevronRight className="size-3" />
        <Link href={`/shop/${product.business_slug}`} className="hover:text-foreground">{product.business_name}</Link>
        <ChevronRight className="size-3" />
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand-soft shadow-card">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <PackageOpen className="size-16 text-primary/30" />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link href={`/shop/${product.business_slug}`} className="label-mono w-fit hover:text-primary">
            {product.business_name}
          </Link>

          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground">{product.name}</h1>
            <ShareProductButton path={`/shop/${slug}/${productSlug}`} refCode={affiliateCode} />
          </div>

          {product.category_name && (
            <CategoryBadge name={product.category_name} className="w-fit font-mono uppercase tracking-wider" />
          )}

          <span className="text-2xl font-bold tracking-tight text-foreground">
            ₱{Number(product.price).toFixed(2)}
          </span>

          {affiliateCommission !== null && (
            <Badge
              variant="outline"
              className={
                affiliateCommission > 0
                  ? 'w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'w-fit text-muted-foreground'
              }
            >
              {affiliateCommission > 0
                ? `You'll earn ₱${affiliateCommission.toFixed(2)} per sale`
                : "This shop isn't enrolled in the affiliate program — ₱0.00"}
            </Badge>
          )}

          <Separator />

          {product.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          )}

          <Badge
            variant={outOfStock ? 'destructive' : 'outline'}
            className={outOfStock ? 'w-fit' : 'w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'}
          >
            {outOfStock ? 'Out of stock' : !product.track_stock ? 'Available' : `${product.stock} in stock`}
          </Badge>

          <ProductPageActions product={product} refCode={ref ?? null} />
        </div>
      </div>
    </div>
  )
}
