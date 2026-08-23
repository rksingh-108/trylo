import AdminRideDetailClient from "./ride-detail-client";

// Ride IDs are runtime database values fetched client-side - nothing to
// enumerate at build time. See history/[id]/page.tsx in apps/customer for
// why this returns one placeholder entry rather than an empty array.
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function AdminRideDetailPage() {
  return <AdminRideDetailClient />;
}
