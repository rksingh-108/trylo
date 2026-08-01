"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Home as HomeIcon, MapPin, Search, User, Wallet } from "lucide-react";
import Link from "next/link";
import { Input, MapPlaceholder } from "@trylo/ui";
import { useAddressSearch, useCurrentUser, useSavedPlaces } from "@trylo/mock-data/hooks";
import { CITY_CENTER } from "@trylo/mock-data";
import type { GeoPoint } from "@trylo/types";
import { useBookingStore } from "@/lib/store";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { pickup, setPickup, setDrop } = useBookingStore();
  const [query, setQuery] = React.useState("");
  const [searchActive, setSearchActive] = React.useState(false);

  const { data: suggestions, isFetching } = useAddressSearch(query);
  const { data: savedPlaces } = useSavedPlaces();

  React.useEffect(() => {
    if (!pickup) {
      setPickup({ address: "Current Location", point: CITY_CENTER });
    }
  }, [pickup, setPickup]);

  function handleSelect(address: string, point: GeoPoint) {
    setDrop({ address, point });
    router.push("/booking");
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <MapPlaceholder className="absolute inset-0 h-full w-full" pickup={{ x: 50, y: 42 }} />

      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}</p>
          <p className="font-display text-lg font-semibold text-foreground">{user?.name || "Rider"}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/wallet"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm"
            aria-label="Wallet"
          >
            <Wallet size={18} className="text-foreground" />
          </Link>
          <Link
            href="/profile"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm"
            aria-label="Profile"
          >
            <User size={18} className="text-foreground" />
          </Link>
        </div>
      </div>

      <div className="relative z-10 mt-auto rounded-t-2xl border-t border-border bg-card px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-base font-semibold text-foreground">Where to?</p>
          {searchActive && (
            <button
              type="button"
              onClick={() => {
                setSearchActive(false);
                setQuery("");
              }}
              className="text-xs font-medium text-muted-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search destination"
            className="pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchActive(true)}
          />
        </div>

        {searchActive && (
          <div className="mt-3 max-h-72 divide-y divide-border overflow-y-auto">
            {!query &&
              savedPlaces?.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handleSelect(place.address, place.point)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent">
                    {place.label === "home" ? (
                      <HomeIcon size={16} className="text-foreground" />
                    ) : (
                      <Briefcase size={16} className="text-foreground" />
                    )}
                  </span>
                  <span>
                    <p className="text-sm font-medium text-foreground">{place.name}</p>
                    <p className="text-xs text-muted-foreground">{place.address}</p>
                  </span>
                </button>
              ))}

            {query && isFetching && <p className="py-3 text-sm text-muted-foreground">Searching...</p>}

            {query &&
              !isFetching &&
              suggestions?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s.primaryText, s.point)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent">
                    <MapPin size={16} className="text-foreground" />
                  </span>
                  <span>
                    <p className="text-sm font-medium text-foreground">{s.primaryText}</p>
                    <p className="text-xs text-muted-foreground">{s.secondaryText}</p>
                  </span>
                </button>
              ))}

            {query && !isFetching && suggestions?.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">No places found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
