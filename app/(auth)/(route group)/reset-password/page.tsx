'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/account/update-password`,
    })

    // Always show success to avoid email enumeration
    if (error) console.error(error)
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-700 mb-2">
          Check your inbox
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Email sent</h1>
        <p className="text-sm text-zinc-500 mb-6">
          If <span className="font-medium text-zinc-700">{email}</span> is registered,
          you&apos;ll receive a reset link shortly.
        </p>
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2.5">
          <span className="mt-px">✓</span>
          <span>Check your spam folder if it doesn&apos;t arrive within a few minutes.</span>
        </div>
        <div className="mt-6 pt-5 border-t border-zinc-100 flex justify-center text-sm">
          <Link href="/login" className="text-emerald-700 font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-widest uppercase text-emerald-700 mb-2">
        Account recovery
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Reset password</h1>
      <p className="text-sm text-zinc-500 mb-7">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm font-medium rounded-lg py-2.5 transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-zinc-100 flex justify-center text-sm">
        <Link href="/login" className="text-emerald-700 font-medium hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}