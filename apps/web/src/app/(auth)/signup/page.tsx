"use client";

import { useState, useCallback } from "react";
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
import { AlertTriangle } from "lucide-react";
import zxcvbn from "zxcvbn";

function StrengthBar({ strength, label }: { strength: number; label: string }) {
  const colors = ["bg-destructive", "bg-destructive/60", "bg-yellow-500", "bg-green-500"];
  return (
    <div className="flex items-center gap-1 mt-2">
      {[0, 1, 2, 3].map((level) => (
        <div
          key={level}
          className={`h-1 flex-1 rounded transition-all duration-500 ${level < strength ? colors[strength - 1] : "bg-border"}`}
        />
      ))}
      <span className="text-[10px] text-muted-foreground ml-2 w-10">{label}</span>
    </div>
  );
}

async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function checkHibpBreach(password: string): Promise<number> {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!res.ok) return 0;
  const text = await res.text();
  for (const line of text.split("\n")) {
    const [h, count] = line.split(":");
    if (h?.trim() === suffix) return parseInt(count ?? "0", 10);
  }
  return 0;
}

const strengthLabels = ["weak", "fair", "good", "strong"] as const;

export default function SignupPage() {
  usePageTitle("Create Account");
  const { t } = useTranslation();
  const { register } = useVault();
  const router = useRouter();
  const [step, setStep] = useState<"form" | "recovery">("form");
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [strength, setStrength] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hibpChecking, setHibpChecking] = useState(false);
  const [hibpBreachCount, setHibpBreachCount] = useState(0);

  const checkStrength = useCallback(
    (password: string) => {
      setMasterPassword(password);
      if (!password) {
        setStrength(0);
        setStrengthLabel("");
        return;
      }
      const result = zxcvbn(password);
      const s = Math.min(result.score + 1, 4);
      setStrength(s);
      setStrengthLabel(t(`auth.passwordStrength.${strengthLabels[result.score]}`) ?? "");
    },
    [t],
  );

  async function handleHibpCheck(password: string) {
    if (password.length < 4) return;
    setHibpChecking(true);
    try {
      const count = await checkHibpBreach(password);
      setHibpBreachCount(count);
      if (count > 0) {
        setError(t("auth.passwordBreached", { count: count.toLocaleString() }));
      } else {
        setError("");
      }
    } catch {
      setError("");
    } finally {
      setHibpChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (hibpBreachCount > 0) {
      setError(t("auth.passwordBreachedWarning"));
      return;
    }
    if (strength < 3) {
      setError(t("auth.passwordTooWeak"));
      return;
    }
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
          onChange={(e) => {
            checkStrength(e.target.value);
            handleHibpCheck(e.target.value);
          }}
          placeholder={t("auth.minCharsRecommend")}
        />
        {masterPassword && <StrengthBar strength={strength} label={strengthLabel} />}
        {hibpChecking && (
          <p className="text-[10px] text-muted-foreground mt-1 animate-pulse">
            {t("auth.checkingBreach")}
          </p>
        )}
        {!hibpChecking && hibpBreachCount > 0 && (
          <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            {t("auth.passwordBreached", { count: hibpBreachCount.toLocaleString() })}
          </p>
        )}
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
