"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, MessageCircleMore } from "lucide-react";
import { Button, OtpInput, PageTransition, toast } from "@trylo/ui";
import { useRequestOtp, useVerifyOtp } from "@trylo/mock-data/hooks";
import { otpSchema } from "@/lib/validation";

const RESEND_SECONDS = 30;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] } },
};

function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";

  const [otp, setOtp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [devHint, setDevHint] = React.useState<string | null>(null);
  const [shakeTrigger, setShakeTrigger] = React.useState(0);
  const [resendCooldown, setResendCooldown] = React.useState(RESEND_SECONDS);

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  React.useEffect(() => {
    if (!phone) return;
    requestOtp.mutateAsync(phone).then((res) => setDevHint(res.devHintOtp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  React.useEffect(() => {
    if (resendCooldown === 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  async function handleVerify(code: string) {
    const parsed = otpSchema.safeParse({ otp: code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the 4-digit code");
      setShakeTrigger((n) => n + 1);
      return;
    }
    setError(null);
    const result = await verifyOtp.mutateAsync({ phone, otp: code });
    if (!result.success) {
      setError("Incorrect code. Try again.");
      setShakeTrigger((n) => n + 1);
      toast.error("Incorrect code. Try again.");
      return;
    }
    toast.success("Verified!");
    router.push(result.isNewUser ? "/auth/profile" : "/home");
  }

  async function handleResend() {
    setError(null);
    setOtp("");
    const res = await requestOtp.mutateAsync(phone);
    setDevHint(res.devHintOtp);
    setResendCooldown(RESEND_SECONDS);
    toast("New code sent");
  }

  function handleOtpChange(value: string) {
    setOtp(value);
    if (value.length === 4) {
      handleVerify(value);
    }
  }

  return (
    <PageTransition className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -right-16 bottom-10 h-56 w-56 rounded-full bg-teal-500/5 blur-[100px]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative flex flex-1 flex-col justify-between px-6 pb-8 pt-16"
      >
        <motion.div variants={item}>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-600 shadow-glow-sm">
            <MessageCircleMore className="h-5 w-5 text-primary-foreground" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">Enter the code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a 4-digit code to <span className="font-medium text-foreground">+91 {phone}</span>
          </p>
        </motion.div>

        <motion.div variants={item} className="flex flex-col items-center gap-6">
          <motion.div
            key={shakeTrigger}
            animate={shakeTrigger > 0 ? { x: [0, -8, 8, -6, 6, 0] } : {}}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="glass rounded-3xl p-5 shadow-elevation-2"
          >
            <OtpInput
              length={4}
              value={otp}
              onChange={handleOtpChange}
              autoFocus
              disabled={verifyOtp.isPending}
              className="gap-4"
            />
          </motion.div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {devHint && !error && (
            <p className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">Demo OTP: {devHint}</p>
          )}
        </motion.div>

        <motion.div variants={item} className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            variant="glow"
            className="w-full"
            onClick={() => handleVerify(otp)}
            disabled={verifyOtp.isPending || otp.length < 4}
          >
            {verifyOtp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {verifyOtp.isPending ? "Verifying..." : "Verify & Continue"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={requestOtp.isPending || resendCooldown > 0}
            className="text-primary disabled:text-muted-foreground"
          >
            {resendCooldown > 0 ? `Resend code in 0:${resendCooldown.toString().padStart(2, "0")}` : "Resend code"}
          </Button>
        </motion.div>
      </motion.div>
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
