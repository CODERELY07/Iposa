'use client'

import { useState, useTransition } from 'react'
import { updateAffiliateSettingsAction } from '@/app/sell/settings/actions'
import type { BusinessAffiliateSettings } from '@/lib/types/marketplace'

export default function AffiliateSettingsForm({ settings }: { settings: BusinessAffiliateSettings | null }) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [rate, setRate] = useState(String(settings?.commission_rate ?? 5))
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await updateAffiliateSettingsAction({ enabled, commission_rate: Number(rate) })
      if (result.success) {
        setMessage({ text: 'Affiliate settings saved.', isError: false })
      } else {
        setMessage({ text: result.message, isError: true })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-zinc-700">Let affiliates promote my shop</span>
      </label>

      <div className="space-y-1.5">
        <label htmlFor="commission_rate" className="block text-sm font-medium text-zinc-700">Commission rate (%)</label>
        <input
          id="commission_rate"
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={rate}
          onChange={e => setRate(e.target.value)}
          disabled={!enabled}
          className="w-32 bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
        />
        <p className="text-[11px] text-zinc-400">Paid to an affiliate out of your revenue for each order they refer.</p>
      </div>

      {message && (
        <p className={`text-xs ${message.isError ? 'text-red-600' : 'text-emerald-600'}`}>{message.text}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
