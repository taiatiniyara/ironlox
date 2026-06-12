"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function MfaPage() {
  usePageTitle("Two-Factor Auth");
  const { apiClient } = useVault();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const storedEmail =
    typeof window !== "undefined" ? sessionStorage.getItem("ironlox_mfa_email") : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient || !code || !storedEmail) return;
    setLoading(true);
    try {
      const tempData = JSON.parse(localStorage.getItem("ironlox_mfa_temp") ?? "{}");
      if (!tempData.tempToken) {
        toast.error("Session expired. Please sign in again.");
        router.push("/login");
        return;
      }
      const verifyResponse = await apiClient.mfaVerify({
        code,
        email: storedEmail,
        tempToken: tempData.tempToken,
      });
      localStorage.removeItem("ironlox_mfa_temp");
      sessionStorage.removeItem("ironlox_mfa_email");

      apiClient.setTokens(verifyResponse.accessToken, verifyResponse.refreshToken);
      localStorage.setItem("ironlox_access_token", verifyResponse.accessToken);
      localStorage.setItem("ironlox_refresh_token", verifyResponse.refreshToken);
      localStorage.setItem("ironlox_email", storedEmail);

      toast.success("Verification successful");
      router.push("/vault");
    } catch (err) {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? "Invalid verification code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
          <Shield className="size-6 text-primary" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {storedEmail && (
            <p className="text-sm text-center text-muted-foreground">{storedEmail}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="font-mono text-center text-2xl tracking-widest"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
