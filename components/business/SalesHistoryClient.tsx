'use client'

import { useState } from 'react'
import SaleItemsDrawer from './SaleItemsDrawer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Receipt } from 'lucide-react'

export type SaleRecord = {
  id: number
  total: number
  payment: number
  change: number
  created_at: string
  created_by: string | null
}

type Props = {
  initialSales: SaleRecord[]
}

export default function SalesHistoryClient({ initialSales }: Props) {
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Sales History</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">In-person POS transactions for your shop.</p>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-brand-soft hover:bg-gradient-brand-soft">
              <TableHead className="p-4">Transaction</TableHead>
              <TableHead className="p-4">Timestamp</TableHead>
              <TableHead className="p-4 text-right">Total</TableHead>
              <TableHead className="p-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
                      <Receipt className="size-5 text-primary" />
                    </span>
                    No sales recorded yet.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              initialSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="p-4 font-mono font-bold text-foreground">#POS-{sale.id}</TableCell>
                  <TableCell className="p-4 text-muted-foreground">{new Date(sale.created_at).toLocaleString('en-US')}</TableCell>
                  <TableCell className="p-4 text-right font-mono text-sm font-bold text-foreground">
                    ₱{Number(sale.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="p-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedSale(sale)}>
                      View / Void
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedSale && (
        <SaleItemsDrawer
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  )
}
