"use client";

import { BRAND } from "@/lib/brand";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 font-extrabold text-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {BRAND.mark}
    </span>
  );
}

export function LogoFull({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2 font-extrabold text-lg">
      <LogoMark size={size} />
      <span>
        {BRAND.name.replace("+", "")}
        <span className="text-brand">+</span>
      </span>
    </span>
  );
}
