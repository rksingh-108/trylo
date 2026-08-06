"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  CreditCard,
  Home as HomeIcon,
  LogOut,
  MapPin,
  Palette,
  QrCode,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  PageTransition,
  RatingStars,
  ThemeToggle,
  toast,
} from "@trylo/ui";
import { useCurrentUser, useLogout, usePaymentMethods, useSavedPlaces } from "@trylo/mock-data/hooks";
import type { PaymentMethod, SavedPlaceLabel } from "@trylo/types";

const PAYMENT_ICONS: Record<PaymentMethod["type"], React.ComponentType<{ size?: number; className?: string }>> = {
  upi: QrCode,
  card: CreditCard,
  cash: Wallet,
};

const PLACE_ICONS: Record<SavedPlaceLabel, React.ComponentType<{ size?: number; className?: string }>> = {
  home: HomeIcon,
  work: Briefcase,
  other: MapPin,
};

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
  const { data: user } = useCurrentUser();
  const { data: savedPlaces } = useSavedPlaces();
  const { data: paymentMethods } = usePaymentMethods();
  const logout = useLogout();

  function handleLogout() {
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success("Logged out");
        queryClient.clear();
        router.push("/auth");
      },
    });
  }

  return (
    <PageTransition className="flex flex-1 flex-col px-5 pb-8 pt-8">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-elevation-1">
        <Avatar className="h-16 w-16 ring-2 ring-primary/20">
          {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
          <AvatarFallback className="text-lg">{user?.name ? initials(user.name) : "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-foreground">{user?.name || "Rider"}</p>
          <p className="text-sm text-muted-foreground">+91 {user?.phone}</p>
          <div className="mt-1.5">
            <RatingStars value={user?.rating ?? 5} size={14} />
          </div>
        </div>
      </div>

      {/* Saved places */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Saved places</p>
        {savedPlaces && savedPlaces.length === 0 ? (
          <EmptyState
            icon={<MapPin />}
            title="No saved places"
            description="Save home and work to book rides faster."
            className="rounded-xl border border-border bg-card py-10"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card shadow-elevation-1">
            {savedPlaces?.map((place) => {
              const Icon = PLACE_ICONS[place.label];
              return (
                <div key={place.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                    <Icon size={18} className="text-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{place.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{place.address}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment methods */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Payment methods</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card shadow-elevation-1">
          {paymentMethods?.map((pm) => {
            const Icon = PAYMENT_ICONS[pm.type];
            return (
              <div key={pm.id} className="flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                  <Icon size={18} className="text-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{pm.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{pm.detail}</p>
                </div>
                {pm.isDefault && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Default
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Settings</p>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-elevation-1">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
            <Palette size={18} className="text-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Appearance</p>
            <p className="truncate text-xs text-muted-foreground">Light, dark or match your device</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Logout */}
      <div className="mt-auto pt-6">
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
            >
              <LogOut size={16} />
              Log out
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log out of TRYLO?</DialogTitle>
              <DialogDescription>You&apos;ll need to verify your phone number again to sign back in.</DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex gap-3">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1">
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="destructive" className="flex-1" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
