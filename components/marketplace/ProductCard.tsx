'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/marketplace/cart-context'
import type { MarketplaceProduct } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import CategoryBadge from '@/components/marketplace/CategoryBadge'
import { PackageOpen, Plus, Check } from 'lucide-react'

export default function ProductCard({ product }: { product: MarketplaceProduct }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const outOfStock = product.stock <= 0
  const productHref = `/shop/${product.business_slug}/${product.slug}`

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      imageUrl: product.image_url,
      businessId: product.business_id,
      businessName: product.business_name,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  return (
    <Card className="card-interactive group overflow-hidden py-0">
      <Link href={productHref} className="relative flex aspect-4/3 items-center justify-center overflow-hidden bg-gradient-brand-soft">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PackageOpen className="size-10 text-primary/30" />
        )}
        {outOfStock && (
          <Badge variant="destructive" className="absolute left-2 top-2 shadow-sm">Out of stock</Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link href={`/shop/${product.business_slug}`} className="label-mono truncate hover:text-primary">
          {product.business_name}
        </Link>

        <Link href={productHref}>
          <h3 className="line-clamp-2 text-[15px] font-medium leading-[1.35] tracking-[-0.005em] text-foreground transition-colors group-hover:text-primary">
            {product.name}
          </h3>
        </Link>

        {product.category_name && (
          <CategoryBadge name={product.category_name} className="w-fit text-[10px] font-mono uppercase tracking-wider" />
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span className="text-base font-bold tracking-[-0.01em] text-foreground">
            ₱{Number(product.price).toFixed(2)}
          </span>
          <Button size="icon" onClick={handleAdd} disabled={outOfStock} aria-label="Add to cart">
            {added ? <Check /> : <Plus />}
          </Button>
        </div>
      </div>
    </Card>
  )
}
