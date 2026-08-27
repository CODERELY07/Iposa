import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-5">
        <PageHeaderSkeleton withAction />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 sm:w-56" />
      </div>
      <TableSkeleton rows={7} cols={6} />
    </div>
  )
}
