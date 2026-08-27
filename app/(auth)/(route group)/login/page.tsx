'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/marketplace/AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

// Create the client once outside the component to prevent unstable references
const supabase = createClient()

export default function SignInPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in"
      description="Sign in to your account to continue."
      footer={
        <>
          <span>Don&apos;t have an account?</span>
          <Link href="/signup" className="font-medium text-primary hover:underline">Create one</Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/reset-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  )
}
