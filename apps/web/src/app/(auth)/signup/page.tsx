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
import { RecoveryKeyDisplay } from "@/components/vault/recovery-key";
import { toast } from "sonner";

function StrengthBar({ strength }: { strength: number }) {
  const { t } = useTranslation();
  const labels = [
    t("auth.passwordStrength.weak"),
    t("auth.passwordStrength.fair"),
    "Good",
    t("auth.passwordStrength.strong"),
  ];
  const colors = ["bg-destructive", "bg-destructive/60", "bg-yellow-500", "bg-green-500"];
  return (
    <div className="flex items-center gap-1 mt-2">
      {[0, 1, 2, 3].map((level) => (
        <div
          key={level}
          className={`h-1 flex-1 rounded transition-all duration-500 ${level < strength ? colors[strength - 1] : "bg-border"}`}
        />
      ))}
      <span className="text-[10px] text-muted-foreground ml-2 w-10">
        {strength > 0 ? labels[strength - 1] : ""}
      </span>
    </div>
  );
}

export default function SignupPage() {
  usePageTitle("Create Account");
  const { t } = useTranslation();
  const { register } = useVault();
  const router = useRouter();
  const [step, setStep] = useState<"form" | "recovery">("form");
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [strength, setStrength] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function checkStrength(password: string) {
    setMasterPassword(password);
    if (password.length >= 12) setStrength(4);
    else if (password.length >= 8) setStrength(3);
    else if (password.length >= 6) setStrength(2);
    else if (password.length >= 4) setStrength(1);
    else setStrength(0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, masterPassword);
      toast.success(t("auth.accountCreated"));
      setStep("recovery");
    } catch (err) {
      const apiErr = err as { message?: string };
      const msg = apiErr.message ?? t("auth.registrationFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (step === "recovery") {
    return <RecoveryKeyDisplay onAcknowledged={() => router.push("/vault")} />;
  }

  return (
    <AuthFormCard
      title={t("auth.createAccount")}
      description={t("app.tagline")}
      onSubmit={handleSubmit}
      footer={
        <p className="pt-4 text-center text-xs text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("auth.signInAction")}
          </Link>
        </p>
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
          onChange={(e) => checkStrength(e.target.value)}
          placeholder={t("auth.minCharsRecommend")}
        />
        {masterPassword && <StrengthBar strength={strength} />}
      </FormField>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <LoadingButton
        type="submit"
        className="w-full"
        loading={loading}
        loadingText={t("auth.loading")}
      >
        {t("auth.createAccount")}
      </LoadingButton>
    </AuthFormCard>
  );
}
