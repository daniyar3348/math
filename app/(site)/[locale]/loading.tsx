import { CardSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="container-app grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
