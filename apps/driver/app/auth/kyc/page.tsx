import { RouteStub } from "@/components/route-stub";

export default function KycPage() {
  return (
    <RouteStub
      title="KYC document upload"
      description="License, RC and insurance upload UI."
      nextHref="/auth/vehicle"
      nextLabel="Simulate: go to vehicle details"
    />
  );
}
