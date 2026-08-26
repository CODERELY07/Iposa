'use client'

import { useState, useTransition } from 'react'
import { registerAffiliateAction } from '@/app/(auth)/(route group)/become-affiliate/actions'

export default function RegisterAffiliateForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await registerAffiliateAction(formData)
      // A successful call redirects server-side and never resolves here.
      if (result && !result.success) {
        setError(result.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
          <span className="mt-px">⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="full_name" className="block text-sm font-medium text-zinc-700">Full name</label>
        <input
          id="full_name"
          name="full_name"
          required
          placeholder="e.g., Juan Dela Cruz"
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="payout_method" className="block text-sm font-medium text-zinc-700">Payout method</label>
        <select
          id="payout_method"
          name="payout_method"
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          <option value="GCash">GCash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="PayMaya">PayMaya</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="payout_details" className="block text-sm font-medium text-zinc-700">Payout details</label>
        <textarea
          id="payout_details"
          name="payout_details"
          rows={2}
          placeholder="Account name and number"
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm font-medium rounded-lg py-2.5 transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  )
}
