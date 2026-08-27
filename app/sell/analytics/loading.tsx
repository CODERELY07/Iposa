import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { ChartCardSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="h-14 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="space-y-2 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCardSkeleton className="lg:col-span-2" />
        <ChartCardSkeleton />
      </div>

      <TableSkeleton rows={5} cols={4} />
    </div>
  )
}
