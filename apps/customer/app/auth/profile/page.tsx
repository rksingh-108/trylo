import { RouteStub } from "@/components/route-stub";

export default function ProfileSetupPage() {
  return (
    <RouteStub
      title="Profile setup"
      description="Name and basic details to finish onboarding."
      nextHref="/home"
      nextLabel="Simulate: go home"
    />
  );
}
