import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <TableSkeleton rows={8} cols={4} />
    </div>
  )
}
