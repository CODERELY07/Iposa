'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  className?: string
  redirectTo?: string
  icon?: React.ReactNode
  // For a collapsed icon-only sidebar — keeps the label for screen readers
  // instead of removing it outright.
  hideLabel?: boolean
}

export default function SignOutButton({ className, redirectTo = '/login', icon, hideLabel }: Props) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className={className}
    >
      {icon}
      <span className={hideLabel ? 'sr-only' : undefined}>{signingOut ? 'Signing out…' : 'Sign out'}</span>
    </button>
  )
}
