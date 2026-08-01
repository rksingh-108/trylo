import { RouteStub } from "@/components/route-stub";

export default function LiveRidePage() {
  return (
    <RouteStub
      checkpoint="Checkpoint 4"
      title="Live ride"
      description="Map with route, driver location, contact/SOS, live fare."
      nextHref="/ride/complete"
      nextLabel="Simulate: end ride"
    />
  );
}
