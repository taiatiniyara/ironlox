"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface UriManagerProps {
  uris: string[];
  onChange: (uris: string[]) => void;
  maxUris?: number;
}

export function UriManager({ uris, onChange, maxUris = 3 }: UriManagerProps) {
  const [newUri, setNewUri] = useState("");

  function addUri() {
    if (!newUri || uris.length >= maxUris) return;
    onChange([...uris, newUri]);
    setNewUri("");
  }

  function removeUri(index: number) {
    onChange(uris.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">URIs ({uris.length}/{maxUris})</Label>
      {uris.map((uri, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={uri}
            onChange={(e) => {
              const updated = [...uris];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            placeholder="https://example.com"
            className="text-xs h-8"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => removeUri(i)}
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      {uris.length < maxUris && (
        <div className="flex items-center gap-2">
          <Input
            value={newUri}
            onChange={(e) => setNewUri(e.target.value)}
            placeholder="Add URI..."
            className="text-xs h-8"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUri())}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={addUri}
            disabled={!newUri}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
