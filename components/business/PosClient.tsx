'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: number
  name: string
  category_id: number | null
  sku: string | null
  cost_price: number
  price: number
  stock: number
  categories: { name: string } | null
  recipes?: { ingredient_id: number; quantity_used: number }[]
}

type Category = { id: number; name: string }
type Ingredient = { id: number; name: string; current_stock: number }

type CartItem = {
  product: Product
  quantity: number
}

type Props = {
  initialProducts: Product[]
  categories: Category[]
  ingredients: Ingredient[]
}

export default function PosClient({ initialProducts, categories, ingredients }: Props) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const [cashReceived, setCashReceived] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const getAvailableStock = (product: Product) => {
    if (!product.recipes || product.recipes.length === 0) {
      return product.stock
    }
    let maxPossibleProducts = Infinity
    product.recipes.forEach(item => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      if (!ing || item.quantity_used <= 0) {
        maxPossibleProducts = 0
        return
      }
      const possibleYield = Math.floor(Number(ing.current_stock) / item.quantity_used)
      if (possibleYield < maxPossibleProducts) {
        maxPossibleProducts = possibleYield
      }
    })
    return maxPossibleProducts === Infinity ? 0 : maxPossibleProducts
  }

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCat || String(p.category_id) === filterCat
      return matchSearch && matchCat
    })
  }, [products, search, filterCat])

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  }, [cart])

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  const cashChange = useMemo(() => {
    const cash = parseFloat(cashReceived)
    if (isNaN(cash) || cash < cartTotal) return 0
    return cash - cartTotal
  }, [cashReceived, cartTotal])

  function addToCart(product: Product) {
    const availableStock = getAvailableStock(product)
    if (availableStock <= 0) return

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        if (existing.quantity >= availableStock) return prev
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function updateQuantity(productId: number, amount: number) {
    setCart(prev =>
      prev
        .map(item => {
          if (item.product.id !== productId) return item
          const newQty = item.quantity + amount
          const availableStock = getAvailableStock(item.product)
          if (newQty > availableStock) return item
          return { ...item, quantity: newQty }
        })
        .filter(item => item.quantity > 0)
    )
  }

  function removeItem(productId: number) {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  function clearCart() {
    setCart([])
    setCashReceived('')
    setErrorMessage(null)
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const paymentAmount = parseFloat(cashReceived)
    if (isNaN(paymentAmount) || paymentAmount < cartTotal) {
      setErrorMessage('Insufficient cash payment amount.')
      return
    }

    setLoading(true)

    const payloadItems = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.product.price,
      subtotal: item.product.price * item.quantity,
    }))

    const { data: saleId, error } = await supabase.rpc('process_sale', {
      p_total: cartTotal,
      p_payment: paymentAmount,
      p_change: cashChange,
      p_items: payloadItems,
    })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    setProducts(prevProducts =>
      prevProducts.map(prod => {
        const soldItem = cart.find(item => item.product.id === prod.id)
        return soldItem ? { ...prod, stock: Math.max(0, prod.stock - soldItem.quantity) } : prod
      })
    )

    setSuccessMessage(`Sale completed successfully! Reference ID: #${saleId}`)
    clearCart()
    setLoading(false)
  }

  return (
    <div className="flex flex-col lg:flex-row h-full lg:max-w-[1600px] lg:mx-auto lg:overflow-hidden bg-zinc-50">

      <div className="lg:w-7/12 flex flex-col p-4 sm:p-5 lg:h-full lg:overflow-hidden border-b lg:border-b-0 lg:border-r border-zinc-200">

        {successMessage && (
          <div className="mb-4 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-4 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Scan SKU or type product name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-zinc-400 text-sm bg-white border border-zinc-200 rounded-xl">
              No matching products found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
              {filteredProducts.map(p => {
                const liveStock = getAvailableStock(p)
                const isOutOfStock = liveStock <= 0
                const cartItem = cart.find(item => item.product.id === p.id)
                const isMaxed = cartItem ? cartItem.quantity >= liveStock : false

                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock || isMaxed || loading}
                    onClick={() => addToCart(p)}
                    className="flex flex-col justify-between text-left p-4 bg-white border border-zinc-200 rounded-xl hover:border-zinc-400 focus:outline-none transition group cursor-pointer disabled:opacity-60"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-medium text-zinc-900 line-clamp-2 text-sm group-hover:text-emerald-600 transition">
                          {p.name}
                        </span>
                        {cartItem && (
                          <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            {cartItem.quantity}
                          </span>
                        )}
                      </div>
                      <span className="block text-xs font-mono text-zinc-400 mt-1">
                        {p.sku ?? 'No SKU'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-2 border-t border-zinc-50 w-full">
                      <span className="text-base font-semibold text-zinc-800">
                        ₱{Number(p.price).toFixed(2)}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        isOutOfStock ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {isOutOfStock ? 'Sold Out' : `${liveStock} units`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleCheckout} className="lg:w-5/12 flex flex-col lg:h-full bg-white">
        <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Current Ticket</h2>
            <p className="text-xs text-zinc-500">{totalItems} items selected</p>
          </div>
          {cart.length > 0 && !loading && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer transition"
            >
              Clear Cart
            </button>
          )}
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto divide-y divide-zinc-100 px-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-400 py-12 lg:py-20 lg:h-full">
              <span className="text-3xl mb-2">🛒</span>
              <p className="text-sm font-medium">Cart is currently empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-zinc-800 truncate">{item.product.name}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">₱{Number(item.product.price).toFixed(2)} each</p>
                </div>

                <div className="flex items-center gap-1.5 border border-zinc-200 rounded-lg p-1 bg-zinc-50">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="w-7 h-7 text-sm rounded-md bg-white border border-zinc-100 shadow-sm flex items-center justify-center font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-semibold text-zinc-800 font-mono">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={item.quantity >= getAvailableStock(item.product) || loading}
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="w-7 h-7 text-sm rounded-md bg-white border border-zinc-100 shadow-sm flex items-center justify-center font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <div className="text-right min-w-[70px]">
                  <span className="text-sm font-semibold text-zinc-900 block">
                    ₱{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                  {!loading && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      className="text-[10px] text-zinc-400 hover:text-red-500 transition cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-zinc-200 bg-zinc-50 space-y-3.5">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Subtotal</span>
              <span>₱{cartTotal.toFixed(2)}</span>
            </div>

            <div className="pt-2 flex items-center justify-between gap-4">
              <label className="text-xs font-medium text-zinc-700 whitespace-nowrap">Cash Tendered</label>
              <div className="relative max-w-[160px] flex-1">
                <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-medium">₱</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  disabled={cart.length === 0 || loading}
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-6 pr-3 py-1.5 text-right text-sm font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-between text-xs text-zinc-500 pt-1">
              <span>Change Amount</span>
              <span className="font-mono text-zinc-700">₱{cashChange.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-200/60">
              <span>Total Bill</span>
              <span className="font-mono text-emerald-600">₱{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={cart.length === 0 || loading || parseFloat(cashReceived) < cartTotal || !cashReceived}
            className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-medium py-3 rounded-xl transition shadow-sm text-sm cursor-pointer"
          >
            {loading ? 'Processing Sale...' : 'Finalize Sale & Print Receipt'}
          </button>
        </div>
      </form>

    </div>
  )
}
