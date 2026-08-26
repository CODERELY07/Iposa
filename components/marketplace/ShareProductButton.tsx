'use client'

import { useState } from 'react'

// Builds and copies this exact product's link. When the viewer is a signed-in
// approved affiliate, the link is tagged with `?ref=<code>` — that tag is
// what ProductPageActions reads to credit a commission, but ONLY once the
// visitor actually adds this product to cart or buys it from this page.
export default function ShareProductButton({ path, refCode }: { path: string; refCode: string | null }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = refCode ? `${origin}${path}?ref=${refCode}` : `${origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — soft failure.
    }
  }

  return (
    <button
      onClick={handleShare}
      title={refCode ? 'Copy your affiliate link for this product' : 'Copy link to this product'}
      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 bg-white rounded-lg px-3 py-1.5 transition cursor-pointer"
    >
      <span>🔗</span>
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
