"use client";

import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PasswordInputProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  readOnly?: boolean;
  autoHideMs?: number;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  id,
  required,
  readOnly,
  autoHideMs = 30000,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleVisibility() {
    setVisible((prev) => {
      const next = !prev;
      if (next && autoHideMs > 0) {
        hideTimerRef.current = setTimeout(() => setVisible(false), autoHideMs);
      } else if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return next;
    });
  }

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <Input
        id={id}
        type={readOnly || !visible ? "password" : "text"}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className="pr-9"
      />
      {!readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
          onClick={toggleVisibility}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="size-4 text-muted-foreground" />
          ) : (
            <Eye className="size-4 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
}
