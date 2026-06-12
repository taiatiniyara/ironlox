"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  id?: string;
  label: string;
  error?: string;
  children?: React.ReactNode;
  className?: string;
}

export function FormField({ id, label, error, children, className }: FormFieldProps) {
  return (
    <div className={className ?? "space-y-2"}>
      {id ? <Label htmlFor={id}>{label}</Label> : <Label>{label}</Label>}
      {children ?? (id ? <Input id={id} /> : <Input />)}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
