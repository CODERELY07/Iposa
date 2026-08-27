'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

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
          <Input
            readOnly
            value={buildUrl(link.path)}
            onFocus={e => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-muted/40 font-mono text-xs text-muted-foreground"
          />
          <Button size="sm" onClick={() => copy(link.path)} className="shrink-0">
            {copiedPath === link.path ? <Check /> : <Copy />}
            {copiedPath === link.path ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      ))}
    </div>
  )
}
