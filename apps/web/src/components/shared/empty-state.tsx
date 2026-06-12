"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-4">
      <div className="rounded-full bg-muted p-4 mb-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
      {action}
    </div>
  );
}
