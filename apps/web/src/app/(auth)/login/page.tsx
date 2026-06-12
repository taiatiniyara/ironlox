"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { AuthFormCard } from "@/components/shared/auth-form-card";
import { FormField } from "@/components/shared/form-field";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  usePageTitle("Sign In");
  const { t } = useTranslation();
  const { login } = useVault();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const mfaRequired = await login(email, masterPassword);
      if (mfaRequired) {
        sessionStorage.setItem("ironlox_mfa_email", email);
        router.push("/mfa");
        return;
      }
      toast.success(t("auth.vaultUnlocked"));
      router.push("/vault");
    } catch (err) {
      const apiErr = err as { message?: string };
      const msg = apiErr.message ?? t("auth.invalidEmailOrPassword");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormCard
      title={t("auth.signIn")}
      description={t("app.tagline")}
      onSubmit={handleSubmit}
      footer={
        <div className="pt-4 space-y-1">
          <p className="text-center text-xs text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/signup" className="text-primary hover:underline">
              {t("auth.createOne")}
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Lost your master password?{" "}
            <Link href="/recover" className="text-primary hover:underline">
              Use recovery key
            </Link>
          </p>
        </div>
      }
    >
      <FormField id="email" label={t("auth.email")}>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
        />
      </FormField>
      <FormField id="password" label={t("auth.masterPassword")}>
        <Input
          id="password"
          type="password"
          required
          value={masterPassword}
          onChange={(e) => setMasterPassword(e.target.value)}
          placeholder={t("auth.passwordPlaceholder")}
        />
      </FormField>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <LoadingButton
        type="submit"
        className="w-full"
        loading={loading}
        loadingText={t("auth.unlocking")}
      >
        {t("auth.unlockVault")}
      </LoadingButton>
    </AuthFormCard>
  );
}
