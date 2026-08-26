'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
        <p className="text-xs font-semibold tracking-widest uppercase text-emerald-700 mb-2">
          Almost there
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Check your email</h1>
        <p className="text-sm text-zinc-500 mb-6">
          We sent a confirmation link to <span className="font-medium text-zinc-700">{email}</span>.
          Click it to activate your account.
        </p>
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2.5">
          <span className="mt-px">✓</span>
          <span>Confirmation email sent. You can close this tab.</span>
        </div>
        <div className="mt-6 pt-5 border-t border-zinc-100 flex justify-center gap-1 text-sm text-zinc-500">
          <span>Already confirmed?</span>
          <Link href="/login" className="text-emerald-700 font-medium hover:underline">Sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-widest uppercase text-emerald-700 mb-2">
        Get started
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Create account</h1>
      <p className="text-sm text-zinc-500 mb-7">Sign up for free. No credit card required.</p>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5 mb-5">
          <span className="mt-px">⚠</span>
          <span>{error}</span>
        </div>
      )}

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

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="block text-sm font-medium text-zinc-700">Confirm password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm font-medium rounded-lg py-2.5 transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-zinc-100 flex justify-center gap-1 text-sm text-zinc-500">
        <span>Already have an account?</span>
        <Link href="/login" className="text-emerald-700 font-medium hover:underline">Sign in</Link>
      </div>
    </div>
  )
}