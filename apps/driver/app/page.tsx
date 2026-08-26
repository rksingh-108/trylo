"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCurrentDriver } from "@trylo/mock-data/hooks";

// A plain unconditional redirect("/auth") here would force a fully
// authenticated driver (valid token still in localStorage) back through phone+OTP
// on every fresh app launch (PWA relaunch, backgrounding, browser reopen) - wait
// for the session check to settle (success or 401) before deciding where to go.
export default function RootPage() {
  const router = useRouter();
  const { data: driver, isFetched } = useCurrentDriver();

  React.useEffect(() => {
    if (!isFetched) return;
    if (!driver) {
      router.replace("/auth");
    } else if (!driver.name) {
      router.replace("/auth/kyc");
    } else if (driver.verificationStatus !== "verified") {
      router.replace("/auth/pending");
    } else {
      router.replace("/dashboard");
    }
  }, [driver, isFetched, router]);

  return null;
}
