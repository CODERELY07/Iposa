'use client'

import { useState, useTransition } from 'react'
import { registerBusinessAction } from '@/app/(auth)/(route group)/register-business/actions'

export default function RegisterBusinessForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await registerBusinessAction(formData)
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
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">Shop name</label>
        <input
          id="name"
          name="name"
          required
          placeholder="e.g., Maria's Bakeshop"
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700">Tell customers about your shop</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What do you sell?"
          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
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
