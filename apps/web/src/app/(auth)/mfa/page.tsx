"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { useMfaVerifyMutation } from "@/hooks/mutations/use-mfa-verify";
import { AuthFormCard } from "@/components/shared/auth-form-card";
import { FormField } from "@/components/shared/form-field";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export default function MfaPage() {
  usePageTitle("Two-Factor Auth");
  const { t } = useTranslation();
  const { apiClient } = useVault();
  const router = useRouter();
  const [code, setCode] = useState("");

  const mfaVerifyMutation = useMfaVerifyMutation();

  const storedEmail =
    typeof window !== "undefined" ? sessionStorage.getItem("ironlox_mfa_email") : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient || !code || !storedEmail) return;
    const tempData = JSON.parse(localStorage.getItem("ironlox_mfa_temp") ?? "{}");
    if (!tempData.tempToken) {
      toast.error(t("mfa.sessionExpired"));
      router.push("/login");
      return;
    }
    mfaVerifyMutation.mutate(
      { code, email: storedEmail, tempToken: tempData.tempToken },
      {
        onSuccess: (verifyResponse) => {
          localStorage.removeItem("ironlox_mfa_temp");
          sessionStorage.removeItem("ironlox_mfa_email");
          apiClient.setTokens(verifyResponse.accessToken, verifyResponse.refreshToken);
          localStorage.setItem("ironlox_access_token", verifyResponse.accessToken);
          localStorage.setItem("ironlox_refresh_token", verifyResponse.refreshToken);
          localStorage.setItem("ironlox_email", storedEmail);
          toast.success(t("mfa.verified"));
          router.push("/vault");
        },
        onError: (err) => {
          const apiErr = err as { message?: string };
          toast.error(apiErr.message ?? t("mfa.invalidCode"));
        },
      },
    );
  }

  return (
    <AuthFormCard
      title={t("mfa.title")}
      description={t("mfa.desc")}
      icon={Shield}
      onSubmit={handleSubmit}
      footer={
        <p className="pt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            {t("mfa.backToSignIn")}
          </Link>
        </p>
      }
    >
      {storedEmail && <p className="text-sm text-center text-muted-foreground">{storedEmail}</p>}
      <FormField id="code" label={t("mfa.code")}>
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
        loading={mfaVerifyMutation.isPending}
        loadingText={t("mfa.verifying")}
        disabled={code.length !== 6}
      >
        {t("mfa.verify")}
      </LoadingButton>
    </AuthFormCard>
  );
}
