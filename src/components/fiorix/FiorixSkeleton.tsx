import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function FiorixSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-0 p-8 shadow-sm">
        <Skeleton className="h-8 w-1/3 mb-4 bg-muted/40" />
        <Skeleton className="h-4 w-2/3 mb-6 bg-muted/40" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 bg-muted/40" />
          <Skeleton className="h-10 w-40 bg-muted/40" />
        </div>
      </Card>

      <Card className="p-4 rounded-xl shadow-sm flex items-center justify-between border-gray-100 dark:border-border">
        <Skeleton className="h-6 w-48 bg-muted/40" />
        <Skeleton className="h-10 w-32 bg-muted/40" />
      </Card>

      <Card className="p-5 rounded-2xl shadow-sm border-gray-100 dark:border-border">
        <Skeleton className="h-5 w-40 mb-5 bg-muted/40" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-14 w-full bg-muted/40" />
          <Skeleton className="h-14 w-full bg-muted/40" />
          <Skeleton className="h-14 w-full bg-muted/40" />
          <Skeleton className="h-14 w-full bg-muted/40" />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 rounded-2xl shadow-sm border-gray-100 dark:border-border flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <Skeleton className="h-3 w-1/2 bg-muted/40" />
              <Skeleton className="h-8 w-8 rounded-lg bg-muted/40" />
            </div>
            <div className="flex justify-between items-end mt-4">
              <Skeleton className="h-8 w-24 bg-muted/40" />
              <Skeleton className="h-4 w-4 bg-muted/40" />
            </div>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-sm rounded-2xl p-5">
          <Skeleton className="h-5 w-48 mb-2 bg-muted/40" />
          <Skeleton className="h-4 w-64 mb-6 bg-muted/40" />
          <Skeleton className="h-[200px] w-full bg-muted/40" />
        </Card>
        <Card className="shadow-sm rounded-2xl p-5">
          <Skeleton className="h-5 w-48 mb-2 bg-muted/40" />
          <Skeleton className="h-4 w-64 mb-6 bg-muted/40" />
          <div className="flex justify-center mt-8">
            <Skeleton className="h-40 w-40 rounded-full bg-muted/40" />
          </div>
        </Card>
      </div>

    </div>
  );
}
