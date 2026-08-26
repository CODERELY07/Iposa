'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Create the client once outside the component to prevent unstable references
const supabase = createClient()

export default function SignInPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        console.log('User is authenticated:', user)
      }
    }
    checkAuth()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const userId = data.user?.id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId!)
      .single()

    setLoading(false)

    if (profileError || !profile?.role) {
      setError('Unable to determine access role. Contact your administrator.')
      return
    }

    // Honor a safe `?next=` redirect target (e.g. /register-business sends
    // people here first), otherwise route by role.
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')

    let destination: string
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      destination = next
    } else if (profile.role === 'super_admin') {
      destination = '/admin/businesses'
    } else if (profile.role === 'business_admin') {
      destination = '/sell'
    } else {
      destination = '/'
    }

    router.push(destination)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-widest uppercase text-emerald-700 mb-2">
        Welcome back
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Sign in</h1>
      <p className="text-sm text-zinc-500 mb-7">Sign in to your account to continue.</p>

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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">Password</label>
            <Link href="/reset-password" className="text-xs text-emerald-700 font-medium hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm font-medium rounded-lg py-2.5 transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-zinc-100 flex justify-center gap-1 text-sm text-zinc-500">
        <span>Don&apos;t have an account?</span>
        <Link href="/signup" className="text-emerald-700 font-medium hover:underline">
          Create one
        </Link>
      </div>
    </div>
  )
}