"use client";

import * as React from "react";
import { motion } from "framer-motion";

/**
 * Wrap each route's page content with this. Combine with a keyed
 * <AnimatePresence mode="wait"> in the root layout (keyed by pathname) for
 * cross-route transitions; used alone it still gives a mount-in animation.
 */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.26, ease: [0, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
