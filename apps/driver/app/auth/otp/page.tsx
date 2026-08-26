"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, OtpInput, PageTransition, toast } from "@trylo/ui";
import { useRequestDriverOtp, useVerifyDriverOtp } from "@trylo/mock-data/hooks";
import { otpSchema } from "@/lib/validation";

function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";

  const [otp, setOtp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [devHint, setDevHint] = React.useState<string | null>(null);

  const requestOtp = useRequestDriverOtp();
  const verifyOtp = useVerifyDriverOtp();

  React.useEffect(() => {
    if (!phone) return;
    requestOtp.mutateAsync(phone).then((res) => setDevHint(res.devHintOtp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  async function handleVerify(code: string) {
    const parsed = otpSchema.safeParse({ otp: code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the 4-digit code");
      return;
    }
    setError(null);
    let result;
    try {
      result = await verifyOtp.mutateAsync({ phone, otp: code });
    } catch {
      toast.error("Something went wrong. Try again.");
      return;
    }
    if (!result.success || !result.driver) {
      setError(result.reason === "suspended" ? "Your account has been suspended." : "Incorrect code. Try again.");
      return;
    }

    const driver = result.driver;
    if (result.isNewDriver || !driver.name) {
      router.push("/auth/kyc");
    } else if (driver.verificationStatus !== "verified") {
      router.push("/auth/pending");
    } else {
      router.push("/dashboard");
    }
  }

  async function handleResend() {
    setError(null);
    setOtp("");
    const res = await requestOtp.mutateAsync(phone);
    setDevHint(res.devHintOtp);
  }

  function handleOtpChange(value: string) {
    setOtp(value);
    if (value.length === 4) {
      handleVerify(value);
    }
  }

  return (
    <PageTransition className="relative flex flex-1 flex-col justify-between overflow-hidden px-6 pb-8 pt-16">
      <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-[90px]" />

      <div className="relative">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck size={24} />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold text-foreground">Enter the code</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 4-digit code to <span className="font-medium text-foreground">+91 {phone}</span>
        </p>
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <OtpInput length={4} value={otp} onChange={handleOtpChange} autoFocus disabled={verifyOtp.isPending} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {devHint && !error && (
          <p className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">Demo OTP: {devHint}</p>
        )}
      </div>

      <div className="relative flex flex-col gap-4">
        <Button size="lg" variant="glow" onClick={() => handleVerify(otp)} disabled={verifyOtp.isPending || otp.length < 4}>
          {verifyOtp.isPending ? "Verifying..." : "Verify & Continue"}
        </Button>
        <button
          type="button"
          onClick={handleResend}
          disabled={requestOtp.isPending}
          className="text-center text-sm font-medium text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </PageTransition>
  );
}

export default function OtpPage() {
  return (
    <React.Suspense fallback={null}>
      <OtpForm />
    </React.Suspense>
  );
}
