'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  className?: string
  redirectTo?: string
  icon?: React.ReactNode
}

export default function SignOutButton({ className, redirectTo = '/login', icon }: Props) {
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
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
