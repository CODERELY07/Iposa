import { Skeleton } from '@/components/ui/skeleton'
import { CardListSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <CardListSkeleton count={4} />
    </div>
  )
}
