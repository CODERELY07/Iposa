import { Skeleton } from '@/components/ui/skeleton'
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      <StatGridSkeleton count={4} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TableSkeleton rows={5} cols={3} />
        <TableSkeleton rows={5} cols={3} />
      </div>
    </div>
  )
}
