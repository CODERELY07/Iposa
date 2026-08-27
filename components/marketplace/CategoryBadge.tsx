import { Badge } from '@/components/ui/badge'

// A stable, varied color per category name (hashed, not random) so the same
// category always reads the same color across the whole marketplace.
const PALETTE = [
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
  'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400',
  'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400',
]

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export default function CategoryBadge({ name, className }: { name: string; className?: string }) {
  return (
    <Badge variant="outline" className={`border-transparent ${colorFor(name)} ${className ?? ''}`}>
      {name}
    </Badge>
  )
}
