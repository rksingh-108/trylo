import RideDetailClient from "./ride-detail-client";

// Ride IDs are created at runtime and fetched client-side (React Query) -
// there is nothing to enumerate at build time. Next.js's `output: "export"`
// requires generateStaticParams() to return at least one entry (an empty
// array is treated the same as the function being absent - confirmed against
// next/dist/build/index.js's `hasGenerateStaticParams` check), so this emits
// one placeholder shell; the client component ignores the build-time param
// entirely and reads the real id from the browser's actual URL via
// useParams(). Azure Static Web Apps' navigationFallback
// (staticwebapp.config.json) serves that same shell for any other id typed
// directly into the address bar so client-side routing can still resolve it.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function RideDetailPage() {
  return <RideDetailClient />;
}
