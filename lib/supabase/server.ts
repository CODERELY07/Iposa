import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export type UserRole = 'admin' | 'staff'

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.role) {
    return null
  }

  if (profile.role === 'admin') {
    return 'admin'
  }

  if (profile.role === 'staff' || profile.role === 'cashier') {
    return 'staff'
  }

  return null
}

export async function requireUserRole(allowedRoles: UserRole[]) {
  const role = await getCurrentUserRole()
  if (!role) {
    redirect('/login')
  }

  if (!allowedRoles.includes(role)) {
    notFound()
  }

  return role
}
