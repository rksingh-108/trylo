"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label } from "@trylo/ui";
import { useRequestOtp } from "@trylo/mock-data/hooks";
import { phoneSchema, type PhoneInput } from "@/lib/validation";

export default function AuthPage() {
  const router = useRouter();
  const requestOtp = useRequestOtp();
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
    <div className="flex flex-1 flex-col justify-between px-6 pb-8 pt-16">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-primary">TRYLO</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-foreground">
          Ride in minutes,
          <br />
          anywhere in the city.
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Mobile number</Label>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background pl-4 focus-within:ring-2 focus-within:ring-ring">
            <span className="font-mono text-base text-muted-foreground">+91</span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
              className="border-0 pl-2 focus-visible:ring-0"
              {...register("phone")}
            />
          </div>
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          {requestOtp.isError && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
        </div>

        <Button type="submit" size="lg" disabled={requestOtp.isPending}>
          {requestOtp.isPending ? "Sending code..." : "Continue"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to TRYLO's Terms of Service and Privacy Policy.
        </p>
      </form>
    </div>
  );
}
