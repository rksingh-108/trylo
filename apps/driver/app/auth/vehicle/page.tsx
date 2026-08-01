import { RouteStub } from "@/components/route-stub";

export default function VehicleDetailsPage() {
  return (
    <RouteStub
      title="Vehicle details"
      description="Vehicle type, make, model, registration number."
      nextHref="/auth/pending"
      nextLabel="Simulate: submit for verification"
    />
  );
}
