import { Skeleton } from '@/components/ui/skeleton'
import { ProductGridSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div>
      <div className="border-b bg-hero-wash">
        <div className="mx-auto flex max-w-310 items-center gap-5 px-4 py-10 sm:px-6">
          <Skeleton className="size-20 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-310 px-4 py-8 sm:px-6">
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  )
}
