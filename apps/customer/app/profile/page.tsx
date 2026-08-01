"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, CreditCard, Home as HomeIcon, LogOut, QrCode, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, RatingStars } from "@trylo/ui";
import { useCurrentUser, usePaymentMethods, useSavedPlaces } from "@trylo/mock-data/hooks";
import type { PaymentMethod } from "@trylo/types";

const PAYMENT_ICONS: Record<PaymentMethod["type"], React.ComponentType<{ size?: number; className?: string }>> = {
  upi: QrCode,
  card: CreditCard,
  cash: Wallet,
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

  function handleLogout() {
    queryClient.clear();
    router.push("/auth");
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">{user?.name ? initials(user.name) : "?"}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{user?.name || "Rider"}</p>
          <p className="text-sm text-muted-foreground">+91 {user?.phone}</p>
          <div className="mt-1">
            <RatingStars value={user?.rating ?? 5} size={14} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Saved places</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {savedPlaces?.map((place) => (
            <div key={place.id} className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                {place.label === "home" ? (
                  <HomeIcon size={18} className="text-foreground" />
                ) : (
                  <Briefcase size={18} className="text-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{place.name}</p>
                <p className="truncate text-xs text-muted-foreground">{place.address}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Payment methods</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
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
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Default</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 py-3 text-sm font-medium text-destructive"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );
}
