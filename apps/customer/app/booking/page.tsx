import { RouteStub } from "@/components/route-stub";

export default function BookingPage() {
  return (
    <RouteStub
      title="Ride booking"
      description="Vehicle type selection, fare estimates, promo code."
      nextHref="/matching"
      nextLabel="Simulate: request ride"
    />
  );
}
