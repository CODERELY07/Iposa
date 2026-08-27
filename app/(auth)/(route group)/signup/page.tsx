'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/marketplace/AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

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
      <AuthCard
        eyebrow="Almost there"
        title="Check your email"
        description={`We sent a confirmation link to ${email}. Click it to activate your account.`}
        footer={
          <>
            <span>Already confirmed?</span>
            <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </>
        }
      >
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            Confirmation email sent. You can close this tab.
          </AlertDescription>
        </Alert>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      eyebrow="Get started"
      title="Create account"
      description="Sign up for free. No credit card required."
      footer={
        <>
          <span>Already have an account?</span>
          <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  )
}
