"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Home as HomeIcon, MapPin, Search, User, Wallet } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PageTransition,
  PlaceAutocomplete,
  PremiumMap,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@trylo/ui";
import { useCurrentUser, useSavedPlaces } from "@trylo/mock-data/hooks";
import { CITY_CENTER } from "@trylo/mock-data";
import type { GeoPoint } from "@trylo/types";
import { useBookingStore } from "@/lib/store";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const PLACE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  home: HomeIcon,
  work: Briefcase,
};

export default function HomePage() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { pickup, setPickup, setDrop } = useBookingStore();
  const [query, setQuery] = React.useState("");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const { data: savedPlaces, isLoading: savedPlacesLoading } = useSavedPlaces();

  React.useEffect(() => {
    if (!pickup) {
      setPickup({ address: "Current Location", point: CITY_CENTER });
    }
  }, [pickup, setPickup]);

  React.useEffect(() => {
    if (!sheetOpen) setQuery("");
  }, [sheetOpen]);

  function handleSelect(address: string, point: GeoPoint) {
    setDrop({ address, point });
    setSheetOpen(false);
    router.push("/booking");
  }

  const mapCenter = pickup?.point ?? CITY_CENTER;

  return (
    <PageTransition className="relative flex flex-1 flex-col overflow-hidden">
      <PremiumMap className="absolute inset-0 h-full w-full" center={mapCenter} pickup={mapCenter} zoom={15} />

      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <div className="glass rounded-2xl px-4 py-2.5 shadow-elevation-2">
          <p className="text-xs text-muted-foreground">{greeting()}</p>
          <p className="font-display text-base font-semibold text-foreground">{user?.name || "Rider"}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/wallet"
            className="glass grid h-11 w-11 place-items-center rounded-full text-foreground shadow-elevation-2 transition-transform active:scale-95"
            aria-label="Wallet"
          >
            <Wallet size={18} />
          </Link>
          <Link
            href="/profile"
            className="glass grid h-11 w-11 place-items-center rounded-full text-foreground shadow-elevation-2 transition-transform active:scale-95"
            aria-label="Profile"
          >
            <User size={18} />
          </Link>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex flex-col gap-3 px-5 pb-5">
        <motion.button
          type="button"
          onClick={() => setSheetOpen(true)}
          whileTap={{ scale: 0.98 }}
          className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-4 text-left shadow-elevation-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15">
            <Search size={17} className="text-primary" />
          </span>
          <span className="flex-1">
            <p className="text-xs text-muted-foreground">Where to?</p>
            <p className="text-sm font-medium text-foreground">Search destination</p>
          </span>
        </motion.button>

        {savedPlaces && savedPlaces.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedPlaces.map((place) => {
              const Icon = PLACE_ICONS[place.label] ?? MapPin;
              return (
                <motion.button
                  key={place.id}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleSelect(place.address, place.point)}
                  className="glass flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 shadow-elevation-1"
                >
                  <Icon size={14} className="text-foreground" />
                  <span className="text-xs font-medium text-foreground">{place.name}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Where to?</SheetTitle>
          </SheetHeader>

          <PlaceAutocomplete
            value={query}
            onChange={setQuery}
            onSelect={(place) => handleSelect(place.description, { lat: place.lat, lng: place.lng })}
            placeholder="Search destination"
            autoFocus
          />

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved places</p>

            {savedPlacesLoading && (
              <div className="space-y-2">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            )}

            <div className="divide-y divide-border">
              {savedPlaces?.map((place) => {
                const Icon = PLACE_ICONS[place.label] ?? MapPin;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelect(place.address, place.point)}
                    className="-mx-1 flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors hover:bg-accent/60"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                      <Icon size={17} className="text-foreground" />
                    </span>
                    <span className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{place.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{place.address}</p>
                    </span>
                  </button>
                );
              })}

              {!savedPlacesLoading && savedPlaces?.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">No saved places yet</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}
