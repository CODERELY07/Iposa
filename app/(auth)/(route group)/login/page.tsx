'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignInPage() {
  const router = useRouter()
  const supabase = createClient()

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
  }, [supabase])

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

    const destination = profile.role === 'staff' || profile.role === 'cashier' ? '/pos' : '/dashboard'
    router.push(destination)
    router.refresh() // Good practice to refresh state after auth
  }

  return (
    <div className="max-w-md w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5"
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm font-medium rounded-lg py-2.5 transition"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-zinc-100 flex justify-center gap-1 text-sm text-zinc-500">
        <span>Dont have an account?</span>
        <a href="/signup" className="text-emerald-700 font-medium hover:underline">
          Create one
        </a>
      </div>
    </div>
  )
}