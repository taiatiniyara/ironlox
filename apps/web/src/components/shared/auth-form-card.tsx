"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroIcon } from "./hero-icon";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AuthFormCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
}

export function AuthFormCard({
  title,
  description,
  icon: Icon,
  children,
  footer,
  onSubmit,
}: AuthFormCardProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        {Icon && <HeroIcon icon={Icon} />}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
        </form>
        {footer}
      </CardContent>
    </Card>
  );
}
