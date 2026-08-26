"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@trylo/mock-data/hooks";

// A plain unconditional redirect("/auth") here would force a fully
// authenticated rider (valid token still in localStorage) back through phone+OTP
// on every fresh app launch (PWA relaunch, backgrounding, browser reopen) - wait
// for the session check to settle (success or 401) before deciding where to go.
export default function RootPage() {
  const router = useRouter();
  const { data: user, isFetched } = useCurrentUser();

  React.useEffect(() => {
    if (!isFetched) return;
    if (!user) {
      router.replace("/auth");
    } else if (!user.name) {
      router.replace("/auth/profile");
    } else {
      router.replace("/home");
    }
  }, [user, isFetched, router]);

  return null;
}
