import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-muted/30 lg:mx-auto lg:max-w-[1600px] lg:flex-row lg:overflow-hidden">
      <div className="flex flex-col border-b p-4 sm:p-5 lg:h-full lg:w-7/12 lg:border-b-0 lg:border-r">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 sm:w-48" />
          <Skeleton className="h-9 w-32 shrink-0" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="flex flex-col bg-card lg:w-5/12">
        <div className="border-b bg-gradient-brand-soft p-4">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1 space-y-4 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="space-y-3 border-t bg-muted/30 p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}
