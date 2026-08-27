"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bike, Car, CarTaxiFront, HelpCircle, LogOut, Mail, Navigation, Palette, Phone } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  RatingStars,
  StatusPill,
  ThemeToggle,
} from "@trylo/ui";
import { useCurrentDriver, useKycDocuments, useLogoutDriver, useUpdateMarkerStyle } from "@trylo/mock-data/hooks";
import type { MarkerStyle, VehicleType } from "@trylo/types";

const VEHICLE_ICONS: Record<VehicleType, React.ComponentType<{ size?: number; className?: string }>> = {
  bike: Bike,
  auto: CarTaxiFront,
  cab: Car,
};

const MARKER_STYLE_OPTIONS: { value: MarkerStyle; label: string; description: string }[] = [
  { value: "classic", label: "Classic", description: "Simple pulsing dot" },
  { value: "arrow", label: "Arrow", description: "Forward-pointing chevron" },
  { value: "beacon", label: "Beacon", description: "Bigger, glowing marker" },
  { value: "compact", label: "Compact", description: "Small, no pulse" },
];

/** A lightweight stand-in for premium-map.tsx's liveDotHtml, just for picking a style — doesn't need pixel-parity with the real map marker. */
function MarkerStylePreview({ style, VehicleIcon }: { style: MarkerStyle; VehicleIcon: React.ComponentType<{ size?: number; className?: string }> }) {
  if (style === "compact") {
    return (
      <span className="grid h-4 w-4 place-items-center rounded-full border-[1.5px] border-background bg-primary shadow-sm">
        <VehicleIcon size={9} className="text-primary-foreground" />
      </span>
    );
  }
  if (style === "beacon") {
    return (
      <span className="relative grid h-9 w-9 place-items-center rounded-full border-[3px] border-background bg-primary shadow-md">
        <span className="absolute -inset-1.5 rounded-full bg-primary/25" />
        <VehicleIcon size={15} className="relative text-primary-foreground" />
      </span>
    );
  }
  if (style === "arrow") {
    return (
      <span className="relative grid h-9 w-9 place-items-center">
        <span
          className="absolute inset-0 bg-primary drop-shadow"
          style={{ clipPath: "polygon(50% 0%, 92% 88%, 50% 66%, 8% 88%)" }}
        />
        <span className="absolute bottom-0 grid h-4 w-4 place-items-center rounded-full border-[1.5px] border-primary bg-background">
          <VehicleIcon size={9} className="text-primary" />
        </span>
      </span>
    );
  }
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-primary shadow-sm">
      <VehicleIcon size={11} className="text-primary-foreground" />
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: driver } = useCurrentDriver();
  const { data: documents } = useKycDocuments();
  const logout = useLogoutDriver();
  const updateMarkerStyle = useUpdateMarkerStyle();

  function handleLogout() {
    logout.mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        router.push("/auth");
      },
    });
  }

  const VehicleIcon = driver?.vehicle ? VEHICLE_ICONS[driver.vehicle.type] : undefined;

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <Card variant="elevated" className="animate-slide-up overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <CardContent className="flex items-center gap-4 p-5">
            <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/15">
              <AvatarFallback className="text-lg">{driver?.name ? initials(driver.name) : "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-display text-lg font-semibold text-foreground">{driver?.name || "Driver"}</p>
                {driver?.verificationStatus && <StatusPill status={driver.verificationStatus} />}
              </div>
              <p className="text-sm text-muted-foreground">+91 {driver?.phone}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <RatingStars value={driver?.rating ?? 5} size={14} />
                <span className="text-xs text-muted-foreground">{driver?.totalRides ?? 0} rides</span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {driver?.vehicle && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-foreground">Vehicle</p>
          <Card variant="default">
            <CardContent className="flex items-center gap-3 p-4">
              {VehicleIcon && (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent">
                  <VehicleIcon size={20} className="text-foreground" />
                </span>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
                </p>
                <p className="mt-1 font-mono text-sm text-muted-foreground">{driver.vehicle.registrationNumber}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Documents</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {documents?.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4">
              <span className="text-sm text-foreground">{doc.label}</span>
              <StatusPill status={doc.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Settings</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                <Palette size={18} className="text-foreground" />
              </span>
              <p className="text-sm font-medium text-foreground">Appearance</p>
            </div>
            <ThemeToggle />
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between p-4 text-left">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                    <Navigation size={18} className="text-foreground" />
                  </span>
                  <p className="text-sm font-medium text-foreground">Marker style</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {MARKER_STYLE_OPTIONS.find((o) => o.value === (driver?.markerStyle ?? "classic"))?.label}
                </span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Live map marker style</DialogTitle>
                <DialogDescription>
                  Choose how your live position appears on the map. Your vehicle type is always shown correctly regardless of style.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {MARKER_STYLE_OPTIONS.map((option) => {
                  const selected = (driver?.markerStyle ?? "classic") === option.value;
                  return (
                    <DialogClose asChild key={option.value}>
                      <button
                        type="button"
                        onClick={() => updateMarkerStyle.mutate(option.value)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                          selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"
                        }`}
                      >
                        <MarkerStylePreview style={option.value} VehicleIcon={VehicleIcon ?? Bike} />
                        <span className="text-sm font-medium text-foreground">{option.label}</span>
                        <span className="text-center text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    </DialogClose>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Support</p>
        {/* Not wired up yet - no support backend/telephony exists. Shown
            disabled rather than as live-looking rows that do nothing. */}
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card opacity-50">
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
              <HelpCircle size={18} className="text-foreground" />
            </span>
            <p className="flex-1 text-sm font-medium text-foreground">Help center</p>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
              <Phone size={18} className="text-foreground" />
            </span>
            <p className="flex-1 text-sm font-medium text-foreground">Call support</p>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
              <Mail size={18} className="text-foreground" />
            </span>
            <p className="flex-1 text-sm font-medium text-foreground">Email us</p>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <LogOut size={16} />
              Log out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log out of Trylo Driver?</DialogTitle>
              <DialogDescription>
                You&apos;ll need to verify your phone number again to sign back in.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex gap-3">
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="flex-1">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" variant="destructive" className="flex-1" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
