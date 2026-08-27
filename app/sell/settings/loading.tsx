import { Skeleton } from '@/components/ui/skeleton'
import { FormCardSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <FormCardSkeleton fields={4} />
      <FormCardSkeleton fields={1} />
      <FormCardSkeleton fields={1} />
    </div>
  )
}
