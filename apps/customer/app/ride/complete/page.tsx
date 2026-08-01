import { RouteStub } from "@/components/route-stub";

export default function RideCompletePage() {
  return (
    <RouteStub
      checkpoint="Checkpoint 4"
      title="Ride complete"
      description="Fare breakdown, rating and tip screen."
      nextHref="/home"
      nextLabel="Simulate: back to home"
    />
  );
}
