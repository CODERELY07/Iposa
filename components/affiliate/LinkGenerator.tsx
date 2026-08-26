'use client'

import { useState } from 'react'

type LinkRow = {
  label: string
  path: string // e.g. '/' or '/shop/marias-bakeshop'
}

export default function LinkGenerator({ code, links }: { code: string; links: LinkRow[] }) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  function buildUrl(path: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const separator = path.includes('?') ? '&' : '?'
    return `${origin}${path}${separator}ref=${code}`
  }

  async function copy(path: string) {
    const url = buildUrl(path)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedPath(path)
      setTimeout(() => setCopiedPath(current => (current === path ? null : current)), 2000)
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the input is
      // still selectable/readable, so this is a soft failure.
    }
  }

  return (
    <div className="space-y-2">
      {links.map(link => (
        <div key={link.path} className="flex items-center gap-2">
          <input
            readOnly
            value={buildUrl(link.path)}
            onFocus={e => e.currentTarget.select()}
            className="flex-1 min-w-0 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-600"
          />
          <button
            onClick={() => copy(link.path)}
            className="shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition cursor-pointer"
          >
            {copiedPath === link.path ? 'Copied!' : 'Copy'}
          </button>
        </div>
      ))}
    </div>
  )
}
