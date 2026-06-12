"use client";

import type { LucideIcon } from "lucide-react";

interface HeroIconProps {
  icon: LucideIcon;
}

export function HeroIcon({ icon: Icon }: HeroIconProps) {
  return (
    <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
      <Icon className="size-6 text-primary" />
    </div>
  );
}
