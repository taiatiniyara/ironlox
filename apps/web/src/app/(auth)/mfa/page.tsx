"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { AuthFormCard } from "@/components/shared/auth-form-card";
import { FormField } from "@/components/shared/form-field";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
    <AuthFormCard
      title="Two-Factor Authentication"
      description="Enter the 6-digit code from your authenticator app"
      icon={Shield}
      onSubmit={handleSubmit}
      footer={
        <p className="pt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {storedEmail && <p className="text-sm text-center text-muted-foreground">{storedEmail}</p>}
      <FormField id="code" label="Verification Code">
        <Input
          id="code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          maxLength={6}
          className="font-mono text-center text-2xl tracking-widest"
        />
      </FormField>
      <LoadingButton
        type="submit"
        className="w-full"
        loading={loading}
        loadingText="Verifying..."
        disabled={code.length !== 6}
      >
        Verify & Continue
      </LoadingButton>
    </AuthFormCard>
  );
}
