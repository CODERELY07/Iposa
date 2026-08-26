import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import ProductPageActions from '@/components/marketplace/ProductPageActions'
import ShareProductButton from '@/components/marketplace/ShareProductButton'
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

  const outOfStock = product.stock <= 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl text-zinc-300">📦</span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link href={`/shop/${product.business_slug}`} className="text-sm font-semibold text-blue-600 hover:underline w-fit">
            {product.business_name}
          </Link>

          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{product.name}</h1>
            <ShareProductButton path={`/shop/${slug}/${productSlug}`} refCode={affiliateCode} />
          </div>

          {product.category_name && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-fit">
              {product.category_name}
            </span>
          )}

          <span className="text-2xl font-mono font-bold text-zinc-900">
            ₱{Number(product.price).toFixed(2)}
          </span>

          {product.description && (
            <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          <p className={`text-xs ${outOfStock ? 'text-red-600' : 'text-zinc-400'}`}>
            {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </p>

          <ProductPageActions product={product} refCode={ref ?? null} />
        </div>
      </div>
    </div>
  )
}
