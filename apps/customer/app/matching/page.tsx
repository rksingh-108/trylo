import { RouteStub } from "@/components/route-stub";

export default function MatchingPage() {
  return (
    <RouteStub
      title="Finding driver"
      description="Animated matching state, then driver-found card."
      nextHref="/ride"
      nextLabel="Simulate: driver matched"
    />
  );
}
