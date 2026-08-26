'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SaleRecord } from './SalesHistoryClient'
import PinVerificationModal from './PinVerificationModal'

type SaleItemJoined = {
  id: number
  quantity: number
  selling_price: number
  store_products: { name: string } | null
}

type DrawerProps = {
  sale: SaleRecord
  onClose: () => void
}

export default function SaleItemsDrawer({ sale, onClose }: DrawerProps) {
  const [items, setItems] = useState<SaleItemJoined[]>([])
  const [loading, setLoading] = useState(true)
  const [showPinGate, setShowPinGate] = useState(false)

  useEffect(() => {
    async function loadReceiptItems() {
      const supabase = createClient()
      const { data } = await supabase
        .from('sale_items')
        .select('id, quantity, selling_price, store_products(name)')
        .eq('sale_id', sale.id)

      setItems((data as unknown as SaleItemJoined[]) ?? [])
      setLoading(false)
    }
    loadReceiptItems()
  }, [sale.id])

  return (
    <div className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-in-right border-l border-zinc-200">
        <header className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Receipt #POS-{sale.id}</h2>
            <p className="text-[11px] text-zinc-400">Created: {new Date(sale.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 font-medium text-lg">&times;</button>
        </header>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-xs text-zinc-400 font-medium animate-pulse">
              Loading receipt items…
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl p-3 bg-white shadow-xs">
              {items.map((item) => (
                <div key={item.id} className="py-2.5 flex justify-between text-xs font-medium">
                  <div>
                    <h4 className="text-zinc-900 font-bold">{item.store_products?.name ?? 'Deleted product'}</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{item.quantity} units &times; ₱{Number(item.selling_price).toFixed(2)}</p>
                  </div>
                  <span className="font-mono text-zinc-700">₱{(item.quantity * item.selling_price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4 text-xs font-medium space-y-2">
            <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>₱{Number(sale.total).toFixed(2)}</span></div>
            <div className="flex justify-between text-zinc-500"><span>Cash Tendered</span><span>₱{Number(sale.payment).toFixed(2)}</span></div>
            <div className="flex justify-between text-zinc-900 font-bold text-sm pt-2 border-t border-dashed border-zinc-200">
              <span>Change</span><span className="text-blue-600">₱{Number(sale.change).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-zinc-100 bg-zinc-50 flex gap-3">
          <button
            onClick={() => setShowPinGate(true)}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            Void Transaction
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-lg text-xs font-bold transition hover:bg-zinc-50"
          >
            Close
          </button>
        </footer>
      </div>

      {showPinGate && (
        <PinVerificationModal
          saleId={sale.id}
          onSuccess={() => { setShowPinGate(false); onClose(); }}
          onCancel={() => setShowPinGate(false)}
        />
      )}
    </div>
  )
}
