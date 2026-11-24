export default function ProjectSkeleton() {
  return (
    <div className="space-y-8 pb-20 text-left">
      {/* Skeleton header */}
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded" />
        <div className="h-10 w-64 bg-[var(--bg-tertiary)] rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          {[1, 2, 3, 4].map((skeletonIndex) => (
            <div
              key={skeletonIndex}
              className="h-20 bg-[var(--bg-tertiary)] rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
