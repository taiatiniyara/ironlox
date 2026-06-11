"use client";

import { useState } from "react";
import { generateRecoveryKey } from "@ironlox/crypto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Copy, Download, Shield } from "lucide-react";
import { toast } from "sonner";

interface RecoveryKeyDisplayProps {
  onAcknowledged: (key: string) => void;
}

export function RecoveryKeyDisplay({ onAcknowledged }: RecoveryKeyDisplayProps) {
  const [key] = useState(() => generateRecoveryKey());
  const [confirmed, setConfirmed] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(key);
    toast.success("Recovery key copied to clipboard");
  }

  function handleDownload() {
    const blob = new Blob([`Ironlox Recovery Key\n\n${key}\n\nSave this key in a secure location. You will need it to recover your account if you lose your master password.`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ironlox-recovery-key.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Recovery key downloaded");
  }

  function handleContinue() {
    if (!confirmed) return;
    localStorage.setItem("ironlox_recovery_key", key);
    onAcknowledged(key);
  }

  // If already saved, show the key read-only
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
          <Shield className="size-6 text-primary" />
        </div>
        <CardTitle>Save Your Recovery Key</CardTitle>
        <CardDescription>
          This is the only way to recover your vault if you forget your master password.
          Ironlox cannot recover it for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-3">
          <Input
            value={key}
            readOnly
            className="font-mono text-xs text-center border-0 bg-transparent h-auto py-2 tracking-wider"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" size="sm" onClick={handleCopy}>
            <Copy className="size-3.5 mr-1" /> Copy
          </Button>
          <Button variant="outline" className="flex-1" size="sm" onClick={handleDownload}>
            <Download className="size-3.5 mr-1" /> Download
          </Button>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="confirm-recovery"
            checked={confirmed}
            onCheckedChange={(c) => setConfirmed(!!c)}
          />
          <Label htmlFor="confirm-recovery" className="text-xs text-muted-foreground leading-relaxed">
            I have saved my recovery key in a secure location. I understand that if I lose both my master password and recovery key, my data is irretrievably gone.
          </Label>
        </div>

        <Button
          className="w-full"
          disabled={!confirmed}
          onClick={handleContinue}
        >
          Continue to Vault
        </Button>
      </CardContent>
    </Card>
  );
}

export function RecoverFromKey({ onBack }: { onBack: () => void }) {
  const [key, setKey] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Recovery key login goes here - calls API
    toast.error("Recovery key login coming soon");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Recover Your Account</CardTitle>
        <CardDescription>Enter your 32-character recovery key</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-key">Recovery Key</Label>
            <Input
              id="recovery-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your recovery key"
              className="font-mono text-xs"
            />
          </div>
          <Button type="submit" className="w-full" disabled={key.length < 32}>
            Recover Vault
          </Button>
          <Button variant="ghost" className="w-full" onClick={onBack} type="button">
            Back to sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
