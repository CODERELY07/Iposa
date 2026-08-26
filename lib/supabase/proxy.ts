import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // PROTECTED ROUTES LOGIC
  // Public marketplace routes: the homepage, shop pages, and cart are
  // browsable by anyone. /checkout and /orders are intentionally NOT
  // included here — placing an order requires being logged in.
  const isPublicRoute =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname === '/cart' ||
    request.nextUrl.pathname.startsWith('/shop/')
  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/auth')

  // If user is not logged in and tries to access a protected page, send to /login
  if (!user && !isPublicRoute && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return redirectWithSession(url, supabaseResponse)
  }

  // If user IS logged in and tries to access /login, send them to the
  // marketplace home. There's no single role-appropriate landing page to
  // pick here without an extra DB round-trip — '/' works for every role,
  // and the header links to /sell or /admin from there.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return redirectWithSession(url, supabaseResponse)
  }

  // Affiliate referral tracking: `?ref=CODE` on any page records a click for
  // the affiliate's own stats. This is informational only — it does NOT
  // grant any commission by itself (no cookie, nothing persisted beyond this
  // count). Commission attribution instead happens per cart item, stamped
  // only when a shopper clicks Add to Cart/Buy Now on that exact product's
  // page while `?ref=` is present in its URL (see ProductPageActions) — a
  // visit alone (or leaving the page without acting) earns nothing. Best-
  // effort — an invalid/unknown code or a failed RPC call never blocks the request.
  const refCode = request.nextUrl.searchParams.get('ref')
  if (refCode) {
    const shopMatch = request.nextUrl.pathname.match(/^\/shop\/([^/]+)/)
    try {
      await supabase.rpc('track_affiliate_referral_click', {
        p_code: refCode,
        p_business_slug: shopMatch ? shopMatch[1] : null,
      })
    } catch {
      // Ignore — tracking is best-effort and must never block navigation.
    }
  }

  return supabaseResponse
}

// NextResponse.redirect() creates a brand new response object, so any
// refreshed Supabase auth cookies that getUser() attached to
// supabaseResponse (via the setAll callback above) would otherwise be
// dropped. Losing them makes the browser keep sending a stale/soon-to-expire
// cookie, which can make the user look logged-out on the very next request -
// bouncing them between /login and a protected route in a redirect loop. Copying
// the cookies over keeps the refreshed session intact across the redirect.
function redirectWithSession(url: URL, supabaseResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })
  return redirectResponse
}