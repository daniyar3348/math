"use client";

import { BRAND } from "@/lib/brand";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2 font-extrabold text-lg text-slate-800">
      <span
        className="grid place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 font-bold text-white shadow-sm"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {BRAND.mark}
      </span>
      <span>
        {BRAND.name.replace("ó", "ó")}
      </span>
    </span>
  );
}
