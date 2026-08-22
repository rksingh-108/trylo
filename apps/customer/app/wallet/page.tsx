"use client";

import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  Car,
  Gift,
  Plus,
  RotateCcw,
  WalletCards,
  Wallet as WalletIcon,
} from "lucide-react";
import {
  AnimatedCounter,
  Button,
  EmptyState,
  Input,
  PageTransition,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  cn,
  toast,
} from "@trylo/ui";
import { useTopUpWallet, useWallet } from "@trylo/mock-data/hooks";
import type { WalletTransaction } from "@trylo/types";

const QUICK_AMOUNTS = [100, 200, 500, 1000];

const CATEGORY_ICONS: Record<WalletTransaction["category"], React.ComponentType<{ size?: number; className?: string }>> = {
  ride: Car,
  top_up: ArrowDownToLine,
  refund: RotateCcw,
  payout: ArrowUpFromLine,
  bonus: Gift,
  cancellation_fee: Ban,
};

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function WalletPage() {
  const { data: wallet, isLoading } = useWallet();
  const topUp = useTopUpWallet();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [customAmount, setCustomAmount] = React.useState("");
  const [selected, setSelected] = React.useState<number | null>(null);

  const amountToAdd = selected ?? Number(customAmount);
  const transactions = wallet?.transactions ?? [];

  async function handleAdd(amount: number) {
    if (amount <= 0) return;
    try {
      await topUp.mutateAsync(amount);
      toast.success(`₹${amount} added to your wallet`);
      setCustomAmount("");
      setSelected(null);
      setSheetOpen(false);
    } catch {
      toast.error("Couldn't add money. Please try again.");
    }
  }

  return (
    <PageTransition className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">Wallet</h1>

      {/* Balance card */}
      <div className="relative mt-5 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-amber-400 via-primary to-amber-600 p-6 text-primary-foreground shadow-glow">
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <p className="text-sm font-medium text-primary-foreground/80">Available balance</p>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
            <WalletCards size={18} />
          </span>
        </div>

        <div className="relative mt-1 font-display text-4xl font-semibold">
          <AnimatedCounter value={wallet?.balance ?? 0} prefix="₹" className="font-display text-4xl font-semibold" />
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="relative mt-5 border-0 bg-white/20 text-primary-foreground shadow-none backdrop-blur-sm hover:bg-white/30"
            >
              <Plus size={16} />
              Add money
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add money</SheetTitle>
              <SheetDescription>Top up your TRYLO wallet for faster checkout on your next ride.</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setSelected(amount);
                    setCustomAmount("");
                  }}
                  className={cn(
                    "rounded-xl border py-3 text-sm font-medium transition-colors",
                    selected === amount
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:bg-accent"
                  )}
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <Input
                placeholder="Enter custom amount"
                inputMode="numeric"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value.replace(/\D/g, ""));
                  setSelected(null);
                }}
              />
            </div>

            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={topUp.isPending || !(amountToAdd > 0)}
              onClick={() => handleAdd(amountToAdd)}
            >
              <Plus size={16} />
              {topUp.isPending ? "Adding..." : amountToAdd > 0 ? `Add ₹${amountToAdd}` : "Add money"}
            </Button>
          </SheetContent>
        </Sheet>
      </div>

      {/* Transaction history */}
      <div className="mt-6 flex-1">
        <p className="mb-2 text-sm font-medium text-foreground">Transaction history</p>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && transactions.length === 0 && (
          <EmptyState
            icon={<WalletIcon />}
            title="No transactions yet"
            description="Your top-ups, rides and refunds will show up here."
          />
        )}

        {!isLoading && transactions.length > 0 && (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card shadow-elevation-1">
            {transactions.map((txn) => {
              const Icon = CATEGORY_ICONS[txn.category];
              const isCredit = txn.type === "credit";
              return (
                <div key={txn.id} className="flex items-center gap-3 p-4">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                      isCredit ? "bg-success/15 text-success" : "bg-accent text-foreground"
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{txn.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatRelative(txn.createdAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      isCredit ? "text-success" : "text-foreground"
                    )}
                  >
                    {isCredit ? "+" : "-"}₹{txn.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
