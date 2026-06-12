"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({ title, backHref = "/vault", backLabel }: PageHeaderProps) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.push(backHref)}
        aria-label={backLabel ?? "Back"}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <h1 className="text-lg font-semibold">{title}</h1>
    </div>
  );
}
