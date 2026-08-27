import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'
import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <Card className="flex flex-col items-start justify-between gap-4 bg-gradient-brand-soft p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Skeleton className="h-9 w-40" />
      </Card>

      <TableSkeleton rows={5} cols={4} />
    </div>
  )
}
