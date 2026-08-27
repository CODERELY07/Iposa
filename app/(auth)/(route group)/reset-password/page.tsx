'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/marketplace/AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2 } from 'lucide-react'

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
      <AuthCard
        eyebrow="Check your inbox"
        title="Email sent"
        description={`If ${email} is registered, you'll receive a reset link shortly.`}
        footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
      >
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            Check your spam folder if it doesn&apos;t arrive within a few minutes.
          </AlertDescription>
        </Alert>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Reset password"
      description="Enter your email and we'll send you a link to reset your password."
      footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
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

        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  )
}
