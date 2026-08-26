'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/marketplace/cart-context'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

// `refCode` comes from this exact page's own `?ref=` query param (read
// server-side and passed down) — never from a cookie or storage. Add to
// Cart/Buy Now are the only two actions that stamp it onto the cart line
// item; simply viewing this page (or leaving without clicking either) never
// records anything, so there's nothing left to "undo" on a back navigation.
export default function ProductPageActions({ product, refCode }: { product: MarketplaceProduct; refCode: string | null }) {
  const { addItem } = useCart()
  const router = useRouter()
  const [added, setAdded] = useState(false)
  const outOfStock = product.stock <= 0

  function buildItem() {
    return {
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      imageUrl: product.image_url,
      businessId: product.business_id,
      businessName: product.business_name,
      refCode,
    }
  }

  function handleAdd() {
    addItem(buildItem())
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  function handleBuyNow() {
    addItem(buildItem())
    router.push('/checkout')
  }

  return (
    <div className="flex gap-3 mt-2">
      <button
        onClick={handleAdd}
        disabled={outOfStock}
        className="flex-1 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 px-4 py-2.5 rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
      >
        {outOfStock ? 'Out of stock' : added ? 'Added ✓' : 'Add to Cart'}
      </button>
      <button
        onClick={handleBuyNow}
        disabled={outOfStock}
        className="flex-1 text-sm font-semibold text-zinc-900 bg-white border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg transition cursor-pointer"
      >
        Buy Now
      </button>
    </div>
  )
}
