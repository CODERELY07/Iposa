import { Skeleton } from '@/components/ui/skeleton'
import { ProductGridSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div>
      <div className="border-b border-border bg-hero-wash">
        <div className="mx-auto max-w-310 space-y-5 px-4 py-16 sm:px-7 sm:py-14">
          <Skeleton className="h-6 w-56 rounded-full" />
          <Skeleton className="h-14 w-full max-w-2xl" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-11.5 w-full max-w-115 rounded-[9px]" />
        </div>
      </div>

      <div className="mx-auto max-w-310 space-y-2.5 overflow-hidden px-4 py-5.5 sm:px-7">
        <div className="flex gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-310 px-4 py-8.5 pb-20 sm:px-7">
        <div className="my-5.5 flex items-baseline justify-between gap-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3 w-20" />
        </div>
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  )
}
