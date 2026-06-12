"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
  label?: string;
  autoHideMs?: number;
}

export function CopyButton({ value, label, autoHideMs = 60000 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }, [value]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), autoHideMs);
    return () => clearTimeout(timer);
  }, [copied, autoHideMs]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs transition-all duration-150"
      onClick={copy}
    >
      {copied ? (
        <span className="flex items-center gap-1 animate-pop-in">
          <Check className="size-3 text-green-500" />
          {label && <span className="text-green-500">{label}</span>}
        </span>
      ) : (
        <>
          <Copy className="size-3" />
          {label}
        </>
      )}
    </Button>
  );
}
