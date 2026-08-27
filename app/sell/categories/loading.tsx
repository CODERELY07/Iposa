import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-6">
        <PageHeaderSkeleton withAction />
      </div>
      <TableSkeleton rows={6} cols={2} />
    </div>
  )
}
