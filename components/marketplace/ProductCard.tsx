'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/marketplace/cart-context'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

export default function ProductCard({ product }: { product: MarketplaceProduct }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const outOfStock = product.stock <= 0

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

  const productHref = `/shop/${product.business_slug}/${product.slug}`

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
      <Link href={productHref} className="aspect-square bg-zinc-50 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl text-zinc-300">📦</span>
        )}
      </Link>

      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <Link
          href={`/shop/${product.business_slug}`}
          className="text-[11px] font-semibold text-blue-600 hover:underline truncate"
        >
          {product.business_name}
        </Link>

        <Link href={productHref}>
          <h3 className="text-sm font-bold text-zinc-900 leading-snug line-clamp-2 hover:text-blue-600 transition">{product.name}</h3>
        </Link>

        {product.category_name && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {product.category_name}
          </span>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="text-base font-mono font-bold text-zinc-900">
            ₱{Number(product.price).toFixed(2)}
          </span>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className="text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
          >
            {outOfStock ? 'Out of stock' : added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
