import { RouteStub } from "@/components/route-stub";

export default function AuthPage() {
  return (
    <RouteStub
      title="Phone entry"
      description="Enter mobile number to receive an OTP."
      nextHref="/auth/otp"
      nextLabel="Simulate: go to OTP"
    />
  );
}
