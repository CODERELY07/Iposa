'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SaleRecord } from './SalesHistoryClient'
import PinVerificationModal from './PinVerificationModal'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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
    <>
      <Sheet open onOpenChange={open => !open && onClose()}>
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Receipt #POS-{sale.id}</SheetTitle>
            <SheetDescription>Created: {new Date(sale.created_at).toLocaleString()}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="divide-y rounded-xl border p-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between py-2.5 text-xs font-medium">
                    <div>
                      <h4 className="font-bold text-foreground">{item.store_products?.name ?? 'Deleted product'}</h4>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{item.quantity} units &times; ₱{Number(item.selling_price).toFixed(2)}</p>
                    </div>
                    <span className="font-mono text-foreground">₱{(item.quantity * item.selling_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-xs font-medium">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₱{Number(sale.total).toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Cash Tendered</span><span>₱{Number(sale.payment).toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-dashed pt-2 text-sm font-bold text-foreground">
                <span>Change</span><span className="text-primary">₱{Number(sale.change).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <SheetFooter className="flex-row border-t">
            <Button variant="destructive" className="flex-1 bg-red-600 text-white hover:bg-red-700" onClick={() => setShowPinGate(true)}>
              Void Transaction
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {showPinGate && (
        <PinVerificationModal
          saleId={sale.id}
          onSuccess={() => { setShowPinGate(false); onClose(); }}
          onCancel={() => setShowPinGate(false)}
        />
      )}
    </>
  )
}
