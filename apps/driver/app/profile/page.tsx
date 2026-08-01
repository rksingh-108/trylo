"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle, LogOut, Mail, Phone } from "lucide-react";
import { Avatar, AvatarFallback, RatingStars, StatusPill } from "@trylo/ui";
import { useCurrentDriver, useKycDocuments } from "@trylo/mock-data/hooks";

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

  function handleLogout() {
    queryClient.clear();
    router.push("/auth");
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">{driver?.name ? initials(driver.name) : "?"}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{driver?.name || "Driver"}</p>
          <p className="text-sm text-muted-foreground">+91 {driver?.phone}</p>
          <div className="mt-1 flex items-center gap-2">
            <RatingStars value={driver?.rating ?? 5} size={14} />
            <span className="text-xs text-muted-foreground">{driver?.totalRides ?? 0} rides</span>
          </div>
        </div>
      </div>

      {driver?.vehicle && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-foreground">Vehicle</p>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">
              {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
            </p>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{driver.vehicle.registrationNumber}</p>
          </div>
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
        <p className="mb-2 text-sm font-medium text-foreground">Support</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent">
              <HelpCircle size={18} className="text-foreground" />
            </span>
            <p className="text-sm font-medium text-foreground">Help center</p>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent">
              <Phone size={18} className="text-foreground" />
            </span>
            <p className="text-sm font-medium text-foreground">Call support</p>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent">
              <Mail size={18} className="text-foreground" />
            </span>
            <p className="text-sm font-medium text-foreground">Email us</p>
          </div>
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
