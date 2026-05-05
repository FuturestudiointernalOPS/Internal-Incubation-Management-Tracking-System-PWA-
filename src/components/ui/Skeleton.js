import React from 'react';

/**
 * IMPACTOS DATA-FIRST SKELETON
 * High-performance placeholder for modular data loading.
 */

export const Skeleton = ({ className, variant = 'rect' }) => {
  const baseClass = "animate-pulse bg-[var(--border-primary)]/50";
  const variants = {
    rect: "rounded-xl",
    circle: "rounded-full",
    text: "h-3 w-3/4 rounded-md"
  };

  return (
    <div className={`${baseClass} ${variants[variant]} ${className}`} />
  );
};

export const TableSkeleton = ({ rows = 5 }) => (
  <div className="space-y-4 w-full">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 border border-[var(--border-primary)] rounded-xl opacity-50">
        <Skeleton className="w-10 h-10" variant="circle" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-2 w-1/2" />
        </div>
        <Skeleton className="w-20 h-8" />
      </div>
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="card space-y-6 opacity-50">
    <div className="flex justify-between">
      <Skeleton className="w-12 h-12" />
      <Skeleton className="w-16 h-6" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <div className="pt-6 border-t border-[var(--border-primary)] flex justify-between">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-24" />
    </div>
  </div>
);
