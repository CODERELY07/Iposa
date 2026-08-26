'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/marketplace/cart-context'
import { placeOrderAction } from '@/app/(marketplace)/checkout/actions'

export default function CheckoutForm({ defaultName }: { defaultName: string }) {
  const { items, totalPrice, clear } = useCart()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: defaultName, phone: '', address: '', notes: '' })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await placeOrderAction(items, form)
      if (!result.success) {
        setError(result.message)
        return
      }
      clear()
      router.push('/orders')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Full name</label>
        <input
          required
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Phone number</label>
        <input
          required
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Delivery address</label>
        <textarea
          required
          rows={3}
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Notes (optional)</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
        <span className="text-sm text-zinc-500">
          Total: <span className="font-mono font-bold text-zinc-900">₱{totalPrice.toFixed(2)}</span>
        </span>
        <button
          type="submit"
          disabled={isPending || items.length === 0}
          className="bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? 'Placing order…' : 'Place order'}
        </button>
      </div>
    </form>
  )
}
