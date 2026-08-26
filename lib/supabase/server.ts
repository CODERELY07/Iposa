import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import type { Business } from '@/lib/types/marketplace'

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

// 'admin' / 'staff' are the legacy internal POS roles. 'super_admin' /
// 'business_admin' / 'customer' are the marketplace roles, layered onto the
// same `profiles.role` column (see database_schema.sql). A profile is
// exactly one of these at a time.
export type MarketplaceRole = 'super_admin' | 'business_admin' | 'customer'
export type UserRole = 'admin' | 'staff' | MarketplaceRole

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

  if (profile.role === 'super_admin' || profile.role === 'business_admin' || profile.role === 'customer') {
    return profile.role
  }

  return null
}

export async function requireUserRole<T extends UserRole>(allowedRoles: T[]): Promise<T> {
  // Check auth status and profile role separately. proxy.ts sends any
  // authenticated Supabase user away from /login straight to '/', so if we
  // redirect('/login') here for a logged-in user who simply has no profile
  // row (or an unrecognized role), the proxy immediately bounces them back
  // and this redirect fires again - an infinite redirect loop. Only
  // redirect to /login when there's no authenticated user at all; treat
  // "authenticated but no permitted role" the same as a role mismatch
  // (404), matching the check below.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getCurrentUserRole()
  if (!role || !allowedRoles.includes(role as T)) {
    notFound()
  }

  return role as T
}

export async function requireSuperAdmin() {
  return requireUserRole(['super_admin'])
}

// Gates the /sell/* business-admin area. Unlike requireUserRole, this does
// NOT 404 a business_admin whose store is still `pending` or was
// `rejected` — those are valid, expected states the dashboard itself
// renders (an application-status screen instead of the product/order
// tools). It only turns away users who were never registered as a seller.
export async function requireBusinessAccount(): Promise<{ role: UserRole; business: Business | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getCurrentUserRole()
  if (role !== 'business_admin' && role !== 'super_admin') {
    notFound()
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle<Business>()

  return { role, business: business ?? null }
}

// For /sell/products, /sell/orders, etc. — pages that only make sense once
// a store has been approved. Anything else bounces back to /sell, which
// explains the pending/rejected/missing state.
export async function requireApprovedBusiness(): Promise<Business> {
  const { business } = await requireBusinessAccount()
  if (!business || business.status !== 'approved') {
    redirect('/sell')
  }
  return business
}
