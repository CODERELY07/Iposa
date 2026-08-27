// Reusable building blocks for route-level `loading.tsx` fallbacks. Kept as
// plain Server Components (no interactivity) and shaped to roughly match the
// real pages they stand in for, so the swap-in doesn't cause a big layout
// jump once data arrives — see the shimmer animation on Skeleton itself in
// globals.css / components/ui/skeleton.tsx.
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-8 w-32 shrink-0 self-start sm:self-auto" />}
    </div>
  )
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="size-9 shrink-0 rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card className="overflow-hidden py-0">
      <div className="flex items-center gap-4 border-b bg-muted/40 p-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-32' : 'w-16'}`} />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 p-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-36' : 'w-14'}`} />
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden py-0">
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <div className="space-y-2 p-3.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center justify-between border-t border-border pt-2.5">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={`p-5 ${className ?? ''}`}>
      <Skeleton className="mb-4 h-3 w-40" />
      <Skeleton className="h-64 w-full" />
    </Card>
  )
}

export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-8 w-28" />
      </CardContent>
    </Card>
  )
}
