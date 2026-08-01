"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label } from "@trylo/ui";
import { useCompleteProfile } from "@trylo/mock-data/hooks";
import { profileSchema, type ProfileInput } from "@/lib/validation";

export default function ProfileSetupPage() {
  const router = useRouter();
  const completeProfile = useCompleteProfile();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) });

  async function onSubmit(values: ProfileInput) {
    await completeProfile.mutateAsync({ name: values.name, email: values.email || undefined });
    router.push("/home");
  }

  return (
    <div className="flex flex-1 flex-col justify-between px-6 pb-8 pt-16">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Tell us about you</h1>
        <p className="mt-2 text-sm text-muted-foreground">This helps drivers recognize you on the ride.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="e.g. Aditi Sharma" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" size="lg" className="mt-2" disabled={completeProfile.isPending}>
          {completeProfile.isPending ? "Saving..." : "Start riding"}
        </Button>
      </form>
    </div>
  );
}
