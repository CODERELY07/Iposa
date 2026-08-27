'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/marketplace/cart-context'
import type { MarketplaceProduct } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Zap, Check } from 'lucide-react'

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
    <div className="mt-2 flex gap-3">
      <Button size="lg" className="flex-1" onClick={handleAdd} disabled={outOfStock}>
        {outOfStock ? 'Out of stock' : added ? <><Check /> Added</> : <><ShoppingCart /> Add to Cart</>}
      </Button>
      <Button size="lg" variant="outline" className="flex-1" onClick={handleBuyNow} disabled={outOfStock}>
        <Zap /> Buy Now
      </Button>
    </div>
  )
}
