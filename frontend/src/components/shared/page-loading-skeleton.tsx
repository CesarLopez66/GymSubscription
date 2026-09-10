import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level fallback rendered by each segment's `loading.tsx` while its
 * page chunk streams in — distinct from the in-place `isLoading` skeletons
 * pages already render once mounted (those cover the data fetch; this one
 * covers the navigation itself, so there's no blank flash between clicking
 * a nav link and the page's own skeleton taking over).
 */
export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  )
}
