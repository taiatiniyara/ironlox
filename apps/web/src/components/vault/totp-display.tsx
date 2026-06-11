"use client";

import { useState, useEffect, useCallback } from "react";
import { generateTotp } from "@ironlox/crypto";
import { CopyButton } from "@/components/shared/copy-button";

interface TotpDisplayProps {
  secret: string;
}

export function TotpDisplay({ secret }: TotpDisplayProps) {
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);

  const refresh = useCallback(async () => {
    try {
      const totp = await generateTotp(secret);
      setCode(totp);
    } catch {
      setCode("invalid");
    }
    setSecondsLeft(30);
  }, [secret]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          refresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!secret || code === "invalid") return null;

  return (
    <div className="flex items-center gap-2">
      <div className="font-mono text-lg tracking-wider tabular-nums">{code}</div>
      <div className="flex items-center gap-1">
        <div className="size-4 rounded-full border-2 border-muted-foreground/30 relative">
          <div
            className="absolute inset-0 rounded-full border-2 border-primary"
            style={{
              clipPath: `inset(0 ${((secondsLeft / 30) * 100).toFixed(0)}% 0 0)`,
            }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums w-6">
          {secondsLeft}
        </span>
      </div>
      <CopyButton value={code} />
    </div>
  );
}
