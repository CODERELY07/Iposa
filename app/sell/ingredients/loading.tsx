import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>

      <Card className="grid grid-cols-1 divide-y overflow-hidden py-0 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="space-y-3 bg-muted/30 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-3 p-4 md:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}
