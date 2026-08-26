'use client'

import { useState, useTransition } from 'react'
import type { Business } from '@/lib/types/marketplace'
import { updateBusinessSettingsAction } from '@/app/sell/settings/actions'

export default function BusinessSettingsForm({ business }: { business: Business }) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: business.name,
    description: business.description ?? '',
    logo_url: business.logo_url ?? '',
    banner_url: business.banner_url ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await updateBusinessSettingsAction({
        name: form.name,
        description: form.description || null,
        logo_url: form.logo_url || null,
        banner_url: form.banner_url || null,
      })
      if (!result.success) {
        setError(result.message)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const inputCls = 'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition font-medium'

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>}
      {saved && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">Saved.</div>}

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Shop name *</label>
        <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Description</label>
        <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Logo URL</label>
        <input type="url" placeholder="https://…" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} className={inputCls} />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Banner URL</label>
        <input type="url" placeholder="https://…" value={form.banner_url} onChange={e => setForm(f => ({ ...f, banner_url: e.target.value }))} className={inputCls} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition cursor-pointer"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
