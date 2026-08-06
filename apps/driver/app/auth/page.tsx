"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Car } from "lucide-react";
import { Button, Input, Label, PageTransition } from "@trylo/ui";
import { useRequestDriverOtp } from "@trylo/mock-data/hooks";
import { phoneSchema, type PhoneInput } from "@/lib/validation";

export default function AuthPage() {
  const router = useRouter();
  const requestOtp = useRequestDriverOtp();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneInput>({ resolver: zodResolver(phoneSchema) });

  async function onSubmit(values: PhoneInput) {
    await requestOtp.mutateAsync(values.phone);
    router.push(`/auth/otp?phone=${values.phone}`);
  }

  return (
    <PageTransition className="relative flex flex-1 flex-col justify-between overflow-hidden px-6 pb-8 pt-16">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-[90px]" />
      <div className="pointer-events-none absolute -left-20 top-44 h-56 w-56 rounded-full bg-amber-500/10 blur-[80px]" />

      <div className="relative">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow animate-float">
          <Car size={26} />
        </span>
        <p className="mt-6 font-mono text-xs uppercase tracking-widest text-primary">TRYLO DRIVER</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-foreground">
          Drive with TRYLO,
          <br />
          earn on your terms.
        </h1>
        <p className="mt-3 max-w-[26rem] text-sm text-muted-foreground">
          Flexible hours, transparent payouts, and a captain community that has your back.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Mobile number</Label>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-card pl-4 shadow-elevation-1 transition-all focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15">
            <span className="font-mono text-base text-muted-foreground">+91</span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
              className="border-0 bg-transparent pl-2 shadow-none focus-visible:ring-0"
              {...register("phone")}
            />
          </div>
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          {requestOtp.isError && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
        </div>

        <Button type="submit" size="lg" variant="glow" disabled={requestOtp.isPending}>
          {requestOtp.isPending ? "Sending code..." : "Continue"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to TRYLO's Driver Terms and Privacy Policy.
        </p>
      </form>
    </PageTransition>
  );
}
