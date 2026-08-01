"use client";

import * as React from "react";
import { Car, Gift, Plus, RotateCcw, Wallet as WalletIcon } from "lucide-react";
import { Button, cn, Input } from "@trylo/ui";
import { useTopUpWallet, useWallet } from "@trylo/mock-data/hooks";
import type { WalletTransaction } from "@trylo/types";

const QUICK_AMOUNTS = [100, 200, 500, 1000];

const CATEGORY_ICONS: Record<WalletTransaction["category"], React.ComponentType<{ size?: number; className?: string }>> = {
  ride: Car,
  top_up: WalletIcon,
  refund: RotateCcw,
  payout: WalletIcon,
  bonus: Gift,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function WalletPage() {
  const { data: wallet } = useWallet();
  const topUp = useTopUpWallet();
  const [customAmount, setCustomAmount] = React.useState("");
  const [selected, setSelected] = React.useState<number | null>(null);

  async function handleAdd(amount: number) {
    if (amount <= 0) return;
    await topUp.mutateAsync(amount);
    setCustomAmount("");
    setSelected(null);
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">Wallet</h1>

      <div className="mt-5 rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-80">Available balance</p>
        <p className="mt-1 font-display text-3xl font-semibold">₹{wallet?.balance ?? 0}</p>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-foreground">Add money</p>
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
                "rounded-lg border py-2 text-sm font-medium transition-colors",
                selected === amount ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"
              )}
            >
              ₹{amount}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Enter custom amount"
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value.replace(/\D/g, ""));
              setSelected(null);
            }}
          />
          <Button
            disabled={topUp.isPending || !(selected || Number(customAmount) > 0)}
            onClick={() => handleAdd(selected ?? Number(customAmount))}
          >
            <Plus size={16} />
            {topUp.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>

      <div className="mt-6 flex-1">
        <p className="mb-2 text-sm font-medium text-foreground">Transaction history</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {wallet?.transactions.map((txn) => {
            const Icon = CATEGORY_ICONS[txn.category];
            return (
              <div key={txn.id} className="flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                  <Icon size={18} className="text-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{txn.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(txn.createdAt)}</p>
                </div>
                <span
                  className={cn(
                    "font-mono text-sm font-semibold",
                    txn.type === "credit" ? "text-success" : "text-foreground"
                  )}
                >
                  {txn.type === "credit" ? "+" : "-"}₹{txn.amount}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
