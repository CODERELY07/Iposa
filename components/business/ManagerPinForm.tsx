'use client'

import { useState, useTransition } from 'react'
import { updateManagerPinAction } from '@/app/sell/settings/actions'

export default function ManagerPinForm() {
  const [isPending, startTransition] = useTransition()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await updateManagerPinAction(pin)
      if (!result.success) {
        setError(result.message)
        return
      }
      setPin('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-xs">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>}
      {saved && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">PIN updated.</div>}

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">4-digit PIN</label>
        <input
          type="password"
          maxLength={4}
          pattern="\d*"
          inputMode="numeric"
          required
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
          className="w-32 bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2 text-center font-mono text-lg tracking-widest text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || pin.length !== 4}
        className="bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition cursor-pointer"
      >
        {isPending ? 'Saving…' : 'Save PIN'}
      </button>
    </form>
  )
}
