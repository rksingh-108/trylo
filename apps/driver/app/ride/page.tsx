import { RouteStub } from "@/components/route-stub";

export default function ActiveRidePage() {
  return (
    <RouteStub
      title="Active ride"
      description="Navigate to pickup, verify rider OTP, in-progress, end ride."
      nextHref="/dashboard"
      nextLabel="Simulate: ride ended"
    />
  );
}
