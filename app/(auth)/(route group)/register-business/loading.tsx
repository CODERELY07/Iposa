import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <Card className="w-full max-w-2xl space-y-5 overflow-visible p-8 shadow-card-hover">
      <Skeleton className="h-6 w-40 rounded-full" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-sm" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-11.5 w-full rounded-[9px]" />
    </Card>
  )
}
