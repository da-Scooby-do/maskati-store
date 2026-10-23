"use client";

import { motion } from "motion/react";

/** The leaf mark breathing while the shop loads. */
export function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <motion.img
        alt="" animate={{ opacity: [0.35, 1, 0.35], scale: [0.94, 1, 0.94] }} className="w-16"
        src="/assets/maskati-mark.png" transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
