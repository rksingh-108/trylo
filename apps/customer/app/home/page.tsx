import { RouteStub } from "@/components/route-stub";

export default function HomePage() {
  return (
    <RouteStub
      title="Home"
      description="Map view, current location, destination search."
      nextHref="/booking"
      nextLabel="Simulate: go to booking"
    />
  );
}
