'use client'

import { useState } from 'react'
import SaleItemsDrawer from './SaleItemsDrawer'


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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-zinc-50 min-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Executive Ledger History</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Real-time point of sale monitoring dashboard with cascade verification safeguards.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-zinc-50 font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-200">
              <tr>
                <th className="p-4">Transaction ID</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Cashier Identity Reference</th>
                <th className="p-4 text-right">Gross Total Volume</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {initialSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-400 italic bg-white">
                    No completed ledger balances tracked in the current cache index.
                  </td>
                </tr>
              ) : (
                initialSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="p-4 font-mono text-zinc-900 font-bold">#POS-{sale.id}</td>
                    <td className="p-4 text-zinc-500">{new Date(sale.created_at).toLocaleString('en-US')}</td>
                    <td className="p-4 font-mono text-zinc-400 text-[11px]">{sale.created_by ?? 'System API Agent'}</td>
                    <td className="p-4 text-right font-mono font-bold text-zinc-900 text-sm">
                      ₱{Number(sale.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="px-3 py-1.5 bg-white border border-zinc-300 hover:border-zinc-400 text-zinc-700 rounded-lg font-bold shadow-sm transition text-[11px]"
                      >
                        Inspect / Void Entry
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSale && (
        <SaleItemsDrawer 
          sale={selectedSale} 
          onClose={() => setSelectedSale(null)} 
        />
      )}
    </div>
  )
}