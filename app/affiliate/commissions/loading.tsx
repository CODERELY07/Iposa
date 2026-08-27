import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <TableSkeleton rows={6} cols={6} />
    </div>
  )
}
