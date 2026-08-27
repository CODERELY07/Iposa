'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Long enough that an instant/prefetched navigation never flashes the bar,
// short enough that a genuinely slow one still feels acknowledged quickly.
const START_DELAY_MS = 120
// Clears a stuck bar if a click looked like a navigation but never actually
// changed route (e.g. it just opened a menu, or was intercepted elsewhere).
const SAFETY_TIMEOUT_MS = 8000
const FINISH_DURATION_MS = 250

type Phase = 'idle' | 'loading' | 'finishing'

// A thin top-of-viewport progress bar shown while a click on a link is
// carrying the app to a new route — the "something is happening" cue that
// was missing for destinations with no loading.tsx of their own, or whose
// data resolves fast enough that a full skeleton isn't worth showing.
//
// Driven by a single capture-phase click listener on the document rather
// than one wired into every link and button: every internal navigation in
// this app goes through a real `<a href>` (next/link, and the shadcn Button's
// `render={<Link .../>}` prop both render one), so catching clicks on
// `a[href]` covers them all from one place. usePathname/useSearchParams then
// report when the destination route has actually rendered, which is the
// "finish" signal.
export default function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('idle')

  const activeRef = useRef(false)
  const startTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const finishTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function finish() {
    if (!activeRef.current) return
    activeRef.current = false
    clearTimeout(startTimer.current)
    clearTimeout(safetyTimer.current)
    setPhase(current => (current === 'idle' ? 'idle' : 'finishing'))
    finishTimer.current = setTimeout(() => setPhase('idle'), FINISH_DURATION_MS)
  }

  function begin(nextUrl: string) {
    if (activeRef.current) return
    if (nextUrl === `${window.location.pathname}${window.location.search}`) return
    activeRef.current = true
    startTimer.current = setTimeout(() => setPhase('loading'), START_DELAY_MS)
    safetyTimer.current = setTimeout(finish, SAFETY_TIMEOUT_MS)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Only a plain left-click without modifiers is a same-tab navigation —
      // cmd/ctrl-click opens a new tab, shift-click a new window, etc.
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return

      begin(`${url.pathname}${url.search}`)
    }

    function onPopState() {
      begin(`${window.location.pathname}${window.location.search}`)
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
      clearTimeout(startTimer.current)
      clearTimeout(safetyTimer.current)
      clearTimeout(finishTimer.current)
    }
    // begin/finish close over refs and the stable setState function, not
    // props or state, so they stay current without this effect re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Runs on every route change to signal arrival at the destination.
  useEffect(() => {
    finish()
  }, [pathname, searchParams])

  if (phase === 'idle') return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-transparent">
      <div
        className={`h-full bg-gradient-brand shadow-glow-primary transition-[width,opacity] ${
          phase === 'finishing'
            ? 'w-full opacity-0 duration-300 ease-in'
            : 'w-4/5 opacity-100 duration-[8000ms] ease-out'
        }`}
      />
    </div>
  )
}
