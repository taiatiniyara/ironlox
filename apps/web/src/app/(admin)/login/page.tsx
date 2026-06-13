"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/admin-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAdmin();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;

    setLoading(true);
    try {
      await login(secret.trim());
      router.push("/admin/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">Enter the admin secret to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={loading || !secret.trim()}>
            {loading ? "Verifying..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
