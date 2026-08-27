import { Skeleton } from '@/components/ui/skeleton'
import { StatGridSkeleton } from '@/components/ui/loading-skeletons'
import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      <StatGridSkeleton count={4} />

      <Card className="space-y-3 p-5">
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-3 w-full max-w-2xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </Card>
    </div>
  )
}
