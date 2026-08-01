import { RouteStub } from "@/components/route-stub";

export default function OtpPage() {
  return (
    <RouteStub
      title="OTP verification"
      description="4-digit OTP input with auto-advance."
      nextHref="/auth/profile"
      nextLabel="Simulate: go to profile setup"
    />
  );
}
