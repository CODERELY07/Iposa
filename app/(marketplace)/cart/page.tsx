'use client'

import Link from 'next/link'
import { useCart } from '@/lib/marketplace/cart-context'

export default function CartPage() {
  const { groupedByBusiness, totalPrice, totalItems, setQuantity, removeItem } = useCart()

  if (totalItems === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-4xl mb-3">🛒</p>
        <h1 className="text-xl font-bold text-zinc-900">Your cart is empty</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6">Browse the marketplace and add something you like.</p>
        <Link href="/" className="inline-block bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
          Start browsing
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <h1 className="text-xl font-bold text-zinc-900">Your cart</h1>

      {groupedByBusiness.map(group => (
        <div key={group.businessId} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-100 text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {group.businessName}
          </div>
          <div className="divide-y divide-zinc-100">
            {group.items.map(item => (
              <div key={item.productId} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg text-zinc-300">📦</span>
                    )}
                  </div>
                  <div className="min-w-0 sm:min-w-[140px]">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{item.name}</p>
                    <p className="text-xs font-mono text-zinc-500">₱{item.price.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end sm:ml-auto">
                  <div className="flex items-center gap-1.5 border border-zinc-200 rounded-lg p-1 bg-zinc-50">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 text-sm rounded-md bg-white border border-zinc-100 shadow-sm flex items-center justify-center font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-xs font-semibold text-zinc-800 font-mono">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      className="w-7 h-7 text-sm rounded-md bg-white border border-zinc-100 shadow-sm flex items-center justify-center font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-mono font-bold text-zinc-900 w-20 text-right shrink-0">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </span>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold px-1.5 cursor-pointer shrink-0"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 bg-zinc-50/70 border-t border-zinc-100 text-right text-xs font-semibold text-zinc-500">
            Shop subtotal: <span className="text-zinc-900 font-mono">₱{group.subtotal.toFixed(2)}</span>
          </div>
        </div>
      ))}

      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-400">
            {groupedByBusiness.length > 1
              ? `Checkout creates ${groupedByBusiness.length} separate orders (one per shop).`
              : 'Total'}
          </p>
          <p className="text-xl font-mono font-bold text-zinc-900">₱{totalPrice.toFixed(2)}</p>
        </div>
        <Link
          href="/checkout"
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
        >
          Checkout
        </Link>
      </div>
    </div>
  )
}
