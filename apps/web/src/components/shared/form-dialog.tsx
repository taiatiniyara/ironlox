"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: ReactNode;
  children?: ReactNode;
  onCancel?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  submitLoading?: boolean;
  submitLoadingLabel?: string;
  submitDisabled?: boolean;
  variant?: "default" | "destructive";
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  onCancel,
  onSubmit,
  submitLabel,
  submitLoading = false,
  submitLoadingLabel,
  submitDisabled = false,
  variant = "default",
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {children}
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={onCancel ?? (() => onOpenChange(false))}
            >
              Cancel
            </Button>
            <Button type="submit" variant={variant} disabled={submitLoading || submitDisabled}>
              {submitLoading ? (submitLoadingLabel ?? "Saving...") : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
