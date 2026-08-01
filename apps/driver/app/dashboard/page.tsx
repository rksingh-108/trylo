import { RouteStub } from "@/components/route-stub";

export default function DashboardPage() {
  return (
    <RouteStub
      title="Dashboard"
      description="Online/offline toggle, earnings summary, map."
      nextHref="/ride"
      nextLabel="Simulate: incoming ride request"
    />
  );
}
