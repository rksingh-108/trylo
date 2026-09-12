"use client";

import * as React from "react";
import { BadgePlus, Loader2, Percent } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@trylo/ui";
import { useAdminPromos, useCreateAdminPromo, useUpdateAdminPromo } from "@trylo/mock-data/hooks";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminPromosPage() {
  const { data: promos, isLoading } = useAdminPromos();
  const createPromo = useCreateAdminPromo();
  const updatePromo = useUpdateAdminPromo();

  const [code, setCode] = React.useState("");
  const [discountPercent, setDiscountPercent] = React.useState("");
  const [maxDiscount, setMaxDiscount] = React.useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const percent = Number(discountPercent);
    if (!code.trim() || !Number.isFinite(percent) || percent < 1 || percent > 100) {
      toast.error("Enter a code and a discount between 1–100%");
      return;
    }
    try {
      await createPromo.mutateAsync({
        code: code.trim(),
        discountPercent: percent,
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      });
      toast.success("Promo code created");
      setCode("");
      setDiscountPercent("");
      setMaxDiscount("");
    } catch (err) {
      const message = (err as { message?: string }).message;
      toast.error(message && message !== "" ? message : "Couldn't create promo code");
    }
  }

  async function handleToggle(id: string, active: boolean) {
    await updatePromo.mutateAsync({ id, input: { active } });
    toast.success(active ? "Promo code activated" : "Promo code deactivated");
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Promo codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage customer discount codes.</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <BadgePlus size={16} />
              New promo code
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New promo code</DialogTitle>
              <DialogDescription>Customers will be able to apply this code at booking.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-code">Code</Label>
                <Input
                  id="promo-code"
                  placeholder="WEEKEND50"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={32}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="promo-percent">Discount %</Label>
                  <Input
                    id="promo-percent"
                    type="number"
                    min={1}
                    max={100}
                    placeholder="20"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="promo-max">Max ₹ (optional)</Label>
                  <Input
                    id="promo-max"
                    type="number"
                    min={1}
                    placeholder="100"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={createPromo.isPending}>
                {createPromo.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                Create promo code
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <Skeleton className="h-64 rounded-none" />
        ) : promos && promos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-mono font-semibold text-foreground">{promo.code}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 font-mono text-sm">
                      <Percent size={12} />
                      {promo.discountPercent}
                      {promo.maxDiscount ? ` · max ₹${promo.maxDiscount}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={promo.active ? "success" : "secondary"}>{promo.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(promo.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Switch checked={promo.active} onCheckedChange={(checked) => handleToggle(promo.id, checked)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">No promo codes yet — create one above.</p>
        )}
      </Card>
    </div>
  );
}