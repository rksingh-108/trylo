"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, User } from "lucide-react";
import { Avatar, AvatarFallback, Button, Input, Label, PageTransition, toast } from "@trylo/ui";
import { useCompleteProfile } from "@trylo/mock-data/hooks";
import { profileSchema, type ProfileInput } from "@/lib/validation";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] } },
};

export default function ProfileSetupPage() {
  const router = useRouter();
  const completeProfile = useCompleteProfile();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) });

  const nameValue = watch("name");
  const initials = React.useMemo(() => {
    const trimmed = nameValue?.trim();
    if (!trimmed) return null;
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [nameValue]);

  async function onSubmit(values: ProfileInput) {
    try {
      await completeProfile.mutateAsync({ name: values.name, email: values.email || undefined });
      toast.success("Profile saved");
      router.push("/home");
    } catch {
      toast.error("Couldn't save your profile. Try again.");
    }
  }

  return (
    <PageTransition className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative flex flex-1 flex-col justify-between px-6 pb-8 pt-16"
      >
        <motion.div variants={item}>
          <h1 className="font-display text-2xl font-semibold text-foreground">Tell us about you</h1>
          <p className="mt-2 text-sm text-muted-foreground">This helps drivers recognize you on the ride.</p>
        </motion.div>

        <motion.div variants={item} className="flex justify-center">
          <Avatar className="h-24 w-24 border-4 border-card shadow-elevation-2">
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-amber-500/10 text-2xl font-semibold text-primary">
              {initials ?? <User className="h-9 w-9 text-muted-foreground" />}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        <motion.form variants={item} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="e.g. Aditi Sharma" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <Button type="submit" size="lg" variant="glow" className="mt-2 w-full" disabled={completeProfile.isPending}>
            {completeProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {completeProfile.isPending ? "Saving..." : "Start riding"}
          </Button>
        </motion.form>
      </motion.div>
    </PageTransition>
  );
}
