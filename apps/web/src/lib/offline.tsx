"use client";

import { useEffect, useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      onlineManager.setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
      onlineManager.setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="sticky top-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
      <WifiOff className="size-3.5" />
      You&apos;re offline. Read-only mode — changes won&apos;t sync until you reconnect.
    </div>
  );
}
