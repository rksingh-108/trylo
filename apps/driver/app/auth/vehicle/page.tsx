"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Bike, Car, CarTaxiFront } from "lucide-react";
import { Button, cn, Input, Label, PageTransition } from "@trylo/ui";
import { useSubmitVehicleDetails } from "@trylo/mock-data/hooks";
import { vehicleDetailsSchema, type VehicleDetailsInput } from "@/lib/validation";
import type { VehicleType } from "@trylo/types";

const VEHICLE_OPTIONS: Array<{
  type: VehicleType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { type: "bike", label: "Bike", icon: Bike },
  { type: "auto", label: "Auto", icon: CarTaxiFront },
  { type: "cab", label: "Cab", icon: Car },
];

export default function VehicleDetailsPage() {
  const router = useRouter();
  const submitVehicle = useSubmitVehicleDetails();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VehicleDetailsInput>({
    resolver: zodResolver(vehicleDetailsSchema),
    defaultValues: { vehicleType: "bike" },
  });
  const vehicleType = watch("vehicleType");

  async function onSubmit(values: VehicleDetailsInput) {
    await submitVehicle.mutateAsync(values);
    router.push("/auth/pending");
  }

  return (
    <PageTransition className="relative flex flex-1 flex-col overflow-hidden px-6 pb-8 pt-12">
      <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-[90px]" />

      <div className="relative">
        <h1 className="font-display text-2xl font-semibold text-foreground">Vehicle details</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tell us about you and the vehicle you'll drive.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="relative mt-6 flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="e.g. Ramesh Kumar" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Vehicle type</Label>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_OPTIONS.map(({ type, label, icon: Icon }) => {
              const selected = vehicleType === type;
              return (
                <motion.button
                  key={type}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setValue("vehicleType", type, { shouldValidate: true })}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-colors",
                    selected
                      ? "border-primary bg-primary/5 shadow-elevation-1"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-full transition-colors",
                      selected ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  <span className={cn("text-xs font-medium", selected ? "text-primary" : "text-foreground")}>
                    {label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="make">Make</Label>
            <Input id="make" placeholder="Honda" {...register("make")} />
            {errors.make && <p className="text-sm text-destructive">{errors.make.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="model">Model</Label>
            <Input id="model" placeholder="Activa" {...register("model")} />
            {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="registrationNumber">Registration No.</Label>
            <Input
              id="registrationNumber"
              placeholder="KA05AB1234"
              className="uppercase"
              {...register("registrationNumber")}
            />
            {errors.registrationNumber && (
              <p className="text-sm text-destructive">{errors.registrationNumber.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="color">Color</Label>
            <Input id="color" placeholder="Black" {...register("color")} />
            {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
          </div>
        </div>

        <Button type="submit" size="lg" variant="glow" className="mt-auto" disabled={submitVehicle.isPending}>
          {submitVehicle.isPending ? "Saving..." : "Submit for verification"}
        </Button>
      </form>
    </PageTransition>
  );
}
