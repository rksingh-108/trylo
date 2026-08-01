import { RouteStub } from "@/components/route-stub";

export default function VerificationPendingPage() {
  return (
    <RouteStub
      title="Verification pending"
      description="Documents are under review. We'll notify you once verified."
      nextHref="/dashboard"
      nextLabel="Simulate: verified, go to dashboard"
    />
  );
}
