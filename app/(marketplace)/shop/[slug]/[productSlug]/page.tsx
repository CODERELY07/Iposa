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

  // Only an approved affiliate gets a code-tagged share link — everyone else
  // just shares the plain product URL.
  let affiliateCode: string | null = null
  const role = await getCurrentUserRole()
  if (role === 'affiliate') {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('code')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .maybeSingle()
      affiliateCode = affiliate?.code ?? null
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
