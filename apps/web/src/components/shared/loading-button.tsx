"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  loading: boolean;
  loadingText?: string;
}

export function LoadingButton({
  loading,
  loadingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <Loader2 className="size-4 mr-2 animate-spin" />
          {loadingText ?? "Loading..."}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
